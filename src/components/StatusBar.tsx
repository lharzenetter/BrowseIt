

import { formatFileSize } from '../utils/format';
import type { FileEntry } from '../types';

interface StatusBarProps {
  entries: FileEntry[];
  selectedPaths: Set<string>;
  searchResultCount: number | null;
  currentPath: string;
}

export const StatusBar = ({
  entries,
  selectedPaths,
  searchResultCount,
  currentPath,
}: StatusBarProps) => {
  const selectedEntries = entries.filter(e => selectedPaths.has(e.path));
  const totalSize = selectedEntries
    .filter(e => !e.is_dir)
    .reduce((sum, e) => sum + e.size, 0);

  const folderCount = entries.filter(e => e.is_dir).length;
  const fileCount = entries.filter(e => !e.is_dir).length;

  return (
    <div className="status-bar">
      <div className="status-left">
        {searchResultCount !== null ? (
          <span>{searchResultCount} search results</span>
        ) : (
          <span>
            {folderCount} folder{folderCount !== 1 ? 's' : ''},{' '}
            {fileCount} file{fileCount !== 1 ? 's' : ''}
          </span>
        )}
      </div>
      <div className="status-center">
        {selectedPaths.size > 0 && (
          <span>
            {selectedPaths.size} selected
            {totalSize > 0 && ` (${formatFileSize(totalSize)})`}
          </span>
        )}
      </div>
      <div className="status-right">
        <span className="status-path" title={currentPath}>
          {currentPath}
        </span>
      </div>
    </div>
  );
};
