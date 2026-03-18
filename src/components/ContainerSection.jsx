export default function ContainerSection() {
  return (
    <div className="sidebar-section">
      <h3>📦 Container</h3>

      <select id="contType" className="full-width" defaultValue="20dc">
        <option value="20dc">20&apos; Dry (590 × 235 × 239)</option>
        <option value="40dc">40&apos; Dry (1203 × 235 × 239)</option>
        <option value="40hc">40&apos; HC (1203 × 235 × 269)</option>
        <option value="45hc">45&apos; HC (1350 × 235 × 269)</option>
        <option value="custom">Tùy chỉnh</option>
      </select>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Rộng (X)</label>
          <input id="cw" defaultValue="235" type="number" step="1" />
        </div>
        <div className="input-group">
          <label>Cao (Y)</label>
          <input id="ch" defaultValue="239" type="number" step="1" />
        </div>
        <div className="input-group">
          <label>Dài (Z)</label>
          <input id="cd" defaultValue="590" type="number" step="1" />
        </div>
      </div>
    </div>
  );
} // phần chọn loại container và nhập kích thước tùy chỉnh, giúp người dùng dễ dàng thiết lập kích thước và tải trọng của container trước khi bắt đầu xếp thùng, có thể mở rộng thêm các loại container khác nếu cần thiết