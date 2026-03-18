export default function CapacityCalculatorSection() {
  return (
    <div className="sidebar-section">
      <h3>📐 Tính sức chứa tối đa</h3>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Dài container</label>
          <input id="calcContainerLength" defaultValue="590" type="number" min="1" />
        </div>
        <div className="input-group">
          <label>Rộng container</label>
          <input id="calcContainerWidth" defaultValue="235" type="number" min="1" />
        </div>
      </div>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Cao container</label>
          <input id="calcContainerHeight" defaultValue="239" type="number" min="1" />
        </div>
        <div className="input-group">
          <label>Tải tối đa (kg)</label>
          <input id="calcContainerMaxWeight" defaultValue="28200" type="number" min="1" />
        </div>
      </div>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Dài thùng</label>
          <input id="calcBoxLength" defaultValue="80" type="number" min="1" />
        </div>
        <div className="input-group">
          <label>Rộng thùng</label>
          <input id="calcBoxWidth" defaultValue="60" type="number" min="1" />
        </div>
      </div>

      <div className="dimension-inputs">
        <div className="input-group">
          <label>Cao thùng</label>
          <input id="calcBoxHeight" defaultValue="50" type="number" min="1" />
        </div>
        <div className="input-group">
          <label>Khối lượng thùng (kg)</label>
          <input id="calcBoxWeight" defaultValue="20" type="number" min="1" />
        </div>
      </div>

      <button id="btnCalcCapacity" className="btn-secondary full-width">
        🧮 Tính số thùng tối đa
      </button>

      <button
        id="btnAutoArrangeCapacity"
        className="btn-primary full-width"
        style={{ display: 'none', marginTop: '10px' }}
      >
        📦 Tự động xếp tối đa + chống sốc
      </button>

      <div
        id="capacityResult"
        className="report-box"
        style={{ display: 'none', marginTop: '12px' }}
      ></div>
    </div>
  );
} // thành phần tính toán sức chứa tối đa của container dựa trên kích thước và trọng lượng của thùng, giúp người dùng nhanh chóng ước lượng được số lượng thùng có thể xếp vào container trước khi bắt đầu quá trình xếp thùng thực tế, cũng như cung cấp tùy chọn tự động xếp tối đa với khả năng chống sốc để tối ưu hóa không gian và bảo vệ hàng hóa trong quá trình vận chuyển