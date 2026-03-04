import { useState, useEffect } from 'react';
import { invoke } from '@tauri-apps/api/core';
import type { FileEntry } from '../types';
import { formatFileSize, formatDate, getFileIcon, getFileType } from '../utils/format';

interface PreviewPanelProps {
  entry: FileEntry | null;
  visible: boolean;
  onClose: () => void;
}

export const PreviewPanel = ({
  entry,
  visible,
  onClose,
}: PreviewPanelProps) => {
  const [textPreview, setTextPreview] = useState<string | null>(null);
  const [loadingPreview, setLoadingPreview] = useState(false);

  useEffect(() => {
    setTextPreview(null);
    if (!entry || entry.is_dir) return;

    const textExtensions = [
      'txt', 'md', 'json', 'xml', 'html', 'css', 'js', 'ts', 'jsx', 'tsx',
      'py', 'rs', 'go', 'java', 'c', 'cpp', 'h', 'sh', 'yaml', 'yml',
      'toml', 'ini', 'cfg', 'conf', 'log', 'env', 'gitignore', 'csv',
      'sql', 'rb', 'php', 'swift', 'kt', 'scala', 'r', 'lua',
    ];

    const ext = entry.extension.toLowerCase();
    if (textExtensions.includes(ext) || entry.size < 50000) {
      setLoadingPreview(true);
      invoke<string>('read_text_file', { path: entry.path })
        .then(setTextPreview)
        .catch(() => setTextPreview(null))
        .finally(() => setLoadingPreview(false));
    }
  }, [entry]);

  if (!visible || !entry) return null;

  const isImage = ['png', 'jpg', 'jpeg', 'gif', 'svg', 'webp', 'bmp', 'ico'].includes(
    entry.extension.toLowerCase()
  );

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <span className="preview-title">Preview</span>
        <button className="preview-close" onClick={onClose}>
          ✕
        </button>
      </div>

      <div className="preview-content">
        <div className="preview-icon-large">{getFileIcon(entry)}</div>
        <div className="preview-filename">{entry.name}</div>

        <div className="preview-info">
          <div className="preview-info-row">
            <span className="preview-label">Type:</span>
            <span className="preview-value">{getFileType(entry)}</span>
          </div>
          {!entry.is_dir && (
            <div className="preview-info-row">
              <span className="preview-label">Size:</span>
              <span className="preview-value">{formatFileSize(entry.size)}</span>
            </div>
          )}
          <div className="preview-info-row">
            <span className="preview-label">Modified:</span>
            <span className="preview-value">{formatDate(entry.modified)}</span>
          </div>
          <div className="preview-info-row">
            <span className="preview-label">Created:</span>
            <span className="preview-value">{formatDate(entry.created)}</span>
          </div>
          <div className="preview-info-row">
            <span className="preview-label">Path:</span>
            <span className="preview-value preview-path">{entry.path}</span>
          </div>
          {entry.is_symlink && (
            <div className="preview-info-row">
              <span className="preview-label">Symlink:</span>
              <span className="preview-value">Yes</span>
            </div>
          )}
        </div>

        {isImage && (
          <div className="preview-image">
            <img
              src={`asset://localhost/${entry.path}`}
              alt={entry.name}
              onError={(e) => {
                (e.target as HTMLImageElement).style.display = 'none';
              }}
            />
          </div>
        )}

        {loadingPreview && (
          <div className="preview-loading">Loading preview...</div>
        )}

        {textPreview !== null && (
          <div className="preview-text">
            <pre>{textPreview}</pre>
          </div>
        )}
      </div>
    </div>
  );
};
