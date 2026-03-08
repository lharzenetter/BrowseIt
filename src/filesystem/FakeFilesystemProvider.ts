/**
 * FakeFilesystemProvider — a fully in-memory implementation of FilesystemProvider.
 *
 * Designed for two use-cases:
 *
 *   1. **Performance & integration tests** — populate a virtual tree with any
 *      number of entries (including 1 million) and exercise the full UI without
 *      touching the real filesystem.
 *
 *   2. **Interactive dev mode** — start the app with `VITE_FAKE_FS=true` to
 *      explore/test the UI on a pre-built virtual tree.
 *
 * ── Virtual tree structure ───────────────────────────────────────────────────
 *
 *   /fake                       root of the virtual filesystem
 *   /fake/Documents             pre-built "home directory"
 *   /fake/Documents/<dir-0…N>   generated sub-directories
 *   /fake/Documents/<dir-N>/<file-0…M>   generated files inside each dir
 *
 * The exact layout is controlled via `FakeFilesystemOptions`.
 *
 * ── Performance notes ────────────────────────────────────────────────────────
 *
 *   - The tree is built lazily on first `listDirectory()` call for each path
 *     so construction cost is amortised.
 *   - 1 million entries are distributed across multiple directories so that
 *     `listDirectory` on the root only returns the top-level dirs, not all 1M.
 *     Call `listDirectory('/fake/Documents/dir-0')` to get a large flat list.
 *   - A dedicated `flatDirectory` path (`/fake/Documents/__flat__`) exposes ALL
 *     entries in a single directory listing — perfect for stress-testing the
 *     FileList renderer.
 */

import type { FilesystemProvider } from './FilesystemProvider';
import type { FileEntry, DiskInfo, AppSettings, SearchResult } from '../types';

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

export interface FakeFilesystemOptions {
  /**
   * Total number of file entries to generate.
   * Default: 1_000_000
   */
  totalFiles?: number;

  /**
   * How many top-level sub-directories to create under the fake home dir.
   * Files are distributed evenly across them.
   * Default: 100
   */
  topLevelDirs?: number;

  /**
   * Seed used for deterministic "random" data.  Pass the same seed to get the
   * same tree across test runs.
   * Default: 42
   */
  seed?: number;

  /**
   * If true, a special `/fake/Documents/__flat__` directory is created that
   * contains ALL files in a single listing.  Useful for worst-case render tests.
   * Default: true
   */
  includeFlatDirectory?: boolean;
}

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

const EXTENSIONS = [
  'ts', 'tsx', 'js', 'jsx', 'css', 'html', 'json', 'md', 'txt', 'png',
  'jpg', 'svg', 'pdf', 'zip', 'mp4', 'mp3', 'rs', 'toml', 'yaml', 'sh',
];

const DIR_NAMES = [
  'Documents', 'Downloads', 'Pictures', 'Music', 'Videos', 'Projects',
  'Work', 'Personal', 'Archive', 'Backups', 'Code', 'Design', 'Notes',
  'Reports', 'Invoices', 'Contracts', 'Data', 'Logs', 'Config', 'Temp',
];

/** Minimal seeded pseudo-random number generator (mulberry32). */
function makePrng(seed: number) {
  let s = seed;
  return () => {
    s |= 0;
    s = (s + 0x6d2b79f5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickExt(rng: () => number): string {
  return EXTENSIONS[Math.floor(rng() * EXTENSIONS.length)];
}

function makeFileName(index: number, rng: () => number): string {
  const ext = pickExt(rng);
  return `file-${index.toString().padStart(7, '0')}.${ext}`;
}

function makeDirName(index: number): string {
  const base = DIR_NAMES[index % DIR_NAMES.length];
  const suffix = Math.floor(index / DIR_NAMES.length);
  return suffix === 0 ? `${base}` : `${base}-${suffix}`;
}

function makeFileEntry(
  name: string,
  path: string,
  isDir: boolean,
  size: number,
  modified: number,
): FileEntry {
  const extension = isDir ? '' : (name.split('.').pop() ?? '');
  return {
    name,
    path,
    is_dir: isDir,
    is_hidden: false,
    is_symlink: false,
    size,
    modified,
    created: modified - 86400 * 1000,
    extension,
    permissions: isDir ? 'drwxr-xr-x' : '-rw-r--r--',
  };
}

// ---------------------------------------------------------------------------
// FakeFilesystemProvider
// ---------------------------------------------------------------------------

export class FakeFilesystemProvider implements FilesystemProvider {
  private readonly opts: Required<FakeFilesystemOptions>;
  private readonly rng: () => number;

  /** Lazily-built directory listings. */
  private readonly dirCache = new Map<string, FileEntry[]>();

  /** Flat map from path → FileEntry for quick look-ups. */
  private readonly entryIndex = new Map<string, FileEntry>();

  private pinnedPaths: string[] = [];
  private settings: AppSettings = {
    terminal: 'Terminal',
    custom_context_actions: [],
    show_hidden: false,
    hidden_home_paths: [],
  };

  // Well-known virtual paths
  readonly rootPath = '/fake';
  readonly homePath = '/fake/Documents';
  readonly flatDirPath = '/fake/Documents/__flat__';

  constructor(opts: FakeFilesystemOptions = {}) {
    this.opts = {
      totalFiles: opts.totalFiles ?? 1_000_000,
      topLevelDirs: opts.topLevelDirs ?? 100,
      seed: opts.seed ?? 42,
      includeFlatDirectory: opts.includeFlatDirectory ?? true,
    };
    this.rng = makePrng(this.opts.seed);
    this._buildTree();
  }

  // ── Tree construction ──────────────────────────────────────────────────────

  private _buildTree() {
    const { totalFiles, topLevelDirs, includeFlatDirectory } = this.opts;
    const filesPerDir = Math.ceil(totalFiles / topLevelDirs);
    const baseTime = Date.now();

    // Register root and home
    const root = makeFileEntry('fake', this.rootPath, true, 0, baseTime);
    const home = makeFileEntry('Documents', this.homePath, true, 0, baseTime);
    this.entryIndex.set(this.rootPath, root);
    this.entryIndex.set(this.homePath, home);

    // Top-level dirs under home
    const topDirEntries: FileEntry[] = [];
    for (let d = 0; d < topLevelDirs; d++) {
      const dirName = makeDirName(d);
      const dirPath = `${this.homePath}/${dirName}`;
      const dirEntry = makeFileEntry(dirName, dirPath, true, 0, baseTime - d * 3600_000);
      topDirEntries.push(dirEntry);
      this.entryIndex.set(dirPath, dirEntry);

      // Build files for this sub-dir
      const fileEntries: FileEntry[] = [];
      const start = d * filesPerDir;
      const end = Math.min(start + filesPerDir, totalFiles);
      for (let f = start; f < end; f++) {
        const fname = makeFileName(f, this.rng);
        const fpath = `${dirPath}/${fname}`;
        const size = Math.floor(this.rng() * 10_000_000);
        const modified = baseTime - Math.floor(this.rng() * 365 * 86400 * 1000);
        const fe = makeFileEntry(fname, fpath, false, size, modified);
        fileEntries.push(fe);
        this.entryIndex.set(fpath, fe);
      }
      this.dirCache.set(dirPath, fileEntries);
    }

    // Optionally add the flat directory containing ALL files
    if (includeFlatDirectory) {
      const flatEntry = makeFileEntry('__flat__', this.flatDirPath, true, 0, baseTime);
      topDirEntries.push(flatEntry);
      this.entryIndex.set(this.flatDirPath, flatEntry);

      // The flat dir listing is built lazily to avoid doubling peak memory
      // usage during construction.  It will be materialised on first access.
    }

    // Cache the home listing
    this.dirCache.set(this.homePath, topDirEntries);

    // Cache root listing (just the 'Documents' entry)
    this.dirCache.set(this.rootPath, [home]);
  }

  /** Lazily build the flat directory listing (all files in a single array). */
  private _buildFlatDir(): FileEntry[] {
    const all: FileEntry[] = [];
    for (const [path, entries] of this.dirCache) {
      if (path === this.homePath || path === this.flatDirPath) continue;
      for (const e of entries) {
        if (!e.is_dir) all.push(e);
      }
    }
    this.dirCache.set(this.flatDirPath, all);
    return all;
  }

  // ── FilesystemProvider implementation ─────────────────────────────────────

  async getHomeDirectory(): Promise<string> {
    return this.homePath;
  }

  async getParentPath(path: string): Promise<string | null> {
    const lastSlash = path.lastIndexOf('/');
    if (lastSlash <= 0) return null;
    const parent = path.slice(0, lastSlash);
    return parent || null;
  }

  async getPathComponents(path: string): Promise<Array<[string, string]>> {
    const parts = path.split('/').filter(Boolean);
    const result: Array<[string, string]> = [];
    let accumulated = '';
    for (const part of parts) {
      accumulated += '/' + part;
      result.push([part, accumulated]);
    }
    return result;
  }

  async listDirectory(path: string, _showHidden: boolean): Promise<FileEntry[]> {
    if (path === this.flatDirPath && !this.dirCache.has(this.flatDirPath)) {
      return this._buildFlatDir();
    }
    return this.dirCache.get(path) ?? [];
  }

  async openFile(_path: string): Promise<void> {
    // No-op in fake filesystem
  }

  async createDirectory(path: string): Promise<void> {
    const name = path.split('/').pop() ?? 'NewFolder';
    const parentPath = path.slice(0, path.lastIndexOf('/'));
    const entry = makeFileEntry(name, path, true, 0, Date.now());
    this.entryIndex.set(path, entry);
    const siblings = this.dirCache.get(parentPath) ?? [];
    this.dirCache.set(parentPath, [entry, ...siblings]);
    this.dirCache.set(path, []);
  }

  async createFile(path: string): Promise<void> {
    const name = path.split('/').pop() ?? 'NewFile';
    const parentPath = path.slice(0, path.lastIndexOf('/'));
    const entry = makeFileEntry(name, path, false, 0, Date.now());
    this.entryIndex.set(path, entry);
    const siblings = this.dirCache.get(parentPath) ?? [];
    this.dirCache.set(parentPath, [entry, ...siblings]);
  }

  async renameItem(oldPath: string, newPath: string): Promise<void> {
    const oldEntry = this.entryIndex.get(oldPath);
    if (!oldEntry) return;

    const newName = newPath.split('/').pop() ?? oldEntry.name;
    const newEntry: FileEntry = { ...oldEntry, name: newName, path: newPath };
    this.entryIndex.delete(oldPath);
    this.entryIndex.set(newPath, newEntry);

    const parentPath = oldPath.slice(0, oldPath.lastIndexOf('/'));
    const siblings = this.dirCache.get(parentPath) ?? [];
    this.dirCache.set(
      parentPath,
      siblings.map(e => (e.path === oldPath ? newEntry : e)),
    );
  }

  async deleteItems(paths: string[], _useTrash: boolean): Promise<void> {
    for (const path of paths) {
      const entry = this.entryIndex.get(path);
      if (!entry) continue;
      this.entryIndex.delete(path);
      const parentPath = path.slice(0, path.lastIndexOf('/'));
      const siblings = this.dirCache.get(parentPath) ?? [];
      this.dirCache.set(parentPath, siblings.filter(e => e.path !== path));
    }
  }

  async copyItems(sources: string[], destination: string): Promise<void> {
    for (const src of sources) {
      const entry = this.entryIndex.get(src);
      if (!entry) continue;
      const destPath = `${destination}/${entry.name}`;
      const newEntry: FileEntry = { ...entry, path: destPath };
      this.entryIndex.set(destPath, newEntry);
      const siblings = this.dirCache.get(destination) ?? [];
      this.dirCache.set(destination, [...siblings, newEntry]);
    }
  }

  async moveItems(sources: string[], destination: string): Promise<void> {
    for (const src of sources) {
      const entry = this.entryIndex.get(src);
      if (!entry) continue;
      const destPath = `${destination}/${entry.name}`;
      const newEntry: FileEntry = { ...entry, path: destPath };
      this.entryIndex.delete(src);
      this.entryIndex.set(destPath, newEntry);

      const srcParent = src.slice(0, src.lastIndexOf('/'));
      const srcSiblings = this.dirCache.get(srcParent) ?? [];
      this.dirCache.set(srcParent, srcSiblings.filter(e => e.path !== src));

      const destSiblings = this.dirCache.get(destination) ?? [];
      this.dirCache.set(destination, [...destSiblings, newEntry]);
    }
  }

  async searchFiles(directory: string, query: string, maxResults: number): Promise<SearchResult> {
    const q = query.toLowerCase();
    const results: FileEntry[] = [];

    // Search through all indexed entries whose path starts with directory
    for (const [path, entry] of this.entryIndex) {
      if (!path.startsWith(directory)) continue;
      if (entry.name.toLowerCase().includes(q)) {
        results.push(entry);
        if (results.length >= maxResults) break;
      }
    }

    return { entries: results, total: results.length };
  }

  async readTextFile(path: string): Promise<string> {
    const entry = this.entryIndex.get(path);
    if (!entry) return '';
    return `[FakeFilesystem] Contents of ${entry.name}\n\nThis is simulated file content.\nPath: ${path}\nSize: ${entry.size} bytes\n`;
  }

  async getFileInfo(path: string): Promise<FileEntry> {
    const entry = this.entryIndex.get(path);
    if (!entry) {
      // Return a minimal stub so the UI doesn't crash
      return makeFileEntry(path.split('/').pop() ?? '', path, false, 0, Date.now());
    }
    return entry;
  }

  async getQuickAccessPaths(): Promise<Array<[string, string]>> {
    return [
      ['Documents', this.homePath],
      ['Downloads', `${this.homePath}/Downloads`],
      ['Pictures', `${this.homePath}/Pictures`],
      ['Music', `${this.homePath}/Music`],
      ['Videos', `${this.homePath}/Videos`],
    ];
  }

  async getVolumes(): Promise<DiskInfo[]> {
    return [
      {
        name: 'Fake Disk',
        mount_point: this.rootPath,
        total_space: 1_000_000_000_000,
        available_space: 500_000_000_000,
      },
    ];
  }

  async getPinnedQuickAccess(): Promise<string[]> {
    return this.pinnedPaths;
  }

  async addPinnedQuickAccess(path: string): Promise<string[]> {
    if (!this.pinnedPaths.includes(path)) {
      this.pinnedPaths = [...this.pinnedPaths, path];
    }
    return this.pinnedPaths;
  }

  async removePinnedQuickAccess(path: string): Promise<string[]> {
    this.pinnedPaths = this.pinnedPaths.filter(p => p !== path);
    return this.pinnedPaths;
  }

  async getSettings(): Promise<AppSettings> {
    return { ...this.settings };
  }

  async saveSettings(settings: AppSettings): Promise<void> {
    this.settings = { ...settings };
  }

  async openNewWindow(_path: string): Promise<void> {
    // No-op
  }

  async openInTerminal(_path: string): Promise<void> {
    // No-op
  }

  async compressToZip(_paths: string[]): Promise<void> {
    // No-op
  }

  async runCustomContextAction(
    _command: string,
    _args: string,
    _path: string,
  ): Promise<void> {
    // No-op
  }
}
