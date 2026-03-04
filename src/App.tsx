import { useState, useEffect, useCallback } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { useFileExplorer } from './hooks/useFileExplorer';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { AddressBar } from './components/AddressBar';
import { TabBar } from './components/TabBar';
import { FileList } from './components/FileList';
import { ContextMenu } from './components/ContextMenu';
import { PreviewPanel } from './components/PreviewPanel';
import { StatusBar } from './components/StatusBar';
import type { ContextMenuState, FileEntry } from './types';

function App() {
  const explorer = useFileExplorer();
  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
  });
  const [newItemPrompt, setNewItemPrompt] = useState<'folder' | 'file' | null>(null);
  const [showSettings, setShowSettings] = useState(false);

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  // Keyboard shortcuts
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

      if (meta && e.key === 'c') {
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
      } else if (meta && e.key === 'p') {
        e.preventDefault();
        explorer.setShowPreview(!explorer.showPreview);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [explorer, closeContextMenu]);

  const handleContextMenuAction = (action: string) => {
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
        invoke('open_new_window', { path: windowPath }).catch((e) =>
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
          invoke('compress_to_zip', { paths: zipPaths })
            .then(() => explorer.refresh())
            .catch((e) => explorer.setError(String(e)));
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
        invoke('open_in_terminal', { path: terminalPath }).catch((e) =>
          explorer.setError(String(e))
        );
        break;
      }
      case 'info':
        if (contextMenu.target) {
          explorer.setPreviewEntry(contextMenu.target);
          explorer.setShowPreview(true);
        } else {
          // No target — show properties of the current directory
          invoke<FileEntry>('get_file_info', { path: explorer.currentPath })
            .then((dirEntry) => {
              explorer.setPreviewEntry(dirEntry);
              explorer.setShowPreview(true);
            })
            .catch(() => {
              // Fallback with basic info if command fails
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
  };

  return (
    <div className="app">
      <TabBar
        tabs={explorer.tabs}
        activeTabId={explorer.activeTabId}
        onSwitchTab={explorer.switchTab}
        onCloseTab={explorer.closeTab}
        onAddTab={explorer.addTab}
      />
      <Toolbar
        canGoBack={explorer.historyIndex > 0}
        canGoForward={explorer.historyIndex < explorer.history.length - 1}
        onGoBack={explorer.goBack}
        onGoForward={explorer.goForward}
        onGoUp={explorer.goUp}
        onRefresh={explorer.refresh}
        onNewFolder={(name) => explorer.createNewFolder(name)}
        onNewFile={(name) => explorer.createNewFile(name)}
        onDelete={() => explorer.deleteSelected(true)}
        onCopy={() => explorer.copyToClipboard()}
        onCut={() => explorer.cutToClipboard()}
        onPaste={() => explorer.paste()}
        hasSelection={explorer.selectedPaths.size > 0}
        hasClipboard={explorer.clipboard !== null}
        viewMode={explorer.viewMode}
        onViewModeChange={explorer.setViewMode}
        showHidden={explorer.showHidden}
        onToggleHidden={() => explorer.setShowHidden(!explorer.showHidden)}
        sortField={explorer.sortField}
        sortDirection={explorer.sortDirection}
        onToggleSort={explorer.toggleSort}
        onOpenSettings={() => setShowSettings(true)}
      />
      <AddressBar
        currentPath={explorer.currentPath}
        onNavigate={(path) => explorer.navigateTo(path)}
        searchQuery={explorer.searchQuery}
        onSearch={explorer.search}
        isSearching={explorer.isSearching}
        canGoBack={explorer.historyIndex > 0}
        canGoForward={explorer.historyIndex < explorer.history.length - 1}
        onGoBack={explorer.goBack}
        onGoForward={explorer.goForward}
        onGoUp={explorer.goUp}
        onRefresh={explorer.refresh}
      />
      <div className="main-area">
        <Sidebar
          quickAccessPaths={explorer.quickAccessPaths}
          pinnedPaths={explorer.pinnedPaths}
          volumes={explorer.volumes}
          currentPath={explorer.currentPath}
          onNavigate={(path) => explorer.navigateTo(path)}
          onUnpin={(path) => explorer.unpinQuickAccess(path)}
        />
        <div className="content-area">
          {explorer.error && (
            <div className="error-bar">
              <span>{explorer.error}</span>
              <button onClick={() => explorer.setError(null)}>✕</button>
            </div>
          )}
          <FileList
            entries={explorer.entries}
            selectedPaths={explorer.selectedPaths}
            viewMode={explorer.viewMode}
            sortField={explorer.sortField}
            sortDirection={explorer.sortDirection}
            renamingPath={explorer.renamingPath}
            onToggleSelection={explorer.toggleSelection}
            onOpen={explorer.openItem}
            onToggleSort={explorer.toggleSort}
            onContextMenu={setContextMenu}
            onRename={explorer.renameItem}
            onSetRenamingPath={explorer.setRenamingPath}
            onPreview={(entry) => {
              explorer.setPreviewEntry(entry);
            }}
            onDrop={async (sources, destination) => {
              try {
                await invoke('move_items', { sources, destination });
                explorer.refresh();
              } catch (e) {
                explorer.setError(String(e));
              }
            }}
            loading={explorer.loading}
          />
        </div>
        <PreviewPanel
          entry={explorer.previewEntry}
          visible={explorer.showPreview}
          onClose={() => explorer.setShowPreview(false)}
        />
      </div>
      <StatusBar
        entries={explorer.entries}
        selectedPaths={explorer.selectedPaths}
        searchResultCount={
          explorer.searchResults ? explorer.searchResults.length : null
        }
        currentPath={explorer.currentPath}
      />
      <ContextMenu
        state={contextMenu}
        onClose={closeContextMenu}
        onOpen={() => handleContextMenuAction('open')}
        onOpenInNewTab={() => handleContextMenuAction('openInNewTab')}
        onOpenInNewWindow={() => handleContextMenuAction('openInNewWindow')}
        onCompressToZip={() => handleContextMenuAction('compressToZip')}
        onCopy={() => handleContextMenuAction('copy')}
        onCut={() => handleContextMenuAction('cut')}
        onPaste={() => handleContextMenuAction('paste')}
        onDelete={() => handleContextMenuAction('delete')}
        onRename={() => handleContextMenuAction('rename')}
        onNewFolder={() => handleContextMenuAction('newFolder')}
        onNewFile={() => handleContextMenuAction('newFile')}
        onGetInfo={() => handleContextMenuAction('info')}
        onOpenInTerminal={() => handleContextMenuAction('openInTerminal')}
        onPinQuickAccess={(path) => {
          closeContextMenu();
          explorer.pinQuickAccess(path);
        }}
        onUnpinQuickAccess={(path) => {
          closeContextMenu();
          explorer.unpinQuickAccess(path);
        }}
        isPinned={
          contextMenu.target
            ? explorer.pinnedPaths.includes(contextMenu.target.path)
            : false
        }
        hasClipboard={explorer.clipboard !== null}
        selectionCount={explorer.selectedPaths.size}
      />

      {/* New Item Modal */}
      {newItemPrompt && (
        <div className="modal-overlay" onClick={() => setNewItemPrompt(null)}>
          <div className="modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">
              New {newItemPrompt === 'folder' ? 'Folder' : 'File'}
            </div>
            <input
              type="text"
              className="modal-input"
              placeholder={
                newItemPrompt === 'folder' ? 'Folder name' : 'File name'
              }
              autoFocus
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  const value = (e.target as HTMLInputElement).value.trim();
                  if (value) {
                    if (newItemPrompt === 'folder') {
                      explorer.createNewFolder(value);
                    } else {
                      explorer.createNewFile(value);
                    }
                    setNewItemPrompt(null);
                  }
                }
                if (e.key === 'Escape') setNewItemPrompt(null);
              }}
            />
            <div className="modal-hint">Press Enter to create, Escape to cancel</div>
          </div>
        </div>
      )}

      {/* Settings Modal */}
      {showSettings && (
        <div className="modal-overlay" onClick={() => setShowSettings(false)}>
          <div className="modal settings-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-title">Settings</div>
            <div className="settings-section">
              <label className="settings-label">Terminal Application</label>
              <div className="settings-terminal-options">
                {[
                  { value: 'Terminal', label: 'Terminal', desc: 'macOS built-in' },
                  { value: 'iTerm', label: 'iTerm2', desc: 'iTerm2 terminal' },
                ].map((opt) => (
                  <div
                    key={opt.value}
                    className={`settings-terminal-option${explorer.settings.terminal === opt.value ? ' active' : ''}`}
                    onClick={() => {
                      explorer.saveSettings({ ...explorer.settings, terminal: opt.value });
                    }}
                  >
                    <div className="settings-terminal-radio">
                      <div className={`radio-outer${explorer.settings.terminal === opt.value ? ' checked' : ''}`}>
                        {explorer.settings.terminal === opt.value && <div className="radio-inner" />}
                      </div>
                    </div>
                    <div className="settings-terminal-info">
                      <span className="settings-terminal-name">{opt.label}</span>
                      <span className="settings-terminal-desc">{opt.desc}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="settings-actions">
              <button className="settings-btn" onClick={() => setShowSettings(false)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
