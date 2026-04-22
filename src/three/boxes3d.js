import {
  BoxGeometry,
  CanvasTexture,
  EdgesGeometry,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let sharedCartonTexture = null;
const PREVIEW_LABEL_ROLE = 'preview-label';
const PREVIEW_OUTLINE_ROLE = 'preview-outline';

function getSharedCartonTexture() {
  if (sharedCartonTexture) return sharedCartonTexture;

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

  sharedCartonTexture = new CanvasTexture(canvas);
  return sharedCartonTexture;
}

export function disposeBox(scene, box) {
  if (!box || !scene) return;

  scene.remove(box);

  if (box.geometry) box.geometry.dispose();

  if (box.material) {
    if (Array.isArray(box.material)) {
      box.material.forEach((m) => {
        if (m.map && !m.userData?.hasSharedTexture) m.map.dispose();
        m.dispose();
      });
    } else {
      if (box.material.map && !box.material.userData?.hasSharedTexture) box.material.map.dispose();
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

function createPreviewOutline(mesh) {
  const edges = new LineSegments(
    new EdgesGeometry(mesh.geometry),
    new LineBasicMaterial({ color: 0x22c55e })
  );
  edges.userData.decoratorRole = PREVIEW_OUTLINE_ROLE;
  mesh.add(edges);
}

function createSampleDimensionLabel(
  mesh,
  { w, h, d, weight, title = 'Item preview', previewQuantity = 1, visible = true }
) {
  const labelDiv = document.createElement('div');
  labelDiv.style.background = 'rgba(2, 6, 23, 0.96)';
  labelDiv.style.color = '#e2e8f0';
  labelDiv.style.padding = '8px 10px';
  labelDiv.style.borderRadius = '12px';
  labelDiv.style.fontSize = '11px';
  labelDiv.style.lineHeight = '1.45';
  labelDiv.style.fontWeight = '600';
  labelDiv.style.border = '1px solid #22c55e';
  labelDiv.style.boxShadow = '0 8px 22px rgba(0,0,0,0.35)';
  labelDiv.style.minWidth = '136px';
  labelDiv.style.maxWidth = '180px';
  labelDiv.style.pointerEvents = 'none';
  labelDiv.style.display = visible ? 'block' : 'none';
  labelDiv.innerHTML = `
    <div style="color:#22c55e;font-weight:700;margin-bottom:4px;">📦 ${title}</div>
    <div>SL preview: <b>${Number(previewQuantity) > 0 ? previewQuantity : 1}</b></div>
    <div>${w} × ${h} × ${d} cm</div>
    <div>${weight} kg</div>
  `;

  const labelObject = new CSS2DObject(labelDiv);
  labelObject.userData.decoratorRole = PREVIEW_LABEL_ROLE;
  labelObject.visible = visible;
  labelObject.position.set(0, h / 2 + 22, 0);
  mesh.add(labelObject);

  createPreviewOutline(mesh);

  mesh.userData.isSampleBox = true;
}

function clearBoxDecorators(box) {
  [...box.children].forEach((child) => {
    if (child.isCSS2DObject) child.element?.remove();
    if (child.geometry) child.geometry.dispose?.();
    if (child.material) {
      if (Array.isArray(child.material)) {
        child.material.forEach((m) => m.dispose?.());
      } else {
        child.material.dispose?.();
      }
    }
    box.remove(child);
  });
}

function applyToObjectMaterials(object3D, callback) {
  if (!object3D) return;

  object3D.traverse((node) => {
    if (!node.material) return;

    const materials = Array.isArray(node.material) ? node.material : [node.material];
    materials.forEach((material) => {
      callback(material);
      material.needsUpdate = true;
    });
  });
}

export function getBoxOrientationPresets({ w, h, d }) {
  return [
    { id: 'whd', label: 'R-C-D', size: { w, h, d } },
    { id: 'wdh', label: 'R-D-C', size: { w, h: d, d: h } },
    { id: 'hwd', label: 'C-R-D', size: { w: h, h: w, d } },
    { id: 'hdw', label: 'C-D-R', size: { w: h, h: d, d: w } },
    { id: 'dwh', label: 'D-R-C', size: { w: d, h: w, d: h } },
    { id: 'dhw', label: 'D-C-R', size: { w: d, h, d: w } },
  ];
}

export function updateCartonGeometry(box, { w, h, d }) {
  if (!box) return;

  const nextGeometry = new BoxGeometry(w, h, d);

  if (box.geometry) {
    box.geometry.dispose();
  }

  box.geometry = nextGeometry;
  box.userData.size = { w, h, d };

  const wasSample = Boolean(box.userData.isSampleBox);
  box.userData.isSampleBox = false;
  clearBoxDecorators(box);

  if (wasSample) {
    createSampleDimensionLabel(box, {
      w,
      h,
      d,
      weight: box.userData.weight,
      title: box.userData.label,
      previewQuantity: box.userData.previewQuantity,
      visible: Boolean(box.userData.showSampleLabel),
    });
  }

  if (Array.isArray(box.userData.clippingPlanes)) {
    setCartonClipping(box, box.userData.clippingPlanes);
  }
}

function applyToBoxMaterials(box, callback) {
  if (!box?.material) return;

  const materials = Array.isArray(box.material) ? box.material : [box.material];
  materials.forEach((material) => {
    callback(material);
    material.needsUpdate = true;
  });
}

export function setCartonClipping(box, clippingPlanes = []) {
  if (!box) return;

  box.userData.clippingPlanes = clippingPlanes;

  applyToObjectMaterials(box, (material) => {
    material.clippingPlanes = clippingPlanes.length > 0 ? clippingPlanes : null;
    material.clipShadows = clippingPlanes.length > 0;
  });
}

export function setCartonSelection(box, active) {
  if (!box) return;

  box.userData.isSelected = Boolean(active);

  applyToBoxMaterials(box, (material) => {
    if (!('emissive' in material)) return;

    material.emissive.set(active ? 0x163f2f : 0x000000);
    material.emissiveIntensity = active ? 0.85 : 0;
  });
}

export function setCartonPreviewLabelVisible(box, visible) {
  if (!box) return;

  box.userData.showSampleLabel = Boolean(visible);

  box.children.forEach((child) => {
    if (!child.isCSS2DObject || child.userData?.decoratorRole !== PREVIEW_LABEL_ROLE) return;
    child.visible = Boolean(visible);
    if (child.element) {
      child.element.style.display = visible ? 'block' : 'none';
    }
  });
}

export function createCarton(
  scene,
  existingCount,
  { w, h, d, x, y, z, weight, isSample = false, label = 'Thùng', previewQuantity = 0, meta = {} }
) {
  const geo = new BoxGeometry(w, h, d);
  const mat = new MeshStandardMaterial({
    map: getSharedCartonTexture(),
    roughness: 0.7,
    metalness: 0.05,
    emissive: 0x000000,
    emissiveIntensity: 0,
  });
  mat.userData = {
    ...(mat.userData || {}),
    hasSharedTexture: true,
  };

  const mesh = new Mesh(geo, mat);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  mesh.frustumCulled = true;
  mesh.userData = {
    size: { w, h, d },
    weight,
    id: existingCount + 1,
    isSampleBox: false,
    showSampleLabel: Boolean(meta.showSampleLabel ?? isSample),
    isSelected: false,
    clippingPlanes: null,
    ...meta,
  };

  if (isSample) {
    createSampleDimensionLabel(mesh, {
      w,
      h,
      d,
      weight,
      title: label,
      previewQuantity,
      visible: Boolean(mesh.userData.showSampleLabel),
    });
  }

  scene.add(mesh);
  return mesh;
}
