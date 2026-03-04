import { Fragment, useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AddressBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  isSearching: boolean;
}

export const AddressBar = ({
  currentPath,
  onNavigate,
  searchQuery,
  onSearch,
  isSearching,
}: AddressBarProps) => {
  const [isEditing, setIsEditing] = useState(false);
  const [editPath, setEditPath] = useState(currentPath);
  const [breadcrumbs, setBreadcrumbs] = useState<[string, string][]>([]);
  const [localSearch, setLocalSearch] = useState(searchQuery);
  const inputRef = useRef<HTMLInputElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    setEditPath(currentPath);
    const loadBreadcrumbs = async () => {
      try {
        const components = await invoke<[string, string][]>('get_path_components', {
          path: currentPath,
        });
        setBreadcrumbs(components);
      } catch (_e) {
        setBreadcrumbs([]);
      }
    };
    loadBreadcrumbs();
  }, [currentPath]);

  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      inputRef.current.select();
    }
  }, [isEditing]);

  const handleSubmit = () => {
    setIsEditing(false);
    if (editPath.trim() && editPath !== currentPath) {
      onNavigate(editPath.trim());
    }
  };

  const handleSearchChange = (value: string) => {
    setLocalSearch(value);
    if (searchTimeoutRef.current) {
      clearTimeout(searchTimeoutRef.current);
    }
    searchTimeoutRef.current = setTimeout(() => {
      onSearch(value);
    }, 300);
  };

  return (
    <div className="address-bar">
      <div className="breadcrumb-container">
        {isEditing ? (
          <input
            ref={inputRef}
            type="text"
            className="address-input"
            value={editPath}
            onChange={(e) => setEditPath(e.target.value)}
            onBlur={handleSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleSubmit();
              if (e.key === 'Escape') {
                setIsEditing(false);
                setEditPath(currentPath);
              }
            }}
          />
        ) : (
          <div
            className="breadcrumbs"
            onClick={() => setIsEditing(true)}
          >
            {breadcrumbs.map(([name, path], idx) => (
              <Fragment key={path}>
                {idx > 0 && <span className="breadcrumb-sep">›</span>}
                <span
                  className="breadcrumb-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(path);
                  }}
                >
                  {name}
                </span>
              </Fragment>
            ))}
          </div>
        )}
      </div>
      <div className="search-container">
        <input
          ref={searchRef}
          type="text"
          className="search-input"
          placeholder="Search files..."
          value={localSearch}
          onChange={(e) => handleSearchChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Escape') {
              setLocalSearch('');
              onSearch('');
              searchRef.current?.blur();
            }
          }}
        />
        {isSearching && <span className="search-spinner">⟳</span>}
        {localSearch && (
          <button
            className="search-clear"
            onClick={() => {
              setLocalSearch('');
              onSearch('');
            }}
          >
            ✕
          </button>
        )}
      </div>
    </div>
  );
};
