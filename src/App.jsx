import { useEffect, useRef } from 'react';
import './App.css';

import Header from './components/Header';
import Sidebar from './components/Sidebar';

import { CONTAINER_TYPES } from './constants/containerTypes';
import { calculateCapacity } from './utils/capacity';
import { showCapacityResult, showPackingReport, showSelectedInfo } from './utils/uiHelpers';

import { createSceneSystem } from './three/initScene';
import { createContainerGroup, updateContainerMesh } from './three/container3d';
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

    const raycaster = new sceneSys.THREE.Raycaster();
    const pointer = new sceneSys.THREE.Vector2();

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
      }));

      clearBoxes();

      const W = +cw.value;
      const H = +ch.value;
      const D = +cd.value;
      itemsToPack.sort((a, b) => b.w * b.h * b.d - a.w * a.h * a.d);

      let layerY = 0;
      let usedVol = 0;
      let packedCount = 0;

      while (layerY + 5 < H && itemsToPack.length > 0) {
        let layerH = 0;
        let z = -D / 2;

        while (z + 5 < D / 2 && itemsToPack.length > 0) {
          let rowD = 0;
          let x = -W / 2;

          for (let i = 0; i < itemsToPack.length; i++) {
            const it = itemsToPack[i];
            if (x + it.w <= W / 2 && z + it.d <= D / 2 && layerY + it.h <= H) {
              addBox({
                w: it.w,
                h: it.h,
                d: it.d,
                x: x + it.w / 2,
                y: layerY + it.h / 2,
                z: z + it.d / 2,
                weight: it.weight,
              });
              usedVol += it.w * it.h * it.d;
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
        remaining: itemsToPack.length,
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
    }

    function autoArrangeFromCapacity() {
      if (!lastCapacityData || !lastCapacityData.ok) return;

      const { best, maxBoxes, boxWeight } = lastCapacityData;
      const { rotation, alongLength, alongWidth, alongHeight, shockPads } = best;

      if (!rotation || maxBoxes <= 0) return;

      clearBoxes();

      const containerWidth = +document.getElementById('calcContainerWidth').value;
      const containerHeight = +document.getElementById('calcContainerHeight').value;
      const containerLength = +document.getElementById('calcContainerLength').value;

      const boxW = rotation.w;
      const boxH = rotation.h;
      const boxD = rotation.l;

      const leftGap = shockPads?.left?.width || 0;
      const rightGap = shockPads?.right?.width || 0;
      const bottomGap = shockPads?.bottom?.height || 0;
      const topGap = shockPads?.top?.height || 0;
      const frontGap = shockPads?.front?.length || 0;
      const backGap = shockPads?.back?.length || 0;

      const usableWidth = containerWidth - leftGap - rightGap;
      const usableHeight = containerHeight - bottomGap - topGap;
      const usableLength = containerLength - frontGap - backGap;

      const safeAlongWidth = Math.floor(usableWidth / boxW);
      const safeAlongHeight = Math.floor(usableHeight / boxH);
      const safeAlongLength = Math.floor(usableLength / boxD);

      const finalAlongWidth = Math.min(alongWidth, safeAlongWidth);
      const finalAlongHeight = Math.min(alongHeight, safeAlongHeight);
      const finalAlongLength = Math.min(alongLength, safeAlongLength);

      const startX = -containerWidth / 2 + leftGap + boxW / 2;
      const startY = bottomGap + boxH / 2;
      const startZ = -containerLength / 2 + frontGap + boxD / 2;

      let created = 0;
      let lastBox = null;

      for (let iy = 0; iy < finalAlongHeight; iy++) {
        for (let iz = 0; iz < finalAlongLength; iz++) {
          for (let ix = 0; ix < finalAlongWidth; ix++) {
            if (created >= maxBoxes) break;

            const x = startX + ix * boxW;
            const y = startY + iy * boxH;
            const z = startZ + iz * boxD;

            lastBox = addBox({
              w: boxW,
              h: boxH,
              d: boxD,
              x,
              y,
              z,
              weight: boxWeight,
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

      const usedVol = created * boxW * boxH * boxD;
      const totalVol = containerWidth * containerHeight * containerLength;

      reportEl.innerHTML = `
        <div style="color:#10b981;font-size:1.1rem;font-weight:bold;margin-bottom:8px;">
          ✅ TỰ ĐỘNG XẾP THÙNG TỐI ĐA
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px;">
          <div>📦 Số thùng đã xếp:</div>
          <div style="text-align:right;font-weight:bold;">${created}</div>

          <div>🔄 Hướng xoay:</div>
          <div style="text-align:right;font-weight:bold;">${best.rotationText}</div>

          <div>🧽 Túi trái / phải:</div>
          <div style="text-align:right;font-weight:bold;">
            ${shockPads.left.width.toFixed(2)} × ${shockPads.left.height.toFixed(2)} × ${shockPads.left.length.toFixed(2)}
          </div>

          <div>🧽 Túi trước / sau:</div>
          <div style="text-align:right;font-weight:bold;">
            ${shockPads.front.width.toFixed(2)} × ${shockPads.front.height.toFixed(2)} × ${shockPads.front.length.toFixed(2)}
          </div>

          <div>🧽 Túi sàn / trần:</div>
          <div style="text-align:right;font-weight:bold;">
            ${shockPads.bottom.width.toFixed(2)} × ${shockPads.bottom.height.toFixed(2)} × ${shockPads.bottom.length.toFixed(2)}
          </div>

          <div>📊 Hiệu suất thể tích:</div>
          <div style="text-align:right;font-weight:bold;">${((usedVol / totalVol) * 100).toFixed(2)}%</div>
        </div>

        <div style="margin-top:10px;font-size:0.85rem;color:#cbd5e1;line-height:1.5;">
          Các túi chống sốc được tính theo đúng kích thước mặt tiếp xúc ngoài rìa và phần khe hở còn dư được chia đều cho 2 mặt phẳng đối nhau.
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

    if (localStorage.getItem('contType')) {
      contType.value = localStorage.getItem('contType');
      cw.value = localStorage.getItem('cw') || 235;
      ch.value = localStorage.getItem('ch') || 239;
      cd.value = localStorage.getItem('cd') || 590;
    }

    updateContainer();
    syncCapacityInputs();
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

    document.getElementById('btnSpawn').onclick = () => {
      const w = +document.getElementById('bw').value || 60;
      const h = +document.getElementById('bh').value || 50;
      const d = +document.getElementById('bd').value || 80;
      const weight = +document.getElementById('bWeight').value || 20;
      const qty = +document.getElementById('bQty').value || 1;
      const W = +cw.value;

      for (let i = 0; i < qty; i++) {
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
        });

        if (i === qty - 1) {
          selected = box;
          transformControl.attach(box);
        }
      }
    };

    document.getElementById('btnCalcCapacity').onclick = handleCapacity;
    btnAutoArrangeCapacity.onclick = autoArrangeFromCapacity;

    document.getElementById('btnAI').onclick = basicPacking;
    document.getElementById('btnAIPro').onclick = basicPacking;
    document.getElementById('btnClear').onclick = clearBoxes;
    document.getElementById('btnModeMove').onclick = () => transformControl.setMode('translate');
    document.getElementById('btnModeRotate').onclick = () => transformControl.setMode('rotate');
    document.getElementById('btnResetView').onclick = () =>
      sceneSys.fitCameraToBox(+cw.value, +ch.value, +cd.value);

    document.getElementById('btnRandom20').onclick = () => {
      for (let i = 0; i < 20; i++) {
        const w = 30 + Math.floor(Math.random() * 70);
        const h = 30 + Math.floor(Math.random() * 70);
        const d = 30 + Math.floor(Math.random() * 70);
        const weight = 10 + Math.floor(Math.random() * 50);
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
        });
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
      clearBoxes();

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