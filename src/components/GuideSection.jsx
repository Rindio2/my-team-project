import SidebarSectionCard from './SidebarSectionCard.jsx';

const GUIDE_ITEMS = [
  'Click để chọn box, double click để focus camera.',
  'Nhấn T để di chuyển, R để xoay.',
  'Dùng Delete, Ctrl+Z, Ctrl+Y, Ctrl+S.',
  'Add item chỉ hiện 1 box mẫu trong preview 3D.',
  'Dùng mục MVP Hub để nạp nhanh kịch bản demo và mở đúng luồng thao tác thật.',
  'AI Pro sẽ bung quantity rồi tính placement thật.',
  'Dùng khu Lệnh nhanh để chạy pack, lưu scene và xuất ảnh chỉ với 1 nút.',
  'Dùng Preflight để audit manifest, SLA và mức độ sẵn sàng trước khi quote.',
  'Có thể xuất hoặc nhập lại file JSON để chia sẻ phương án xếp hàng cho người khác review.',
  'Chỉnh tay: click box, bấm Di chuyển để kéo; bấm Lật rồi click box để xoay nhanh.',
  'Có thể dùng các nút Focus box, Lật tiếp, Xóa box nếu không muốn nhớ phím tắt.',
  'Dấu cầu vàng trong scene là trọng tâm tải hàng.',
];

export default function GuideSection() {
  return (
    <SidebarSectionCard id="guideSection" icon="📌" title="Hướng dẫn">
      <ul className="guide-list">
        {GUIDE_ITEMS.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </SidebarSectionCard>
  );
}
