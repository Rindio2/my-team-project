export default function AiSection() {
  return (
    <div className="sidebar-section">
      <h3>🤖 AI Packing</h3>

      <button id="btnAI" className="btn-secondary full-width">
        🤖 AI Cơ bản
      </button>

      <button id="btnAIPro" className="btn-pro full-width">
        🚀 AI Pro (Xoay hướng)
      </button>

      <button id="btnOptimizeMulti" className="btn-primary full-width" style={{ marginTop: '10px' }}>
        🧠 Sắp xếp tối ưu
      </button>
    </div>
  );
}