import { useState, useCallback, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { FileEntry, Tab, ClipboardData, SortField, SortDirection, ViewMode } from '../types';

let tabIdCounter = 1;

function generateTabId(): string {
  return `tab-${tabIdCounter++}`;
}

export function useFileExplorer() {
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
  const [volumes, setVolumes] = useState<{ name: string; mount_point: string }[]>([]);

  // Initialize
  useEffect(() => {
    const init = async () => {
      try {
        const home = await invoke<string>('get_home_directory');
        const qaPaths = await invoke<[string, string][]>('get_quick_access_paths');
        const vols = await invoke<{ name: string; mount_point: string }[]>('get_volumes');
        setQuickAccessPaths(qaPaths);
        setVolumes(vols);

        const tabId = generateTabId();
        setTabs([{ id: tabId, path: home, label: 'Home' }]);
        setActiveTabId(tabId);
        await navigateTo(home, true);
      } catch (e) {
        setError(String(e));
      }
    };
    init();
  }, []);

  const loadDirectory = useCallback(async (path: string) => {
    setLoading(true);
    setError(null);
    setSearchResults(null);
    setSearchQuery('');
    try {
      const result = await invoke<FileEntry[]>('list_directory', {
        path,
        showHidden,
      });
      setEntries(result);
      setCurrentPath(path);
      setSelectedPaths(new Set());
      setPreviewEntry(null);
    } catch (e) {
      setError(String(e));
    } finally {
      setLoading(false);
    }
  }, [showHidden]);

  const navigateTo = useCallback(async (path: string, replace = false) => {
    await loadDirectory(path);
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
    const parent = await invoke<string | null>('get_parent_path', { path: currentPath });
    if (parent) {
      await navigateTo(parent);
    }
  }, [currentPath, navigateTo]);

  const refresh = useCallback(async () => {
    await loadDirectory(currentPath);
  }, [currentPath, loadDirectory]);

  const openItem = useCallback(async (entry: FileEntry) => {
    if (entry.is_dir) {
      await navigateTo(entry.path);
    } else {
      try {
        await invoke('open_file', { path: entry.path });
      } catch (e) {
        setError(String(e));
      }
    }
  }, [navigateTo]);

  const createNewFolder = useCallback(async (name: string) => {
    try {
      const newPath = `${currentPath}/${name}`;
      await invoke('create_directory', { path: newPath });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [currentPath, refresh]);

  const createNewFile = useCallback(async (name: string) => {
    try {
      const newPath = `${currentPath}/${name}`;
      await invoke('create_file', { path: newPath });
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [currentPath, refresh]);

  const renameItem = useCallback(async (oldPath: string, newName: string) => {
    try {
      const parent = oldPath.substring(0, oldPath.lastIndexOf('/'));
      const newPath = `${parent}/${newName}`;
      await invoke('rename_item', { oldPath, newPath });
      setRenamingPath(null);
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [refresh]);

  const deleteSelected = useCallback(async (useTrash = true) => {
    try {
      const paths = Array.from(selectedPaths);
      if (paths.length === 0) return;
      await invoke('delete_items', { paths, useTrash });
      setSelectedPaths(new Set());
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [selectedPaths, refresh]);

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
        await invoke('copy_items', {
          sources: clipboard.paths,
          destination: currentPath,
        });
      } else {
        await invoke('move_items', {
          sources: clipboard.paths,
          destination: currentPath,
        });
        setClipboard(null);
      }
      await refresh();
    } catch (e) {
      setError(String(e));
    }
  }, [clipboard, currentPath, refresh]);

  const search = useCallback(async (query: string) => {
    setSearchQuery(query);
    if (!query.trim()) {
      setSearchResults(null);
      return;
    }
    setIsSearching(true);
    try {
      const result = await invoke<{ entries: FileEntry[]; total: number }>('search_files', {
        directory: currentPath,
        query: query.trim(),
        maxResults: 200,
      });
      setSearchResults(result.entries);
    } catch (e) {
      setError(String(e));
    } finally {
      setIsSearching(false);
    }
  }, [currentPath]);

  const addTab = useCallback(() => {
    const tabId = generateTabId();
    const newTab: Tab = {
      id: tabId,
      path: currentPath,
      label: currentPath.split('/').pop() || '/',
    };
    setTabs(prev => [...prev, newTab]);
    setActiveTabId(tabId);
  }, [currentPath]);

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

  const sortedEntries = useCallback((): FileEntry[] => {
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

  // Reload when showHidden changes
  useEffect(() => {
    if (currentPath) {
      loadDirectory(currentPath);
    }
  }, [showHidden]);

  return {
    currentPath,
    entries: sortedEntries(),
    loading,
    error,
    setError,
    showHidden,
    setShowHidden,
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
    volumes,
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
  };
}
