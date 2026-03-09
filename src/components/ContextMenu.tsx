import { useEffect, useRef } from 'react';
import type { ContextMenuState, CustomContextAction } from '../types';

interface ContextMenuProps {
  state: ContextMenuState;
  onClose: () => void;
  onOpen: () => void;
  onCopy: () => void;
  onCut: () => void;
  onPaste: () => void;
  onDelete: () => void;
  onRename: () => void;
  onNewFolder: () => void;
  onNewFile: () => void;
  onGetInfo: () => void;
  onOpenInTerminal: () => void;
  onOpenInNewWindow: () => void;
  onOpenInNewTab: () => void;
  onCompressToZip: () => void;
  onPinQuickAccess: (path: string) => void;
  onUnpinQuickAccess: (path: string) => void;
  isPinned: boolean;
  hasClipboard: boolean;
  customActions: CustomContextAction[];
  onCustomAction: (action: CustomContextAction) => void;
}

export const ContextMenu = ({
  state,
  onClose,
  onOpen,
  onCopy,
  onCut,
  onPaste,
  onDelete,
  onRename,
  onNewFolder,
  onNewFile,
  onGetInfo,
  onOpenInTerminal,
  onOpenInNewWindow,
  onOpenInNewTab,
  onCompressToZip,
  hasClipboard,
  onPinQuickAccess,
  onUnpinQuickAccess,
  isPinned,
  customActions,
  onCustomAction,
}: ContextMenuProps) => {
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = () => onClose();
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('click', handleClick);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('click', handleClick);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current && state.visible) {
      const rect = menuRef.current.getBoundingClientRect();
      const viewportW = window.innerWidth;
      const viewportH = window.innerHeight;

      let x = state.x;
      let y = state.y;

      if (x + rect.width > viewportW) x = viewportW - rect.width - 8;
      if (y + rect.height > viewportH) y = viewportH - rect.height - 8;

      menuRef.current.style.left = `${x}px`;
      menuRef.current.style.top = `${y}px`;
    }
  }, [state]);

  if (!state.visible) return null;

  const hasTarget = state.target !== null;

  return (
    <div
      ref={menuRef}
      className="context-menu"
      style={{ left: state.x, top: state.y }}
    >
      {hasTarget && (
        <>
          {/* Menu items */}
          <div className="context-menu-item" onClick={onOpen}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" stroke="currentColor" strokeWidth="1"/>
            </svg>
            <span className="ctx-label">Open</span>
          </div>

          <div className="context-menu-item" onClick={onOpenInNewTab}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
              <path d="M2 6h12" stroke="currentColor" strokeWidth="0.8"/>
              <path d="M8 8v4M6 10h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span className="ctx-label">Open in new tab</span>
          </div>

          <div className="context-menu-item" onClick={onOpenInNewWindow}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="3" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 3V1.5h4V3" stroke="currentColor" strokeWidth="1"/>
            </svg>
            <span className="ctx-label">Open in new window</span>
          </div>

          <div className="context-menu-separator" />

          {state.target?.is_dir && !isPinned && (
            <div className="context-menu-item" onClick={() => {
              if (state.target) onPinQuickAccess(state.target.path);
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L9.8 5.8H14L10.6 8.2L12 12.5L8 9.7L4 12.5L5.4 8.2L2 5.8H6.2L8 2z" fill="none" stroke="currentColor" strokeWidth="1"/>
              </svg>
              <span className="ctx-label ctx-label-bold">Pin to Quick access</span>
            </div>
          )}

          {state.target?.is_dir && isPinned && (
            <div className="context-menu-item" onClick={() => {
              if (state.target) onUnpinQuickAccess(state.target.path);
            }}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M8 2L9.8 5.8H14L10.6 8.2L12 12.5L8 9.7L4 12.5L5.4 8.2L2 5.8H6.2L8 2z" fill="currentColor" stroke="currentColor" strokeWidth="1"/>
              </svg>
              <span className="ctx-label">Unpin from Quick access</span>
            </div>
          )}

          <div className="context-menu-item" onClick={onCompressToZip}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M3 4h10l-1 9H4L3 4z" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 4V3a1 1 0 0 1 1-1h2a1 1 0 0 1 1 1v1" stroke="currentColor" strokeWidth="1"/>
            </svg>
            <span className="ctx-label">Compress to ZIP file</span>
          </div>

          <div className="context-menu-item" onClick={() => {
            navigator.clipboard.writeText(state.target?.path || '');
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 12h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <path d="M4 4h8" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              <path d="M4 8h5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
            </svg>
            <span className="ctx-label">Copy as path</span>
            <span className="ctx-shortcut">Cmd+Shift+C</span>
          </div>

          <div className="context-menu-item" onClick={onGetInfo}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
            </svg>
            <span className="ctx-label">Properties</span>
            <span className="ctx-shortcut">Alt+Enter</span>
          </div>

          <div className="context-menu-item" onClick={onOpenInTerminal}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="2" y="4" width="12" height="9" rx="1" stroke="currentColor" strokeWidth="1"/>
              <path d="M5 7h6M5 9.5h3" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
              <path d="M2 6h12" stroke="currentColor" strokeWidth="0.8"/>
            </svg>
            <span className="ctx-label">Open in Terminal</span>
          </div>

          {/* Custom context menu actions */}
          {customActions
            .filter((action) => {
              if (!state.target) return false;
              if (action.applies_to === 'both') return true;
              if (action.applies_to === 'directories') return state.target.is_dir;
              if (action.applies_to === 'files') return !state.target.is_dir;
              return true;
            })
            .map((action) => (
              <div
                key={action.id}
                className="context-menu-item"
                onClick={() => onCustomAction(action)}
              >
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="2" y="2" width="12" height="12" rx="2" stroke="currentColor" strokeWidth="1"/>
                  <path d="M5.5 5.5l5 2.5-5 2.5V5.5z" fill="currentColor"/>
                </svg>
                <span className="ctx-label">{action.label}</span>
              </div>
            ))}

          <div className="context-menu-separator" />

          <div className="context-menu-item" onClick={() => {}}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <circle cx="8" cy="8" r="1" fill="currentColor"/>
              <circle cx="8" cy="4" r="1" fill="currentColor"/>
              <circle cx="8" cy="12" r="1" fill="currentColor"/>
            </svg>
            <span className="ctx-label">Show more options</span>
            <span className="ctx-shortcut">Shift+F10</span>
          </div>

          {/* Icon action bar at the bottom - Win11 style */}
          <div className="context-menu-separator" />
          <div className="ctx-icon-bar">
            <button className="ctx-icon-btn" onClick={onCut} title="Cut">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <circle cx="5" cy="12" r="1.8" stroke="currentColor" strokeWidth="1"/>
                <circle cx="11" cy="12" r="1.8" stroke="currentColor" strokeWidth="1"/>
                <path d="M6.2 10.5L10.5 4M9.8 10.5L5.5 4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="ctx-icon-btn" onClick={onCopy} title="Copy">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="5.5" y="5.5" width="7" height="8" rx="1" stroke="currentColor" strokeWidth="1"/>
                <path d="M10.5 5.5V4a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v7a1 1 0 0 0 1 1h1.5" stroke="currentColor" strokeWidth="1"/>
              </svg>
            </button>
            {hasClipboard && (
              <button className="ctx-icon-btn" onClick={onPaste} title="Paste">
                <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                  <rect x="3.5" y="3.5" width="9" height="10.5" rx="1" stroke="currentColor" strokeWidth="1"/>
                  <path d="M6 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1" stroke="currentColor" strokeWidth="1"/>
                </svg>
              </button>
            )}
            <button className="ctx-icon-btn" onClick={onRename} title="Rename">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3 13h3.5M4.75 13V3M8 6h5M10.5 3v6" stroke="currentColor" strokeWidth="1.1" strokeLinecap="round"/>
              </svg>
            </button>
            <button className="ctx-icon-btn ctx-icon-btn-danger" onClick={onDelete} title="Delete">
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path d="M3.5 5h9M6 5V3.5h4V5" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
                <path d="M4.5 5l.5 8h6l.5-8" stroke="currentColor" strokeWidth="1"/>
              </svg>
            </button>
          </div>
        </>
      )}

      {!hasTarget && (
        <>
          {hasClipboard && (
            <div className="context-menu-item" onClick={onPaste}>
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <rect x="3.5" y="3.5" width="9" height="10.5" rx="1" stroke="currentColor" strokeWidth="1"/>
                <path d="M6 3.5V2.5a.5.5 0 0 1 .5-.5h3a.5.5 0 0 1 .5.5v1" stroke="currentColor" strokeWidth="1"/>
              </svg>
              <span className="ctx-label">Paste</span>
              <span className="ctx-shortcut">Cmd+V</span>
            </div>
            )}
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={onNewFolder}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M2 4.5C2 3.67 2.67 3 3.5 3H6l1.5 1.5H12.5C13.33 4.5 14 5.17 14 6V11.5C14 12.33 13.33 13 12.5 13H3.5C2.67 13 2 12.33 2 11.5V4.5Z" fill="#FFB900" stroke="#E6A700" strokeWidth="0.5"/>
            </svg>
            <span className="ctx-label">New Folder</span>
          </div>
          <div className="context-menu-item" onClick={onNewFile}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M4 2h5l3 3v9H4V2z" fill="white" stroke="#888" strokeWidth="0.8"/>
              <path d="M9 2v3h3" stroke="#888" strokeWidth="0.8" fill="none"/>
            </svg>
            <span className="ctx-label">New File</span>
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={onGetInfo}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="3" y="1" width="10" height="14" rx="1.5" stroke="currentColor" strokeWidth="1"/>
              <path d="M6 5h4M6 8h4M6 11h2" stroke="currentColor" strokeWidth="0.8" strokeLinecap="round"/>
            </svg>
            <span className="ctx-label">Properties</span>
            <span className="ctx-shortcut">Alt+Enter</span>
          </div>
        </>
      )}
    </div>
  );
};
