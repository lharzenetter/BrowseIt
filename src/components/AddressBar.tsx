import { Fragment, useState, useEffect, useRef } from 'react';
import { invoke } from '@tauri-apps/api/core';

interface AddressBarProps {
  currentPath: string;
  onNavigate: (path: string) => void;
  searchQuery: string;
  onSearch: (query: string) => void;
  isSearching: boolean;
  canGoBack: boolean;
  canGoForward: boolean;
  onGoBack: () => void;
  onGoForward: () => void;
  onGoUp: () => void;
  onRefresh: () => void;
}

export const AddressBar = ({
  currentPath,
  onNavigate,
  searchQuery,
  onSearch,
  isSearching,
  canGoBack,
  canGoForward,
  onGoBack,
  onGoForward,
  onGoUp,
  onRefresh,
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
      {/* Navigation arrows */}
      <div className="nav-buttons">
        <button
          className="nav-btn"
          onClick={onGoBack}
          disabled={!canGoBack}
          title="Back (Cmd+[)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="nav-btn"
          onClick={onGoForward}
          disabled={!canGoForward}
          title="Forward (Cmd+])"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="nav-btn"
          onClick={onGoUp}
          title="Up (Alt+Up)"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 10l5-5 5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Breadcrumb / address */}
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
                {idx > 0 && (
                  <span className="breadcrumb-sep">
                    <svg width="8" height="8" viewBox="0 0 8 8">
                      <path d="M2.5 1.5L5.5 4L2.5 6.5" stroke="#999" strokeWidth="1.2" fill="none" strokeLinecap="round"/>
                    </svg>
                  </span>
                )}
                <span
                  className="breadcrumb-item"
                  onClick={(e) => {
                    e.stopPropagation();
                    onNavigate(path);
                  }}
                >
                  {idx === 0 ? (
                    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ verticalAlign: '-2px' }}>
                      <path d="M2 7l5-4.5L12 7" stroke="#666" strokeWidth="1.2" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                      <path d="M3.5 6v4.5h2.5V8.5h2v2h2.5V6" stroke="#666" strokeWidth="1.1" fill="none" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  ) : name}
                </span>
              </Fragment>
            ))}
          </div>
        )}
        <button className="address-refresh" onClick={onRefresh} title="Refresh (Cmd+R)">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11.5 7A4.5 4.5 0 1 1 7 2.5" stroke="#666" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M9 2.5L7 2.5V4.5" stroke="#666" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
      </div>

      {/* Search */}
      <div className="search-container">
        <svg className="search-icon" width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="6" cy="6" r="4" stroke="#999" strokeWidth="1.3"/>
          <path d="M9 9l3 3" stroke="#999" strokeWidth="1.3" strokeLinecap="round"/>
        </svg>
        <input
          ref={searchRef}
          type="text"
          className="search-input"
          placeholder="Search"
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
            <svg width="10" height="10" viewBox="0 0 10 10">
              <path d="M2 2l6 6M8 2l-6 6" stroke="#999" strokeWidth="1.3" strokeLinecap="round"/>
            </svg>
          </button>
        )}
      </div>
    </div>
  );
};
