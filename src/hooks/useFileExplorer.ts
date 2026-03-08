import { useState, useCallback, useEffect, useMemo } from 'react';
import type { FilesystemProvider } from '../filesystem/FilesystemProvider';
import type { FileEntry, Tab, ClipboardData, SortField, SortDirection, ViewMode, AppSettings } from '../types';

let tabIdCounter = 1;

function generateTabId(): string {
  return `tab-${tabIdCounter++}`;
}

export function useFileExplorer(fs: FilesystemProvider) {
  const [currentPath, setCurrentPath] = useState<string>('');
  const [entries, setEntries] = useState<FileEntry[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const [showHidden, setShowHidden] = useState(false);
  const [selectedPaths, setSelectedPaths] = useState<Set<string>>(new Set());
  const [clipboard, setClipboard] = useState<ClipboardData | null>(null);
  const [sortField, setSortField] = useState<SortField>('name');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');
  const [viewMode, setViewMode] = useState<ViewMode>('details');
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<FileEntry[] | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [tabs, setTabs] = useState<Tab[]>([]);
  const [activeTabId, setActiveTabId] = useState<string>('');
  const [previewEntry, setPreviewEntry] = useState<FileEntry | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [renamingPath, setRenamingPath] = useState<string | null>(null);
  const [quickAccessPaths, setQuickAccessPaths] = useState<[string, string][]>([]);
  const [pinnedPaths, setPinnedPaths] = useState<string[]>([]);
  const [volumes, setVolumes] = useState<{ name: string; mount_point: string }[]>([]);
  const [settings, setSettingsState] = useState<AppSettings>({ terminal: 'Terminal', custom_context_actions: [], show_hidden: false, hidden_home_paths: [] });

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const home = await fs.getHomeDirectory();
        const qaPaths = await fs.getQuickAccessPaths();
        const vols = await fs.getVolumes();
        const pinned = await fs.getPinnedQuickAccess();
        const appSettings = await fs.getSettings();
        setQuickAccessPaths(qaPaths);
        setVolumes(vols);
        setPinnedPaths(pinned);
        setSettingsState(appSettings);
        setShowHidden(appSettings.show_hidden ?? false);

        // Check if a path was passed via query param (new window)
        const params = new URLSearchParams(window.location.search);
        const initialPath = params.get('path') || home;
        const initialLabel = initialPath === home
          ? 'Home'
          : initialPath.split('/').pop() || '/';

        const tabId = generateTabId();
        setTabs([{ id: tabId, path: initialPath, label: initialLabel }]);
        setActiveTabId(tabId);
        await navigateTo(initialPath, true, appSettings.show_hidden ?? false);
      } catch (e) {
        setError(String(e));
      }
    };
    init();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const loadDirectory = useCallback(async (path: string, overrideShowHidden?: boolean) => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setSearchQuery('');
    try {
      const result = await fs.listDirectory(path, overrideShowHidden ?? showHidden);
      setEntries(result);
      setCurrentPath(path);
      setSelectedPaths(new Set());
      setPreviewEntry(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [fs, showHidden]);

  const navigateTo = useCallback(async (path: string, replace = false, overrideShowHidden?: boolean) => {
    await loadDirectory(path, overrideShowHidden);
    setHistory(prev => {
      if (replace) {
        return [path];
      }
      const newHistory = [...prev.slice(0, historyIndex + 1), path];
      return newHistory;
    });
    setHistoryIndex(prev => replace ? 0 : prev + 1);

    // Update active tab
    setTabs(prev =>
      prev.map(tab =>
        tab.id === activeTabId
          ? { ...tab, path, label: path.split('/').pop() || '/' }
          : tab
      )
    );
  }, [historyIndex, activeTabId, loadDirectory]);

  const goBack = useCallback(async () => {
    if (historyIndex > 0) {
      const newIndex = historyIndex - 1;
      setHistoryIndex(newIndex);
      await loadDirectory(history[newIndex]);
      setTabs(prev =>
        prev.map(tab =>
          tab.id === activeTabId
            ? { ...tab, path: history[newIndex], label: history[newIndex].split('/').pop() || '/' }
            : tab
        )
      );
    }
  }, [historyIndex, history, activeTabId, loadDirectory]);

  const goForward = useCallback(async () => {
    if (historyIndex < history.length - 1) {
      const newIndex = historyIndex + 1;
      setHistoryIndex(newIndex);
      await loadDirectory(history[newIndex]);
      setTabs(prev =>
        prev.map(tab =>
          tab.id === activeTabId
            ? { ...tab, path: history[newIndex], label: history[newIndex].split('/').pop() || '/' }
            : tab
        )
      );
    }
  }, [historyIndex, history, activeTabId, loadDirectory]);

  const goUp = useCallback(async () => {
    const parent = await fs.getParentPath(currentPath);
    if (parent) {
      await navigateTo(parent);
    }
  }, [fs, currentPath, navigateTo]);

  const refresh = useCallback(async () => {
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const openItem = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      await navigateTo(entry.path);
    } else {
      try {
        await fs.openFile(entry.path);
      } catch (e) {
        setError(String(e));
      }
    }
  }, [fs, navigateTo]);

  const createNewFolder = useCallback(async (name: string) => {
    try {
      const newPath = `${currentPath}/${name}`;
      await fs.createDirectory(newPath);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [fs, currentPath, refresh]);

  const createNewFile = useCallback(async (name: string) => {
    try {
      const newPath = `${currentPath}/${name}`;
      await fs.createFile(newPath);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [fs, currentPath, refresh]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    try {
      const parent = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${parent}/${newName}`;
      await fs.renameItem(oldPath, newPath);
      setRenamingPath(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [fs, refresh]);

  const deleteSelected = useCallback(async (useTrash = true) => {
    try {
      const paths = Array.from(selectedPaths);
      if (paths.length === 0) return;
      await fs.deleteItems(paths, useTrash);
      setSelectedPaths(new Set());
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [fs, selectedPaths, refresh]);

  const copyToClipboard = useCallback((paths?: string[]) => {
    const toCopy = paths || Array.from(selectedPaths);
    if (toCopy.length === 0) return;
    setClipboard({ paths: toCopy, operation: 'copy' });
  }, [selectedPaths]);

  const cutToClipboard = useCallback((paths?: string[]) => {
    const toCut = paths || Array.from(selectedPaths);
    if (toCut.length === 0) return;
    setClipboard({ paths: toCut, operation: 'cut' });
  }, [selectedPaths]);

  const paste = useCallback(async () => {
    if (!clipboard) return;
    try {
      if (clipboard.operation === 'copy') {
        await fs.copyItems(clipboard.paths, currentPath);
      } else {
        await fs.moveItems(clipboard.paths, currentPath);
        setClipboard(null);
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [fs, clipboard, currentPath, refresh]);

  const search = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const result = await fs.searchFiles(currentPath, query.trim(), 200);
      setSearchResults(result.entries);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSearching(false);
    }
  }, [fs, currentPath]);

  const pinQuickAccess = useCallback(async (path: string) => {
    try {
      const updated = await fs.addPinnedQuickAccess(path);
      setPinnedPaths(updated);
    } catch (e) {
      setError(String(e));
    }
  }, [fs]);

  const saveSettings = useCallback(async (newSettings: AppSettings) => {
    try {
      await fs.saveSettings(newSettings);
      setSettingsState(newSettings);
    } catch (e) {
      setError(String(e));
    }
  }, [fs]);

  const unpinQuickAccess = useCallback(async (path: string) => {
    try {
      const updated = await fs.removePinnedQuickAccess(path);
      setPinnedPaths(updated);
    } catch (e) {
      setError(String(e));
    }
  }, [fs]);

  const addTab = useCallback(async (targetPath?: string) => {
    const path = targetPath || currentPath;
    const tabId = generateTabId();
    const newTab: Tab = {
      id: tabId,
      path,
      label: path.split('/').pop() || '/',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
    await loadDirectory(path);
  }, [currentPath, loadDirectory]);

  const closeTab = useCallback((tabId: string) => {
    setTabs(prev => {
      const filtered = prev.filter(t => t.id !== tabId);
      if (filtered.length === 0) return prev; // Keep at least one tab
      if (tabId === activeTabId) {
        const idx = prev.findIndex(t => t.id === tabId);
        const newActive = filtered[Math.min(idx, filtered.length - 1)];
        setActiveTabId(newActive.id);
        loadDirectory(newActive.path);
      }
      return filtered;
    });
  }, [activeTabId, loadDirectory]);

  const switchTab = useCallback(async (tabId: string) => {
    const tab = tabs.find(t => t.id === tabId);
    if (tab) {
      setActiveTabId(tabId);
      await loadDirectory(tab.path);
    }
  }, [tabs, loadDirectory]);

  const toggleSelection = useCallback((path: string, multi: boolean) => {
    setSelectedPaths(prev => {
      const next = new Set(multi ? prev : []);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  }, []);

  const selectAll = useCallback(() => {
    setSelectedPaths(new Set(entries.map(e => e.path)));
  }, [entries]);

  const clearSelection = useCallback(() => {
    setSelectedPaths(new Set());
  }, []);

  // useMemo instead of useCallback: the sort result is a value, not a function.
  // This means the sort only runs when entries/sort actually change, not on every
  // render of every component that calls useFileExplorer().
  const sortedEntries = useMemo((): FileEntry[] => {
    const source = searchResults ?? entries;
    const sorted = [...source].sort((a, b) => {
      // Always keep directories first
      if (a.is_dir !== b.is_dir) return a.is_dir ? -1 : 1;

      let cmp = 0;
      switch (sortField) {
        case 'name':
          cmp = a.name.toLowerCase().localeCompare(b.name.toLowerCase());
          break;
        case 'size':
          cmp = a.size - b.size;
          break;
        case 'modified':
          cmp = (a.modified ?? 0) - (b.modified ?? 0);
          break;
        case 'extension':
          cmp = a.extension.localeCompare(b.extension);
          break;
      }
      return sortDirection === 'asc' ? cmp : -cmp;
    });
    return sorted;
  }, [entries, searchResults, sortField, sortDirection]);

  const toggleSort = useCallback((field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => (prev === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  }, [sortField]);

  const updateShowHidden = useCallback(async (value: boolean) => {
    setShowHidden(value);
    try {
      const newSettings = { ...settings, show_hidden: value };
      await fs.saveSettings(newSettings);
      setSettingsState(newSettings);
    } catch (e) {
      setError(String(e));
    }
  }, [fs, settings]);

  // Reload when showHidden changes
  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showHidden]);

  return {
    currentPath,
    entries: sortedEntries,
    loading,
    error,
    setError,
    showHidden,
    setShowHidden: updateShowHidden,
    selectedPaths,
    clipboard,
    sortField,
    sortDirection,
    viewMode,
    setViewMode,
    searchQuery,
    searchResults,
    isSearching,
    tabs,
    activeTabId,
    previewEntry,
    setPreviewEntry,
    showPreview,
    setShowPreview,
    renamingPath,
    setRenamingPath,
    quickAccessPaths,
    pinnedPaths,
    volumes,
    settings,
    saveSettings,
    pinQuickAccess,
    unpinQuickAccess,
    history,
    historyIndex,
    navigateTo,
    goBack,
    goForward,
    goUp,
    refresh,
    openItem,
    createNewFolder,
    createNewFile,
    renameItem,
    deleteSelected,
    copyToClipboard,
    cutToClipboard,
    paste,
    search,
    addTab,
    closeTab,
    switchTab,
    toggleSelection,
    selectAll,
    clearSelection,
    toggleSort,
    // Expose the provider so App.tsx can call it for commands not yet in the hook
    fs,
  };
}
