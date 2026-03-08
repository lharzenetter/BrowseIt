import {
  useState, useRef, useEffect, useCallback, memo, useLayoutEffect,
} from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import type { FileEntry, ViewMode, SortField, SortDirection, ContextMenuState } from '../types';
import { formatFileSize, formatDate, getFileIcon, getFileType } from '../utils/format';

// Row heights must match CSS exactly so the virtual spacer is the right size.
const DETAILS_ROW_HEIGHT = 30; // .file-row { height: 30px }
const LIST_ROW_HEIGHT = 28;    // .file-list-item: 12px font * 1.4 lh + 8px padding = ~28px
const GRID_ITEM_WIDTH = 96;    // .file-grid-item { width: 96px }
const GRID_ITEM_HEIGHT = 110;  // icon 40px + mb 4px + name ~2 lines + padding 10/6px
const GRID_GAP = 4;            // gap: 4px
const GRID_PADDING = 12;       // padding: 12px on .file-grid
// Rows above/below the visible window that stay mounted. Keeps scrolling smooth
// and ensures the rename input is reachable for items just off-screen.
const OVERSCAN = 10;

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
  /** Called with a scrollToIndex function so the parent (App) can scroll on
   *  keyboard arrow-key navigation. */
  onVirtualizerReady?: (scrollToIndex: (index: number) => void) => void;
}

// ---------------------------------------------------------------------------
// Rename input
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
// Row components — identical to before; virtualization is in the parent
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
  onVirtualizerReady,
}: FileListProps) => {
  const [dragOverPath, setDragOverPath] = useState<string | null>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Scroll containers — one ref per view mode. useVirtualizer needs a stable
  // ref to the scrollable element.
  const detailsBodyRef = useRef<HTMLDivElement>(null);
  const listBodyRef = useRef<HTMLDivElement>(null);
  const gridBodyRef = useRef<HTMLDivElement>(null);

  // Grid column count — derived from container width, recalculated on resize.
  const [gridColumns, setGridColumns] = useState(6);
  useLayoutEffect(() => {
    const el = gridBodyRef.current;
    if (!el) return;
    const update = () => {
      const available = el.clientWidth - GRID_PADDING * 2;
      const cols = Math.max(1, Math.floor((available + GRID_GAP) / (GRID_ITEM_WIDTH + GRID_GAP)));
      setGridColumns(cols);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, [viewMode]); // re-run when switching to grid so ref is populated

  // ── Virtualizers ───────────────────────────────────────────────────────────

  const detailsVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => detailsBodyRef.current,
    estimateSize: () => DETAILS_ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  const listVirtualizer = useVirtualizer({
    count: entries.length,
    getScrollElement: () => listBodyRef.current,
    estimateSize: () => LIST_ROW_HEIGHT,
    overscan: OVERSCAN,
  });

  // Grid virtualizer: each "row" holds `gridColumns` items.
  const gridRowCount = Math.ceil(entries.length / gridColumns);
  const gridVirtualizer = useVirtualizer({
    count: gridRowCount,
    getScrollElement: () => gridBodyRef.current,
    estimateSize: () => GRID_ITEM_HEIGHT + GRID_GAP,
    overscan: OVERSCAN,
  });

  // ── Expose scrollToIndex to the parent ────────────────────────────────────
  // App.tsx uses this for keyboard arrow-key navigation so the selected row
  // is always scrolled into view even when it's outside the virtual window.
  useEffect(() => {
    if (!onVirtualizerReady) return;
    const scrollToIndex = (index: number) => {
      if (viewMode === 'details') {
        detailsVirtualizer.scrollToIndex(index, { align: 'auto' });
      } else if (viewMode === 'list') {
        listVirtualizer.scrollToIndex(index, { align: 'auto' });
      } else {
        const rowIndex = Math.floor(index / gridColumns);
        gridVirtualizer.scrollToIndex(rowIndex, { align: 'auto' });
      }
    };
    onVirtualizerReady(scrollToIndex);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onVirtualizerReady, viewMode, gridColumns]);

  // ── Scroll to top when the directory changes ──────────────────────────────
  // `entries` is a new array reference every time loadDirectory() completes.
  // Reset all three scroll containers so a freshly-navigated folder always
  // starts at the top regardless of which view mode is active.
  useEffect(() => {
    if (detailsBodyRef.current) detailsBodyRef.current.scrollTop = 0;
    if (listBodyRef.current)    listBodyRef.current.scrollTop = 0;
    if (gridBodyRef.current)    gridBodyRef.current.scrollTop = 0;
  }, [entries]);

  // ── Rename: focus + selection range ───────────────────────────────────────
  // When renamingPath is set, first scroll the target index into view so the
  // virtualizer renders its row, then focus the input on the next frame.
  useEffect(() => {
    if (!renamingPath) return;
    const index = entries.findIndex(e => e.path === renamingPath);
    if (index === -1) return;

    if (viewMode === 'details') {
      detailsVirtualizer.scrollToIndex(index, { align: 'auto' });
    } else if (viewMode === 'list') {
      listVirtualizer.scrollToIndex(index, { align: 'auto' });
    } else {
      gridVirtualizer.scrollToIndex(Math.floor(index / gridColumns), { align: 'auto' });
    }

    // Wait one frame for the virtualizer to mount the row, then focus.
    const raf = requestAnimationFrame(() => {
      if (renameInputRef.current) {
        const entry = entries[index];
        renameInputRef.current.focus();
        const dotIndex = entry.name.lastIndexOf('.');
        if (dotIndex > 0 && !entry.is_dir) {
          renameInputRef.current.setSelectionRange(0, dotIndex);
        } else {
          renameInputRef.current.select();
        }
      }
    });
    return () => cancelAnimationFrame(raf);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [renamingPath]);

  // ── Stable callbacks ───────────────────────────────────────────────────────

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

  const handleDragLeave = useCallback(() => setDragOverPath(null), []);

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
    if ((e.target as HTMLElement).closest('.file-row, .file-grid-item, .file-list-item')) return;
    e.preventDefault();
    onContextMenu({ visible: true, x: e.clientX, y: e.clientY, target: null });
  }, [onContextMenu]);

  const sortIndicator = useCallback((field: SortField) => {
    if (sortField !== field) return '';
    return sortDirection === 'asc' ? ' ▲' : ' ▼';
  }, [sortField, sortDirection]);

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

  // ── Details view ───────────────────────────────────────────────────────────
  if (viewMode === 'details') {
    const items = detailsVirtualizer.getVirtualItems();
    return (
      <div className="file-details">
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

        {/* Scroll container — must have a fixed height for the virtualizer */}
        <div
          ref={detailsBodyRef}
          className="details-body"
          onContextMenu={handleBackgroundContextMenu}
        >
          {/* Total height spacer — makes the scrollbar accurate */}
          <div style={{ height: detailsVirtualizer.getTotalSize(), position: 'relative' }}>
            {/* Absolutely-positioned strip containing only the visible rows */}
            <div
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${items[0]?.start ?? 0}px)`,
              }}
            >
              {items.map(virtualRow => {
                const entry = entries[virtualRow.index];
                return (
                  <DetailsRow
                    key={entry.path}
                    entry={entry}
                    isSelected={selectedPaths.has(entry.path)}
                    isDragOver={dragOverPath === entry.path}
                    isRenaming={renamingPath === entry.path}
                    {...rowHandlers}
                  />
                );
              })}
            </div>
          </div>
        </div>
      </div>
    );
  }

  // ── List view ──────────────────────────────────────────────────────────────
  if (viewMode === 'list') {
    const items = listVirtualizer.getVirtualItems();
    return (
      <div
        ref={listBodyRef}
        className="file-list-view"
        onContextMenu={handleBackgroundContextMenu}
      >
        <div style={{ height: listVirtualizer.getTotalSize(), position: 'relative' }}>
          <div
            style={{
              position: 'absolute',
              top: 0,
              left: 0,
              width: '100%',
              transform: `translateY(${items[0]?.start ?? 0}px)`,
            }}
          >
            {items.map(virtualRow => {
              const entry = entries[virtualRow.index];
              return (
                <ListItem
                  key={entry.path}
                  entry={entry}
                  isSelected={selectedPaths.has(entry.path)}
                  isDragOver={dragOverPath === entry.path}
                  isRenaming={renamingPath === entry.path}
                  {...rowHandlers}
                />
              );
            })}
          </div>
        </div>
      </div>
    );
  }

  // ── Grid view ──────────────────────────────────────────────────────────────
  // The grid virtualizer works row-by-row. Each virtual row contains
  // `gridColumns` items laid out in a flex row.
  const gridRows = gridVirtualizer.getVirtualItems();
  return (
    <div
      ref={gridBodyRef}
      className="file-grid-virtual"
      onContextMenu={handleBackgroundContextMenu}
    >
      <div style={{ height: gridVirtualizer.getTotalSize(), position: 'relative' }}>
        <div
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            width: '100%',
            transform: `translateY(${gridRows[0]?.start ?? 0}px)`,
          }}
        >
          {gridRows.map(virtualRow => {
            const rowStartIndex = virtualRow.index * gridColumns;
            const rowItems = entries.slice(rowStartIndex, rowStartIndex + gridColumns);
            return (
              <div key={virtualRow.index} className="file-grid-row">
                {rowItems.map(entry => (
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
          })}
        </div>
      </div>
    </div>
  );
});
