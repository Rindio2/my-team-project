import {
  Box3,
  BoxGeometry,
  DoubleSide,
  EdgesGeometry,
  Euler,
  GridHelper,
  Group,
  LineBasicMaterial,
  LineSegments,
  Mesh,
  MeshStandardMaterial,
  PlaneGeometry,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

function makeMarker(text, color, x, y, z) {
  const group = new Group();

  const tag = document.createElement('div');
  tag.style.background = 'rgba(2,6,23,0.88)';
  tag.style.color = color;
  tag.style.border = `1px solid ${color}`;
  tag.style.padding = '6px 10px';
  tag.style.borderRadius = '8px';
  tag.style.fontSize = '12px';
  tag.style.fontWeight = '700';
  tag.style.whiteSpace = 'nowrap';
  tag.textContent = text;

  const label = new CSS2DObject(tag);
  label.position.set(x, y, z);
  group.add(label);

  return group;
}

function disposeObject3D(object) {
  if (!object) return;

  if (object.children?.length) {
    [...object.children].forEach((child) => disposeObject3D(child));
  }

  if (object.isCSS2DObject) {
    object.element?.remove();
  }

  if (object.geometry) {
    object.geometry.dispose?.();
  }

  if (object.material) {
    if (Array.isArray(object.material)) {
      object.material.forEach((m) => m.dispose?.());
    } else {
      object.material.dispose?.();
    }
  }

  if (object.parent) {
    object.parent.remove(object);
  }
}

function clearGroupChildren(targetGroup) {
  if (!targetGroup) return;

  while (targetGroup.children.length > 0) {
    const child = targetGroup.children[0];
    disposeObject3D(child);
  }
}

function clearContainerOnly(group, shockGroup) {
  if (!group) return;

  const childrenToRemove = group.children.filter((child) => child !== shockGroup);
  childrenToRemove.forEach((child) => disposeObject3D(child));
}

function applyClippingToNode(node, clippingPlanes = []) {
  if (!node) return;

  node.traverse((child) => {
    if (!child.material) return;

    const materials = Array.isArray(child.material) ? child.material : [child.material];
    materials.forEach((material) => {
      material.clippingPlanes = clippingPlanes.length > 0 ? clippingPlanes : null;
      material.clipShadows = clippingPlanes.length > 0;
      material.needsUpdate = true;
    });
  });
}

export function createContainerGroup() {
  return {
    group: new Group(),
    box3: new Box3(),
    shockGroup: new Group(),
    wallMeshes: {},
  };
}

function createWallMesh({ geometry, position, rotation, color, opacity, face }) {
  const material = new MeshStandardMaterial({
    color,
    transparent: true,
    opacity,
    roughness: 0.24,
    metalness: 0.12,
    side: DoubleSide,
    depthWrite: false,
  });

  const mesh = new Mesh(
    geometry,
    material
  );

  mesh.position.copy(position);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.userData.face = face;
  mesh.userData.baseOpacity = opacity;
  return mesh;
}

export function updateContainerMesh({
  group,
  box3,
  width,
  height,
  depth,
  opacity = 0.18,
  shockGroup,
  wallMeshes,
}) {
  // Chỉ xóa phần container, KHÔNG xóa shockGroup
  clearContainerOnly(group, shockGroup);

  const resolvedWallMeshes = wallMeshes || {};
  Object.keys(resolvedWallMeshes).forEach((key) => {
    delete resolvedWallMeshes[key];
  });

  const wallOpacity = Math.max(0.14, opacity * 0.95);
  const shellGeo = new BoxGeometry(width, height, depth);

  const walls = [
    createWallMesh({
      geometry: new PlaneGeometry(width, height),
      position: new Vector3(0, height / 2, -depth / 2),
      rotation: new Euler(0, 0, 0),
      color: 0x55b3ff,
      opacity: wallOpacity,
      face: 'head',
    }),
    createWallMesh({
      geometry: new PlaneGeometry(width, height),
      position: new Vector3(0, height / 2, depth / 2),
      rotation: new Euler(0, Math.PI, 0),
      color: 0x4b9af0,
      opacity: wallOpacity,
      face: 'door',
    }),
    createWallMesh({
      geometry: new PlaneGeometry(depth, height),
      position: new Vector3(-width / 2, height / 2, 0),
      rotation: new Euler(0, Math.PI / 2, 0),
      color: 0x3d8cff,
      opacity: Math.max(0.12, wallOpacity * 0.9),
      face: 'left',
    }),
    createWallMesh({
      geometry: new PlaneGeometry(depth, height),
      position: new Vector3(width / 2, height / 2, 0),
      rotation: new Euler(0, -Math.PI / 2, 0),
      color: 0x3d8cff,
      opacity: Math.max(0.12, wallOpacity * 0.9),
      face: 'right',
    }),
    createWallMesh({
      geometry: new PlaneGeometry(width, depth),
      position: new Vector3(0, height, 0),
      rotation: new Euler(Math.PI / 2, 0, 0),
      color: 0x82c9ff,
      opacity: Math.max(0.1, wallOpacity * 0.72),
      face: 'top',
    }),
  ];

  walls.forEach((wall) => {
    resolvedWallMeshes[wall.userData.face] = wall;
    group.add(wall);
  });

  const wire = new LineSegments(
    new EdgesGeometry(shellGeo),
    new LineBasicMaterial({ color: 0x9ddcff, transparent: true, opacity: 0.72 })
  );
  wire.position.set(0, height / 2, 0);
  group.add(wire);

  const deck = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.9,
      metalness: 0.04,
    })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.8;
  group.add(deck);

  const innerGrid = new GridHelper(
    Math.max(width, depth),
    Math.max(8, Math.floor(Math.max(width, depth) / 30)),
    0x38bdf8,
    0x24445e
  );
  innerGrid.position.y = 1.2;
  group.add(innerGrid);

  const headMarker = makeMarker('ĐẦU CONTAINER', '#22c55e', 0, height + 25, -depth / 2 - 30);
  group.add(headMarker);

  const doorMarker = makeMarker('CỬA CONTAINER', '#f97316', 0, height + 25, depth / 2 + 30);
  group.add(doorMarker);

  if (shockGroup && shockGroup.parent !== group) {
    group.add(shockGroup);
  }

  box3.setFromObject(group);
}

export function resolveContainerFaceFromCamera({ camera, height }) {
  if (!camera) return 'door';

  const cameraVector = camera.position.clone().sub(new Vector3(0, height / 2, 0));
  const absX = Math.abs(cameraVector.x);
  const absY = Math.abs(cameraVector.y);
  const absZ = Math.abs(cameraVector.z);

  if (absY >= absX && absY >= absZ) {
    return 'top';
  }

  if (absX >= absZ) {
    return cameraVector.x >= 0 ? 'right' : 'left';
  }

  return cameraVector.z >= 0 ? 'door' : 'head';
}

export function updateContainerViewOcclusion({
  wallMeshes,
  camera,
  height,
  enabled = true,
  mode = 'hide',
}) {
  if (!wallMeshes) return;

  const faces = ['head', 'door', 'left', 'right', 'top'];

  const restoreFace = (mesh) => {
    if (!mesh) return;
    mesh.visible = true;

    if (mesh.material) {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        material.opacity = mesh.userData.baseOpacity ?? material.opacity;
        material.transparent = true;
        material.depthWrite = false;
        material.needsUpdate = true;
      });
    }
  };

  if (!enabled) {
    faces.forEach((face) => {
      restoreFace(wallMeshes[face]);
    });
    return null;
  }

  const hiddenFace = resolveContainerFaceFromCamera({ camera, height });

  faces.forEach((face) => {
    const mesh = wallMeshes[face];
    if (!mesh) return;

    restoreFace(mesh);

    if (face !== hiddenFace) return;

    if (mode === 'fade') {
      const materials = Array.isArray(mesh.material) ? mesh.material : [mesh.material];
      materials.forEach((material) => {
        material.opacity = Math.max(0.035, Number(mesh.userData.baseOpacity || 0.16) * 0.18);
        material.depthWrite = false;
        material.needsUpdate = true;
      });
      mesh.visible = true;
      return;
    }

    mesh.visible = false;
  });

  return hiddenFace;
}

export function setContainerClipping(group, clippingPlanes = []) {
  applyClippingToNode(group, clippingPlanes);
}

function addShockMesh(group, width, height, depth, x, y, z, color = 0xfbbf24, opacity = 0.45) {
  if (width <= 0 || height <= 0 || depth <= 0) return;

  const mesh = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshStandardMaterial({
      color,
      transparent: true,
      opacity,
      roughness: 0.65,
      metalness: 0.02,
    })
  );

  mesh.position.set(x, y, z);
  group.add(mesh);
}

export function clearShockVisuals(shockGroup) {
  clearGroupChildren(shockGroup);
}

export function renderShockVisuals({
  shockGroup,
  mode,
  withNet,
  containerWidth,
  containerHeight,
  containerLength,
  best,
}) {
  if (!shockGroup || !best?.shockPads) return;

  clearGroupChildren(shockGroup);

  const pads = best.shockPads;
  const summary = pads.summary;

  if (mode === 'basic') {
    addShockMesh(
      shockGroup,
      pads.left.width,
      pads.left.height,
      pads.left.length,
      -containerWidth / 2 + pads.left.width / 2,
      pads.left.height / 2,
      0
    );

    addShockMesh(
      shockGroup,
      pads.right.width,
      pads.right.height,
      pads.right.length,
      containerWidth / 2 - pads.right.width / 2,
      pads.right.height / 2,
      0
    );

    addShockMesh(
      shockGroup,
      pads.front.width,
      pads.front.height,
      pads.front.length,
      0,
      pads.front.height / 2,
      -containerLength / 2 + pads.front.length / 2
    );

    addShockMesh(
      shockGroup,
      pads.back.width,
      pads.back.height,
      pads.back.length,
      0,
      pads.back.height / 2,
      containerLength / 2 - pads.back.length / 2
    );

    addShockMesh(
      shockGroup,
      pads.top.width,
      pads.top.height,
      pads.top.length,
      0,
      containerHeight - pads.top.height / 2,
      0,
      0x60a5fa,
      0.22
    );
  }

  if (mode === 'center') {
    addShockMesh(
      shockGroup,
      pads.centerWidthSplit.width,
      pads.centerWidthSplit.height,
      pads.centerWidthSplit.length,
      0,
      pads.centerWidthSplit.height / 2,
      0,
      0xfb7185,
      0.42
    );

    addShockMesh(
      shockGroup,
      pads.topFull.width,
      pads.topFull.height,
      pads.topFull.length,
      0,
      containerHeight - pads.topFull.height / 2,
      0,
      0x60a5fa,
      0.22
    );
  }

  if (withNet) {
    const netMat = new MeshStandardMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.18,
      roughness: 0.9,
      metalness: 0.02,
      side: DoubleSide,
    });

    const net = new Mesh(
      new PlaneGeometry(containerWidth * 0.96, containerHeight * 0.88),
      netMat
    );
    net.position.set(0, containerHeight * 0.48, containerLength / 2 - 8);
    shockGroup.add(net);

    const lines = new GridHelper(containerWidth * 0.96, 12, 0x22c55e, 0x22c55e);
    lines.position.set(0, containerHeight * 0.48, containerLength / 2 - 7.5);
    lines.rotation.x = Math.PI / 2;
    shockGroup.add(lines);
  }

  const info = document.createElement('div');
  info.style.background = 'rgba(2,6,23,0.88)';
  info.style.color = '#f8fafc';
  info.style.border = '1px solid #fbbf24';
  info.style.padding = '6px 10px';
  info.style.borderRadius = '8px';
  info.style.fontSize = '12px';
  info.style.fontWeight = '700';
  info.textContent =
    mode === 'center'
      ? 'CHỐNG SỐC: GIỮA CONTAINER THEO CHIỀU RỘNG'
      : 'CHỐNG SỐC: CƠ BẢN';

  const infoLabel = new CSS2DObject(info);
  infoLabel.position.set(0, containerHeight + 10, 0);
  shockGroup.add(infoLabel);

  if (summary.leftoverWidth <= 0 && summary.leftoverLength <= 0 && summary.leftoverHeight <= 0) {
    info.textContent += ' (KHÍT)';
  }
}
