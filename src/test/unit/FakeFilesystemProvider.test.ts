import { describe, it, expect, beforeEach } from 'vitest';
import { FakeFilesystemProvider } from '../../filesystem/FakeFilesystemProvider';

// Use a tiny tree so tests are fast (totalFiles=0 means only pre-built dirs)
function makeFs() {
  return new FakeFilesystemProvider({
    totalFiles: 10,
    topLevelDirs: 2,
    includeFlatDirectory: false,
    seed: 1,
  });
}

describe('FakeFilesystemProvider', () => {
  let fs: FakeFilesystemProvider;

  beforeEach(() => {
    fs = makeFs();
  });

  // ── Navigation ──────────────────────────────────────────────────────────

  describe('getHomeDirectory', () => {
    it('returns the home path', async () => {
      expect(await fs.getHomeDirectory()).toBe('/fake/Documents');
    });
  });

  describe('getParentPath', () => {
    it('returns parent for a nested path', async () => {
      const parent = await fs.getParentPath('/fake/Documents/dir-0');
      expect(parent).toBe('/fake/Documents');
    });

    it('returns null at the root', async () => {
      const parent = await fs.getParentPath('/fake');
      expect(parent).toBeNull();
    });
  });

  describe('getPathComponents', () => {
    it('returns breadcrumb components', async () => {
      const crumbs = await fs.getPathComponents('/fake/Documents/dir-0');
      expect(crumbs.length).toBeGreaterThan(0);
      // Each component is a [label, path] tuple
      expect(crumbs[crumbs.length - 1][1]).toBe('/fake/Documents/dir-0');
    });
  });

  // ── Directory listing ───────────────────────────────────────────────────

  describe('listDirectory', () => {
    it('returns entries for the home directory', async () => {
      const entries = await fs.listDirectory('/fake/Documents', false);
      expect(entries.length).toBeGreaterThan(0);
    });

    it('all returned entries are objects with required fields', async () => {
      const entries = await fs.listDirectory('/fake/Documents', false);
      for (const e of entries) {
        expect(e).toHaveProperty('name');
        expect(e).toHaveProperty('path');
        expect(e).toHaveProperty('is_dir');
        expect(e).toHaveProperty('size');
      }
    });

    it('does not return hidden files when showHidden=false', async () => {
      const entries = await fs.listDirectory('/fake/Documents', false);
      expect(entries.every(e => !e.is_hidden)).toBe(true);
    });
  });

  // ── CRUD operations ─────────────────────────────────────────────────────

  describe('createDirectory', () => {
    it('adds the new directory to the parent listing', async () => {
      await fs.createDirectory('/fake/Documents/NewFolder');
      const entries = await fs.listDirectory('/fake/Documents', false);
      expect(entries.some(e => e.name === 'NewFolder' && e.is_dir)).toBe(true);
    });
  });

  describe('createFile', () => {
    it('adds the new file to the parent listing', async () => {
      await fs.createFile('/fake/Documents/hello.txt');
      const entries = await fs.listDirectory('/fake/Documents', false);
      expect(entries.some(e => e.name === 'hello.txt' && !e.is_dir)).toBe(true);
    });
  });

  describe('renameItem', () => {
    it('removes the old entry and adds the renamed one', async () => {
      await fs.createFile('/fake/Documents/old.txt');
      await fs.renameItem('/fake/Documents/old.txt', '/fake/Documents/new.txt');
      const entries = await fs.listDirectory('/fake/Documents', false);
      expect(entries.some(e => e.name === 'old.txt')).toBe(false);
      expect(entries.some(e => e.name === 'new.txt')).toBe(true);
    });
  });

  describe('deleteItems', () => {
    it('removes the item from its parent directory', async () => {
      await fs.createFile('/fake/Documents/to-delete.txt');
      await fs.deleteItems(['/fake/Documents/to-delete.txt'], false);
      const entries = await fs.listDirectory('/fake/Documents', false);
      expect(entries.some(e => e.name === 'to-delete.txt')).toBe(false);
    });

    it('handles non-existent paths silently', async () => {
      await expect(fs.deleteItems(['/fake/Documents/ghost.txt'], false)).resolves.not.toThrow();
    });
  });

  describe('copyItems', () => {
    it('creates a copy at the destination and keeps the original', async () => {
      await fs.createDirectory('/fake/Documents/src-dir');
      await fs.createFile('/fake/Documents/src-dir/file.txt');
      await fs.createDirectory('/fake/Documents/dest-dir');

      await fs.copyItems(['/fake/Documents/src-dir/file.txt'], '/fake/Documents/dest-dir');

      const src = await fs.listDirectory('/fake/Documents/src-dir', false);
      const dest = await fs.listDirectory('/fake/Documents/dest-dir', false);

      expect(src.some(e => e.name === 'file.txt')).toBe(true);
      expect(dest.some(e => e.name === 'file.txt')).toBe(true);
    });
  });

  describe('moveItems', () => {
    it('moves the item to the destination and removes it from the source', async () => {
      await fs.createDirectory('/fake/Documents/from-dir');
      await fs.createFile('/fake/Documents/from-dir/moving.txt');
      await fs.createDirectory('/fake/Documents/to-dir');

      await fs.moveItems(['/fake/Documents/from-dir/moving.txt'], '/fake/Documents/to-dir');

      const src = await fs.listDirectory('/fake/Documents/from-dir', false);
      const dest = await fs.listDirectory('/fake/Documents/to-dir', false);

      expect(src.some(e => e.name === 'moving.txt')).toBe(false);
      expect(dest.some(e => e.name === 'moving.txt')).toBe(true);
    });
  });

  // ── Search ──────────────────────────────────────────────────────────────

  describe('searchFiles', () => {
    it('returns matching entries', async () => {
      await fs.createFile('/fake/Documents/report-2024.pdf');
      const result = await fs.searchFiles('/fake/Documents', 'report', 10);
      expect(result.entries.some(e => e.name === 'report-2024.pdf')).toBe(true);
    });

    it('returns empty results for a query with no matches', async () => {
      const result = await fs.searchFiles('/fake/Documents', 'zzznonexistent', 10);
      expect(result.entries).toHaveLength(0);
      expect(result.total).toBe(0);
    });

    it('respects maxResults limit', async () => {
      const result = await fs.searchFiles('/fake/Documents', 'file', 2);
      expect(result.entries.length).toBeLessThanOrEqual(2);
    });
  });

  // ── Pinned quick-access ─────────────────────────────────────────────────

  describe('addPinnedQuickAccess / removePinnedQuickAccess', () => {
    it('adds a path to pinned list', async () => {
      const updated = await fs.addPinnedQuickAccess('/fake/Documents');
      expect(updated).toContain('/fake/Documents');
    });

    it('does not add duplicates', async () => {
      await fs.addPinnedQuickAccess('/fake/Documents');
      const updated = await fs.addPinnedQuickAccess('/fake/Documents');
      expect(updated.filter(p => p === '/fake/Documents')).toHaveLength(1);
    });

    it('removes a path from the pinned list', async () => {
      await fs.addPinnedQuickAccess('/fake/Documents');
      const updated = await fs.removePinnedQuickAccess('/fake/Documents');
      expect(updated).not.toContain('/fake/Documents');
    });
  });

  // ── Settings ────────────────────────────────────────────────────────────

  describe('saveSettings / getSettings', () => {
    it('persists and retrieves settings', async () => {
      const newSettings = {
        terminal: 'iTerm',
        custom_context_actions: [],
        show_hidden: true,
        hidden_home_paths: [],
      };
      await fs.saveSettings(newSettings);
      const loaded = await fs.getSettings();
      expect(loaded.terminal).toBe('iTerm');
      expect(loaded.show_hidden).toBe(true);
    });
  });
});
