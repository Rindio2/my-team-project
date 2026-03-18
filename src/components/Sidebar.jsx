import ContainerSection from './ContainerSection';
import CapacityCalculatorSection from './CapacityCalculatorSection';
import BoxSection from './BoxSection';
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
      <AiSection />
      <ToolsSection />
      <InfoPanel />
      <ReportBox />
      <GuideSection />
    </div>
  );
} // thành phần sidebar chính, chứa tất cả các phần con như chọn container, tính toán dung tích, quản lý box, AI packing, công cụ điều khiển, thông tin thùng đang chọn, báo cáo kết quả và hướng dẫn nhanh, giúp người dùng dễ dàng truy cập và sử dụng các chức năng của ứng dụng trong quá trình tối ưu xếp thùng