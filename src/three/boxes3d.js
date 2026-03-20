import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

export function disposeBox(scene, box) {
  if (!box || !scene) return;

  scene.remove(box);

  if (box.geometry) box.geometry.dispose();

  if (box.material) {
    if (Array.isArray(box.material)) {
      box.material.forEach((m) => {
        if (m.map) m.map.dispose();
        m.dispose();
      });
    } else {
      if (box.material.map) box.material.map.dispose();
      box.material.dispose();
    }
  }

  box.children.forEach((child) => {
    if (child.isCSS2DObject) child.element?.remove();
    if (child.geometry) child.geometry.dispose?.();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose?.());
      } else {
        child.material.dispose?.();
      }
    }
  });
}

function createSampleDimensionLabel(mesh, { w, h, d, weight }) {
  const labelDiv = document.createElement('div');
  labelDiv.style.background = 'rgba(2, 6, 23, 0.92)';
  labelDiv.style.color = '#e2e8f0';
  labelDiv.style.padding = '8px 10px';
  labelDiv.style.borderRadius = '10px';
  labelDiv.style.fontSize = '12px';
  labelDiv.style.lineHeight = '1.5';
  labelDiv.style.fontWeight = '600';
  labelDiv.style.border = '1px solid #22c55e';
  labelDiv.style.boxShadow = '0 6px 18px rgba(0,0,0,0.35)';
  labelDiv.style.minWidth = '150px';
  labelDiv.style.pointerEvents = 'none';
  labelDiv.innerHTML = `
    <div style="color:#22c55e;font-weight:700;margin-bottom:4px;">📦 Thùng mẫu</div>
    <div>Rộng: <b>${w}</b></div>
    <div>Dài: <b>${d}</b></div>
    <div>Cao: <b>${h}</b></div>
    <div>Kg: <b>${weight}</b></div>
  `;

  const label = new CSS2DObject(labelDiv);
  label.position.set(0, h / 2 + 22, 0);
  mesh.add(label);

  const edges = new THREE.LineSegments(
    new THREE.EdgesGeometry(mesh.geometry),
    new THREE.LineBasicMaterial({ color: 0x22c55e })
  );
  mesh.add(edges);

  mesh.userData.isSampleBox = true;
}

export function createCarton(
  scene,
  existingCount,
  { w, h, d, x, y, z, weight, isSample = false }
) {
  const geo = new THREE.BoxGeometry(w, h, d);

  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 512;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#8b5a2b';
  ctx.fillRect(0, 0, 512, 512);
  ctx.strokeStyle = '#6b4226';
  ctx.lineWidth = 4;

  for (let i = 0; i < 20; i++) {
    ctx.beginPath();
    ctx.moveTo(i * 25, 0);
    ctx.lineTo(i * 25 + 50, 512);
    ctx.stroke();
  }

  const texture = new THREE.CanvasTexture(canvas);
  const mat = new THREE.MeshStandardMaterial({
    map: texture,
    roughness: 0.7,
    metalness: 0.05,
  });

  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.userData = {
    size: { w, h, d },
    weight,
    id: existingCount + 1,
    isSampleBox: false,
  };

  if (isSample) {
    createSampleDimensionLabel(mesh, { w, h, d, weight });
  }

  scene.add(mesh);
  return mesh;
}