import { useState, useRef, useEffect } from 'react';
import type { ViewMode, SortField, SortDirection } from '../types';

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
  sortField: SortField;
  sortDirection: SortDirection;
  onToggleSort: (field: SortField) => void;
}

export const Toolbar = ({
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
  sortField,
  sortDirection,
  onToggleSort,
}: ToolbarProps) => {
  const [showNewMenu, setShowNewMenu] = useState(false);
  const [showViewMenu, setShowViewMenu] = useState(false);
  const [showSortMenu, setShowSortMenu] = useState(false);
  const [newItemName, setNewItemName] = useState('');
  const [newItemType, setNewItemType] = useState<'folder' | 'file' | null>(null);
  const newMenuRef = useRef<HTMLDivElement>(null);
  const viewMenuRef = useRef<HTMLDivElement>(null);
  const sortMenuRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns when clicking outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (newMenuRef.current && !newMenuRef.current.contains(e.target as Node)) {
        setShowNewMenu(false);
        setNewItemType(null);
      }
      if (viewMenuRef.current && !viewMenuRef.current.contains(e.target as Node)) {
        setShowViewMenu(false);
      }
      if (sortMenuRef.current && !sortMenuRef.current.contains(e.target as Node)) {
        setShowSortMenu(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  return (
    <div className="toolbar">
      {/* New button with dropdown */}
      <div className="toolbar-new-wrapper" ref={newMenuRef}>
        <button
          className="toolbar-btn toolbar-btn-new"
          onClick={() => { setShowNewMenu(!showNewMenu); setNewItemType(null); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M8 5v6M5 8h6" stroke="#0067c0" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span>New</span>
          <svg className="chevron-down" width="10" height="10" viewBox="0 0 10 10">
            <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        {showNewMenu && (
          <div className="toolbar-dropdown">
            {newItemType === null ? (
              <>
                <div className="dropdown-item" onClick={() => setNewItemType('folder')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" fill="#FFB900" stroke="#E6A700" strokeWidth="0.5"/>
                  </svg>
                  <span>Folder</span>
                </div>
                <div className="context-menu-separator" />
                <div className="dropdown-item" onClick={() => setNewItemType('file')}>
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M4 2h5l3 3v9H4V2z" fill="white" stroke="#888" strokeWidth="0.8"/>
                    <path d="M9 2v3h3" stroke="#888" strokeWidth="0.8" fill="none"/>
                  </svg>
                  <span>Text Document</span>
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
                    if (e.key === 'Escape') { setNewItemType(null); setShowNewMenu(false); }
                  }}
                  placeholder={newItemType === 'folder' ? 'Folder name' : 'File name'}
                  autoFocus
                />
                <button onClick={handleNewItem}>Create</button>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="toolbar-separator" />

      {/* Icon-only action buttons */}
      <div className="toolbar-group">
        <button
          className="toolbar-icon-btn"
          onClick={onCut}
          disabled={!hasSelection}
          title="Cut (Cmd+X)"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="5.5" cy="13" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="12.5" cy="13" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 11.5L12 4M11 11.5L6 4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          className="toolbar-icon-btn"
          onClick={onCopy}
          disabled={!hasSelection}
          title="Copy (Cmd+C)"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="6" y="6" width="8" height="9" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M12 6V4.5C12 3.67 11.33 3 10.5 3H4.5C3.67 3 3 3.67 3 4.5V12.5C3 13.33 3.67 14 4.5 14H6" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
        <button
          className="toolbar-icon-btn"
          onClick={onPaste}
          disabled={!hasClipboard}
          title="Paste (Cmd+V)"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <rect x="4" y="4" width="10" height="12" rx="1.5" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M7 4V3C7 2.45 7.45 2 8 2h2c.55 0 1 .45 1 1v1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="6.5" y="2" width="5" height="2.5" rx="0.75" stroke="currentColor" strokeWidth="0.8" fill="white"/>
          </svg>
        </button>
        <button
          className="toolbar-icon-btn"
          onClick={() => {
            if (hasSelection) {
              // trigger rename via parent
            }
          }}
          disabled={!hasSelection}
          title="Rename (F2)"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M3 14h4M5 14V4M8 7h6M11 4v6" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
        </button>
        <button
          className="toolbar-icon-btn"
          disabled={!hasSelection}
          title="Share"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <circle cx="13" cy="4" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="5" cy="9" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <circle cx="13" cy="14" r="2" stroke="currentColor" strokeWidth="1.2"/>
            <path d="M6.8 8L11.2 5M6.8 10L11.2 13" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
        <button
          className="toolbar-icon-btn toolbar-icon-btn-danger"
          onClick={onDelete}
          disabled={!hasSelection}
          title="Delete (Cmd+Backspace)"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path d="M4 5h10M7 5V4c0-.55.45-1 1-1h2c.55 0 1 .45 1 1v1" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M5 5l.7 9.1c.06.5.48.9.99.9h4.62c.51 0 .93-.4.99-.9L13 5" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
        </button>
      </div>

      <div className="toolbar-separator" />

      {/* Sort dropdown */}
      <div className="toolbar-menu-wrapper" ref={sortMenuRef}>
        <button
          className="toolbar-btn toolbar-btn-text"
          onClick={() => { setShowSortMenu(!showSortMenu); setShowViewMenu(false); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M2 4h12M2 8h8M2 12h4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
          </svg>
          <span>Sort</span>
          <svg className="chevron-down" width="10" height="10" viewBox="0 0 10 10">
            <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        {showSortMenu && (
          <div className="toolbar-dropdown">
            <div className={`dropdown-item ${sortField === 'name' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onToggleSort('name'); setShowSortMenu(false); }}>
              <span>Name</span>
              {sortField === 'name' && <span className="sort-direction">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className={`dropdown-item ${sortField === 'modified' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onToggleSort('modified'); setShowSortMenu(false); }}>
              <span>Date modified</span>
              {sortField === 'modified' && <span className="sort-direction">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className={`dropdown-item ${sortField === 'extension' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onToggleSort('extension'); setShowSortMenu(false); }}>
              <span>Type</span>
              {sortField === 'extension' && <span className="sort-direction">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
            <div className={`dropdown-item ${sortField === 'size' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onToggleSort('size'); setShowSortMenu(false); }}>
              <span>Size</span>
              {sortField === 'size' && <span className="sort-direction">{sortDirection === 'asc' ? '▲' : '▼'}</span>}
            </div>
          </div>
        )}
      </div>

      {/* View dropdown */}
      <div className="toolbar-menu-wrapper" ref={viewMenuRef}>
        <button
          className="toolbar-btn toolbar-btn-text"
          onClick={() => { setShowViewMenu(!showViewMenu); setShowSortMenu(false); }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
            <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1.2"/>
          </svg>
          <span>View</span>
          <svg className="chevron-down" width="10" height="10" viewBox="0 0 10 10">
            <path d="M2.5 4L5 6.5L7.5 4" stroke="currentColor" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
          </svg>
        </button>
        {showViewMenu && (
          <div className="toolbar-dropdown">
            <div className={`dropdown-item ${viewMode === 'grid' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onViewModeChange('grid'); setShowViewMenu(false); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1"/>
                <rect x="9" y="2" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1"/>
                <rect x="2" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1"/>
                <rect x="9" y="9" width="5" height="5" rx="1" stroke="currentColor" strokeWidth="1"/>
              </svg>
              <span>Large icons</span>
            </div>
            <div className={`dropdown-item ${viewMode === 'list' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onViewModeChange('list'); setShowViewMenu(false); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="2" y="3" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1"/>
                <rect x="2" y="8" width="4" height="3" rx="0.5" stroke="currentColor" strokeWidth="1"/>
                <path d="M8 4.5h6M8 9.5h6" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span>List</span>
            </div>
            <div className={`dropdown-item ${viewMode === 'details' ? 'dropdown-item-active' : ''}`}
              onClick={() => { onViewModeChange('details'); setShowViewMenu(false); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M2 4h12M2 7.5h12M2 11h12" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
              <span>Details</span>
            </div>
            <div className="context-menu-separator" />
            <div className={`dropdown-item ${showHidden ? 'dropdown-item-active' : ''}`}
              onClick={() => { onToggleHidden(); setShowViewMenu(false); }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 4C4.5 4 2 8 2 8s2.5 4 6 4 6-4 6-4-2.5-4-6-4z" stroke="currentColor" strokeWidth="1.2"/>
                <circle cx="8" cy="8" r="2" stroke="currentColor" strokeWidth="1.2"/>
              </svg>
              <span>Show hidden items</span>
            </div>
          </div>
        )}
      </div>

      <div className="toolbar-spacer" />

      {/* Overflow / more */}
      <button className="toolbar-icon-btn" title="See more">
        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
          <circle cx="5" cy="9" r="1.2" fill="currentColor"/>
          <circle cx="9" cy="9" r="1.2" fill="currentColor"/>
          <circle cx="13" cy="9" r="1.2" fill="currentColor"/>
        </svg>
      </button>
    </div>
  );
};
