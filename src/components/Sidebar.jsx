import { useEffect, useRef, useState } from 'react';

import SidebarWorkspaceMap from './SidebarWorkspaceMap.jsx';
import { SIDEBAR_SECTIONS } from './sidebarSections.js';

const NAVIGABLE_SIDEBAR_SECTIONS = SIDEBAR_SECTIONS.filter(
  (section) => section.showInMap !== false
);

export default function Sidebar({ disabled = false }) {
  const sidebarScrollRef = useRef(null);
  const [activeSectionId, setActiveSectionId] = useState(NAVIGABLE_SIDEBAR_SECTIONS[0].id);

  function getSectionScrollOffset(sectionElement) {
    const sidebarScrollElement = sidebarScrollRef.current;
    if (!sidebarScrollElement || !sectionElement) return 0;

    const sidebarRect = sidebarScrollElement.getBoundingClientRect();
    const sectionRect = sectionElement.getBoundingClientRect();

    return sectionRect.top - sidebarRect.top + sidebarScrollElement.scrollTop;
  }

  useEffect(() => {
    const sidebarScrollElement = sidebarScrollRef.current;
    if (!sidebarScrollElement) return undefined;

    const updateActiveSection = () => {
      const scrollMarker = sidebarScrollElement.scrollTop + 120;
      let nextActiveSectionId = NAVIGABLE_SIDEBAR_SECTIONS[0].id;

      NAVIGABLE_SIDEBAR_SECTIONS.forEach((section) => {
        const sectionElement = document.getElementById(section.id);
        if (sectionElement && getSectionScrollOffset(sectionElement) <= scrollMarker) {
          nextActiveSectionId = section.id;
        }
      });

      setActiveSectionId((currentActiveSectionId) =>
        currentActiveSectionId === nextActiveSectionId
          ? currentActiveSectionId
          : nextActiveSectionId
      );
    };

    updateActiveSection();
    sidebarScrollElement.addEventListener('scroll', updateActiveSection, { passive: true });

    return () => {
      sidebarScrollElement.removeEventListener('scroll', updateActiveSection);
    };
  }, []);

  function jumpToSection(sectionId) {
    const sidebarScrollElement = sidebarScrollRef.current;
    const sectionElement = document.getElementById(sectionId);

    if (!sidebarScrollElement || !sectionElement) return;

    if ('open' in sectionElement) {
      sectionElement.open = true;
    }

    sidebarScrollElement.scrollTo({
      top: Math.max(getSectionScrollOffset(sectionElement) - 16, 0),
      behavior: 'smooth',
    });
    setActiveSectionId(sectionId);
  }

  function setAllSectionsOpen(isOpen) {
    const sidebarScrollElement = sidebarScrollRef.current;
    if (!sidebarScrollElement) return;

    sidebarScrollElement.querySelectorAll('.sidebar-card').forEach((sectionElement) => {
      sectionElement.open = isOpen;
    });
  }

  return (
    <aside
      className={`sidebar ${disabled ? 'sidebar-booting' : ''}`}
      id="sidebar"
      aria-busy={disabled}
    >
      <SidebarWorkspaceMap
        sections={NAVIGABLE_SIDEBAR_SECTIONS}
        activeSectionId={activeSectionId}
        onJump={jumpToSection}
        onExpandAll={() => setAllSectionsOpen(true)}
        onCollapseAll={() => setAllSectionsOpen(false)}
      />

      <div className="sidebar-scroll-content" ref={sidebarScrollRef}>
        {SIDEBAR_SECTIONS.map((section) => {
          const Component = section.component;
          return <Component key={section.id} />;
        })}
      </div>
    </aside>
  );
}
