import {
  Box3,
  BoxGeometry,
  CanvasTexture,
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
  RepeatWrapping,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let sharedContainerWallTexture = null;

function getContainerWallTexture() {
  if (sharedContainerWallTexture) return sharedContainerWallTexture;

  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = '#1e5f86';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  for (let x = 0; x < canvas.width; x += 22) {
    const isRaised = Math.floor(x / 22) % 2 === 0;
    ctx.fillStyle = isRaised ? 'rgba(186,230,253,0.16)' : 'rgba(2,6,23,0.18)';
    ctx.fillRect(x, 0, 11, canvas.height);
  }

  ctx.strokeStyle = 'rgba(125,211,252,0.2)';
  ctx.lineWidth = 1;
  for (let y = 28; y < canvas.height; y += 38) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y + 4);
    ctx.stroke();
  }

  ctx.fillStyle = 'rgba(15,23,42,0.16)';
  for (let i = 0; i < 120; i++) {
    const x = Math.random() * canvas.width;
    const y = Math.random() * canvas.height;
    ctx.fillRect(x, y, 1.2, 1.2);
  }

  sharedContainerWallTexture = new CanvasTexture(canvas);
  sharedContainerWallTexture.wrapS = RepeatWrapping;
  sharedContainerWallTexture.wrapT = RepeatWrapping;
  sharedContainerWallTexture.repeat.set(3, 2);
  return sharedContainerWallTexture;
}

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
    map: getContainerWallTexture(),
    transparent: true,
    opacity,
    roughness: 0.38,
    metalness: 0.28,
    emissive: color,
    emissiveIntensity: 0.012,
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

function addContainerRail(group, { width, height, depth, position, color = 0x7dd3fc }) {
  const rail = new Mesh(
    new BoxGeometry(width, height, depth),
    new MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: 0.035,
      roughness: 0.52,
      metalness: 0.28,
    })
  );

  rail.position.copy(position);
  rail.castShadow = true;
  rail.receiveShadow = true;
  group.add(rail);
  return rail;
}

function addCornerCasting(group, x, y, z, color = 0x0f172a) {
  addContainerRail(group, {
    width: 13,
    height: 9,
    depth: 13,
    position: new Vector3(x, y, z),
    color,
  });
}

function addDoorHardware(group, width, height, depth) {
  const z = depth / 2 + 4.8;
  const doorColor = 0xc65d1e;
  const hardwareColor = 0xe5e7eb;
  const shadowColor = 0x7c2d12;

  [
    { x: -width / 4, railWidth: width / 2 - 10 },
    { x: width / 4, railWidth: width / 2 - 10 },
  ].forEach((door) => {
    addContainerRail(group, {
      width: door.railWidth,
      height: 3,
      depth: 3,
      position: new Vector3(door.x, height * 0.16, z),
      color: doorColor,
    });
    addContainerRail(group, {
      width: door.railWidth,
      height: 3,
      depth: 3,
      position: new Vector3(door.x, height * 0.84, z),
      color: doorColor,
    });
    addContainerRail(group, {
      width: 3,
      height: height * 0.72,
      depth: 3,
      position: new Vector3(door.x - door.railWidth / 2, height * 0.5, z),
      color: doorColor,
    });
    addContainerRail(group, {
      width: 3,
      height: height * 0.72,
      depth: 3,
      position: new Vector3(door.x + door.railWidth / 2, height * 0.5, z),
      color: doorColor,
    });
  });

  addContainerRail(group, {
    width: 5,
    height: height * 0.82,
    depth: 5,
    position: new Vector3(0, height * 0.5, z + 1.2),
    color: shadowColor,
  });

  [-width * 0.32, -width * 0.12, width * 0.12, width * 0.32].forEach((x) => {
    addContainerRail(group, {
      width: 3,
      height: height * 0.72,
      depth: 4,
      position: new Vector3(x, height * 0.5, z + 2.4),
      color: hardwareColor,
    });

    [height * 0.24, height * 0.5, height * 0.76].forEach((y) => {
      addContainerRail(group, {
        width: 13,
        height: 4,
        depth: 5,
        position: new Vector3(x, y, z + 3.2),
        color: hardwareColor,
      });
    });
  });

  [-width / 2 + 10, width / 2 - 10].forEach((x) => {
    [height * 0.22, height * 0.42, height * 0.64, height * 0.84].forEach((y) => {
      addContainerRail(group, {
        width: 7,
        height: 16,
        depth: 7,
        position: new Vector3(x, y, z + 3.8),
        color: hardwareColor,
      });
    });
  });

  [-width * 0.08, width * 0.08].forEach((x) => {
    addContainerRail(group, {
      width: 22,
      height: 4,
      depth: 6,
      position: new Vector3(x, height * 0.46, z + 4.6),
      color: 0xfbbf24,
    });
  });
}

function addHeadWallDetails(group, width, height, depth) {
  const z = -depth / 2 - 4.5;
  const headColor = 0x15803d;

  addContainerRail(group, {
    width: width * 0.94,
    height: 4,
    depth: 4,
    position: new Vector3(0, height * 0.16, z),
    color: headColor,
  });
  addContainerRail(group, {
    width: width * 0.94,
    height: 4,
    depth: 4,
    position: new Vector3(0, height * 0.84, z),
    color: headColor,
  });

  const ribCount = Math.max(4, Math.floor(width / 44));
  for (let index = 0; index <= ribCount; index++) {
    const x = -width * 0.47 + (width * 0.94 * index) / ribCount;
    addContainerRail(group, {
      width: 3,
      height: height * 0.68,
      depth: 4,
      position: new Vector3(x, height * 0.5, z + 1.5),
      color: headColor,
    });
  }
}

function addRoofCorrugations(group, width, height, depth) {
  const ridgeCount = Math.max(8, Math.floor(width / 28));
  const step = width / ridgeCount;

  for (let index = 0; index <= ridgeCount; index++) {
    const x = -width / 2 + index * step;
    addContainerRail(group, {
      width: 2.2,
      height: 3,
      depth: depth * 0.96,
      position: new Vector3(x, height + 3.2, 0),
      color: index % 2 === 0 ? 0x7dd3fc : 0x2563eb,
    });
  }
}

function addContainerRibs(group, width, height, depth) {
  const ribCount = Math.max(5, Math.floor(depth / 95));
  const zStart = -depth / 2;
  const step = depth / ribCount;

  for (let index = 0; index <= ribCount; index++) {
    const z = zStart + index * step;
    const ribColor = index === 0 || index === ribCount ? 0xfb923c : 0x38bdf8;

    addContainerRail(group, {
      width: 3.5,
      height,
      depth: 3.5,
      position: new Vector3(-width / 2, height / 2, z),
      color: ribColor,
    });

    addContainerRail(group, {
      width: 3.5,
      height,
      depth: 3.5,
      position: new Vector3(width / 2, height / 2, z),
      color: ribColor,
    });
  }

  const sidePanelCount = Math.max(10, Math.floor(depth / 48));
  const sidePanelStep = depth / sidePanelCount;
  for (let index = 0; index <= sidePanelCount; index++) {
    const z = zStart + index * sidePanelStep;
    const color = index % 2 === 0 ? 0x2f88c9 : 0x1d4f7a;

    addContainerRail(group, {
      width: 1.8,
      height: height * 0.78,
      depth: 2.4,
      position: new Vector3(-width / 2 + 1.2, height * 0.5, z),
      color,
    });

    addContainerRail(group, {
      width: 1.8,
      height: height * 0.78,
      depth: 2.4,
      position: new Vector3(width / 2 - 1.2, height * 0.5, z),
      color,
    });
  }

  const endPanelCount = Math.max(5, Math.floor(width / 34));
  const xStart = -width / 2;
  const endPanelStep = width / endPanelCount;
  for (let index = 0; index <= endPanelCount; index++) {
    const x = xStart + index * endPanelStep;

    addContainerRail(group, {
      width: 2.4,
      height: height * 0.76,
      depth: 1.8,
      position: new Vector3(x, height * 0.5, -depth / 2 + 1.2),
      color: 0x1f7f57,
    });

    addContainerRail(group, {
      width: 2.4,
      height: height * 0.76,
      depth: 1.8,
      position: new Vector3(x, height * 0.5, depth / 2 - 1.2),
      color: 0xb85b1d,
    });
  }

  [
    { x: -width / 2, y: height, z: 0, railWidth: 4, railHeight: 4, railDepth: depth },
    { x: width / 2, y: height, z: 0, railWidth: 4, railHeight: 4, railDepth: depth },
    { x: 0, y: height, z: -depth / 2, railWidth: width, railHeight: 4, railDepth: 4 },
    { x: 0, y: height, z: depth / 2, railWidth: width, railHeight: 4, railDepth: 4 },
  ].forEach((rail) => {
    addContainerRail(group, {
      width: rail.railWidth,
      height: rail.railHeight,
      depth: rail.railDepth,
      position: new Vector3(rail.x, rail.y, rail.z),
    });
  });

  [
    { x: -width / 2, z: -depth / 2, color: 0x22c55e },
    { x: width / 2, z: -depth / 2, color: 0x22c55e },
    { x: -width / 2, z: depth / 2, color: 0xfb923c },
    { x: width / 2, z: depth / 2, color: 0xfb923c },
  ].forEach((post) => {
    addContainerRail(group, {
      width: 7,
      height: height + 2,
      depth: 7,
      position: new Vector3(post.x, height / 2, post.z),
      color: post.color,
    });
  });

  [-width / 2, width / 2].forEach((x) => {
    [-depth / 2, depth / 2].forEach((z) => {
      addCornerCasting(group, x, -2.4, z);
      addCornerCasting(group, x, height + 3.4, z);
    });
  });

  addDoorHardware(group, width, height, depth);
  addHeadWallDetails(group, width, height, depth);
  addRoofCorrugations(group, width, height, depth);
}

function addFloorLanes(group, width, depth) {
  const plankCount = Math.max(8, Math.floor(width / 18));
  const plankWidth = width / plankCount;

  for (let index = 0; index < plankCount; index++) {
    const color = index % 2 === 0 ? 0x6f5338 : 0x5b432d;
    const plank = new Mesh(
      new BoxGeometry(Math.max(2, plankWidth - 1.2), 1.2, depth * 0.94),
      new MeshStandardMaterial({
        color,
        roughness: 0.92,
        metalness: 0.01,
      })
    );

    plank.position.set(-width / 2 + plankWidth * index + plankWidth / 2, 1.45, 0);
    plank.receiveShadow = true;
    group.add(plank);
  }

  const laneMaterial = new MeshStandardMaterial({
    color: 0x22c55e,
    emissive: 0x064e3b,
    emissiveIntensity: 0.16,
    transparent: true,
    opacity: 0.2,
    roughness: 0.86,
    metalness: 0.02,
    side: DoubleSide,
  });

  [
    { x: -width / 4, color: 0x38bdf8 },
    { x: 0, color: 0x22c55e },
    { x: width / 4, color: 0xf59e0b },
  ].forEach((lane) => {
    const material = laneMaterial.clone();
    material.color.setHex(lane.color);
    material.emissive.setHex(lane.color);

    const mesh = new Mesh(new PlaneGeometry(5, depth * 0.94), material);
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(lane.x, 1.4, 0);
    group.add(mesh);
  });
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

  const wallOpacity = Math.max(0.2, opacity * 1.12);
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

  addContainerRibs(group, width, height, depth);

  const deck = new Mesh(
    new PlaneGeometry(width, depth),
    new MeshStandardMaterial({
      color: 0x16324f,
      emissive: 0x071827,
      emissiveIntensity: 0.16,
      roughness: 0.88,
      metalness: 0.08,
    })
  );
  deck.rotation.x = -Math.PI / 2;
  deck.position.y = 0.8;
  group.add(deck);
  addFloorLanes(group, width, depth);

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
