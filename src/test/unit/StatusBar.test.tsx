import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBar } from '../../components/StatusBar';
import type { FileEntry } from '../../types';

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

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('StatusBar', () => {
  // ── Item counts ───────────────────────────────────────────────────────────

  it('shows folder and file counts', () => {
    const entries = [
      makeEntry({ name: 'dir', path: '/p/dir', is_dir: true }),
      makeEntry({ name: 'a.txt', path: '/p/a.txt' }),
      makeEntry({ name: 'b.txt', path: '/p/b.txt' }),
    ];
    render(
      <StatusBar
        entries={entries}
        selectedPaths={new Set()}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    expect(screen.getByText(/1 folder,\s*2 files/)).toBeInTheDocument();
  });

  it('uses singular "folder" and "file" for counts of 1', () => {
    const entries = [
      makeEntry({ name: 'dir', path: '/p/dir', is_dir: true }),
      makeEntry({ name: 'a.txt', path: '/p/a.txt' }),
    ];
    render(
      <StatusBar
        entries={entries}
        selectedPaths={new Set()}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    expect(screen.getByText(/1 folder,\s*1 file$/)).toBeInTheDocument();
  });

  it('handles zero folders and zero files', () => {
    render(
      <StatusBar
        entries={[]}
        selectedPaths={new Set()}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    expect(screen.getByText(/0 folders,\s*0 files/)).toBeInTheDocument();
  });

  // ── Search result count ───────────────────────────────────────────────────

  it('shows search result count instead of folder/file counts when searchResultCount is set', () => {
    const entries = [makeEntry(), makeEntry({ path: '/p/b.txt' })];
    render(
      <StatusBar
        entries={entries}
        selectedPaths={new Set()}
        searchResultCount={42}
        currentPath="/p"
      />,
    );
    expect(screen.getByText('42 search results')).toBeInTheDocument();
    expect(screen.queryByText(/folders/)).not.toBeInTheDocument();
  });

  it('shows folder/file counts when searchResultCount is null', () => {
    render(
      <StatusBar
        entries={[makeEntry(), makeEntry({ path: '/p/b.txt' })]}
        selectedPaths={new Set()}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    expect(screen.queryByText(/search results/)).not.toBeInTheDocument();
    expect(screen.getByText(/files/)).toBeInTheDocument();
  });

  // ── Selection display ─────────────────────────────────────────────────────

  it('shows selected count when paths are selected', () => {
    const entry = makeEntry({ path: '/p/a.txt' });
    render(
      <StatusBar
        entries={[entry]}
        selectedPaths={new Set(['/p/a.txt'])}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    expect(screen.getByText(/1 selected/)).toBeInTheDocument();
  });

  it('does not show selection info when nothing is selected', () => {
    render(
      <StatusBar
        entries={[makeEntry()]}
        selectedPaths={new Set()}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    expect(screen.queryByText(/selected/)).not.toBeInTheDocument();
  });

  // ── Selected size ─────────────────────────────────────────────────────────

  it('shows total size of selected files (excluding directories)', () => {
    const file1 = makeEntry({ path: '/p/a.txt', size: 1024 });
    const file2 = makeEntry({ path: '/p/b.txt', size: 1024 });
    const dir = makeEntry({ path: '/p/dir', is_dir: true, size: 0 });
    render(
      <StatusBar
        entries={[file1, file2, dir]}
        selectedPaths={new Set(['/p/a.txt', '/p/b.txt', '/p/dir'])}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    // 1024 + 1024 = 2048 = 2 KB
    expect(screen.getByText(/2 KB/)).toBeInTheDocument();
  });

  it('does not show size when only directories are selected', () => {
    const dir = makeEntry({ path: '/p/dir', is_dir: true, size: 0 });
    render(
      <StatusBar
        entries={[dir]}
        selectedPaths={new Set(['/p/dir'])}
        searchResultCount={null}
        currentPath="/p"
      />,
    );
    // "1 selected" without size
    expect(screen.getByText('1 selected')).toBeInTheDocument();
    expect(screen.queryByText(/KB|MB|B\)/)).not.toBeInTheDocument();
  });

  // ── Current path ──────────────────────────────────────────────────────────

  it('displays the current path on the right', () => {
    render(
      <StatusBar
        entries={[]}
        selectedPaths={new Set()}
        searchResultCount={null}
        currentPath="/home/user/Documents"
      />,
    );
    expect(screen.getByText('/home/user/Documents')).toBeInTheDocument();
  });
});
