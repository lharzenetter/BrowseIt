import { useState, useRef, useEffect, useCallback, memo } from 'react';
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

// ---------------------------------------------------------------------------
// Rename input — extracted so it can be memoized independently
// ---------------------------------------------------------------------------

interface RenameInputProps {
  path: string;
  initialName: string;
  inputRef: React.RefObject<HTMLInputElement | null>;
  onSubmit: (path: string, newName: string) => void;
  onCancel: () => void;
}

const RenameInput = memo(({ path, initialName, inputRef, onSubmit, onCancel }: RenameInputProps) => {
  const [value, setValue] = useState(initialName);

  const handleSubmit = useCallback(() => {
    if (value.trim()) onSubmit(path, value.trim());
    else onCancel();
  }, [value, path, onSubmit, onCancel]);

  return (
    <input
      ref={inputRef}
      className="rename-input"
      value={value}
      onChange={e => setValue(e.target.value)}
      onBlur={handleSubmit}
      onKeyDown={e => {
        if (e.key === 'Enter') handleSubmit();
        if (e.key === 'Escape') onCancel();
      }}
    />
  );
});

// ---------------------------------------------------------------------------
// Memoized row components
//
// Each row receives only the data it needs plus stable callbacks (useCallback
// in the parent).  React.memo means a row only re-renders when its specific
// props change — a selection toggle on row 5 will not re-render rows 1-4 or
// 6-N.
//
// NOTE on event delegation vs per-row handlers
// ─────────────────────────────────────────────
// We still attach handlers here because each row needs to pass its specific
// `entry` object.  The alternative (pure delegation via data-attributes) would
// require a Map<path, FileEntry> on the parent to look up the entry on click,
// which adds complexity.  The win from React.memo already avoids most
// unnecessary re-renders; the handler objects themselves are cheap once React
// knows it doesn't need to reconcile the row.
// ---------------------------------------------------------------------------

interface RowProps {
  entry: FileEntry;
  isSelected: boolean;
  isDragOver: boolean;
  isRenaming: boolean;
  renameInputRef: React.RefObject<HTMLInputElement | null>;
  onRenameSubmit: (path: string, newName: string) => void;
  onRenameCancel: () => void;
  onClick: (e: React.MouseEvent, entry: FileEntry) => void;
  onDoubleClick: (entry: FileEntry) => void;
  onContextMenu: (e: React.MouseEvent, entry: FileEntry) => void;
  onDragStart: (e: React.DragEvent, entry: FileEntry) => void;
  onDragOver: (e: React.DragEvent, entry: FileEntry) => void;
  onDragLeave: () => void;
  onDrop: (e: React.DragEvent, entry: FileEntry) => void;
}

const DetailsRow = memo(({
  entry, isSelected, isDragOver, isRenaming,
  renameInputRef, onRenameSubmit, onRenameCancel,
  onClick, onDoubleClick, onContextMenu,
  onDragStart, onDragOver, onDragLeave, onDrop,
}: RowProps) => (
  <div
    className={`file-row${isSelected ? ' selected' : ''}${isDragOver ? ' drag-over' : ''}${entry.is_hidden ? ' hidden-file' : ''}`}
    onClick={e => onClick(e, entry)}
    onDoubleClick={() => onDoubleClick(entry)}
    onContextMenu={e => onContextMenu(e, entry)}
    draggable
    onDragStart={e => onDragStart(e, entry)}
    onDragOver={e => onDragOver(e, entry)}
    onDragLeave={onDragLeave}
    onDrop={e => onDrop(e, entry)}
  >
    <div className="details-col col-name">
      <span className="file-icon">{getFileIcon(entry)}</span>
      {isRenaming ? (
        <RenameInput
          path={entry.path}
          initialName={entry.name}
          inputRef={renameInputRef}
          onSubmit={onRenameSubmit}
          onCancel={onRenameCancel}
        />
      ) : (
        <span className="file-name">{entry.name}</span>
      )}
      {entry.is_symlink && <span className="symlink-badge">↗</span>}
    </div>
    <div className="details-col col-modified">{formatDate(entry.modified)}</div>
    <div className="details-col col-type">{getFileType(entry)}</div>
    <div className="details-col col-size">{entry.is_dir ? '—' : formatFileSize(entry.size)}</div>
  </div>
));

const GridItem = memo(({
  entry, isSelected, isDragOver, isRenaming,
  renameInputRef, onRenameSubmit, onRenameCancel,
  onClick, onDoubleClick, onContextMenu,
  onDragStart, onDragOver, onDragLeave, onDrop,
}: RowProps) => (
  <div
    className={`file-grid-item${isSelected ? ' selected' : ''}${isDragOver ? ' drag-over' : ''}${entry.is_hidden ? ' hidden-file' : ''}`}
    onClick={e => onClick(e, entry)}
    onDoubleClick={() => onDoubleClick(entry)}
    onContextMenu={e => onContextMenu(e, entry)}
    draggable
    onDragStart={e => onDragStart(e, entry)}
    onDragOver={e => onDragOver(e, entry)}
    onDragLeave={onDragLeave}
    onDrop={e => onDrop(e, entry)}
  >
    <div className="grid-icon">{getFileIcon(entry)}</div>
    {isRenaming ? (
      <RenameInput
        path={entry.path}
        initialName={entry.name}
        inputRef={renameInputRef}
        onSubmit={onRenameSubmit}
        onCancel={onRenameCancel}
      />
    ) : (
      <div className="grid-name" title={entry.name}>{entry.name}</div>
    )}
  </div>
));

const ListItem = memo(({
  entry, isSelected, isDragOver, isRenaming,
  renameInputRef, onRenameSubmit, onRenameCancel,
  onClick, onDoubleClick, onContextMenu,
  onDragStart, onDragOver, onDragLeave, onDrop,
}: RowProps) => (
  <div
    className={`file-list-item${isSelected ? ' selected' : ''}${isDragOver ? ' drag-over' : ''}${entry.is_hidden ? ' hidden-file' : ''}`}
    onClick={e => onClick(e, entry)}
    onDoubleClick={() => onDoubleClick(entry)}
    onContextMenu={e => onContextMenu(e, entry)}
    draggable
    onDragStart={e => onDragStart(e, entry)}
    onDragOver={e => onDragOver(e, entry)}
    onDragLeave={onDragLeave}
    onDrop={e => onDrop(e, entry)}
  >
    <span className="list-icon">{getFileIcon(entry)}</span>
    {isRenaming ? (
      <RenameInput
        path={entry.path}
        initialName={entry.name}
        inputRef={renameInputRef}
        onSubmit={onRenameSubmit}
        onCancel={onRenameCancel}
      />
    ) : (
      <span className="list-name">{entry.name}</span>
    )}
  </div>
));

// ---------------------------------------------------------------------------
// FileList
// ---------------------------------------------------------------------------

export const FileList = memo(({
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
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Focus and set selection range on the rename input when it appears
  useEffect(() => {
    if (renamingPath && renameInputRef.current) {
      const entry = entries.find(e => e.path === renamingPath);
      if (entry) {
        renameInputRef.current.focus();
        const dotIndex = entry.name.lastIndexOf('.');
        if (dotIndex > 0 && !entry.is_dir) {
          renameInputRef.current.setSelectionRange(0, dotIndex);
        } else {
          renameInputRef.current.select();
        }
      }
    }
  }, [renamingPath, entries]);

  // ── Stable callbacks ───────────────────────────────────────────────────────
  //
  // useCallback here is important: these are passed as props to every row
  // component.  Without it, every render of FileList would produce new function
  // references, defeating React.memo on the row components entirely.

  const handleRenameSubmit = useCallback((path: string, newName: string) => {
    onRename(path, newName);
  }, [onRename]);

  const handleRenameCancel = useCallback(() => {
    onSetRenamingPath(null);
  }, [onSetRenamingPath]);

  const handleRowClick = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    onToggleSelection(entry.path, e.metaKey || e.ctrlKey);
    onPreview(entry);
  }, [onToggleSelection, onPreview]);

  const handleRowDoubleClick = useCallback((entry: FileEntry) => {
    onOpen(entry);
  }, [onOpen]);

  const handleRowContextMenu = useCallback((e: React.MouseEvent, entry: FileEntry) => {
    e.preventDefault();
    if (!selectedPaths.has(entry.path)) {
      onToggleSelection(entry.path, false);
    }
    onContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: entry });
  }, [selectedPaths, onToggleSelection, onContextMenu]);

  const handleDragStart = useCallback((e: React.DragEvent, entry: FileEntry) => {
    const paths = selectedPaths.has(entry.path)
      ? Array.from(selectedPaths)
      : [entry.path];
    e.dataTransfer.setData('text/plain', JSON.stringify(paths));
    e.dataTransfer.effectAllowed = 'copyMove';
  }, [selectedPaths]);

  const handleDragOver = useCallback((e: React.DragEvent, entry: FileEntry) => {
    if (entry.is_dir) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      setDragOverPath(entry.path);
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setDragOverPath(null);
  }, []);

  const handleRowDrop = useCallback((e: React.DragEvent, entry: FileEntry) => {
    e.preventDefault();
    setDragOverPath(null);
    if (!entry.is_dir) return;
    try {
      const paths = JSON.parse(e.dataTransfer.getData('text/plain'));
      if (Array.isArray(paths)) onDrop(paths, entry.path);
    } catch {}
  }, [onDrop]);

  const handleBackgroundContextMenu = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest('.file-row, .file-grid-item')) return;
    e.preventDefault();
    onContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: null });
  }, [onContextMenu]);

  const sortIndicator = useCallback((field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }, [sortField, sortDirection]);

  // ── Shared row props (avoids rebuilding this object in every map call) ──────
  const rowHandlers = {
    renameInputRef,
    onRenameSubmit: handleRenameSubmit,
    onRenameCancel: handleRenameCancel,
    onClick: handleRowClick,
    onDoubleClick: handleRowDoubleClick,
    onContextMenu: handleRowContextMenu,
    onDragStart: handleDragStart,
    onDragOver: handleDragOver,
    onDragLeave: handleDragLeave,
    onDrop: handleRowDrop,
  };

  // ── Render ─────────────────────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="file-list-loading">
        <div className="spinner">Loading...</div>
      </div>
    );
  }

  if (entries.length === 0) {
    return (
      <div className="file-list-empty" onContextMenu={handleBackgroundContextMenu}>
        <div className="empty-message">This folder is empty</div>
      </div>
    );
  }

  if (viewMode === 'grid') {
    return (
      <div className="file-grid" onContextMenu={handleBackgroundContextMenu}>
        {entries.map(entry => (
          <GridItem
            key={entry.path}
            entry={entry}
            isSelected={selectedPaths.has(entry.path)}
            isDragOver={dragOverPath === entry.path}
            isRenaming={renamingPath === entry.path}
            {...rowHandlers}
          />
        ))}
      </div>
    );
  }

  if (viewMode === 'list') {
    return (
      <div className="file-list-view" onContextMenu={handleBackgroundContextMenu}>
        {entries.map(entry => (
          <ListItem
            key={entry.path}
            entry={entry}
            isSelected={selectedPaths.has(entry.path)}
            isDragOver={dragOverPath === entry.path}
            isRenaming={renamingPath === entry.path}
            {...rowHandlers}
          />
        ))}
      </div>
    );
  }

  // Details view (default)
  return (
    <div className="file-details" onContextMenu={handleBackgroundContextMenu}>
      <div className="details-header">
        <div className="details-col col-name" onClick={() => onToggleSort('name')}>
          Name{sortIndicator('name')}
        </div>
        <div className="details-col col-modified" onClick={() => onToggleSort('modified')}>
          Date Modified{sortIndicator('modified')}
        </div>
        <div className="details-col col-type" onClick={() => onToggleSort('extension')}>
          Type{sortIndicator('extension')}
        </div>
        <div className="details-col col-size" onClick={() => onToggleSort('size')}>
          Size{sortIndicator('size')}
        </div>
      </div>
      <div className="details-body">
        {entries.map(entry => (
          <DetailsRow
            key={entry.path}
            entry={entry}
            isSelected={selectedPaths.has(entry.path)}
            isDragOver={dragOverPath === entry.path}
            isRenaming={renamingPath === entry.path}
            {...rowHandlers}
          />
        ))}
      </div>
    </div>
  );
});
