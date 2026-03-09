import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ContextMenu } from '../../components/ContextMenu';
import type { ContextMenuState, CustomContextAction, FileEntry } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'file.txt',
    path: '/fake/file.txt',
    is_dir: false,
    is_hidden: false,
    is_symlink: false,
    size: 1024,
    modified: null,
    created: null,
    extension: 'txt',
    permissions: 'rw-r--r--',
    ...overrides,
  };
}

function makeState(overrides: Partial<ContextMenuState> = {}): ContextMenuState {
  return { visible: true, x: 100, y: 100, target: makeEntry(), ...overrides };
}

interface RenderOptions {
  state?: ContextMenuState;
  hasClipboard?: boolean;
  isPinned?: boolean;
  customActions?: CustomContextAction[];
}

function renderMenu(options: RenderOptions = {}) {
  const {
    state = makeState(),
    hasClipboard = false,
    isPinned = false,
    customActions = [],
  } = options;

  const handlers = {
    onClose: vi.fn(),
    onOpen: vi.fn(),
    onCopy: vi.fn(),
    onCut: vi.fn(),
    onPaste: vi.fn(),
    onDelete: vi.fn(),
    onRename: vi.fn(),
    onNewFolder: vi.fn(),
    onNewFile: vi.fn(),
    onGetInfo: vi.fn(),
    onOpenInTerminal: vi.fn(),
    onOpenInNewWindow: vi.fn(),
    onOpenInNewTab: vi.fn(),
    onCompressToZip: vi.fn(),
    onPinQuickAccess: vi.fn(),
    onUnpinQuickAccess: vi.fn(),
    onCustomAction: vi.fn(),
  };

  render(
    <ContextMenu
      state={state}
      hasClipboard={hasClipboard}
      isPinned={isPinned}
      customActions={customActions}
      {...handlers}
    />,
  );

  return handlers;
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('ContextMenu', () => {
  // ── Visibility guard ───────────────────────────────────────────────────────

  it('renders nothing when visible=false', () => {
    const { container } = render(
      <ContextMenu
        state={{ visible: false, x: 0, y: 0, target: null }}
        hasClipboard={false}
        isPinned={false}
        customActions={[]}
        onClose={vi.fn()} onOpen={vi.fn()} onCopy={vi.fn()} onCut={vi.fn()}
        onPaste={vi.fn()} onDelete={vi.fn()} onRename={vi.fn()} onNewFolder={vi.fn()}
        onNewFile={vi.fn()} onGetInfo={vi.fn()} onOpenInTerminal={vi.fn()}
        onOpenInNewWindow={vi.fn()} onOpenInNewTab={vi.fn()} onCompressToZip={vi.fn()}
        onPinQuickAccess={vi.fn()} onUnpinQuickAccess={vi.fn()} onCustomAction={vi.fn()}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  // ── Target vs. no-target items ────────────────────────────────────────────

  it('shows file-specific items (Open, Cut, Copy, Rename, Delete) when target is set', () => {
    renderMenu();
    expect(screen.getByText('Open')).toBeInTheDocument();
    expect(screen.getByTitle('Cut')).toBeInTheDocument();
    expect(screen.getByTitle('Copy')).toBeInTheDocument();
    expect(screen.getByTitle('Rename')).toBeInTheDocument();
    expect(screen.getByTitle('Delete')).toBeInTheDocument();
  });

  it('shows background items (New Folder, New File) when target is null', () => {
    renderMenu({ state: makeState({ target: null }) });
    expect(screen.getByText('New Folder')).toBeInTheDocument();
    expect(screen.getByText('New File')).toBeInTheDocument();
  });

  it('does not show "Open" when target is null', () => {
    renderMenu({ state: makeState({ target: null }) });
    expect(screen.queryByText('Open')).not.toBeInTheDocument();
  });

  // ── Clipboard (Paste button) ──────────────────────────────────────────────

  it('shows Paste button in icon bar when hasClipboard=true and target is set', () => {
    renderMenu({ hasClipboard: true });
    expect(screen.getByTitle('Paste')).toBeInTheDocument();
  });

  it('hides Paste button in icon bar when hasClipboard=false', () => {
    renderMenu({ hasClipboard: false });
    expect(screen.queryByTitle('Paste')).not.toBeInTheDocument();
  });

  it('shows Paste menu item in background context when hasClipboard=true and target is null', () => {
    renderMenu({ state: makeState({ target: null }), hasClipboard: true });
    expect(screen.getByText('Paste')).toBeInTheDocument();
  });

  it('hides Paste menu item in background context when hasClipboard=false', () => {
    renderMenu({ state: makeState({ target: null }), hasClipboard: false });
    expect(screen.queryByText('Paste')).not.toBeInTheDocument();
  });

  // ── Pin / Unpin ───────────────────────────────────────────────────────────

  it('shows "Pin to Quick access" for a directory when isPinned=false', () => {
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: true }) }),
      isPinned: false,
    });
    expect(screen.getByText('Pin to Quick access')).toBeInTheDocument();
    expect(screen.queryByText('Unpin from Quick access')).not.toBeInTheDocument();
  });

  it('shows "Unpin from Quick access" for a directory when isPinned=true', () => {
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: true }) }),
      isPinned: true,
    });
    expect(screen.getByText('Unpin from Quick access')).toBeInTheDocument();
    expect(screen.queryByText('Pin to Quick access')).not.toBeInTheDocument();
  });

  it('hides pin/unpin items for files', () => {
    renderMenu({ state: makeState({ target: makeEntry({ is_dir: false }) }) });
    expect(screen.queryByText('Pin to Quick access')).not.toBeInTheDocument();
    expect(screen.queryByText('Unpin from Quick access')).not.toBeInTheDocument();
  });

  // ── Custom actions filtering ──────────────────────────────────────────────

  it('renders a custom action with applies_to="both" for files', () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'Do both', command: 'cmd', args: '', applies_to: 'both',
    };
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: false }) }),
      customActions: [action],
    });
    expect(screen.getByText('Do both')).toBeInTheDocument();
  });

  it('renders a custom action with applies_to="both" for directories', () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'Do both', command: 'cmd', args: '', applies_to: 'both',
    };
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: true }) }),
      customActions: [action],
    });
    expect(screen.getByText('Do both')).toBeInTheDocument();
  });

  it('renders a custom action with applies_to="files" only for files', () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'File only', command: 'cmd', args: '', applies_to: 'files',
    };
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: false }) }),
      customActions: [action],
    });
    expect(screen.getByText('File only')).toBeInTheDocument();
  });

  it('hides a custom action with applies_to="files" for directories', () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'File only', command: 'cmd', args: '', applies_to: 'files',
    };
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: true }) }),
      customActions: [action],
    });
    expect(screen.queryByText('File only')).not.toBeInTheDocument();
  });

  it('renders a custom action with applies_to="directories" only for directories', () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'Dir only', command: 'cmd', args: '', applies_to: 'directories',
    };
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: true }) }),
      customActions: [action],
    });
    expect(screen.getByText('Dir only')).toBeInTheDocument();
  });

  it('hides a custom action with applies_to="directories" for files', () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'Dir only', command: 'cmd', args: '', applies_to: 'directories',
    };
    renderMenu({
      state: makeState({ target: makeEntry({ is_dir: false }) }),
      customActions: [action],
    });
    expect(screen.queryByText('Dir only')).not.toBeInTheDocument();
  });

  // ── Keyboard / outside-click dismissal ───────────────────────────────────

  it('calls onClose when Escape is pressed', async () => {
    const { onClose } = renderMenu();
    await userEvent.keyboard('{Escape}');
    expect(onClose).toHaveBeenCalled();
  });

  it('calls onClose when clicking outside the menu', async () => {
    const { onClose } = renderMenu();
    // Clicking document body fires the global click listener registered in ContextMenu
    await userEvent.click(document.body);
    expect(onClose).toHaveBeenCalled();
  });

  // ── Callback wiring ───────────────────────────────────────────────────────

  it('calls onOpen when "Open" is clicked', async () => {
    const { onOpen } = renderMenu();
    await userEvent.click(screen.getByText('Open'));
    expect(onOpen).toHaveBeenCalledOnce();
  });

  it('calls onCut when Cut button is clicked', async () => {
    const { onCut } = renderMenu();
    await userEvent.click(screen.getByTitle('Cut'));
    expect(onCut).toHaveBeenCalledOnce();
  });

  it('calls onCopy when Copy button is clicked', async () => {
    const { onCopy } = renderMenu();
    await userEvent.click(screen.getByTitle('Copy'));
    expect(onCopy).toHaveBeenCalledOnce();
  });

  it('calls onDelete when Delete button is clicked', async () => {
    const { onDelete } = renderMenu();
    await userEvent.click(screen.getByTitle('Delete'));
    expect(onDelete).toHaveBeenCalledOnce();
  });

  it('calls onRename when Rename button is clicked', async () => {
    const { onRename } = renderMenu();
    await userEvent.click(screen.getByTitle('Rename'));
    expect(onRename).toHaveBeenCalledOnce();
  });

  it('calls onPinQuickAccess with the target path when "Pin" is clicked', async () => {
    const target = makeEntry({ is_dir: true, path: '/fake/dir' });
    const { onPinQuickAccess } = renderMenu({
      state: makeState({ target }),
      isPinned: false,
    });
    await userEvent.click(screen.getByText('Pin to Quick access'));
    expect(onPinQuickAccess).toHaveBeenCalledWith('/fake/dir');
  });

  it('calls onCustomAction when a custom action item is clicked', async () => {
    const action: CustomContextAction = {
      id: 'a1', label: 'Run Script', command: 'sh', args: '', applies_to: 'both',
    };
    const { onCustomAction } = renderMenu({ customActions: [action] });
    await userEvent.click(screen.getByText('Run Script'));
    expect(onCustomAction).toHaveBeenCalledWith(action);
  });

  // ── Position ──────────────────────────────────────────────────────────────

  it('positions the menu at the given coordinates', () => {
    renderMenu({ state: makeState({ x: 200, y: 350 }) });
    const menu = document.querySelector('.context-menu') as HTMLElement;
    expect(menu.style.left).toBe('200px');
    expect(menu.style.top).toBe('350px');
  });
});
