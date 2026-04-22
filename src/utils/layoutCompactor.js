const EPSILON = 0.0001;
const MIN_SUPPORT_RATIO = 0.78;

function intersects3D(a, b) {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h ||
    a.z + a.d <= b.z ||
    a.z >= b.z + b.d
  );
}

function cloneBox(box) {
  return {
    ...box,
    originalSize: box.originalSize ? { ...box.originalSize } : undefined,
  };
}

function getOverlapSize(aStart, aEnd, bStart, bEnd) {
  return Math.max(0, Math.min(aEnd, bEnd) - Math.max(aStart, bStart));
}

function getBaseOverlapArea(a, b) {
  const overlapX = getOverlapSize(a.x, a.x + a.w, b.x, b.x + b.w);
  const overlapZ = getOverlapSize(a.z, a.z + a.d, b.z, b.z + b.d);
  return overlapX * overlapZ;
}

function getSupportInfo(box, placed, index) {
  if (box.y <= EPSILON) {
    return {
      isSupported: true,
      supportRatio: 1,
      supports: [],
    };
  }

  const baseArea = box.w * box.d;
  let supportArea = 0;
  const supports = [];

  for (let i = 0; i < placed.length; i++) {
    if (i === index) continue;

    const placedBox = placed[i];
    const touchesFromBelow = Math.abs(placedBox.y + placedBox.h - box.y) <= EPSILON;
    if (!touchesFromBelow) continue;

    const overlapArea = getBaseOverlapArea(box, placedBox);
    if (overlapArea <= EPSILON) continue;

    supportArea += overlapArea;
    supports.push({
      ...placedBox,
      overlapArea,
    });
  }

  const supportRatio = baseArea > 0 ? supportArea / baseArea : 0;

  return {
    isSupported: supportRatio >= MIN_SUPPORT_RATIO,
    supportRatio,
    supports,
  };
}

function respectsSupport(box, placed, index) {
  const supportInfo = getSupportInfo(box, placed, index);
  if (!supportInfo.isSupported) return false;

  if (
    supportInfo.supports.some(
      (support) =>
        support.noStack ||
        support.fragile ||
        Number(support.priorityGroup || support.deliveryOrder || 1) <
          Number(box.priorityGroup || box.deliveryOrder || 1)
    )
  ) {
    return false;
  }

  return true;
}

function canMoveTo(box, placed, index, nextX, nextY, nextZ, container, options = {}) {
  const { preserveSupport = true } = options;
  const moved = {
    ...box,
    x: nextX,
    y: nextY,
    z: nextZ,
  };

  if (
    moved.x < -container.w / 2 ||
    moved.y < 0 ||
    moved.z < -container.d / 2 ||
    moved.x + moved.w > container.w / 2 ||
    moved.y + moved.h > container.h ||
    moved.z + moved.d > container.d / 2
  ) {
    return false;
  }

  for (let i = 0; i < placed.length; i++) {
    if (i === index) continue;
    if (intersects3D(moved, placed[i])) return false;
  }

  if (preserveSupport && !respectsSupport(moved, placed, index)) {
    return false;
  }

  return true;
}

function compactAxisNegative(placed, index, axis, container, step = 1, options = {}) {
  const box = placed[index];
  let moved = false;

  while (true) {
    let nextX = box.x;
    let nextY = box.y;
    let nextZ = box.z;

    if (axis === 'x') nextX -= step;
    if (axis === 'y') nextY -= step;
    if (axis === 'z') nextZ -= step;

    if (!canMoveTo(box, placed, index, nextX, nextY, nextZ, container, options)) break;

    box.x = nextX;
    box.y = nextY;
    box.z = nextZ;
    moved = true;
  }

  return moved;
}

function sortForCompaction(placed) {
  return [...placed].sort((a, b) => {
    if (a.y !== b.y) return a.y - b.y;
    if (a.z !== b.z) return a.z - b.z;
    if (a.x !== b.x) return a.x - b.x;
    return 0;
  });
}

export function compactPlacedLayout(placed, container, options = {}) {
  const {
    step = 1,
    maxPasses = 20,
    compactFloor = true,
    compactLeft = true,
    compactFront = true,
    preserveSupport = true,
  } = options;

  const working = sortForCompaction(placed).map(cloneBox);

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;

    for (let i = 0; i < working.length; i++) {
      if (compactFloor) {
        changed =
          compactAxisNegative(working, i, 'y', container, step, { preserveSupport }) || changed;
      }

      if (compactFront) {
        changed =
          compactAxisNegative(working, i, 'z', container, step, { preserveSupport }) || changed;
      }

      if (compactLeft) {
        changed =
          compactAxisNegative(working, i, 'x', container, step, { preserveSupport }) || changed;
      }
    }

    if (!changed) break;
  }

  return working;
}
