import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { TabBar } from '../../components/TabBar';
import type { Tab } from '../../types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeTab(id: string, label: string, path = '/fake'): Tab {
  return { id, label, path };
}

function renderTabBar(
  tabs: Tab[],
  activeTabId: string,
  overrides: Partial<{
    onSwitchTab: (id: string) => void;
    onCloseTab: (id: string) => void;
    onAddTab: () => void;
  }> = {},
) {
  const onSwitchTab = overrides.onSwitchTab ?? vi.fn();
  const onCloseTab = overrides.onCloseTab ?? vi.fn();
  const onAddTab = overrides.onAddTab ?? vi.fn();
  render(
    <TabBar
      tabs={tabs}
      activeTabId={activeTabId}
      onSwitchTab={onSwitchTab}
      onCloseTab={onCloseTab}
      onAddTab={onAddTab}
    />,
  );
  return { onSwitchTab, onCloseTab, onAddTab };
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('TabBar', () => {
  // ── Rendering ─────────────────────────────────────────────────────────────

  it('renders all tab labels', () => {
    const tabs = [makeTab('t1', 'Documents'), makeTab('t2', 'Downloads')];
    renderTabBar(tabs, 't1');
    expect(screen.getByText('Documents')).toBeInTheDocument();
    expect(screen.getByText('Downloads')).toBeInTheDocument();
  });

  it('renders "/" as label when tab label is empty', () => {
    const tabs = [makeTab('t1', '')];
    renderTabBar(tabs, 't1');
    expect(screen.getByText('/')).toBeInTheDocument();
  });

  it('renders the "+" add-tab button', () => {
    renderTabBar([makeTab('t1', 'Home')], 't1');
    expect(screen.getByTitle(/new tab/i)).toBeInTheDocument();
  });

  // ── Active tab ────────────────────────────────────────────────────────────

  it('applies the "active" class to the active tab', () => {
    const tabs = [makeTab('t1', 'Home'), makeTab('t2', 'Downloads')];
    renderTabBar(tabs, 't2');

    const allTabs = document.querySelectorAll('.tab');
    const activeTab = document.querySelector('.tab.active');
    expect(activeTab).not.toBeNull();
    expect(activeTab?.textContent).toContain('Downloads');
    expect(allTabs).toHaveLength(2);
  });

  it('does not apply "active" to inactive tabs', () => {
    const tabs = [makeTab('t1', 'Home'), makeTab('t2', 'Downloads')];
    renderTabBar(tabs, 't1');

    const activeTabs = document.querySelectorAll('.tab.active');
    expect(activeTabs).toHaveLength(1);
  });

  // ── Close button visibility ───────────────────────────────────────────────

  it('hides close buttons when only one tab exists', () => {
    renderTabBar([makeTab('t1', 'Home')], 't1');
    expect(document.querySelectorAll('.tab-close')).toHaveLength(0);
  });

  it('shows close buttons on all tabs when multiple tabs exist', () => {
    const tabs = [makeTab('t1', 'Home'), makeTab('t2', 'Docs'), makeTab('t3', 'Pics')];
    renderTabBar(tabs, 't1');
    expect(document.querySelectorAll('.tab-close')).toHaveLength(3);
  });

  // ── Interactions ──────────────────────────────────────────────────────────

  it('calls onSwitchTab with the correct id when a tab is clicked', async () => {
    const tabs = [makeTab('t1', 'Home'), makeTab('t2', 'Downloads')];
    const { onSwitchTab } = renderTabBar(tabs, 't1');

    await userEvent.click(screen.getByText('Downloads'));
    expect(onSwitchTab).toHaveBeenCalledWith('t2');
  });

  it('calls onCloseTab with the correct id when the close button is clicked', async () => {
    const tabs = [makeTab('t1', 'Home'), makeTab('t2', 'Downloads')];
    const { onCloseTab } = renderTabBar(tabs, 't1');

    const closeButtons = document.querySelectorAll('.tab-close');
    await userEvent.click(closeButtons[1]); // close second tab
    expect(onCloseTab).toHaveBeenCalledWith('t2');
  });

  it('does not call onSwitchTab when the close button inside a tab is clicked', async () => {
    const tabs = [makeTab('t1', 'Home'), makeTab('t2', 'Downloads')];
    const { onSwitchTab } = renderTabBar(tabs, 't1');

    const closeButtons = document.querySelectorAll('.tab-close');
    await userEvent.click(closeButtons[0]); // click close on first tab
    // onSwitchTab must NOT fire — stopPropagation prevents the parent click
    expect(onSwitchTab).not.toHaveBeenCalled();
  });

  it('calls onAddTab when the "+" button is clicked', async () => {
    const { onAddTab } = renderTabBar([makeTab('t1', 'Home')], 't1');
    await userEvent.click(screen.getByTitle(/new tab/i));
    expect(onAddTab).toHaveBeenCalledOnce();
  });
});
