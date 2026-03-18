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
  });
}

export function createCarton(scene, existingCount, { w, h, d, x, y, z, weight }) {
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
  };

  const labelDiv = document.createElement('div');
  labelDiv.style.backgroundColor = 'rgba(0,0,0,0.8)';
  labelDiv.style.color = 'white';
  labelDiv.style.padding = '4px 8px';
  labelDiv.style.borderRadius = '4px';
  labelDiv.style.fontSize = '12px';
  labelDiv.style.fontWeight = 'bold';
  labelDiv.style.border = '1px solid #fbbf24';
  labelDiv.innerHTML = `#${mesh.userData.id}<br>${weight}kg`;

  const label = new CSS2DObject(labelDiv);
  label.position.set(0, h / 2 + 10, 0);
  mesh.add(label);

  scene.add(mesh);
  return mesh;
} // hình dạng 3d của các box carton, có thể tùy chỉnh vật liệu và hiệu ứng nếu muốn, hiện tại ưu tiên đơn giản để dễ nhìn và render mượt trên nhiều máy tính