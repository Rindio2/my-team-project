import { useState } from 'react';

const WORKSPACE_MAP_STORAGE_KEY = 'packet-opt-workspace-map-expanded';
const COMPACT_SECTION_IDS = ['commercialSection', 'aiSection', 'toolsSection'];

function readInitialExpandedState() {
  if (typeof window === 'undefined') return false;
  return window.localStorage.getItem(WORKSPACE_MAP_STORAGE_KEY) === '1';
}

export default function SidebarWorkspaceMap({
  sections,
  activeSectionId,
  onJump,
  onExpandAll,
  onCollapseAll,
}) {
  const [expanded, setExpanded] = useState(readInitialExpandedState);
  const activeSection = sections.find((section) => section.id === activeSectionId) || sections[0];
  const compactSections = [
    activeSection,
    ...COMPACT_SECTION_IDS.map((sectionId) => sections.find((section) => section.id === sectionId)),
  ].filter((section, index, compactList) => {
    return section && compactList.findIndex((item) => item?.id === section.id) === index;
  });

  function toggleExpanded() {
    setExpanded((current) => {
      const next = !current;

      if (typeof window !== 'undefined') {
        window.localStorage.setItem(WORKSPACE_MAP_STORAGE_KEY, next ? '1' : '0');
      }

      return next;
    });
  }

  return (
    <div className={`sidebar-workspace-map ${expanded ? 'expanded' : 'compact'}`}>
      <div className="sidebar-workspace-map-head">
        <div className="sidebar-workspace-map-copy">
          <div className="sidebar-workspace-map-kicker">Workspace map</div>
          <div className="sidebar-workspace-map-title">Điều hướng</div>
          <div className="sidebar-workspace-map-note">
            Đang ở: <b>{activeSection?.shortLabel || 'Workspace'}</b>
          </div>
        </div>
        <div className="sidebar-workspace-map-actions">
          <button
            type="button"
            className="sidebar-utility-btn sidebar-map-toggle"
            aria-expanded={expanded}
            onClick={toggleExpanded}
          >
            {expanded ? 'Ẩn map' : 'Mở map'}
          </button>
        </div>
      </div>

      {expanded ? (
        <>
          <div className="sidebar-workspace-map-grid" role="navigation" aria-label="Điều hướng sidebar">
            {sections.map((section) => (
              <button
                key={section.id}
                type="button"
                className={`sidebar-map-chip ${activeSectionId === section.id ? 'active' : ''}`}
                aria-pressed={activeSectionId === section.id}
                onClick={() => onJump(section.id)}
              >
                <span className="sidebar-map-chip-icon" aria-hidden="true">
                  {section.icon}
                </span>
                <span>{section.shortLabel}</span>
              </button>
            ))}
          </div>

          <div className="sidebar-workspace-map-bulk-actions">
            <button type="button" className="sidebar-utility-btn" onClick={onExpandAll}>
              Mở tất cả panel
            </button>
            <button type="button" className="sidebar-utility-btn" onClick={onCollapseAll}>
              Thu tất cả panel
            </button>
          </div>
        </>
      ) : (
        <div
          className="sidebar-workspace-map-quick-grid"
          role="navigation"
          aria-label="Điều hướng nhanh sidebar"
        >
          {compactSections.map((section) => (
            <button
              key={section.id}
              type="button"
              className={`sidebar-map-chip sidebar-map-chip-compact ${
                activeSectionId === section.id ? 'active' : ''
              }`}
              aria-pressed={activeSectionId === section.id}
              onClick={() => onJump(section.id)}
            >
              <span className="sidebar-map-chip-icon" aria-hidden="true">
                {section.icon}
              </span>
              <span>{section.shortLabel}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
