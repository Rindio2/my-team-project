export default function ToolsSection() {
  return (
    <div className="sidebar-section">
      <h3>🛠️ Công cụ</h3>

      <div className="button-row">
        <button id="btnUndo" className="btn-icon" title="Undo (Ctrl+Z)">
          ↩️
        </button>
        <button id="btnRedo" className="btn-icon" title="Redo (Ctrl+Y)">
          ↪️
        </button>
        <button id="btnClear" className="btn-icon danger" title="Xóa tất cả">
          🗑️
        </button>
        <button id="btnRandom20" className="btn-icon warning" title="Sinh 20 thùng ngẫu nhiên">
          🎲
        </button>
      </div>

      <div className="button-row">
        <button id="btnModeMove" className="btn-icon" title="Dịch chuyển (T)">
          ↔️
        </button>
        <button id="btnModeRotate" className="btn-icon" title="Xoay (R)">
          🔄
        </button>
        <button id="btnResetView" className="btn-icon" title="Reset camera">
          🖼️
        </button>
      </div>

      <div className="button-row">
        <button id="btnSave" className="btn-icon" title="Lưu trạng thái">
          💾
        </button>
        <button id="btnLoad" className="btn-icon" title="Tải trạng thái">
          📂
        </button>
      </div>

      <div className="slider-container">
        <span>🔆 Độ mờ</span>
        <input
          type="range"
          id="opacitySlider"
          min="0.1"
          max="0.9"
          step="0.01"
          defaultValue="0.18"
        />
      </div>
    </div>
  );
} // phần công cụ chính để điều khiển việc xếp thùng, bao gồm undo/redo, xóa, sinh thùng ngẫu nhiên, chuyển đổi chế độ di chuyển/xoay, reset camera, lưu/tải trạng thái và điều chỉnh độ mờ của thùng để dễ quan sát khi có nhiều thùng chồng lên nhau