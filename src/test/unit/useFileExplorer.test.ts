import { describe, it, expect, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useFileExplorer } from '../../hooks/useFileExplorer';
import { FakeFilesystemProvider } from '../../filesystem/FakeFilesystemProvider';

function makeFs() {
  return new FakeFilesystemProvider({
    totalFiles: 20,
    topLevelDirs: 3,
    includeFlatDirectory: false,
    seed: 7,
  });
}

// Wait for the hook's async init (getHomeDirectory + listDirectory) to settle
async function waitForInit(result: { current: ReturnType<typeof useFileExplorer> }) {
  await waitFor(() => {
    expect(result.current.loading).toBe(false);
    expect(result.current.currentPath).not.toBe('');
  });
}

describe('useFileExplorer', () => {
  let fs: FakeFilesystemProvider;

  beforeEach(() => {
    fs = makeFs();
  });

  // ── Initialisation ──────────────────────────────────────────────────────

  it('initialises to the home directory with entries loaded', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    expect(result.current.currentPath).toBe(fs.homePath);
    expect(result.current.entries.length).toBeGreaterThan(0);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
  });

  it('creates one tab on init pointing to the home directory', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    expect(result.current.tabs).toHaveLength(1);
    expect(result.current.tabs[0].path).toBe(fs.homePath);
  });

  // ── Navigation ──────────────────────────────────────────────────────────

  it('navigateTo changes currentPath and loads new entries', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const subDir = result.current.entries.find(e => e.is_dir);
    expect(subDir).toBeDefined();

    await act(async () => {
      await result.current.navigateTo(subDir!.path);
    });

    expect(result.current.currentPath).toBe(subDir!.path);
  });

  it('goBack returns to the previous directory', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const home = result.current.currentPath;
    const subDir = result.current.entries.find(e => e.is_dir)!;

    await act(async () => { await result.current.navigateTo(subDir.path); });
    await act(async () => { await result.current.goBack(); });

    expect(result.current.currentPath).toBe(home);
  });

  it('goForward re-applies navigation after goBack', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const subDir = result.current.entries.find(e => e.is_dir)!;
    await act(async () => { await result.current.navigateTo(subDir.path); });
    await act(async () => { await result.current.goBack(); });
    await act(async () => { await result.current.goForward(); });

    expect(result.current.currentPath).toBe(subDir.path);
  });

  it('goUp navigates to the parent directory', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const subDir = result.current.entries.find(e => e.is_dir)!;
    await act(async () => { await result.current.navigateTo(subDir.path); });
    await act(async () => { await result.current.goUp(); });

    expect(result.current.currentPath).toBe(fs.homePath);
  });

  // ── Selection ───────────────────────────────────────────────────────────

  it('toggleSelection adds a path to selectedPaths', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const path = result.current.entries[0].path;
    act(() => { result.current.toggleSelection(path, false); });

    expect(result.current.selectedPaths.has(path)).toBe(true);
  });

  it('toggleSelection deselects an already-selected path', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const path = result.current.entries[0].path;
    act(() => { result.current.toggleSelection(path, false); });
    act(() => { result.current.toggleSelection(path, true); }); // multi=true keeps others

    expect(result.current.selectedPaths.has(path)).toBe(false);
  });

  it('selectAll selects every visible entry', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    act(() => { result.current.selectAll(); });

    expect(result.current.selectedPaths.size).toBe(result.current.entries.length);
  });

  it('clearSelection empties selectedPaths', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    act(() => { result.current.selectAll(); });
    act(() => { result.current.clearSelection(); });

    expect(result.current.selectedPaths.size).toBe(0);
  });

  // ── Sorting ─────────────────────────────────────────────────────────────

  it('toggleSort switches the sort field and defaults to asc', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    act(() => { result.current.toggleSort('size'); });

    expect(result.current.sortField).toBe('size');
    expect(result.current.sortDirection).toBe('asc');
  });

  it('toggleSort on the same field reverses direction', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    act(() => { result.current.toggleSort('name'); }); // already 'name', direction toggles
    expect(result.current.sortDirection).toBe('desc');

    act(() => { result.current.toggleSort('name'); });
    expect(result.current.sortDirection).toBe('asc');
  });

  it('entries are sorted with directories first', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const entries = result.current.entries;
    const firstFileIdx = entries.findIndex(e => !e.is_dir);
    const lastDirIdx = entries.map(e => e.is_dir).lastIndexOf(true);

    // All dirs appear before the first file
    if (firstFileIdx !== -1 && lastDirIdx !== -1) {
      expect(lastDirIdx).toBeLessThan(firstFileIdx);
    }
  });

  // ── Clipboard ───────────────────────────────────────────────────────────

  it('copyToClipboard sets operation to "copy"', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const path = result.current.entries[0].path;
    act(() => { result.current.copyToClipboard([path]); });

    expect(result.current.clipboard).toEqual({ paths: [path], operation: 'copy' });
  });

  it('cutToClipboard sets operation to "cut"', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const path = result.current.entries[0].path;
    act(() => { result.current.cutToClipboard([path]); });

    expect(result.current.clipboard).toEqual({ paths: [path], operation: 'cut' });
  });

  it('paste copies items and refreshes directory', async () => {
    // Seed a file directly in home so it's available on init
    await fs.createFile(`${fs.homePath}/paste-source.txt`);
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const file = result.current.entries.find(e => !e.is_dir)!;
    const destDir = result.current.entries.find(e => e.is_dir)!;

    act(() => { result.current.copyToClipboard([file.path]); });
    await act(async () => { await result.current.navigateTo(destDir.path); });
    await act(async () => { await result.current.paste(); });

    expect(result.current.entries.some(e => e.name === file.name)).toBe(true);
  });

  // ── Tabs ────────────────────────────────────────────────────────────────

  it('addTab creates a new tab', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    await act(async () => { await result.current.addTab(); });

    expect(result.current.tabs).toHaveLength(2);
  });

  it('closeTab removes the tab', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    await act(async () => { await result.current.addTab(); });
    const tabToClose = result.current.tabs[1];

    act(() => { result.current.closeTab(tabToClose.id); });

    expect(result.current.tabs.find(t => t.id === tabToClose.id)).toBeUndefined();
  });

  it('closeTab does not remove the last tab', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    const lastTab = result.current.tabs[0];
    act(() => { result.current.closeTab(lastTab.id); });

    expect(result.current.tabs).toHaveLength(1);
  });

  // ── Search ──────────────────────────────────────────────────────────────

  it('search returns results for a matching query', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    await act(async () => { await result.current.search('file'); });

    expect(result.current.searchResults).not.toBeNull();
  });

  it('search with empty query clears results', async () => {
    const { result } = renderHook(() => useFileExplorer(fs));
    await waitForInit(result);

    await act(async () => { await result.current.search('file'); });
    await act(async () => { await result.current.search(''); });

    expect(result.current.searchResults).toBeNull();
  });
});
