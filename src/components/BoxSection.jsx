export default function BoxSection() {
  return (
    <div className="sidebar-section">
      <h3>➕ Thêm thùng mới</h3>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Rộng</label>
          <input id="bw" defaultValue="60" type="number" step="1" />
        </div>
        <div className="input-group">
          <label>Cao</label>
          <input id="bh" defaultValue="50" type="number" step="1" />
        </div>
        <div className="input-group">
          <label>Dài</label>
          <input id="bd" defaultValue="80" type="number" step="1" />
        </div>
      </div>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Kg</label>
          <input id="bWeight" defaultValue="20" type="number" step="1" />
        </div>
        <div className="input-group">
          <label>Số lượng</label>
          <input id="bQty" defaultValue="1" type="number" min="1" />
        </div>
      </div>

      <button id="btnSpawn" className="btn-primary full-width">
        📦 Tạo thùng
      </button>
    </div>
  );
} // phần thêm thùng mới vào scene, cho phép người dùng nhập kích thước, trọng lượng và số lượng của thùng trước khi tạo, giúp quá trình xếp thùng trở nên linh hoạt và phù hợp với nhu cầu thực tế của người dùng, có thể mở rộng thêm các thuộc tính khác như loại hàng hóa, hạn sử dụng, v.v. nếu cần thiết