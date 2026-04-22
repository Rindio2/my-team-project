function fmt(value) {
  return Number(value || 0).toFixed(2);
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}

function formatRotationMode(mode) {
  if (mode === 'fixed') return 'Giữ nguyên';
  if (mode === 'upright') return 'Giữ đứng';
  return 'Đủ 6 mặt';
}

function formatPriorityGroup(priorityGroup) {
  return `Nhóm ${Number(priorityGroup) > 0 ? Number(priorityGroup) : 1}`;
}

function formatYesNo(value) {
  return value ? 'Có' : 'Không';
}

function formatDeliveryZone(zone) {
  if (zone === 'head') return 'Đầu container';
  if (zone === 'middle') return 'Giữa container';
  if (zone === 'door') return 'Gần cửa';
  return 'Không cố định';
}

export function showCapacityResult(resultBox, data) {
  if (!resultBox) return;

  if (!data.ok) {
    resultBox.style.display = 'block';
    resultBox.innerHTML = `
      <div style="color:#f87171;font-weight:bold;">❌ Dữ liệu không hợp lệ</div>
      <div>${escapeHtml(data.message)}</div>
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
        🧽 Số liệu chống sốc
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
        <div><b>• Cơ bản - túi trái / phải:</b> ${fmt(pads.left.width)} × ${fmt(pads.left.height)} × ${fmt(pads.left.length)}</div>
        <div><b>• Cơ bản - túi trước / sau:</b> ${fmt(pads.front.width)} × ${fmt(pads.front.height)} × ${fmt(pads.front.length)}</div>
        <div><b>• Cơ bản - túi sàn / trần:</b> ${fmt(pads.bottom.width)} × ${fmt(pads.bottom.height)} × ${fmt(pads.bottom.length)}</div>

        <div style="margin-top:8px;"><b>• Giữa container - túi giữa theo chiều rộng:</b> ${fmt(pads.centerWidthSplit.width)} × ${fmt(pads.centerWidthSplit.height)} × ${fmt(pads.centerWidthSplit.length)}</div>
        <div><b>• Giữa container - túi trên nóc:</b> ${fmt(pads.topFull.width)} × ${fmt(pads.topFull.height)} × ${fmt(pads.topFull.length)}</div>
      </div>

      <div style="margin-top:10px;font-size:0.84rem;color:#cbd5e1;line-height:1.5;">
        Quy ước hiển thị kích thước: <b>Rộng × Cao × Dài</b>.<br/>
        Với chế độ <b>chèn giữa container</b>, túi chống sốc nằm ở giữa theo <b>chiều rộng</b>, tức là tách khối hàng sang trái và phải.
      </div>
    </div>
  `;
}

export function showSelectedInfo(panel, content, box) {
  if (!panel || !content || !box) return;

  const s = box.userData.size;
  const original = box.userData.originalSize || s;
  const w = box.userData.weight;
  const pos = box.position;
  const vol = (s.w * s.h * s.d) / 1000000;
  const density = vol > 0 ? w / vol : 0;
  const label = box.userData.label || 'Không xác định';
  const priorityGroup = box.userData.priorityGroup ?? box.userData.deliveryOrder;
  const allowRotate = box.userData.allowRotate ?? box.userData.rotationMode !== 'fixed';
  const noStack = box.userData.noStack ?? box.userData.fragile;
  const noTilt = box.userData.noTilt ?? box.userData.rotationMode === 'upright';
  const rotationMode = box.userData.rotationMode;
  const stackLevel = box.userData.stackLevel;
  const loadAboveKg = box.userData.loadAboveKg;
  const supportRatio = box.userData.supportRatio;
  const floorBearingWeight = box.userData.floorBearingWeight;
  const floorPressureKgM2 = box.userData.floorPressureKgM2;
  const sceneRole = box.userData.sceneRole || 'placement';
  const previewQuantity = box.userData.previewQuantity;
  const deliveryZone = box.userData.deliveryZone || 'any';
  const stackLimit = box.userData.stackLimit;
  const maxLoadAbove = box.userData.maxLoadAbove;

  content.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px;">
      <span>🆔 ID:</span><span style="font-weight:bold;">${box.userData.id}</span>
      <span>🏷️ Loại:</span><span>${escapeHtml(label)}</span>
      <span>🎬 Chế độ scene:</span><span>${sceneRole === 'preview' ? 'Preview item' : 'Placement'}</span>
      <span>📐 Kích thước hiện tại:</span><span>${s.w} x ${s.h} x ${s.d} cm</span>
      <span>📦 Kích thước gốc:</span><span>${original.w} x ${original.h} x ${original.d} cm</span>
      <span>📦 Thể tích:</span><span>${vol.toFixed(2)} m³</span>
      <span>⚖️ Trọng lượng:</span><span>${w} kg</span>
      <span>📊 Mật độ:</span><span>${density.toFixed(1)} kg/m³</span>
      <span>🚚 Priority group:</span><span>${escapeHtml(formatPriorityGroup(priorityGroup))}</span>
      <span>🚪 Delivery zone:</span><span>${escapeHtml(formatDeliveryZone(deliveryZone))}</span>
      <span>🔄 Allow rotate:</span><span>${escapeHtml(formatYesNo(allowRotate))}</span>
      <span>📏 No tilt:</span><span>${escapeHtml(formatYesNo(noTilt))}${allowRotate ? ` (${escapeHtml(formatRotationMode(rotationMode))})` : ''}</span>
      <span>🧱 No stack:</span><span>${escapeHtml(formatYesNo(noStack))}</span>
      <span>🏗️ Stack limit:</span><span>${Number(stackLimit) > 0 ? stackLimit : 'Mở'}</span>
      <span>🏋️ Max load above:</span><span>${Number(maxLoadAbove) > 0 ? `${Number(maxLoadAbove).toFixed(2)} kg` : 'Mở'}</span>
      ${sceneRole === 'preview' ? `<span>🧮 Quantity preview:</span><span>${Number(previewQuantity) > 0 ? previewQuantity : 1}</span>` : ''}
      <span>🏗️ Tầng hiện tại:</span><span>${Number(stackLevel) > 0 ? stackLevel : 1}</span>
      <span>🧩 Mức tựa đáy:</span><span>${Number(supportRatio) > 0 ? `${(Number(supportRatio) * 100).toFixed(1)}%` : 'Đặt trực tiếp trên sàn'}</span>
      <span>📥 Tải đang đè lên:</span><span>${Number(loadAboveKg) > 0 ? `${Number(loadAboveKg).toFixed(2)} kg` : 'Chưa có'}</span>
      <span>🪵 Tải truyền xuống sàn:</span><span>${Number(floorBearingWeight) > 0 ? `${Number(floorBearingWeight).toFixed(2)} kg` : 'Chưa tính'}</span>
      <span>📉 Áp suất sàn:</span><span>${Number(floorPressureKgM2) > 0 ? `${Number(floorPressureKgM2).toFixed(2)} kg/m²` : 'Chưa tính'}</span>
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
