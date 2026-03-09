import { useState, useEffect, useCallback, useRef } from 'react';
import { useFileExplorer } from './hooks/useFileExplorer';
import type { FilesystemProvider } from './filesystem/FilesystemProvider';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { AddressBar } from './components/AddressBar';
import { TabBar } from './components/TabBar';
import { FileList } from './components/FileList';
import { ContextMenu } from './components/ContextMenu';
import { PreviewPanel } from './components/PreviewPanel';
import { StatusBar } from './components/StatusBar';
import type { ContextMenuState, CustomContextAction } from './types';

interface AppProps {
  fs: FilesystemProvider;
}

function App({ fs }: AppProps) {
  const explorer = useFileExplorer(fs);
  // Receives scrollToIndex from FileList's virtualizer so keyboard navigation
  // can keep the selected row in view.
  const scrollToIndexRef = useRef<((index: number) => void) | null>(null);
  const handleVirtualizerReady = useCallback((fn: (index: number) => void) => {
    scrollToIndexRef.current = fn;
  }, []);

  const [contextMenu, setContextMenu] = useState<ContextMenuState>({
    visible: false,
    x: 0,
    y: 0,
    target: null,
  });
  const [newItemPrompt, setNewItemPrompt] = useState<'folder' | 'file' | null>(null);
  const [showSettings, setShowSettings] = useState(false);
  const [editingAction, setEditingAction] = useState<CustomContextAction | null>(null);

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
          // No target — show properties of the current directory
          fs.getFileInfo(explorer.currentPath)
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
          hiddenHomePaths={explorer.settings.hidden_home_paths}
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
                await fs.moveItems(sources, destination);
                explorer.refresh();
              } catch (e) {
                explorer.setError(String(e));
              }
            }}
            loading={explorer.loading}
            onVirtualizerReady={handleVirtualizerReady}
          />
        </div>
        <PreviewPanel
          entry={explorer.previewEntry}
          visible={explorer.showPreview}
          onClose={() => explorer.setShowPreview(false)}
          onReadFile={(path) => explorer.fs.readTextFile(path)}
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
        customActions={explorer.settings.custom_context_actions}
        onCustomAction={(action: CustomContextAction) => {
          closeContextMenu();
          const targetPath = contextMenu.target
            ? contextMenu.target.path
            : explorer.currentPath;
          fs.runCustomContextAction(action.command, action.args, targetPath)
            .catch((e: unknown) => explorer.setError(String(e)));
        }}
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
        <div className="modal-overlay" onClick={() => { setShowSettings(false); setEditingAction(null); }}>
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

            {/* Custom Context Menu Actions */}
            <div className="settings-section">
              <label className="settings-label">Custom Context Menu Actions</label>
              <div className="settings-custom-actions-list">
                {explorer.settings.custom_context_actions.map((action) => (
                  <div key={action.id} className="settings-custom-action-item">
                    <div className="settings-custom-action-info">
                      <span className="settings-custom-action-label">{action.label}</span>
                      <span className="settings-custom-action-detail">
                        {action.command} {action.args} &middot; {action.applies_to}
                      </span>
                    </div>
                    <div className="settings-custom-action-buttons">
                      <button
                        className="settings-custom-action-btn"
                        title="Edit"
                        onClick={() => setEditingAction({ ...action })}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M11.5 2.5l2 2L5 13H3v-2L11.5 2.5z" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round"/>
                        </svg>
                      </button>
                      <button
                        className="settings-custom-action-btn danger"
                        title="Remove"
                        onClick={() => {
                          const updated = explorer.settings.custom_context_actions.filter(
                            (a) => a.id !== action.id
                          );
                          explorer.saveSettings({
                            ...explorer.settings,
                            custom_context_actions: updated,
                          });
                        }}
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                          <path d="M3.5 5h9M6 5V3.5h4V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                          <path d="M4.5 5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1"/>
                        </svg>
                      </button>
                    </div>
                  </div>
                ))}
                {explorer.settings.custom_context_actions.length === 0 && (
                  <div className="settings-custom-actions-empty">
                    No custom actions configured. Add one to open files or folders in your favourite apps.
                  </div>
                )}
              </div>

              {/* Add / Edit form */}
              {editingAction ? (
                <div className="settings-custom-action-form">
                  <div className="settings-custom-action-form-title">
                    {explorer.settings.custom_context_actions.some((a) => a.id === editingAction.id)
                      ? 'Edit Action'
                      : 'New Action'}
                  </div>
                  <div className="settings-form-row">
                    <label className="settings-form-label">Label</label>
                    <input
                      className="settings-form-input"
                      type="text"
                      placeholder="e.g. Open in VS Code"
                      value={editingAction.label}
                      onChange={(e) => setEditingAction({ ...editingAction, label: e.target.value })}
                    />
                  </div>
                  <div className="settings-form-row">
                    <label className="settings-form-label">Command</label>
                    <input
                      className="settings-form-input"
                      type="text"
                      placeholder="e.g. Visual Studio Code"
                      value={editingAction.command}
                      onChange={(e) => setEditingAction({ ...editingAction, command: e.target.value })}
                    />
                    <span className="settings-form-hint">App name (e.g. "Visual Studio Code") or full path to executable</span>
                  </div>
                  <div className="settings-form-row">
                    <label className="settings-form-label">Arguments</label>
                    <input
                      className="settings-form-input"
                      type="text"
                      placeholder="e.g. {path}"
                      value={editingAction.args}
                      onChange={(e) => setEditingAction({ ...editingAction, args: e.target.value })}
                    />
                    <span className="settings-form-hint">Use {'{path}'} for the file/folder path, {'{dir}'} for the parent directory</span>
                  </div>
                  <div className="settings-form-row">
                    <label className="settings-form-label">Applies to</label>
                    <div className="settings-applies-to-options">
                      {(['both', 'directories', 'files'] as const).map((opt) => (
                        <div
                          key={opt}
                          className={`settings-applies-to-option${editingAction.applies_to === opt ? ' active' : ''}`}
                          onClick={() => setEditingAction({ ...editingAction, applies_to: opt })}
                        >
                          {opt === 'both' ? 'Both' : opt === 'directories' ? 'Directories' : 'Files'}
                        </div>
                      ))}
                    </div>
                  </div>
                  <div className="settings-form-buttons">
                    <button
                      className="settings-btn"
                      onClick={() => setEditingAction(null)}
                    >
                      Cancel
                    </button>
                    <button
                      className="settings-btn settings-btn-primary"
                      disabled={!editingAction.label.trim() || !editingAction.command.trim()}
                      onClick={() => {
                        const actions = [...explorer.settings.custom_context_actions];
                        const idx = actions.findIndex((a) => a.id === editingAction.id);
                        if (idx >= 0) {
                          actions[idx] = editingAction;
                        } else {
                          actions.push(editingAction);
                        }
                        explorer.saveSettings({
                          ...explorer.settings,
                          custom_context_actions: actions,
                        });
                        setEditingAction(null);
                      }}
                    >
                      Save
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  className="settings-btn settings-add-action-btn"
                  onClick={() =>
                    setEditingAction({
                      id: `action-${Date.now()}`,
                      label: '',
                      command: '',
                      args: '{path}',
                      applies_to: 'both',
                    })
                  }
                >
                  + Add Action
                </button>
              )}
            </div>

            {/* Home Sidebar Items */}
            <div className="settings-section">
              <label className="settings-label">Home Sidebar Items</label>
              <div className="settings-home-items-list">
                {explorer.quickAccessPaths.map(([name, path]) => {
                  const isHidden = explorer.settings.hidden_home_paths.includes(path);
                  return (
                    <div
                      key={path}
                      className={`settings-home-item${isHidden ? ' disabled' : ''}`}
                      onClick={() => {
                        const current = explorer.settings.hidden_home_paths;
                        const updated = isHidden
                          ? current.filter((p) => p !== path)
                          : [...current, path];
                        explorer.saveSettings({
                          ...explorer.settings,
                          hidden_home_paths: updated,
                        });
                      }}
                    >
                      <div className={`settings-home-item-toggle${isHidden ? '' : ' active'}`}>
                        <div className="toggle-track">
                          <div className="toggle-thumb" />
                        </div>
                      </div>
                      <span className="settings-home-item-name">{name}</span>
                      <span className="settings-home-item-path">{path}</span>
                    </div>
                  );
                })}
              </div>
            </div>

            <div className="settings-actions">
              <button className="settings-btn" onClick={() => { setShowSettings(false); setEditingAction(null); }}>
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
