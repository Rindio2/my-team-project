import AiSection from './AiSection.jsx';
import BoxSection from './BoxSection.jsx';
import CapacityCalculatorSection from './CapacityCalculatorSection.jsx';
import CloudWorkspaceSection from './CloudWorkspaceSection.jsx';
import CommercialSection from './CommercialSection.jsx';
import ContainerSection from './ContainerSection.jsx';
import CrmSection from './CrmSection.jsx';
import GuideSection from './GuideSection.jsx';
import InfoPanel from './InfoPanel.jsx';
import ManualArrangeSection from './ManualArrangeSection.jsx';
import MissionControlSection from './MissionControlSection.jsx';
import MultiBoxTypesSection from './MultiBoxTypesSection.jsx';
import OperationsSummarySection from './OperationsSummarySection.jsx';
import QuickActionsSection from './QuickActionsSection.jsx';
import ReportBox from './ReportBox.jsx';
import ToolsSection from './ToolsSection.jsx';

export const SIDEBAR_SECTIONS = [
  {
    id: 'containerSection',
    icon: '📦',
    shortLabel: 'Container',
    component: ContainerSection,
  },
  {
    id: 'missionControlSection',
    icon: '🧭',
    shortLabel: 'Workflow',
    component: MissionControlSection,
  },
  {
    id: 'operationsSummarySection',
    icon: '📈',
    shortLabel: 'Ops',
    component: OperationsSummarySection,
  },
  {
    id: 'commercialSection',
    icon: '💼',
    shortLabel: 'Commercial',
    component: CommercialSection,
  },
  {
    id: 'cloudWorkspaceSection',
    icon: '☁️',
    shortLabel: 'Cloud',
    component: CloudWorkspaceSection,
  },
  {
    id: 'crmSection',
    icon: '📣',
    shortLabel: 'CRM',
    component: CrmSection,
  },
  {
    id: 'quickActionsSection',
    icon: '⚡',
    shortLabel: 'Quick',
    component: QuickActionsSection,
  },
  {
    id: 'boxSection',
    icon: '➕',
    shortLabel: 'Add item',
    component: BoxSection,
  },
  {
    id: 'multiBoxTypesSection',
    icon: '📚',
    shortLabel: 'Items',
    component: MultiBoxTypesSection,
  },
  {
    id: 'aiSection',
    icon: '🤖',
    shortLabel: 'Auto-pack',
    component: AiSection,
  },
  {
    id: 'manualArrangePanel',
    icon: '🧩',
    shortLabel: 'Chỉnh tay',
    component: ManualArrangeSection,
  },
  {
    id: 'toolsSection',
    icon: '🛠️',
    shortLabel: '3D tools',
    component: ToolsSection,
  },
  {
    id: 'capacityCalculatorSection',
    icon: '📐',
    shortLabel: 'Capacity',
    component: CapacityCalculatorSection,
  },
  {
    id: 'infoPanel',
    icon: '📋',
    shortLabel: 'Đang chọn',
    component: InfoPanel,
    showInMap: false,
  },
  {
    id: 'reportSection',
    icon: '🧾',
    shortLabel: 'Report',
    component: ReportBox,
    showInMap: false,
  },
  {
    id: 'guideSection',
    icon: '📌',
    shortLabel: 'Guide',
    component: GuideSection,
  },
];
