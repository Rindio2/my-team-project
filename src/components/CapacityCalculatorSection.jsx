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
        📦 Tự động xếp tối đa
      </button>

      <div
        id="shockOptions"
        className="sidebar-section"
        style={{ display: 'none', marginTop: '12px', padding: '12px' }}
      >
        <h3 style={{ marginBottom: '10px' }}>🧽 Chống sốc</h3>

        <div style={{ display: 'grid', gap: '8px' }}>
          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="shockMode" id="shockBasic" value="basic" defaultChecked />
            <span>Chèn theo cách cơ bản</span>
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="radio" name="shockMode" id="shockCenter" value="center" />
            <span>Chèn giữa container</span>
          </label>

          <label style={{ display: 'flex', gap: '8px', alignItems: 'center', cursor: 'pointer' }}>
            <input type="checkbox" id="shockNet" />
            <span>Chèn lưới chống rơi hàng</span>
          </label>
        </div>

        <button
          id="btnApplyShockVisual"
          className="btn-secondary full-width"
          style={{ marginTop: '12px' }}
        >
          🎯 Hiển thị chống sốc trên mô hình 3D
        </button>
      </div>

      <div
        id="capacityResult"
        className="report-box"
        style={{ display: 'none', marginTop: '12px' }}
      ></div>
    </div>
  );
}