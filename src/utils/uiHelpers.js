function fmt(value) {
  return Number(value || 0).toFixed(2);
}

export function showCapacityResult(resultBox, data) {
  if (!resultBox) return;

  if (!data.ok) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div style="color:#f87171;font-weight:bold;">❌ Dữ liệu không hợp lệ</div>
      <div>${data.message}</div>
    `;
    return;
  }

  const { best } = data;
  const pads = best.shockPads;
  const summary = pads.summary;

  resultBox.style.display = 'block';
  resultBox.innerHTML = `
    <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
      ✅ KẾT QUẢ TÍNH SỨC CHỨA
    </div>

    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>🔄 Cách xoay tốt nhất:</div>
      <div style="text-align:right;font-weight:bold;">${best.rotationText}</div>

      <div>📏 Theo chiều dài:</div>
      <div style="text-align:right;font-weight:bold;">${best.alongLength}</div>

      <div>📏 Theo chiều rộng:</div>
      <div style="text-align:right;font-weight:bold;">${best.alongWidth}</div>

      <div>📏 Theo chiều cao:</div>
      <div style="text-align:right;font-weight:bold;">${best.alongHeight}</div>

      <div>📦 Theo không gian 3D:</div>
      <div style="text-align:right;font-weight:bold;">${data.maxBySpace} thùng</div>

      <div>⚖️ Theo tải trọng:</div>
      <div style="text-align:right;font-weight:bold;">${data.maxByWeight} thùng</div>

      <div style="color:#fbbf24;">🚚 Sức chứa tối đa:</div>
      <div style="text-align:right;font-weight:bold;color:#fbbf24;">${data.maxBoxes} thùng</div>
    </div>

    <div style="margin-top:14px;padding-top:10px;border-top:1px solid rgba(255,255,255,0.08);">
      <div style="font-weight:bold;color:#93c5fd;margin-bottom:8px;">
        🧽 Kích thước túi chống sốc tự tính
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;font-size:0.92rem;">
        <div>Khoảng dư chiều dài:</div>
        <div style="text-align:right;font-weight:bold;">${fmt(summary.leftoverLength)}</div>

        <div>Khoảng dư chiều rộng:</div>
        <div style="text-align:right;font-weight:bold;">${fmt(summary.leftoverWidth)}</div>

        <div>Khoảng dư chiều cao:</div>
        <div style="text-align:right;font-weight:bold;">${fmt(summary.leftoverHeight)}</div>
      </div>

      <div style="margin-top:10px;line-height:1.7;font-size:0.9rem;color:#dbeafe;">
        <div><b>• Túi trái / phải:</b> ${fmt(pads.left.width)} × ${fmt(pads.left.height)} × ${fmt(pads.left.length)}</div>
        <div style="padding-left:10px;color:#cbd5e1;">
          (độ dày mỗi túi = ${fmt(summary.halfWidthGap)}, phủ mặt tiếp xúc bên hông)
        </div>

        <div style="margin-top:6px;"><b>• Túi trước / sau:</b> ${fmt(pads.front.width)} × ${fmt(pads.front.height)} × ${fmt(pads.front.length)}</div>
        <div style="padding-left:10px;color:#cbd5e1;">
          (độ dày mỗi túi = ${fmt(summary.halfLengthGap)}, phủ mặt tiếp xúc đầu/cuối)
        </div>

        <div style="margin-top:6px;"><b>• Túi sàn / trần:</b> ${fmt(pads.bottom.width)} × ${fmt(pads.bottom.height)} × ${fmt(pads.bottom.length)}</div>
        <div style="padding-left:10px;color:#cbd5e1;">
          (độ dày mỗi túi = ${fmt(summary.halfHeightGap)}, phủ mặt tiếp xúc trên/dưới)
        </div>
      </div>

      <div style="margin-top:10px;font-size:0.84rem;color:#cbd5e1;line-height:1.5;">
        Quy ước hiển thị kích thước túi: <b>Rộng × Cao × Dài</b>. 
        Túi chỉ tính tại các mặt ngoài cùng tiếp xúc trực tiếp với container, và phần khoảng trống còn lại được chia đều cho 2 mặt phẳng đối nhau.
      </div>
    </div>
  `;
}

export function showSelectedInfo(panel, content, box) {
  if (!panel || !content || !box) return;

  const s = box.userData.size;
  const w = box.userData.weight;
  const pos = box.position;
  const vol = (s.w * s.h * s.d) / 1000000;
  const density = w / vol;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
      <span>🆔 ID:</span><span style="font-weight:bold;">${box.userData.id}</span>
      <span>📐 Kích thước:</span><span>${s.w} x ${s.h} x ${s.d} cm</span>
      <span>📦 Thể tích:</span><span>${vol.toFixed(2)} m³</span>
      <span>⚖️ Trọng lượng:</span><span>${w} kg</span>
      <span>📊 Mật độ:</span><span>${density.toFixed(1)} kg/m³</span>
      <span>📍 Vị trí:</span><span>(${pos.x.toFixed(0)}, ${pos.y.toFixed(0)}, ${pos.z.toFixed(0)})</span>
    </div>
  `;
  panel.style.display = 'block';
}

export function showPackingReport(reportEl, { packedCount, remaining, usedVol, totalVol }) {
  if (!reportEl) return;

  reportEl.innerHTML = `
    <div style="color:#10b981;font-size:1.2rem;margin-bottom:8px;">✅ PACKING COMPLETE</div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
      <div>📦 Đã xếp:</div><div style="text-align:right;font-weight:bold;">${packedCount}</div>
      <div>❌ Còn lại:</div><div style="text-align:right;font-weight:bold;">${remaining}</div>
      <div>📊 Hiệu suất:</div><div style="text-align:right;font-weight:bold;">${((usedVol / totalVol) * 100).toFixed(2)}%</div>
    </div>
  `;
  reportEl.style.display = 'block';
}