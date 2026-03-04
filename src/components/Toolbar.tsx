import { useState } from 'react';
import type { ViewMode } from '../types';

interface ToolbarProps {
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
  onNewFolder: (name: string) => void;
  onNewFile: (name: string) => void;
  onDelete: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  hasSelection: boolean;
  hasClipboard: boolean;
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
  showHidden: boolean;
  onToggleHidden: () => void;
}

export const Toolbar = ({
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
  onNewFolder,
  onNewFile,
  onDelete,
  onCopy,
  onCut,
  onPaste,
  hasSelection,
  hasClipboard,
  viewMode,
  onViewModeChange,
  showHidden,
  onToggleHidden,
}: ToolbarProps) => {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | null>(null);

  const handleNewItem = () => {
    if (!newItemName.trim() || !newItemType) return;
    if (newItemType === 'folder') {
      onNewFolder(newItemName.trim());
    } else {
      onNewFile(newItemName.trim());
    }
    setNewItemName('');
    setNewItemType(null);
    setShowNewMenu(false);
  };

  return (
    <div className="toolbar">
      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={onGoBack}
          disabled={!canGoBack}
          title="Back (Cmd+[)"
        >
          ◀
        </button>
        <button
          className="toolbar-btn"
          onClick={onGoForward}
          disabled={!canGoForward}
          title="Forward (Cmd+])"
        >
          ▶
        </button>
        <button className="toolbar-btn" onClick={onGoUp} title="Up (Alt+Up)">
          ▲
        </button>
        <button className="toolbar-btn" onClick={onRefresh} title="Refresh (Cmd+R)">
          ↻
        </button>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <div className="toolbar-new-wrapper">
          <button
            className="toolbar-btn"
            onClick={() => setShowNewMenu(!showNewMenu)}
            title="New"
          >
            + New
          </button>
          {showNewMenu && (
            <div className="toolbar-dropdown">
              {newItemType === null ? (
                <>
                  <div
                    className="dropdown-item"
                    onClick={() => setNewItemType('folder')}
                  >
                    📁 New Folder
                  </div>
                  <div
                    className="dropdown-item"
                    onClick={() => setNewItemType('file')}
                  >
                    📄 New File
                  </div>
                </>
              ) : (
                <div className="dropdown-input">
                  <input
                    type="text"
                    value={newItemName}
                    onChange={(e) => setNewItemName(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleNewItem();
                      if (e.key === 'Escape') {
                        setNewItemType(null);
                        setShowNewMenu(false);
                      }
                    }}
                    placeholder={newItemType === 'folder' ? 'Folder name' : 'File name'}
                    autoFocus
                  />
                  <button onClick={handleNewItem}>OK</button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      <div className="toolbar-separator" />

      <div className="toolbar-group">
        <button
          className="toolbar-btn"
          onClick={onCopy}
          disabled={!hasSelection}
          title="Copy (Cmd+C)"
        >
          📋 Copy
        </button>
        <button
          className="toolbar-btn"
          onClick={onCut}
          disabled={!hasSelection}
          title="Cut (Cmd+X)"
        >
          ✂️ Cut
        </button>
        <button
          className="toolbar-btn"
          onClick={onPaste}
          disabled={!hasClipboard}
          title="Paste (Cmd+V)"
        >
          📌 Paste
        </button>
        <button
          className="toolbar-btn danger"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete (Cmd+Delete)"
        >
          🗑️ Delete
        </button>
      </div>

      <div className="toolbar-spacer" />

      <div className="toolbar-group">
        <button
          className={`toolbar-btn ${viewMode === 'details' ? 'active' : ''}`}
          onClick={() => onViewModeChange('details')}
          title="Details view"
        >
          ≡
        </button>
        <button
          className={`toolbar-btn ${viewMode === 'list' ? 'active' : ''}`}
          onClick={() => onViewModeChange('list')}
          title="List view"
        >
          ☰
        </button>
        <button
          className={`toolbar-btn ${viewMode === 'grid' ? 'active' : ''}`}
          onClick={() => onViewModeChange('grid')}
          title="Grid view"
        >
          ▦
        </button>
        <div className="toolbar-separator" />
        <button
          className={`toolbar-btn ${showHidden ? 'active' : ''}`}
          onClick={onToggleHidden}
          title="Toggle hidden files"
        >
          👁️
        </button>
      </div>
    </div>
  );
};
