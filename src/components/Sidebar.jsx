import ContainerSection from './ContainerSection';
import CapacityCalculatorSection from './CapacityCalculatorSection';
import BoxSection from './BoxSection';
import MultiBoxTypesSection from './MultiBoxTypesSection';
import AiSection from './AiSection';
import ToolsSection from './ToolsSection';
import InfoPanel from './InfoPanel';
import ReportBox from './ReportBox';
import GuideSection from './GuideSection';

export default function Sidebar() {
  return (
    <div className="sidebar" id="sidebar">
      <ContainerSection />
      <CapacityCalculatorSection />
      <BoxSection />
      <MultiBoxTypesSection />
      <AiSection />
      <ToolsSection />
      <InfoPanel />
      <ReportBox />
      <GuideSection />
    </div>
  );
}