import { useEffect, useRef, useState } from 'react';

import SidebarWorkspaceMap from './SidebarWorkspaceMap.jsx';
import { SIDEBAR_SECTIONS } from './sidebarSections.js';

const NAVIGABLE_SIDEBAR_SECTIONS = SIDEBAR_SECTIONS.filter(
  (section) => section.showInMap !== false
);

export default function Sidebar({ disabled = false }) {
  const sidebarRef = useRef(null);
  const [activeSectionId, setActiveSectionId] = useState(NAVIGABLE_SIDEBAR_SECTIONS[0].id);

  useEffect(() => {
    const sidebarElement = sidebarRef.current;
    if (!sidebarElement) return undefined;

    const updateActiveSection = () => {
      const scrollMarker = sidebarElement.scrollTop + 120;
      let nextActiveSectionId = NAVIGABLE_SIDEBAR_SECTIONS[0].id;

      NAVIGABLE_SIDEBAR_SECTIONS.forEach((section) => {
        const sectionElement = document.getElementById(section.id);
        if (sectionElement && sectionElement.offsetTop <= scrollMarker) {
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
    sidebarElement.addEventListener('scroll', updateActiveSection, { passive: true });

    return () => {
      sidebarElement.removeEventListener('scroll', updateActiveSection);
    };
  }, []);

  function jumpToSection(sectionId) {
    const sidebarElement = sidebarRef.current;
    const sectionElement = document.getElementById(sectionId);

    if (!sidebarElement || !sectionElement) return;

    if ('open' in sectionElement) {
      sectionElement.open = true;
    }

    sidebarElement.scrollTo({
      top: Math.max(sectionElement.offsetTop - 88, 0),
      behavior: 'smooth',
    });
    setActiveSectionId(sectionId);
  }

  function setAllSectionsOpen(isOpen) {
    const sidebarElement = sidebarRef.current;
    if (!sidebarElement) return;

    sidebarElement.querySelectorAll('.sidebar-card').forEach((sectionElement) => {
      sectionElement.open = isOpen;
    });
  }

  return (
    <aside
      className={`sidebar ${disabled ? 'sidebar-booting' : ''}`}
      id="sidebar"
      ref={sidebarRef}
      aria-busy={disabled}
    >
      <SidebarWorkspaceMap
        sections={NAVIGABLE_SIDEBAR_SECTIONS}
        activeSectionId={activeSectionId}
        onJump={jumpToSection}
        onExpandAll={() => setAllSectionsOpen(true)}
        onCollapseAll={() => setAllSectionsOpen(false)}
      />

      {SIDEBAR_SECTIONS.map((section) => {
        const Component = section.component;
        return <Component key={section.id} />;
      })}
    </aside>
  );
}
