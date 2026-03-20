import * as THREE from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

function makeMarker(text, color, x, y, z) {
  const group = new THREE.Group();

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

export function createContainerGroup() {
  return {
    group: new THREE.Group(),
    box3: new THREE.Box3(),
    shockGroup: new THREE.Group(),
  };
}

export function updateContainerMesh({
  group,
  box3,
  width,
  height,
  depth,
  opacity = 0.18,
  shockGroup,
}) {
  // Chỉ xóa phần container, KHÔNG xóa shockGroup
  clearContainerOnly(group, shockGroup);

  const shellGeo = new THREE.BoxGeometry(width, height, depth);
  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshStandardMaterial({
      color: 0x3b82f6,
      transparent: true,
      opacity: Math.max(0.16, opacity * 0.9),
      roughness: 0.18,
      metalness: 0.25,
      side: THREE.DoubleSide,
    })
  );
  shell.position.set(0, height / 2, 0);
  group.add(shell);

  const wire = new THREE.LineSegments(
    new THREE.EdgesGeometry(shellGeo),
    new THREE.LineBasicMaterial({ color: 0x7dd3fc })
  );
  wire.position.copy(shell.position);
  group.add(wire);

  const deck = new THREE.Mesh(
    new THREE.PlaneGeometry(width, depth),
    new THREE.MeshStandardMaterial({
      color: 0x1e3a5f,
      roughness: 0.9,
      metalness: 0.04,
    })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.8;
  group.add(deck);

  const innerGrid = new THREE.GridHelper(
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

function addShockMesh(group, width, height, depth, x, y, z, color = 0xfbbf24, opacity = 0.45) {
  if (width <= 0 || height <= 0 || depth <= 0) return;

  const mesh = new THREE.Mesh(
    new THREE.BoxGeometry(width, height, depth),
    new THREE.MeshStandardMaterial({
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
    const netMat = new THREE.MeshStandardMaterial({
      color: 0x22c55e,
      transparent: true,
      opacity: 0.18,
      roughness: 0.9,
      metalness: 0.02,
      side: THREE.DoubleSide,
    });

    const net = new THREE.Mesh(
      new THREE.PlaneGeometry(containerWidth * 0.96, containerHeight * 0.88),
      netMat
    );
    net.position.set(0, containerHeight * 0.48, containerLength / 2 - 8);
    shockGroup.add(net);

    const lines = new THREE.GridHelper(containerWidth * 0.96, 12, 0x22c55e, 0x22c55e);
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