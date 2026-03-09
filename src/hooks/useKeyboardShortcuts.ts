import { useEffect } from 'react';
import type { useFileExplorer } from './useFileExplorer';

type Explorer = ReturnType<typeof useFileExplorer>;

interface UseKeyboardShortcutsOptions {
  explorer: Explorer;
  scrollToIndexRef: React.RefObject<((index: number) => void) | null>;
  closeContextMenu: () => void;
  setNewItemPrompt: (type: 'folder' | 'file' | null) => void;
}

export function useKeyboardShortcuts({
  explorer,
  scrollToIndexRef,
  closeContextMenu,
  setNewItemPrompt,
}: UseKeyboardShortcutsOptions) {
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;

      // Prevent shortcuts when typing in inputs
      if (
        e.target instanceof HTMLInputElement ||
        e.target instanceof HTMLTextAreaElement
      ) {
        return;
      }

      if (meta && e.shiftKey && e.key === 'c') {
        e.preventDefault();
        if (explorer.selectedPaths.size > 0) {
          const paths = Array.from(explorer.selectedPaths).join('\n');
          navigator.clipboard.writeText(paths);
        }
      } else if (meta && e.key === 'c') {
        e.preventDefault();
        explorer.copyToClipboard();
      } else if (meta && e.key === 'x') {
        e.preventDefault();
        explorer.cutToClipboard();
      } else if (meta && e.key === 'v') {
        e.preventDefault();
        explorer.paste();
      } else if (meta && e.key === 'a') {
        e.preventDefault();
        explorer.selectAll();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (meta) {
          e.preventDefault();
          explorer.deleteSelected(true);
        }
      } else if (e.key === 'F2' || (meta && e.key === 'Enter')) {
        e.preventDefault();
        if (explorer.selectedPaths.size === 1) {
          explorer.setRenamingPath(Array.from(explorer.selectedPaths)[0]);
        }
      } else if (meta && e.key === 'r') {
        e.preventDefault();
        explorer.refresh();
      } else if (meta && e.key === 't') {
        e.preventDefault();
        explorer.addTab();
      } else if (meta && e.key === 'w') {
        e.preventDefault();
        if (explorer.tabs.length > 1) {
          explorer.closeTab(explorer.activeTabId);
        }
      } else if (meta && e.key === '[') {
        e.preventDefault();
        explorer.goBack();
      } else if (meta && e.key === ']') {
        e.preventDefault();
        explorer.goForward();
      } else if (e.altKey && e.key === 'ArrowUp') {
        e.preventDefault();
        explorer.goUp();
      } else if (e.key === 'Enter' && !meta && !e.altKey) {
        e.preventDefault();
        if (explorer.selectedPaths.size === 1) {
          const entry = explorer.entries.find(
            e => e.path === Array.from(explorer.selectedPaths)[0]
          );
          if (entry) explorer.openItem(entry);
        }
      } else if (e.key === 'Escape') {
        explorer.clearSelection();
        closeContextMenu();
      } else if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
        e.preventDefault();
        const currentEntries = explorer.entries;
        if (currentEntries.length === 0) return;

        const currentSelected = Array.from(explorer.selectedPaths);
        let currentIndex = -1;
        if (currentSelected.length > 0) {
          currentIndex = currentEntries.findIndex(
            e => e.path === currentSelected[currentSelected.length - 1]
          );
        }

        let newIndex: number;
        if (e.key === 'ArrowDown') {
          newIndex = Math.min(currentIndex + 1, currentEntries.length - 1);
        } else {
          newIndex = Math.max(currentIndex - 1, 0);
        }

        explorer.toggleSelection(currentEntries[newIndex].path, false);
        explorer.setPreviewEntry(currentEntries[newIndex]);
        scrollToIndexRef.current?.(newIndex);
      } else if (meta && e.key === 'p') {
        e.preventDefault();
        explorer.setShowPreview(!explorer.showPreview);
      } else if (meta && e.key === 'n') {
        e.preventDefault();
        setNewItemPrompt('folder');
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [explorer, closeContextMenu, scrollToIndexRef, setNewItemPrompt]);
}
