import { useEffect, useRef } from 'react';
import './App.css';

import Header from './components/Header';
import Sidebar from './components/Sidebar';

import { CONTAINER_TYPES } from './constants/containerTypes';
import { calculateCapacity } from './utils/capacity';
import { optimizeMixedPacking } from './utils/multiBoxPacking';
import { compactPlacedLayout } from './utils/layoutCompactor';
import { showCapacityResult, showPackingReport, showSelectedInfo } from './utils/uiHelpers';

import { createSceneSystem } from './three/initScene';
import {
  createContainerGroup,
  updateContainerMesh,
  renderShockVisuals,
  clearShockVisuals,
} from './three/container3d';
import { createCarton, disposeBox } from './three/boxes3d';

export default function App() {
  const initializedRef = useRef(false);

  useEffect(() => {
    if (initializedRef.current) return;
    initializedRef.current = true;

    const canvasDiv = document.getElementById('canvas');
    const statsEl = document.getElementById('stats');
    const infoPanel = document.getElementById('infoPanel');
    const infoText = document.getElementById('infoText');
    const reportEl = document.getElementById('report');
    const capacityResult = document.getElementById('capacityResult');
    const btnAutoArrangeCapacity = document.getElementById('btnAutoArrangeCapacity');
    const shockOptions = document.getElementById('shockOptions');
    const btnApplyShockVisual = document.getElementById('btnApplyShockVisual');
    const multiBoxTypesList = document.getElementById('multiBoxTypesList');
    const btnAddBoxType = document.getElementById('btnAddBoxType');

    const cw = document.getElementById('cw');
    const ch = document.getElementById('ch');
    const cd = document.getElementById('cd');
    const contType = document.getElementById('contType');
    const opacitySlider = document.getElementById('opacitySlider');

    const sceneSys = createSceneSystem(canvasDiv);
    const { scene, camera, renderer, transformControl, stars, cogMarker } = sceneSys;

    const containerSys = createContainerGroup();
    scene.add(containerSys.group);

    let boxes = [];
    let selected = null;
    let animationId;
    let resizeObserver;
    let lastCapacityData = null;

    let multiBoxTypes = [
      { id: Date.now(), label: 'Loại 1', w: 60, h: 50, d: 80, weight: 20, qty: 2 },
    ];

    const raycaster = new sceneSys.THREE.Raycaster();
    const pointer = new sceneSys.THREE.Vector2();

    function getCurrentContainerMaxLoad() {
      const selectedType = contType.value;
      if (CONTAINER_TYPES[selectedType]?.maxLoad) {
        return CONTAINER_TYPES[selectedType].maxLoad;
      }

      const calcMaxWeightEl = document.getElementById('calcContainerMaxWeight');
      if (calcMaxWeightEl && Number(calcMaxWeightEl.value) > 0) {
        return Number(calcMaxWeightEl.value);
      }

      return Infinity;
    }

    function getShockMode() {
      const center = document.getElementById('shockCenter');
      return center?.checked ? 'center' : 'basic';
    }

    function getShockNet() {
      return !!document.getElementById('shockNet')?.checked;
    }

    function syncCapacityInputs() {
      const calcContainerLength = document.getElementById('calcContainerLength');
      const calcContainerWidth = document.getElementById('calcContainerWidth');
      const calcContainerHeight = document.getElementById('calcContainerHeight');
      const calcContainerMaxWeight = document.getElementById('calcContainerMaxWeight');

      if (calcContainerLength) calcContainerLength.value = cd.value;
      if (calcContainerWidth) calcContainerWidth.value = cw.value;
      if (calcContainerHeight) calcContainerHeight.value = ch.value;

      const selectedType = contType.value;
      if (calcContainerMaxWeight && CONTAINER_TYPES[selectedType]?.maxLoad) {
        calcContainerMaxWeight.value = CONTAINER_TYPES[selectedType].maxLoad;
      }
    }

    function updateContainer() {
      updateContainerMesh({
        group: containerSys.group,
        box3: containerSys.box3,
        width: +cw.value,
        height: +ch.value,
        depth: +cd.value,
        opacity: +(opacitySlider?.value || 0.18),
        shockGroup: containerSys.shockGroup,
      });

      sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);
      sceneSys.resize();
    }

    function updateStats() {
      const count = boxes.length;
      let vol = 0;
      let totalWeight = 0;
      const combinedPos = new sceneSys.THREE.Vector3(0, 0, 0);

      boxes.forEach((b) => {
        const s = b.userData.size;
        const w = b.userData.weight;
        vol += s.w * s.h * s.d;
        totalWeight += w;
        combinedPos.add(b.position.clone().multiplyScalar(w));
      });

      const containerVol = +cw.value * +ch.value * +cd.value;
      const perc = containerVol > 0 ? ((vol / containerVol) * 100).toFixed(1) : '0.0';
      statsEl.innerHTML = `${count} thùng | ${perc}% | ${(totalWeight / 1000).toFixed(1)} tấn`;

      if (totalWeight > 0) {
        combinedPos.divideScalar(totalWeight);
        cogMarker.position.copy(combinedPos);
        cogMarker.visible = true;
      } else {
        cogMarker.visible = false;
      }
    }

    function addBox(params) {
      const box = createCarton(scene, boxes.length, params);
      box.userData.label = params.label || 'Thùng';
      box.userData.originalSize = params.originalSize || { w: params.w, h: params.h, d: params.d };
      boxes.push(box);
      updateStats();
      return box;
    }

    function clearBoxes() {
      boxes.forEach((b) => disposeBox(scene, b));
      boxes = [];
      selected = null;
      transformControl.detach();
      if (infoPanel) infoPanel.style.display = 'none';
      updateStats();
    }

    function basicPacking() {
      const itemsToPack = boxes.map((b) => ({
        w: b.userData.size.w,
        h: b.userData.size.h,
        d: b.userData.size.d,
        weight: b.userData.weight,
        label: b.userData.label || 'Thùng',
        originalSize: b.userData.originalSize || b.userData.size,
      }));

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);

      const W = +cw.value;
      const H = +ch.value;
      const D = +cd.value;

      const containerMaxWeight = getCurrentContainerMaxLoad();
      let runningWeight = 0;

      itemsToPack.sort((a, b) => b.w * b.h * b.d - a.w * a.h * a.d);

      let layerY = 0;
      let usedVol = 0;
      let packedCount = 0;
      let rejectedByWeight = 0;

      while (layerY + 5 < H && itemsToPack.length > 0) {
        let layerH = 0;
        let z = -D / 2;

        while (z + 5 < D / 2 && itemsToPack.length > 0) {
          let rowD = 0;
          let x = -W / 2;

          for (let i = 0; i < itemsToPack.length; i++) {
            const it = itemsToPack[i];

            if (runningWeight + it.weight > containerMaxWeight) {
              rejectedByWeight++;
              itemsToPack.splice(i, 1);
              i--;
              continue;
            }

            if (x + it.w <= W / 2 && z + it.d <= D / 2 && layerY + it.h <= H) {
              addBox({
                w: it.w,
                h: it.h,
                d: it.d,
                x: x + it.w / 2,
                y: layerY + it.h / 2,
                z: z + it.d / 2,
                weight: it.weight,
                label: it.label,
                originalSize: it.originalSize,
              });
              usedVol += it.w * it.h * it.d;
              runningWeight += it.weight;
              packedCount++;
              x += it.w + 1;
              rowD = Math.max(rowD, it.d);
              layerH = Math.max(layerH, it.h);
              itemsToPack.splice(i, 1);
              i--;
            }
          }

          if (rowD === 0) break;
          z += rowD + 1;
        }

        if (layerH === 0) break;
        layerY += layerH + 1;
      }

      showPackingReport(reportEl, {
        packedCount,
        remaining: itemsToPack.length + rejectedByWeight,
        usedVol,
        totalVol: W * H * D,
      });
    }

    function handleCapacity() {
      const result = calculateCapacity({
        containerLength: +document.getElementById('calcContainerLength').value,
        containerWidth: +document.getElementById('calcContainerWidth').value,
        containerHeight: +document.getElementById('calcContainerHeight').value,
        containerMaxWeight: +document.getElementById('calcContainerMaxWeight').value,
        boxLength: +document.getElementById('calcBoxLength').value,
        boxWidth: +document.getElementById('calcBoxWidth').value,
        boxHeight: +document.getElementById('calcBoxHeight').value,
        boxWeight: +document.getElementById('calcBoxWeight').value,
      });

      lastCapacityData = result;
      showCapacityResult(capacityResult, result);

      if (btnAutoArrangeCapacity) {
        btnAutoArrangeCapacity.style.display = result.ok ? 'block' : 'none';
      }

      if (shockOptions) {
        shockOptions.style.display = result.ok ? 'block' : 'none';
      }
    }

    function arrangeBoxesPlain() {
      if (!lastCapacityData?.ok) return { created: 0, usedVol: 0, totalVol: 0 };

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight } = best;

      const containerWidth = +document.getElementById('calcContainerWidth').value;
      const containerHeight = +document.getElementById('calcContainerHeight').value;
      const containerLength = +document.getElementById('calcContainerLength').value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const startX = -containerWidth / 2 + boxW / 2;
      const startY = boxH / 2;
      const startZ = -containerLength / 2 + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < alongHeight; iy++) {
        for (let iz = 0; iz < alongLength; iz++) {
          for (let ix = 0; ix < alongWidth; ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: startX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: created === 0,
              label: 'Auto capacity',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }
          if (created >= maxBoxes) break;
        }
        if (created >= maxBoxes) break;
      }

      if (lastBox) {
        selected = lastBox;
        transformControl.attach(lastBox);
        showSelectedInfo(infoPanel, infoText, lastBox);
      }

      return {
        created,
        usedVol: created * boxW * boxH * boxD,
        totalVol: containerWidth * containerHeight * containerLength,
      };
    }

    function arrangeBoxesBasicShock() {
      if (!lastCapacityData?.ok) return { created: 0, usedVol: 0, totalVol: 0 };

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight, shockPads } = best;

      const containerWidth = +document.getElementById('calcContainerWidth').value;
      const containerHeight = +document.getElementById('calcContainerHeight').value;
      const containerLength = +document.getElementById('calcContainerLength').value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const leftGap = shockPads.left.width;
      const rightGap = shockPads.right.width;
      const frontGap = shockPads.front.length;
      const backGap = shockPads.back.length;
      const topGap = shockPads.top.height;

      const usableWidth = containerWidth - leftGap - rightGap;
      const usableLength = containerLength - frontGap - backGap;
      const usableHeight = containerHeight - topGap;

      const finalAlongWidth = Math.floor(usableWidth / boxW);
      const finalAlongLength = Math.floor(usableLength / boxD);
      const finalAlongHeight = Math.floor(usableHeight / boxH);

      const startX = -containerWidth / 2 + leftGap + boxW / 2;
      const startY = boxH / 2;
      const startZ = -containerLength / 2 + frontGap + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < Math.min(alongHeight, finalAlongHeight); iy++) {
        for (let iz = 0; iz < Math.min(alongLength, finalAlongLength); iz++) {
          for (let ix = 0; ix < Math.min(alongWidth, finalAlongWidth); ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: startX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: created === 0,
              label: 'Shock basic',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }
          if (created >= maxBoxes) break;
        }
        if (created >= maxBoxes) break;
      }

      if (lastBox) {
        selected = lastBox;
        transformControl.attach(lastBox);
        showSelectedInfo(infoPanel, infoText, lastBox);
      }

      return {
        created,
        usedVol: created * boxW * boxH * boxD,
        totalVol: containerWidth * containerHeight * containerLength,
      };
    }

    function arrangeBoxesCenterShock() {
      if (!lastCapacityData?.ok) return { created: 0, usedVol: 0, totalVol: 0 };

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight, shockPads } = best;

      const containerWidth = +document.getElementById('calcContainerWidth').value;
      const containerHeight = +document.getElementById('calcContainerHeight').value;
      const containerLength = +document.getElementById('calcContainerLength').value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const centerGap = shockPads.centerWidthSplit.width;
      const topGap = shockPads.topFull.height;
      const frontGap = shockPads.summary.halfLengthGap;
      const backGap = shockPads.summary.halfLengthGap;

      const usableHeight = containerHeight - topGap;
      const usableLength = containerLength - frontGap - backGap;

      const finalAlongHeight = Math.floor(usableHeight / boxH);
      const finalAlongLength = Math.floor(usableLength / boxD);

      const totalCols = alongWidth;
      const leftCols = Math.ceil(totalCols / 2);
      const rightCols = Math.floor(totalCols / 2);

      const leftStartX = -containerWidth / 2 + boxW / 2;
      const rightStartX = -containerWidth / 2 + leftCols * boxW + centerGap + boxW / 2;

      const startY = boxH / 2;
      const startZ = -containerLength / 2 + frontGap + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < Math.min(alongHeight, finalAlongHeight); iy++) {
        for (let iz = 0; iz < Math.min(alongLength, finalAlongLength); iz++) {
          for (let ix = 0; ix < leftCols; ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: leftStartX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: created === 0,
              label: 'Shock center',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }

          for (let ix = 0; ix < rightCols; ix++) {
            if (created >= maxBoxes) break;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x: rightStartX + ix * boxW,
              y: startY + iy * boxH,
              z: startZ + iz * boxD,
              weight: boxWeight,
              isSample: false,
              label: 'Shock center',
              originalSize: { w: boxW, h: boxH, d: boxD },
            });

            created++;
          }

          if (created >= maxBoxes) break;
        }
        if (created >= maxBoxes) break;
      }

      if (lastBox) {
        selected = lastBox;
        transformControl.attach(lastBox);
        showSelectedInfo(infoPanel, infoText, lastBox);
      }

      return {
        created,
        usedVol: created * boxW * boxH * boxD,
        totalVol: containerWidth * containerHeight * containerLength,
      };
    }

    function autoArrangeFromCapacity() {
      if (!lastCapacityData || !lastCapacityData.ok) return;

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();

      const result = arrangeBoxesPlain();

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ✅ TỰ ĐỘNG XẾP THÙNG TỐI ĐA
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>📦 Số thùng đã xếp:</div>
          <div style="text-align:right;font-weight:bold;">${result.created}</div>

          <div>🔄 Hướng xoay:</div>
          <div style="text-align:right;font-weight:bold;">${lastCapacityData.best.rotationText}</div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${((result.usedVol / result.totalVol) * 100).toFixed(2)}%</div>
        </div>

        <div style="margin-top:10px;font-size:0.85rem;color:#cbd5e1;line-height:1.5;">
          Chống sốc chưa được hiển thị. Khi bạn chọn kiểu chống sốc và bấm nút hiển thị, hệ thống sẽ xếp lại thùng theo đúng kiểu chống sốc để tránh chồng hình.
        </div>
      `;
      reportEl.style.display = 'block';
    }

    function applyShockVisual() {
      if (!lastCapacityData?.ok) return;

      const mode = getShockMode();
      const withNet = getShockNet();

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();

      const arrangement =
        mode === 'center' ? arrangeBoxesCenterShock() : arrangeBoxesBasicShock();

      const containerWidth = +document.getElementById('calcContainerWidth').value;
      const containerHeight = +document.getElementById('calcContainerHeight').value;
      const containerLength = +document.getElementById('calcContainerLength').value;

      renderShockVisuals({
        shockGroup: containerSys.shockGroup,
        mode,
        withNet,
        containerWidth,
        containerHeight,
        containerLength,
        best: lastCapacityData.best,
      });

      const modeText = mode === 'center' ? 'Giữa container theo chiều rộng' : 'Cơ bản';
      const netText = withNet ? 'Có' : 'Không';

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ✅ ĐÃ HIỂN THỊ CHỐNG SỐC TRÊN MÔ HÌNH 3D
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>Kiểu chống sốc:</div>
          <div style="text-align:right;font-weight:bold;">${modeText}</div>

          <div>Lưới chống rơi hàng:</div>
          <div style="text-align:right;font-weight:bold;">${netText}</div>

          <div>📦 Số thùng đang hiển thị:</div>
          <div style="text-align:right;font-weight:bold;">${arrangement.created}</div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${((arrangement.usedVol / arrangement.totalVol) * 100).toFixed(2)}%</div>
        </div>
      `;
      reportEl.style.display = 'block';
    }

    function handlePointerDown(e) {
      if (transformControl.dragging) return;

      const rect = renderer.domElement.getBoundingClientRect();
      pointer.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      pointer.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycaster.setFromCamera(pointer, camera);
      const hits = raycaster.intersectObjects(boxes);

      if (hits.length > 0) {
        selected = hits[0].object;
        transformControl.attach(selected);
        showSelectedInfo(infoPanel, infoText, selected);
      } else {
        selected = null;
        transformControl.detach();
        if (infoPanel) infoPanel.style.display = 'none';
      }
    }

    function renderMultiBoxTypeRow(item, index) {
      return `
        <div class="multi-box-row" data-id="${item.id}" style="border:1px solid #334155;border-radius:10px;padding:12px;margin-bottom:10px;background:#0f172a;">
          <div class="dimension-inputs">
            <div class="input-group">
              <label>Tên loại</label>
              <input data-field="label" value="${item.label || `Loại ${index + 1}`}" />
            </div>
            <div class="input-group">
              <label>Số lượng</label>
              <input data-field="qty" type="number" min="1" value="${item.qty}" />
            </div>
          </div>

          <div class="dimension-inputs">
            <div class="input-group">
              <label>Rộng</label>
              <input data-field="w" type="number" min="1" value="${item.w}" />
            </div>
            <div class="input-group">
              <label>Cao</label>
              <input data-field="h" type="number" min="1" value="${item.h}" />
            </div>
            <div class="input-group">
              <label>Dài</label>
              <input data-field="d" type="number" min="1" value="${item.d}" />
            </div>
          </div>

          <div class="dimension-inputs">
            <div class="input-group">
              <label>Khối lượng</label>
              <input data-field="weight" type="number" min="1" value="${item.weight}" />
            </div>
          </div>

          <button type="button" class="btn-icon danger btn-remove-box-type" title="Xóa loại thùng">🗑️</button>
        </div>
      `;
    }

    function bindMultiBoxTypeEvents() {
      if (!multiBoxTypesList) return;

      multiBoxTypesList.querySelectorAll('.multi-box-row').forEach((row) => {
        const id = Number(row.dataset.id);

        row.querySelectorAll('input').forEach((input) => {
          input.addEventListener('input', (e) => {
            const field = e.target.dataset.field;
            const value = field === 'label' ? e.target.value : Number(e.target.value);

            multiBoxTypes = multiBoxTypes.map((item) =>
              item.id === id
                ? {
                    ...item,
                    [field]: value,
                  }
                : item
            );
          });
        });

        const removeBtn = row.querySelector('.btn-remove-box-type');
        removeBtn?.addEventListener('click', () => {
          multiBoxTypes = multiBoxTypes.filter((item) => item.id !== id);
          renderMultiBoxTypes();
        });
      });
    }

    function renderMultiBoxTypes() {
      if (!multiBoxTypesList) return;
      multiBoxTypesList.innerHTML = multiBoxTypes
        .map((item, index) => renderMultiBoxTypeRow(item, index))
        .join('');
      bindMultiBoxTypeEvents();
    }

    function addMultiBoxType() {
      multiBoxTypes.push({
        id: Date.now() + Math.floor(Math.random() * 10000),
        label: `Loại ${multiBoxTypes.length + 1}`,
        w: 60,
        h: 50,
        d: 80,
        weight: 20,
        qty: 1,
      });
      renderMultiBoxTypes();
    }

    function buildRejectedListHtml(title, items, color = '#fbbf24') {
      if (!items || items.length === 0) return '';

      return `
        <div style="margin-top:12px;">
          <div style="font-weight:700;color:${color};margin-bottom:8px;">${title}</div>
          <div style="display:grid;gap:8px;">
            ${items
              .map(
                (item) => `
                  <div style="padding:10px;border-radius:8px;background:rgba(15,23,42,0.7);border:1px solid rgba(148,163,184,0.18);line-height:1.6;">
                    <div><b>Loại thùng:</b> ${item.label}</div>
                    <div><b>Kích thước:</b> Dài ${item.d} × Rộng ${item.w} × Cao ${item.h} cm</div>
                    <div><b>Khối lượng:</b> ${item.weight} kg</div>
                    <div><b>Số lượng bị loại:</b> ${item.count} thùng</div>
                  </div>
                `
              )
              .join('')}
          </div>
        </div>
      `;
    }

    function buildOptimizeWarningHtml(result) {
      const warnings = [];

      if (result.overSpaceRequested) {
        warnings.push(
          `⚠️ Tổng số thùng yêu cầu vượt quá <b>dung tích không gian</b> của container. Hệ thống đã tự giảm bớt để chỉ giữ số lượng vừa đủ.`
        );
      }

      if (result.overWeightRequested) {
        warnings.push(
          `⚠️ Tổng khối lượng thùng yêu cầu vượt quá <b>tải trọng tối đa</b> của container. Hệ thống đã tự loại bớt thùng để không vượt tải.`
        );
      }

      const rejectedSpaceDetails =
        result.rejectedBySpaceSummary && result.rejectedBySpaceSummary.length > 0
          ? `
            <div style="margin-top:10px;">
              <div><b>📦 Thùng bị loại do không gian:</b> ${result.rejectedBySpaceCount} thùng</div>
              <div style="margin-top:6px;display:grid;gap:6px;">
                ${result.rejectedBySpaceSummary
                  .map(
                    (item) => `
                      <div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.06);">
                        • ${item.label}: Dài ${item.d} × Rộng ${item.w} × Cao ${item.h} cm, ${item.weight} kg, bị loại ${item.count} thùng
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
          : '';

      const rejectedWeightDetails =
        result.rejectedByWeightSummary && result.rejectedByWeightSummary.length > 0
          ? `
            <div style="margin-top:10px;">
              <div><b>⚖️ Thùng bị loại do khối lượng:</b> ${result.rejectedByWeightCount} thùng</div>
              <div style="margin-top:6px;display:grid;gap:6px;">
                ${result.rejectedByWeightSummary
                  .map(
                    (item) => `
                      <div style="padding:8px 10px;border-radius:8px;background:rgba(255,255,255,0.06);">
                        • ${item.label}: Dài ${item.d} × Rộng ${item.w} × Cao ${item.h} cm, ${item.weight} kg, bị loại ${item.count} thùng
                      </div>
                    `
                  )
                  .join('')}
              </div>
            </div>
          `
          : '';

      if (warnings.length === 0 && !rejectedSpaceDetails && !rejectedWeightDetails) return '';

      return `
        <div style="margin-top:12px;padding:12px;border-radius:10px;background:rgba(245,158,11,0.12);border:1px solid rgba(245,158,11,0.45);color:#fde68a;line-height:1.65;">
          ${warnings.map((w) => `<div>${w}</div>`).join('')}
          ${rejectedSpaceDetails}
          ${rejectedWeightDetails}
        </div>
      `;
    }

    function optimizeMultiTypeBoxes() {
      const validTypes = multiBoxTypes.filter(
        (t) =>
          Number(t.qty) > 0 &&
          Number(t.w) > 0 &&
          Number(t.h) > 0 &&
          Number(t.d) > 0 &&
          Number(t.weight) > 0
      );

      if (validTypes.length === 0) {
        reportEl.innerHTML = `
          <div style="color:#f87171;font-weight:bold;">❌ Chưa có loại thùng hợp lệ</div>
          <div>Vui lòng thêm ít nhất 1 loại thùng có số lượng, kích thước và khối lượng lớn hơn 0.</div>
        `;
        reportEl.style.display = 'block';
        return;
      }

      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();

      const containerMaxWeight = getCurrentContainerMaxLoad();

      const containerSize = {
        w: +cw.value,
        h: +ch.value,
        d: +cd.value,
      };

      const result = optimizeMixedPacking({
        container: containerSize,
        boxTypes: validTypes,
        maxWeight: containerMaxWeight,
      });

      const compactedPlaced = compactPlacedLayout(result.placed, containerSize, {
        step: 1,
        maxPasses: 30,
        compactFloor: true,
        compactFront: true,
        compactLeft: true,
      });

      let lastBox = null;

      compactedPlaced.forEach((item, index) => {
        lastBox = addBox({
          w: item.w,
          h: item.h,
          d: item.d,
          x: item.x + item.w / 2,
          y: item.y + item.h / 2,
          z: item.z + item.d / 2,
          weight: item.weight,
          isSample: index === 0,
          label: item.label,
          originalSize: item.originalSize,
        });
      });

      if (lastBox) {
        selected = lastBox;
        transformControl.attach(lastBox);
        showSelectedInfo(infoPanel, infoText, lastBox);
      }

      const warningHtml = buildOptimizeWarningHtml(result);
      const rejectedSpaceHtml = buildRejectedListHtml(
        '📦 Danh sách thùng bị loại do không gian',
        result.rejectedBySpaceSummary,
        '#fbbf24'
      );
      const rejectedWeightHtml = buildRejectedListHtml(
        '⚖️ Danh sách thùng bị loại do khối lượng',
        result.rejectedByWeightSummary,
        '#fb7185'
      );

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ✅ SẮP XẾP TỐI ƯU NHIỀU LOẠI THÙNG
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>📦 Tổng yêu cầu:</div>
          <div style="text-align:right;font-weight:bold;">${result.totalRequested}</div>

          <div>📦 Đã xếp thực tế:</div>
          <div style="text-align:right;font-weight:bold;color:#10b981;">${result.packedCount}</div>

          <div>❌ Không được xếp:</div>
          <div style="text-align:right;font-weight:bold;color:#f59e0b;">${result.remaining}</div>

          <div>📦 Loại do không gian:</div>
          <div style="text-align:right;font-weight:bold;">${result.rejectedBySpaceCount}</div>

          <div>⚖️ Loại do khối lượng:</div>
          <div style="text-align:right;font-weight:bold;">${result.rejectedByWeightCount}</div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${result.efficiency.toFixed(2)}%</div>

          <div>⚖️ Khối lượng đã xếp:</div>
          <div style="text-align:right;font-weight:bold;">${result.totalPlacedWeight.toFixed(2)} kg</div>

          <div>🚚 Tải trọng container:</div>
          <div style="text-align:right;font-weight:bold;">${
            Number.isFinite(result.maxWeight) ? result.maxWeight.toFixed(2) : 'Không giới hạn'
          } kg</div>
        </div>

        <div style="margin-top:12px;padding:10px 12px;border-radius:10px;background:rgba(59,130,246,0.10);border:1px solid rgba(59,130,246,0.35);color:#bfdbfe;line-height:1.6;">
          ℹ️ Thuật toán xếp vẫn giữ nguyên theo candidate points heuristic. Mô hình 3D đã được nén hiển thị để các thùng dồn sát hơn về <b>đầu container</b>, <b>vách trái</b> và <b>sàn</b>.
        </div>

        ${warningHtml}
        ${rejectedSpaceHtml}
        ${rejectedWeightHtml}

        <div style="margin-top:10px;font-size:0.84rem;color:#cbd5e1;line-height:1.5;">
          Hệ thống giữ nguyên logic chọn thùng của thuật toán tối ưu, nhưng sau đó sẽ thực hiện bước “compact layout” để giảm khoảng hở khi hiển thị trên mô hình 3D.
        </div>
      `;
      reportEl.style.display = 'block';
    }

    if (localStorage.getItem('contType')) {
      contType.value = localStorage.getItem('contType');
      cw.value = localStorage.getItem('cw') || 235;
      ch.value = localStorage.getItem('ch') || 239;
      cd.value = localStorage.getItem('cd') || 590;
    }

    updateContainer();
    syncCapacityInputs();
    renderMultiBoxTypes();
    sceneSys.resize();

    contType.onchange = (e) => {
      if (e.target.value !== 'custom' && CONTAINER_TYPES[e.target.value]) {
        const d = CONTAINER_TYPES[e.target.value];
        cw.value = d.w;
        ch.value = d.h;
        cd.value = d.d;
      }

      updateContainer();
      syncCapacityInputs();
      localStorage.setItem('contType', e.target.value);
      localStorage.setItem('cw', cw.value);
      localStorage.setItem('ch', ch.value);
      localStorage.setItem('cd', cd.value);
    };

    [cw, ch, cd].forEach((el) => {
      el.onchange = () => {
        updateContainer();
        syncCapacityInputs();
      };
    });

    opacitySlider?.addEventListener('input', updateContainer);
    canvasDiv.addEventListener('pointerdown', handlePointerDown);
    btnAddBoxType?.addEventListener('click', addMultiBoxType);

    document.getElementById('btnSpawn').onclick = () => {
      const w = +document.getElementById('bw').value || 60;
      const h = +document.getElementById('bh').value || 50;
      const d = +document.getElementById('bd').value || 80;
      const weight = +document.getElementById('bWeight').value || 20;
      const qty = +document.getElementById('bQty').value || 1;
      const W = +cw.value;
      const containerMaxWeight = getCurrentContainerMaxLoad();

      let currentTotalWeight = boxes.reduce((sum, b) => sum + Number(b.userData.weight || 0), 0);
      let createdCount = 0;
      let rejectedByWeight = 0;

      for (let i = 0; i < qty; i++) {
        if (currentTotalWeight + weight > containerMaxWeight) {
          rejectedByWeight++;
          continue;
        }

        const offsetX = Math.random() * 60 - 30;
        const offsetZ = Math.random() * 140 - 70;
        const box = addBox({
          w,
          h,
          d,
          x: -W / 2 + w / 2 + offsetX,
          y: h / 2,
          z: offsetZ,
          weight,
          label: 'Thùng đơn',
          originalSize: { w, h, d },
        });

        currentTotalWeight += weight;
        createdCount++;

        if (i === qty - 1 || createdCount > 0) {
          selected = box;
          transformControl.attach(box);
        }
      }

      if (rejectedByWeight > 0) {
        reportEl.innerHTML = `
          <div style="color:#f59e0b;font-size:1.05rem;font-weight:bold;margin-bottom:8px;">
            ⚠️ SỐ LƯỢNG THÙNG ĐÃ ĐƯỢC GIẢM
          </div>

          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>Yêu cầu tạo:</div>
            <div style="text-align:right;font-weight:bold;">${qty}</div>

            <div>Đã tạo:</div>
            <div style="text-align:right;font-weight:bold;color:#10b981;">${createdCount}</div>

            <div>Bị loại do vượt tải:</div>
            <div style="text-align:right;font-weight:bold;color:#f59e0b;">${rejectedByWeight}</div>

            <div>Tải trọng tối đa container:</div>
            <div style="text-align:right;font-weight:bold;">${containerMaxWeight} kg</div>
          </div>

          <div style="margin-top:10px;color:#fde68a;line-height:1.6;">
            Tổng khối lượng yêu cầu vượt giới hạn container nên hệ thống chỉ tạo số lượng vừa đủ để không vượt tải.
          </div>
        `;
        reportEl.style.display = 'block';
      }
    };

    document.getElementById('btnCalcCapacity').onclick = handleCapacity;
    if (btnAutoArrangeCapacity) btnAutoArrangeCapacity.onclick = autoArrangeFromCapacity;
    if (btnApplyShockVisual) btnApplyShockVisual.onclick = applyShockVisual;

    document.getElementById('btnAI').onclick = basicPacking;
    document.getElementById('btnAIPro').onclick = basicPacking;
    document.getElementById('btnOptimizeMulti').onclick = optimizeMultiTypeBoxes;

    document.getElementById('btnClear').onclick = () => {
      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);
      updateContainer();
      reportEl.style.display = 'none';
    };

    document.getElementById('btnModeMove').onclick = () => transformControl.setMode('translate');
    document.getElementById('btnModeRotate').onclick = () => transformControl.setMode('rotate');
    document.getElementById('btnResetView').onclick = () =>
      sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);

    document.getElementById('btnRandom20').onclick = () => {
      const containerMaxWeight = getCurrentContainerMaxLoad();
      let currentTotalWeight = boxes.reduce((sum, b) => sum + Number(b.userData.weight || 0), 0);
      let created = 0;
      let skipped = 0;

      for (let i = 0; i < 20; i++) {
        const w = 30 + Math.floor(Math.random() * 70);
        const h = 30 + Math.floor(Math.random() * 70);
        const d = 30 + Math.floor(Math.random() * 70);
        const weight = 10 + Math.floor(Math.random() * 50);

        if (currentTotalWeight + weight > containerMaxWeight) {
          skipped++;
          continue;
        }

        const W = +cw.value;
        const offsetX = Math.random() * 200 - 100;
        const offsetZ = Math.random() * 260 - 130;

        addBox({
          w,
          h,
          d,
          x: -W / 2 + w / 2 + offsetX,
          y: h / 2,
          z: offsetZ,
          weight,
          label: 'Ngẫu nhiên',
          originalSize: { w, h, d },
        });

        currentTotalWeight += weight;
        created++;
      }

      if (skipped > 0) {
        reportEl.innerHTML = `
          <div style="color:#f59e0b;font-size:1.05rem;font-weight:bold;margin-bottom:8px;">
            ⚠️ RANDOM THÙNG ĐÃ ĐƯỢC GIẢM
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
            <div>Đã tạo:</div>
            <div style="text-align:right;font-weight:bold;">${created}</div>

            <div>Bị loại do vượt tải:</div>
            <div style="text-align:right;font-weight:bold;">${skipped}</div>
          </div>
        `;
        reportEl.style.display = 'block';
      }
    };

    document.getElementById('btnScreenshot').onclick = () => {
      renderer.render(scene, camera);
      const link = document.createElement('a');
      link.download = `packing-report-${new Date().toISOString().slice(0, 19).replace(/:/g, '-')}.png`;
      link.href = renderer.domElement.toDataURL('image/png');
      link.click();
    };

    document.getElementById('toggleSidebar').onclick = () => {
      document.getElementById('sidebar').classList.toggle('collapsed');
      setTimeout(() => {
        sceneSys.resize();
        sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);
      }, 310);
    };

    resizeObserver = new ResizeObserver(() => sceneSys.resize());
    resizeObserver.observe(canvasDiv);
    window.addEventListener('resize', sceneSys.resize);

    function animate() {
      animationId = requestAnimationFrame(animate);
      if (stars) stars.rotation.y += 0.00015;
      if (cogMarker?.visible) {
        cogMarker.children[1].rotation.y += 0.01;
        cogMarker.children[2].rotation.y -= 0.01;
      }
      sceneSys.render();
    }

    animate();

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener('resize', sceneSys.resize);
      resizeObserver?.disconnect();
      canvasDiv.removeEventListener('pointerdown', handlePointerDown);
      btnAddBoxType?.removeEventListener('click', addMultiBoxType);
      clearBoxes();
      clearShockVisuals(containerSys.shockGroup);

      renderer?.dispose?.();

      if (renderer?.domElement?.parentNode) {
        renderer.domElement.parentNode.removeChild(renderer.domElement);
      }
      if (sceneSys.labelRenderer?.domElement?.parentNode) {
        sceneSys.labelRenderer.domElement.parentNode.removeChild(sceneSys.labelRenderer.domElement);
      }
    };
  }, []);

  return (
    <div>
      <Header />
      <div className="container-app">
        <Sidebar />
        <div id="canvas"></div>
      </div>
    </div>
  );
}