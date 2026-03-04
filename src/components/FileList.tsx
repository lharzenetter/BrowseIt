import { useState, useRef, useEffect } from 'react';
import type { FileEntry, ViewMode, SortField, SortDirection, ContextMenuState } from '../types';
import { formatFileSize, formatDate, getFileIcon, getFileType } from '../utils/format';

interface FileListProps {
  entries: FileEntry[];
  selectedPaths: Set<string>;
  viewMode: ViewMode;
  sortField: SortField;
  sortDirection: SortDirection;
  renamingPath: string | null;
  onToggleSelection: (path: string, multi: boolean) => void;
  onOpen: (entry: FileEntry) => void;
  onToggleSort: (field: SortField) => void;
  onContextMenu: (state: ContextMenuState) => void;
  onRename: (oldPath: string, newName: string) => void;
  onSetRenamingPath: (path: string | null) => void;
  onPreview: (entry: FileEntry) => void;
  onDrop: (sources: string[], destination: string) => void;
  loading: boolean;
}

export const FileList = ({
  entries,
  selectedPaths,
  viewMode,
  sortField,
  sortDirection,
  renamingPath,
  onToggleSelection,
  onOpen,
  onToggleSort,
  onContextMenu,
  onRename,
  onSetRenamingPath,
  onPreview,
  onDrop,
  loading,
}: FileListProps) => {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState('');
  const renameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      const entry = entries.find(e => e.path === renamingPath);
      if (entry) {
        setRenameValue(entry.name);
        renameInputRef.current.focus();
        // Select filename without extension
        const dotIndex = entry.name.lastIndexOf('.');
        if (dotIndex > 0 && !entry.is_dir) {
          renameInputRef.current.setSelectionRange(0, dotIndex);
        } else {
          renameInputRef.current.select();
        }
      }
    }
  }, [renamingPath, entries]);

  const handleRenameSubmit = () => {
    if (renamingPath && renameValue.trim()) {
      onRename(renamingPath, renameValue.trim());
    }
    onSetRenamingPath(null);
  };

  const handleDragStart = (e: React.DragEvent, entry: FileEntry) => {
    const paths = selectedPaths.has(entry.path)
      ? Array.from(selectedPaths)
      : [entry.path];
    e.dataTransfer.setData('text/plain', JSON.stringify(paths));
    e.dataTransfer.effectAllowed = 'copyMove';
  };

  const handleDragOver = (e: React.DragEvent, entry: FileEntry) => {
    if (entry.is_dir) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverPath(entry.path);
    }
  };

  const handleDrop = (e: React.DragEvent, entry: FileEntry) => {
    e.preventDefault();
    setDragOverPath(null);
    if (!entry.is_dir) return;
    try {
      const paths = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (Array.isArray(paths)) {
        onDrop(paths, entry.path);
      }
    } catch {}
  };

  const sortIndicator = (field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  };

  const handleRowClick = (e: React.MouseEvent, entry: FileEntry) => {
    onToggleSelection(entry.path, e.metaKey || e.ctrlKey);
    onPreview(entry);
  };

  const handleRowDoubleClick = (entry: FileEntry) => {
    onOpen(entry);
  };

  const handleRowContextMenu = (e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    if (!selectedPaths.has(entry.path)) {
      onToggleSelection(entry.path, false);
    }
    onContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      target: entry,
    });
  };

  const handleBackgroundContextMenu = (e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.file-row, .file-grid-item')) return;
    e.preventDefault();
    onContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY,
      target: null,
    });
  };

  if (loading) {
    return (
      <div className="file-list-loading">
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div
        className="file-list-empty"
        onContextMenu={handleBackgroundContextMenu}
      >
        <div className="empty-message">This folder is empty</div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div
        className="file-grid"
        onContextMenu={handleBackgroundContextMenu}
      >
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-grid-item ${selectedPaths.has(entry.path) ? 'selected' : ''} ${
              dragOverPath === entry.path ? 'drag-over' : ''
            } ${entry.is_hidden ? 'hidden-file' : ''}`}
            onClick={(e) => handleRowClick(e, entry)}
            onDoubleClick={() => handleRowDoubleClick(entry)}
            onContextMenu={(e) => handleRowContextMenu(e, entry)}
            draggable
            onDragStart={(e) => handleDragStart(e, entry)}
            onDragOver={(e) => handleDragOver(e, entry)}
            onDragLeave={() => setDragOverPath(null)}
            onDrop={(e) => handleDrop(e, entry)}
          >
            <div className="grid-icon">{getFileIcon(entry)}</div>
            {renamingPath === entry.path ? (
              <input
                ref={renameInputRef}
                className="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') onSetRenamingPath(null);
                }}
              />
            ) : (
              <div className="grid-name" title={entry.name}>
                {entry.name}
              </div>
            )}
          </div>
        ))}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div
        className="file-list-view"
        onContextMenu={handleBackgroundContextMenu}
      >
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-list-item ${selectedPaths.has(entry.path) ? 'selected' : ''} ${
              dragOverPath === entry.path ? 'drag-over' : ''
            } ${entry.is_hidden ? 'hidden-file' : ''}`}
            onClick={(e) => handleRowClick(e, entry)}
            onDoubleClick={() => handleRowDoubleClick(entry)}
            onContextMenu={(e) => handleRowContextMenu(e, entry)}
            draggable
            onDragStart={(e) => handleDragStart(e, entry)}
            onDragOver={(e) => handleDragOver(e, entry)}
            onDragLeave={() => setDragOverPath(null)}
            onDrop={(e) => handleDrop(e, entry)}
          >
            <span className="list-icon">{getFileIcon(entry)}</span>
            {renamingPath === entry.path ? (
              <input
                ref={renameInputRef}
                className="rename-input"
                value={renameValue}
                onChange={(e) => setRenameValue(e.target.value)}
                onBlur={handleRenameSubmit}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleRenameSubmit();
                  if (e.key === 'Escape') onSetRenamingPath(null);
                }}
              />
            ) : (
              <span className="list-name">{entry.name}</span>
            )}
          </div>
        ))}
      </div>
    );
  }

  // Details view (default)
  return (
    <div
      className="file-details"
      onContextMenu={handleBackgroundContextMenu}
    >
      <div className="details-header">
        <div
          className="details-col col-name"
          onClick={() => onToggleSort('name')}
        >
          Name{sortIndicator('name')}
        </div>
        <div
          className="details-col col-modified"
          onClick={() => onToggleSort('modified')}
        >
          Date Modified{sortIndicator('modified')}
        </div>
        <div
          className="details-col col-type"
          onClick={() => onToggleSort('extension')}
        >
          Type{sortIndicator('extension')}
        </div>
        <div
          className="details-col col-size"
          onClick={() => onToggleSort('size')}
        >
          Size{sortIndicator('size')}
        </div>
      </div>
      <div className="details-body">
        {entries.map((entry) => (
          <div
            key={entry.path}
            className={`file-row ${selectedPaths.has(entry.path) ? 'selected' : ''} ${
              dragOverPath === entry.path ? 'drag-over' : ''
            } ${entry.is_hidden ? 'hidden-file' : ''}`}
            onClick={(e) => handleRowClick(e, entry)}
            onDoubleClick={() => handleRowDoubleClick(entry)}
            onContextMenu={(e) => handleRowContextMenu(e, entry)}
            draggable
            onDragStart={(e) => handleDragStart(e, entry)}
            onDragOver={(e) => handleDragOver(e, entry)}
            onDragLeave={() => setDragOverPath(null)}
            onDrop={(e) => handleDrop(e, entry)}
          >
            <div className="details-col col-name">
              <span className="file-icon">{getFileIcon(entry)}</span>
              {renamingPath === entry.path ? (
                <input
                  ref={renameInputRef}
                  className="rename-input"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onBlur={handleRenameSubmit}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') handleRenameSubmit();
                    if (e.key === 'Escape') onSetRenamingPath(null);
                  }}
                />
              ) : (
                <span className="file-name">{entry.name}</span>
              )}
              {entry.is_symlink && <span className="symlink-badge">↗</span>}
            </div>
            <div className="details-col col-modified">
              {formatDate(entry.modified)}
            </div>
            <div className="details-col col-type">{getFileType(entry)}</div>
            <div className="details-col col-size">
              {entry.is_dir ? '—' : formatFileSize(entry.size)}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
