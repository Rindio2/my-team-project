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

function canMoveTo(box, placed, index, nextX, nextY, nextZ, container) {
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

  return true;
}

function compactAxisNegative(placed, index, axis, container, step = 1) {
  const box = placed[index];
  let moved = false;

  while (true) {
    let nextX = box.x;
    let nextY = box.y;
    let nextZ = box.z;

    if (axis === 'x') nextX -= step;
    if (axis === 'y') nextY -= step;
    if (axis === 'z') nextZ -= step;

    if (!canMoveTo(box, placed, index, nextX, nextY, nextZ, container)) break;

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
  } = options;

  const working = sortForCompaction(placed).map(cloneBox);

  for (let pass = 0; pass < maxPasses; pass++) {
    let changed = false;

    for (let i = 0; i < working.length; i++) {
      if (compactFloor) {
        changed = compactAxisNegative(working, i, 'y', container, step) || changed;
      }

      if (compactFront) {
        changed = compactAxisNegative(working, i, 'z', container, step) || changed;
      }

      if (compactLeft) {
        changed = compactAxisNegative(working, i, 'x', container, step) || changed;
      }
    }

    if (!changed) break;
  }

  return working;
}