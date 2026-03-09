import { useCallback } from 'react';
import type { FilesystemProvider } from '../filesystem/FilesystemProvider';
import type { ContextMenuState } from '../types';
import type { useFileExplorer } from './useFileExplorer';

type Explorer = ReturnType<typeof useFileExplorer>;

interface UseContextMenuHandlersOptions {
  contextMenu: ContextMenuState;
  explorer: Explorer;
  fs: FilesystemProvider;
  closeContextMenu: () => void;
  setNewItemPrompt: (type: 'folder' | 'file' | null) => void;
}

export function useContextMenuHandlers({
  contextMenu,
  explorer,
  fs,
  closeContextMenu,
  setNewItemPrompt,
}: UseContextMenuHandlersOptions) {
  const handleContextMenuAction = useCallback((action: string) => {
    closeContextMenu();
    switch (action) {
      case 'open':
        if (contextMenu.target) explorer.openItem(contextMenu.target);
        break;
      case 'openInNewTab': {
        const tabPath = contextMenu.target
          ? (contextMenu.target.is_dir ? contextMenu.target.path : explorer.currentPath)
          : explorer.currentPath;
        explorer.addTab(tabPath);
        break;
      }
      case 'openInNewWindow': {
        const windowPath = contextMenu.target
          ? (contextMenu.target.is_dir ? contextMenu.target.path : explorer.currentPath)
          : explorer.currentPath;
        fs.openNewWindow(windowPath).catch((e: unknown) =>
          explorer.setError(String(e))
        );
        break;
      }
      case 'compressToZip': {
        const zipPaths = contextMenu.target
          ? (explorer.selectedPaths.has(contextMenu.target.path)
              ? Array.from(explorer.selectedPaths)
              : [contextMenu.target.path])
          : [];
        if (zipPaths.length > 0) {
          fs.compressToZip(zipPaths)
            .then(() => explorer.refresh())
            .catch((e: unknown) => explorer.setError(String(e)));
        }
        break;
      }
      case 'copy':
        if (contextMenu.target) {
          const paths = explorer.selectedPaths.has(contextMenu.target.path)
            ? Array.from(explorer.selectedPaths)
            : [contextMenu.target.path];
          explorer.copyToClipboard(paths);
        }
        break;
      case 'cut':
        if (contextMenu.target) {
          const paths = explorer.selectedPaths.has(contextMenu.target.path)
            ? Array.from(explorer.selectedPaths)
            : [contextMenu.target.path];
          explorer.cutToClipboard(paths);
        }
        break;
      case 'paste':
        explorer.paste();
        break;
      case 'delete':
        explorer.deleteSelected(true);
        break;
      case 'rename':
        if (contextMenu.target) {
          explorer.setRenamingPath(contextMenu.target.path);
        }
        break;
      case 'newFolder':
        setNewItemPrompt('folder');
        break;
      case 'newFile':
        setNewItemPrompt('file');
        break;
      case 'openInTerminal': {
        const terminalPath = contextMenu.target
          ? contextMenu.target.path
          : explorer.currentPath;
        fs.openInTerminal(terminalPath).catch((e: unknown) =>
          explorer.setError(String(e))
        );
        break;
      }
      case 'info':
        if (contextMenu.target) {
          explorer.setPreviewEntry(contextMenu.target);
          explorer.setShowPreview(true);
        } else {
          fs.getFileInfo(explorer.currentPath)
            .then((dirEntry) => {
              explorer.setPreviewEntry(dirEntry);
              explorer.setShowPreview(true);
            })
            .catch(() => {
              const dirName = explorer.currentPath.split('/').pop() || '/';
              explorer.setPreviewEntry({
                name: dirName,
                path: explorer.currentPath,
                is_dir: true,
                is_hidden: false,
                is_symlink: false,
                size: 0,
                modified: null,
                created: null,
                extension: '',
                permissions: '',
              });
              explorer.setShowPreview(true);
            });
        }
        break;
    }
  }, [contextMenu, explorer, fs, closeContextMenu, setNewItemPrompt]);

  return { handleContextMenuAction };
}
