export default function InfoPanel() {
  return (
    <div className="sidebar-section" id="infoPanel" style={{ display: 'none' }}>
      <h3>📋 Thùng đang chọn</h3>
      <div id="infoText" className="info-content"></div>
    </div>
  );
} // thành phần hiển thị thông tin chi tiết về thùng đang được chọn trong scene 3d, bao gồm kích thước, vị trí, trọng lượng và các thuộc tính khác, giúp người dùng dễ dàng kiểm tra và điều chỉnh khi cần thiết trong quá trình xếp thùng