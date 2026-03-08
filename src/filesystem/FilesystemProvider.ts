/**
 * FilesystemProvider — the abstraction layer between the UI and the underlying
 * filesystem implementation.
 *
 * All UI code that previously called `invoke()` directly is now typed against
 * this interface.  Two concrete implementations exist:
 *
 *   - TauriFilesystemProvider  — production, delegates to Rust via Tauri IPC
 *   - FakeFilesystemProvider   — in-memory tree used for tests and fake-fs dev mode
 *
 * Adding a new backend (e.g. a remote FS, WASM sandbox, …) is just a matter of
 * implementing this interface.
 */

import type { FileEntry, DiskInfo, AppSettings, SearchResult } from '../types';

export interface FilesystemProvider {
  // ── Navigation ──────────────────────────────────────────────────────────────
  getHomeDirectory(): Promise<string>;
  getParentPath(path: string): Promise<string | null>;
  getPathComponents(path: string): Promise<Array<[string, string]>>;

  // ── Directory listing ────────────────────────────────────────────────────────
  listDirectory(path: string, showHidden: boolean): Promise<FileEntry[]>;

  // ── File operations ──────────────────────────────────────────────────────────
  openFile(path: string): Promise<void>;
  createDirectory(path: string): Promise<void>;
  createFile(path: string): Promise<void>;
  renameItem(oldPath: string, newPath: string): Promise<void>;
  deleteItems(paths: string[], useTrash: boolean): Promise<void>;
  copyItems(sources: string[], destination: string): Promise<void>;
  moveItems(sources: string[], destination: string): Promise<void>;

  // ── Search ───────────────────────────────────────────────────────────────────
  searchFiles(directory: string, query: string, maxResults: number): Promise<SearchResult>;

  // ── Preview ──────────────────────────────────────────────────────────────────
  readTextFile(path: string): Promise<string>;
  getFileInfo(path: string): Promise<FileEntry>;

  // ── Sidebar data ─────────────────────────────────────────────────────────────
  getQuickAccessPaths(): Promise<Array<[string, string]>>;
  getVolumes(): Promise<DiskInfo[]>;
  getPinnedQuickAccess(): Promise<string[]>;
  addPinnedQuickAccess(path: string): Promise<string[]>;
  removePinnedQuickAccess(path: string): Promise<string[]>;

  // ── Settings ─────────────────────────────────────────────────────────────────
  getSettings(): Promise<AppSettings>;
  saveSettings(settings: AppSettings): Promise<void>;

  // ── Windowing / shell ────────────────────────────────────────────────────────
  openNewWindow(path: string): Promise<void>;
  openInTerminal(path: string): Promise<void>;
  compressToZip(paths: string[]): Promise<void>;
  runCustomContextAction(command: string, args: string, path: string): Promise<void>;
}
