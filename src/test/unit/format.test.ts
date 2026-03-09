import { describe, it, expect } from 'vitest';
import { formatFileSize, formatDate, getFileType, getFileIcon } from '../../utils/format';

// ---------------------------------------------------------------------------
// formatFileSize
// ---------------------------------------------------------------------------

describe('formatFileSize', () => {
  it('returns — for 0 bytes', () => {
    expect(formatFileSize(0)).toBe('—');
  });

  it('formats bytes', () => {
    expect(formatFileSize(1)).toBe('1 B');
    expect(formatFileSize(512)).toBe('512 B');
    expect(formatFileSize(1023)).toBe('1023 B');
  });

  it('formats kilobytes', () => {
    expect(formatFileSize(1024)).toBe('1 KB');
    expect(formatFileSize(1536)).toBe('1.5 KB');
  });

  it('formats megabytes', () => {
    expect(formatFileSize(1024 * 1024)).toBe('1 MB');
    expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
  });

  it('formats gigabytes', () => {
    expect(formatFileSize(1024 ** 3)).toBe('1 GB');
  });

  it('formats terabytes', () => {
    expect(formatFileSize(1024 ** 4)).toBe('1 TB');
  });
});

// ---------------------------------------------------------------------------
// formatDate
// ---------------------------------------------------------------------------

describe('formatDate', () => {
  it('returns — for null', () => {
    expect(formatDate(null)).toBe('—');
  });

  it('returns — for 0 (falsy epoch)', () => {
    expect(formatDate(0)).toBe('—');
  });

  it('returns a non-empty string for a valid epoch', () => {
    const result = formatDate(1_700_000_000);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    expect(result).not.toBe('—');
  });

  it('returns the same string for the same epoch (cache)', () => {
    const epoch = 1_600_000_000;
    const first = formatDate(epoch);
    const second = formatDate(epoch);
    expect(first).toBe(second);
  });
});

// ---------------------------------------------------------------------------
// getFileType
// ---------------------------------------------------------------------------

describe('getFileType', () => {
  it('returns "Folder" for directories', () => {
    expect(getFileType({ is_dir: true, extension: '' })).toBe('Folder');
  });

  it('returns known type for recognized extensions', () => {
    expect(getFileType({ is_dir: false, extension: 'ts' })).toBe('TypeScript');
    expect(getFileType({ is_dir: false, extension: 'pdf' })).toBe('PDF Document');
    expect(getFileType({ is_dir: false, extension: 'mp3' })).toBe('MP3 Audio');
    expect(getFileType({ is_dir: false, extension: 'zip' })).toBe('ZIP Archive');
    expect(getFileType({ is_dir: false, extension: 'png' })).toBe('PNG Image');
  });

  it('is case-insensitive for extensions', () => {
    expect(getFileType({ is_dir: false, extension: 'TS' })).toBe('TypeScript');
    expect(getFileType({ is_dir: false, extension: 'PDF' })).toBe('PDF Document');
  });

  it('returns "<EXT> File" for unknown extensions', () => {
    expect(getFileType({ is_dir: false, extension: 'xyz' })).toBe('XYZ File');
    expect(getFileType({ is_dir: false, extension: 'abc' })).toBe('ABC File');
  });

  it('returns "File" for entries with no extension', () => {
    expect(getFileType({ is_dir: false, extension: '' })).toBe('File');
  });
});

// ---------------------------------------------------------------------------
// getFileIcon
// ---------------------------------------------------------------------------

describe('getFileIcon', () => {
  it('returns a ReactNode (SVG) for directories', () => {
    const icon = getFileIcon({ is_dir: true, extension: '', name: 'folder' });
    expect(icon).toBeTruthy();
    // ReactNode for folder is an object (JSX element), not a string
    expect(typeof icon).toBe('object');
  });

  it('returns the correct emoji for image files', () => {
    expect(getFileIcon({ is_dir: false, extension: 'png', name: 'img.png' })).toBe('🖼️');
    expect(getFileIcon({ is_dir: false, extension: 'jpg', name: 'img.jpg' })).toBe('🖼️');
    expect(getFileIcon({ is_dir: false, extension: 'svg', name: 'img.svg' })).toBe('🖼️');
  });

  it('returns the correct emoji for code files', () => {
    expect(getFileIcon({ is_dir: false, extension: 'ts', name: 'file.ts' })).toBe('💻');
    expect(getFileIcon({ is_dir: false, extension: 'rs', name: 'file.rs' })).toBe('💻');
  });

  it('returns the correct emoji for archives', () => {
    expect(getFileIcon({ is_dir: false, extension: 'zip', name: 'archive.zip' })).toBe('📦');
  });

  it('returns default file emoji for unknown extensions', () => {
    expect(getFileIcon({ is_dir: false, extension: 'xyz', name: 'file.xyz' })).toBe('📄');
  });
});
