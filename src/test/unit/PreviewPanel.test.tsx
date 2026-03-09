import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { PreviewPanel } from '../../components/PreviewPanel';
import type { FileEntry } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeEntry(overrides: Partial<FileEntry> = {}): FileEntry {
  return {
    name: 'readme.txt',
    path: '/fake/Documents/readme.txt',
    is_dir: false,
    is_hidden: false,
    is_symlink: false,
    size: 512,
    modified: 1700000000,
    created: 1690000000,
    extension: 'txt',
    permissions: 'rw-r--r--',
    ...overrides,
  };
}

/** A promise that never settles — simulates an in-flight network/IPC call. */
function pendingPromise<T>(): Promise<T> {
  return new Promise(() => {});
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('PreviewPanel', () => {
  let onReadFile: ReturnType<typeof vi.fn<(path: string) => Promise<string>>>;
  let onClose: ReturnType<typeof vi.fn<() => void>>;

  beforeEach(() => {
    // Default: never settles — prevents spurious act() warnings in tests that
    // only care about synchronous rendering and don't need the preview content.
    onReadFile = vi.fn<(path: string) => Promise<string>>().mockReturnValue(pendingPromise());
    onClose = vi.fn<() => void>();
  });

  // ── Visibility guard ───────────────────────────────────────────────────

  it('renders nothing when visible=false', () => {
    const { container } = render(
      <PreviewPanel
        entry={makeEntry()}
        visible={false}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  it('renders nothing when entry=null', () => {
    const { container } = render(
      <PreviewPanel
        entry={null}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(container.firstChild).toBeNull();
  });

  // ── Metadata rendering ─────────────────────────────────────────────────

  it('displays the file name', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ name: 'report.pdf', extension: 'pdf' })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.getByText('report.pdf')).toBeInTheDocument();
  });

  it('displays the file path', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ path: '/home/user/notes.txt' })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.getByText('/home/user/notes.txt')).toBeInTheDocument();
  });

  it('displays formatted file size for non-directories', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ size: 2048 })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.getByText('2 KB')).toBeInTheDocument();
  });

  it('does not display a size row for directories', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ is_dir: true, size: 0 })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    // "Size:" label must not appear
    expect(screen.queryByText('Size:')).not.toBeInTheDocument();
  });

  it('shows symlink indicator when is_symlink=true', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ is_symlink: true })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.getByText('Symlink:')).toBeInTheDocument();
    expect(screen.getByText('Yes')).toBeInTheDocument();
  });

  it('does not show symlink row when is_symlink=false', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ is_symlink: false })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.queryByText('Symlink:')).not.toBeInTheDocument();
  });

  // ── Close button ───────────────────────────────────────────────────────

  it('calls onClose when the close button is clicked', async () => {
    render(
      <PreviewPanel
        entry={makeEntry()}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    await userEvent.click(screen.getByRole('button'));
    expect(onClose).toHaveBeenCalledOnce();
  });

  // ── onReadFile delegation ─────────────────────────────────────────────

  it('calls onReadFile with the entry path for a known text extension', async () => {
    render(
      <PreviewPanel
        entry={makeEntry({ path: '/docs/notes.md', extension: 'md' })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    await waitFor(() => expect(onReadFile).toHaveBeenCalledWith('/docs/notes.md'));
  });

  it('calls onReadFile for a small file with an unknown extension', async () => {
    render(
      <PreviewPanel
        // size < 50000 triggers preview regardless of extension
        entry={makeEntry({ path: '/docs/mystery', extension: '', size: 100 })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    await waitFor(() => expect(onReadFile).toHaveBeenCalledWith('/docs/mystery'));
  });

  it('does NOT call onReadFile for directories', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ is_dir: true, extension: '' })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(onReadFile).not.toHaveBeenCalled();
  });

  it('does NOT call onReadFile for large files with a non-text extension', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ extension: 'bin', size: 100_000 })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(onReadFile).not.toHaveBeenCalled();
  });

  // ── Text preview rendering ─────────────────────────────────────────────

  it('displays the text returned by onReadFile', async () => {
    onReadFile.mockResolvedValue('Hello, world!'); // override default pending promise
    render(
      <PreviewPanel
        entry={makeEntry()}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    await waitFor(() => expect(screen.getByText('Hello, world!')).toBeInTheDocument());
  });

  it('shows a loading indicator while onReadFile is pending', () => {
    onReadFile.mockReturnValue(pendingPromise());
    render(
      <PreviewPanel
        entry={makeEntry()}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.getByText('Loading preview...')).toBeInTheDocument();
  });

  it('does not show a loading indicator after onReadFile resolves', async () => {
    onReadFile.mockResolvedValue(''); // override default pending promise so loading clears
    render(
      <PreviewPanel
        entry={makeEntry()}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    await waitFor(() =>
      expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument(),
    );
  });

  it('shows no text preview when onReadFile rejects', async () => {
    onReadFile.mockRejectedValue(new Error('permission denied')); // override default pending promise
    render(
      <PreviewPanel
        entry={makeEntry()}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    // After the rejection settles there must be no <pre> element
    await waitFor(() =>
      expect(screen.queryByText('Loading preview...')).not.toBeInTheDocument(),
    );
    expect(screen.queryByRole('generic', { name: /pre/i })).not.toBeInTheDocument();
    // The component must not crash — the panel header is still rendered
    expect(screen.getByText('Preview')).toBeInTheDocument();
  });

  // ── Image preview ──────────────────────────────────────────────────────

  it('renders an <img> for image file extensions', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ name: 'photo.jpg', path: '/photos/photo.jpg', extension: 'jpg' })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    const img = screen.getByRole('img', { name: 'photo.jpg' });
    expect(img).toBeInTheDocument();
    expect(img).toHaveAttribute('src', 'asset://localhost//photos/photo.jpg');
  });

  it('does NOT render an <img> for non-image extensions', () => {
    render(
      <PreviewPanel
        entry={makeEntry({ name: 'data.json', extension: 'json' })}
        visible={true}
        onClose={onClose}
        onReadFile={onReadFile}
      />,
    );
    expect(screen.queryByRole('img')).not.toBeInTheDocument();
  });

  // ── Re-render behaviour ────────────────────────────────────────────────

  it('calls onReadFile again when the entry changes', async () => {
    onReadFile.mockResolvedValue(''); // needs to resolve so waitFor assertions settle
    const entry1 = makeEntry({ path: '/docs/a.txt', name: 'a.txt' });
    const entry2 = makeEntry({ path: '/docs/b.txt', name: 'b.txt' });

    const { rerender } = render(
      <PreviewPanel entry={entry1} visible={true} onClose={onClose} onReadFile={onReadFile} />,
    );
    await waitFor(() => expect(onReadFile).toHaveBeenCalledWith('/docs/a.txt'));

    rerender(
      <PreviewPanel entry={entry2} visible={true} onClose={onClose} onReadFile={onReadFile} />,
    );
    await waitFor(() => expect(onReadFile).toHaveBeenCalledWith('/docs/b.txt'));
    expect(onReadFile).toHaveBeenCalledTimes(2);
  });
});
