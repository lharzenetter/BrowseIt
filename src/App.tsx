import { useState, useCallback, useRef } from 'react';
import { useFileExplorer } from './hooks/useFileExplorer';
import { useKeyboardShortcuts } from './hooks/useKeyboardShortcuts';
import { useContextMenuHandlers } from './hooks/useContextMenuHandlers';
import type { FilesystemProvider } from './filesystem/FilesystemProvider';
import { Sidebar } from './components/Sidebar';
import { Toolbar } from './components/Toolbar';
import { AddressBar } from './components/AddressBar';
import { TabBar } from './components/TabBar';
import { FileList } from './components/FileList';
import { ContextMenu } from './components/ContextMenu';
import { PreviewPanel } from './components/PreviewPanel';
import { StatusBar } from './components/StatusBar';
import { SettingsModal } from './components/SettingsModal';
import type { ContextMenuState, CustomContextAction } from './types/index';

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

  const closeContextMenu = useCallback(() => {
    setContextMenu(prev => ({ ...prev, visible: false }));
  }, []);

  const { handleContextMenuAction } = useContextMenuHandlers({
    contextMenu,
    explorer,
    fs,
    closeContextMenu,
    setNewItemPrompt,
  });

  useKeyboardShortcuts({
    explorer,
    scrollToIndexRef,
    closeContextMenu,
    setNewItemPrompt,
  });

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
        fs={fs}
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
        <SettingsModal
          settings={explorer.settings}
          quickAccessPaths={explorer.quickAccessPaths}
          onSaveSettings={explorer.saveSettings}
          onClose={() => setShowSettings(false)}
        />
      )}
    </div>
  );
}

export default App;
