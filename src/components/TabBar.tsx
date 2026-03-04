

import type { Tab } from '../types';

interface TabBarProps {
  tabs: Tab[];
  activeTabId: string;
  onSwitchTab: (tabId: string) => void;
  onCloseTab: (tabId: string) => void;
  onAddTab: () => void;
}

export const TabBar = ({
  tabs,
  activeTabId,
  onSwitchTab,
  onCloseTab,
  onAddTab,
}: TabBarProps) => {
  return (
    <div className="tab-bar">
      {tabs.map((tab) => (
        <div
          key={tab.id}
          className={`tab ${tab.id === activeTabId ? 'active' : ''}`}
          onClick={() => onSwitchTab(tab.id)}
        >
          <span className="tab-label">{tab.label || '/'}</span>
          {tabs.length > 1 && (
            <button
              className="tab-close"
              onClick={(e) => {
                e.stopPropagation();
                onCloseTab(tab.id);
              }}
            >
              ✕
            </button>
          )}
        </div>
      ))}
      <button className="tab-add" onClick={onAddTab} title="New tab (Cmd+T)">
        +
      </button>
    </div>
  );
};
