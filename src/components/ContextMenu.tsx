import { useEffect, useRef } from 'react';
import type { ContextMenuState } from '../types';

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
  hasClipboard: boolean;
  selectionCount: number;
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
  hasClipboard,
  selectionCount,
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
          <div className="context-menu-item" onClick={onOpen}>
            {state.target?.is_dir ? '📁 Open' : '📄 Open'}
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={onCopy}>
            📋 Copy{selectionCount > 1 ? ` (${selectionCount} items)` : ''}
          </div>
          <div className="context-menu-item" onClick={onCut}>
            ✂️ Cut{selectionCount > 1 ? ` (${selectionCount} items)` : ''}
          </div>
        </>
      )}
      {hasClipboard && (
        <div className="context-menu-item" onClick={onPaste}>
          📌 Paste
        </div>
      )}
      {hasTarget && (
        <>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={onRename}>
            ✏️ Rename
          </div>
          <div className="context-menu-item danger" onClick={onDelete}>
            🗑️ Move to Trash{selectionCount > 1 ? ` (${selectionCount} items)` : ''}
          </div>
          <div className="context-menu-separator" />
          <div className="context-menu-item" onClick={onGetInfo}>
            ℹ️ Properties
          </div>
        </>
      )}
      {!hasTarget && (
        <>
          {hasClipboard && <div className="context-menu-separator" />}
          <div className="context-menu-item" onClick={onNewFolder}>
            📁 New Folder
          </div>
          <div className="context-menu-item" onClick={onNewFile}>
            📄 New File
          </div>
        </>
      )}
    </div>
  );
};
