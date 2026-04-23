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
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  RepeatWrapping,
  Vector3,
} from 'three';
import { CSS2DObject } from 'three/examples/jsm/renderers/CSS2DRenderer.js';

let sharedContainerWallTexture = null;
const CONTAINER_FACES = ['head', 'door', 'left', 'right', 'top'];

function tagOcclusionFace(object, face) {
  if (!object || !face) return object;
  object.userData.occlusionFace = face;
  return object;
}

function collectFaceTargets(group, targetMap) {
  CONTAINER_FACES.forEach((face) => {
    targetMap[face] = [];
  });

  group.traverse((node) => {
    const face = node.userData?.occlusionFace;
    if (!face || !targetMap[face]) return;
    targetMap[face].push(node);
  });
}

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

function createContainerDecalTexture({
  title,
  subtitle,
  footer,
  accent = '#fbbf24',
  background = 'rgba(2,6,23,0.72)',
}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 256;
  const ctx = canvas.getContext('2d');

  ctx.fillStyle = background;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.strokeStyle = accent;
  ctx.lineWidth = 8;
  ctx.strokeRect(12, 12, canvas.width - 24, canvas.height - 24);

  ctx.fillStyle = accent;
  ctx.font = '700 56px Arial, sans-serif';
  ctx.fillText(title, 34, 82);

  ctx.fillStyle = '#e5e7eb';
  ctx.font = '700 34px Arial, sans-serif';
  ctx.fillText(subtitle, 34, 136);

  ctx.fillStyle = '#bae6fd';
  ctx.font = '600 24px Arial, sans-serif';
  ctx.fillText(footer, 34, 190);

  ctx.fillStyle = 'rgba(251,191,36,0.8)';
  for (let x = 330; x < 480; x += 34) {
    ctx.beginPath();
    ctx.moveTo(x, 210);
    ctx.lineTo(x + 18, 210);
    ctx.lineTo(x - 22, 242);
    ctx.lineTo(x - 40, 242);
    ctx.closePath();
    ctx.fill();
  }

  const texture = new CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
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
      object.material.forEach((m) => {
        if (m.map && !m.userData?.hasSharedTexture) m.map.dispose?.();
        m.dispose?.();
      });
    } else {
      if (object.material.map && !object.material.userData?.hasSharedTexture) {
        object.material.map.dispose?.();
      }
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

  material.userData = {
    ...(material.userData || {}),
    hasSharedTexture: true,
  };

  const mesh = new Mesh(
    geometry,
    material
  );

  mesh.position.copy(position);
  mesh.rotation.set(rotation.x, rotation.y, rotation.z);
  mesh.userData.face = face;
  mesh.userData.baseOpacity = opacity;
  tagOcclusionFace(mesh, face);
  return mesh;
}

function addContainerRail(group, { width, height, depth, position, color = 0x7dd3fc, face = null }) {
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
  tagOcclusionFace(rail, face);
  rail.userData.baseOpacity = rail.material.opacity ?? 1;
  rail.castShadow = true;
  rail.receiveShadow = true;
  group.add(rail);
  return rail;
}

function addDecalPlane(group, { width, height, position, rotation, texture, opacity = 0.88, face = null }) {
  const decal = new Mesh(
    new PlaneGeometry(width, height),
    new MeshBasicMaterial({
      map: texture,
      transparent: true,
      opacity,
      side: DoubleSide,
      depthWrite: false,
    })
  );

  decal.position.copy(position);
  decal.rotation.set(rotation.x, rotation.y, rotation.z);
  tagOcclusionFace(decal, face);
  decal.userData.baseOpacity = opacity;
  group.add(decal);
}

function addContainerPanel(group, { width, height, depth, position, color, opacity = 0.46, face = null }) {
  const material = new MeshStandardMaterial({
    color,
    map: getContainerWallTexture(),
    transparent: true,
    opacity,
    roughness: 0.44,
    metalness: 0.24,
    emissive: color,
    emissiveIntensity: 0.018,
    depthWrite: false,
  });

  material.userData = {
    ...(material.userData || {}),
    hasSharedTexture: true,
  };

  const panel = new Mesh(new BoxGeometry(width, height, depth), material);
  panel.position.copy(position);
  tagOcclusionFace(panel, face);
  panel.userData.baseOpacity = opacity;
  panel.castShadow = true;
  panel.receiveShadow = true;
  group.add(panel);
  return panel;
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
    { x: -width / 4, panelColor: 0xba4d16 },
    { x: width / 4, panelColor: 0xd9651f },
  ].forEach((door) => {
    addContainerPanel(group, {
      width: width / 2 - 9,
      height: height * 0.78,
      depth: 2.2,
      position: new Vector3(door.x, height * 0.5, depth / 2 + 2.2),
      color: door.panelColor,
      opacity: 0.72,
      face: 'door',
    });
  });

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
      face: 'door',
    });
    addContainerRail(group, {
      width: door.railWidth,
      height: 3,
      depth: 3,
      position: new Vector3(door.x, height * 0.84, z),
      color: doorColor,
      face: 'door',
    });
    addContainerRail(group, {
      width: 3,
      height: height * 0.72,
      depth: 3,
      position: new Vector3(door.x - door.railWidth / 2, height * 0.5, z),
      color: doorColor,
      face: 'door',
    });
    addContainerRail(group, {
      width: 3,
      height: height * 0.72,
      depth: 3,
      position: new Vector3(door.x + door.railWidth / 2, height * 0.5, z),
      color: doorColor,
      face: 'door',
    });
  });

  addContainerRail(group, {
    width: 5,
    height: height * 0.82,
    depth: 5,
    position: new Vector3(0, height * 0.5, z + 1.2),
    color: shadowColor,
    face: 'door',
  });

  [-width * 0.32, -width * 0.12, width * 0.12, width * 0.32].forEach((x) => {
    addContainerRail(group, {
      width: 3,
      height: height * 0.72,
      depth: 4,
      position: new Vector3(x, height * 0.5, z + 2.4),
      color: hardwareColor,
      face: 'door',
    });

    [height * 0.24, height * 0.5, height * 0.76].forEach((y) => {
      addContainerRail(group, {
        width: 13,
        height: 4,
        depth: 5,
        position: new Vector3(x, y, z + 3.2),
        color: hardwareColor,
        face: 'door',
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
        face: 'door',
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
      face: 'door',
    });
  });
}

function addForkliftPocketsAndSkids(group, width, depth) {
  const skidColor = 0x111827;
  const pocketColor = 0x020617;

  [-width * 0.32, width * 0.32].forEach((x) => {
    addContainerRail(group, {
      width: 10,
      height: 5,
      depth: depth * 0.9,
      position: new Vector3(x, -4.8, 0),
      color: skidColor,
    });
  });

  [-depth * 0.22, depth * 0.22].forEach((z) => {
    [-width / 2 - 2.2, width / 2 + 2.2].forEach((x) => {
      const face = x < 0 ? 'left' : 'right';
      addContainerRail(group, {
        width: 3,
        height: 12,
        depth: 38,
        position: new Vector3(x, 14, z),
        color: pocketColor,
        face,
      });
      addContainerRail(group, {
        width: 3,
        height: 3,
        depth: 46,
        position: new Vector3(x, 21.5, z),
        color: 0xeab308,
        face,
      });
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
    face: 'head',
  });
  addContainerRail(group, {
    width: width * 0.94,
    height: 4,
    depth: 4,
    position: new Vector3(0, height * 0.84, z),
    color: headColor,
    face: 'head',
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
      face: 'head',
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
      face: 'top',
    });
  }
}

function addContainerDecals(group, width, height, depth) {
  const sideTexture = createContainerDecalTexture({
    title: 'PCKU 2026',
    subtitle: 'PACKET OPT',
    footer: 'MAX GROSS 30,480 KG',
    accent: '#facc15',
  });
  const doorTexture = createContainerDecalTexture({
    title: 'CAUTION',
    subtitle: 'HIGH CUBE',
    footer: 'SEAL CHECK | DOOR SIDE',
    accent: '#fb923c',
    background: 'rgba(124,45,18,0.72)',
  });
  const headTexture = createContainerDecalTexture({
    title: 'FRONT',
    subtitle: 'LOAD PLAN',
    footer: 'CENTER OF GRAVITY SAFE',
    accent: '#22c55e',
    background: 'rgba(6,78,59,0.72)',
  });

  addDecalPlane(group, {
    width: depth * 0.26,
    height: height * 0.18,
    position: new Vector3(width / 2 + 4.2, height * 0.62, -depth * 0.12),
    rotation: new Euler(0, Math.PI / 2, 0),
    texture: sideTexture,
    face: 'right',
  });

  addDecalPlane(group, {
    width: depth * 0.26,
    height: height * 0.18,
    position: new Vector3(-width / 2 - 4.2, height * 0.62, -depth * 0.12),
    rotation: new Euler(0, -Math.PI / 2, 0),
    texture: sideTexture.clone(),
    face: 'left',
  });

  addDecalPlane(group, {
    width: width * 0.38,
    height: height * 0.18,
    position: new Vector3(0, height * 0.66, depth / 2 + 8.8),
    rotation: new Euler(0, 0, 0),
    texture: doorTexture,
    face: 'door',
  });

  addDecalPlane(group, {
    width: width * 0.38,
    height: height * 0.18,
    position: new Vector3(0, height * 0.64, -depth / 2 - 8.8),
    rotation: new Euler(0, Math.PI, 0),
    texture: headTexture,
    face: 'head',
  });
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
      face: 'left',
    });

    addContainerRail(group, {
      width: 1.8,
      height: height * 0.78,
      depth: 2.4,
      position: new Vector3(width / 2 - 1.2, height * 0.5, z),
      color,
      face: 'right',
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
      face: 'head',
    });

    addContainerRail(group, {
      width: 2.4,
      height: height * 0.76,
      depth: 1.8,
      position: new Vector3(x, height * 0.5, depth / 2 - 1.2),
      color: 0xb85b1d,
      face: 'door',
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
  addForkliftPocketsAndSkids(group, width, depth);
  addContainerDecals(group, width, height, depth);
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

  const wallOpacity = Math.max(0.52, opacity * 1.05);
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
      opacity: Math.max(0.45, wallOpacity * 0.86),
      face: 'top',
    }),
  ];

  walls.forEach((wall) => {
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

  collectFaceTargets(group, resolvedWallMeshes);

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

  function getFaceTargets(face) {
    const targets = wallMeshes[face];
    if (!targets) return [];
    return Array.isArray(targets) ? targets : [targets];
  }

  function applyToTargetMaterials(target, callback) {
    if (!target?.material) return;

    const materials = Array.isArray(target.material) ? target.material : [target.material];
    materials.forEach((material) => {
      if (material.userData.baseOpacity === undefined) {
        material.userData.baseOpacity = target.userData.baseOpacity ?? material.opacity ?? 1;
        material.userData.baseTransparent = material.transparent;
        material.userData.baseDepthWrite = material.depthWrite;
      }

      callback(material);
      material.needsUpdate = true;
    });
  }

  function restoreTarget(target) {
    if (!target) return;
    target.visible = true;
    applyToTargetMaterials(target, (material) => {
      const baseOpacity = material.userData.baseOpacity ?? target.userData.baseOpacity ?? material.opacity;
      material.opacity = baseOpacity;
      material.transparent = material.userData.baseTransparent ?? baseOpacity < 1;
      material.depthWrite = material.userData.baseDepthWrite ?? baseOpacity >= 0.96;
    });
  }

  function fadeTarget(target) {
    if (!target) return;
    target.visible = true;
    applyToTargetMaterials(target, (material) => {
      const baseOpacity = material.userData.baseOpacity ?? target.userData.baseOpacity ?? 1;
      material.opacity = Math.max(0.035, Number(baseOpacity || 0.16) * 0.18);
      material.transparent = true;
      material.depthWrite = false;
    });
  }

  if (!enabled) {
    CONTAINER_FACES.forEach((face) => {
      getFaceTargets(face).forEach(restoreTarget);
    });
    return null;
  }

  const hiddenFace = resolveContainerFaceFromCamera({ camera, height });

  CONTAINER_FACES.forEach((face) => {
    const targets = getFaceTargets(face);
    targets.forEach(restoreTarget);

    if (face !== hiddenFace) return;

    if (mode === 'fade') {
      targets.forEach(fadeTarget);
      return;
    }

    targets.forEach((target) => {
      target.visible = false;
    });
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
