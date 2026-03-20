function getUniqueRotations(item) {
  const raw = [
    { w: item.w, h: item.h, d: item.d },
    { w: item.w, h: item.d, d: item.h },
    { w: item.h, h: item.w, d: item.d },
    { w: item.h, h: item.d, d: item.w },
    { w: item.d, h: item.w, d: item.h },
    { w: item.d, h: item.h, d: item.w },
  ];

  const map = new Map();

  raw.forEach((r) => {
    const key = `${r.w}-${r.h}-${r.d}`;
    if (!map.has(key)) map.set(key, r);
  });

  return [...map.values()];
}

function intersects(a, b) {
  return !(
    a.x + a.w <= b.x ||
    a.x >= b.x + b.w ||
    a.y + a.h <= b.y ||
    a.y >= b.y + b.h ||
    a.z + a.d <= b.z ||
    a.z >= b.z + b.d
  );
}

function isInsideContainer(box, container) {
  return (
    box.x >= -container.w / 2 &&
    box.y >= 0 &&
    box.z >= -container.d / 2 &&
    box.x + box.w <= container.w / 2 &&
    box.y + box.h <= container.h &&
    box.z + box.d <= container.d / 2
  );
}

function canBePlaced(box, placed, container) {
  if (!isInsideContainer(box, container)) return false;
  return !placed.some((p) => intersects(box, p));
}

function scorePlacement(box, container) {
  const rightGap = container.w / 2 - (box.x + box.w);
  const topGap = container.h - (box.y + box.h);
  const backGap = container.d / 2 - (box.z + box.d);

  return rightGap + topGap + backGap;
}

function expandBoxTypes(boxTypes) {
  const items = [];

  boxTypes.forEach((t, idx) => {
    const qty = Math.max(0, Number(t.qty || 0));

    for (let i = 0; i < qty; i++) {
      items.push({
        typeIndex: idx,
        label: t.label || `Loại ${idx + 1}`,
        w: Number(t.w),
        h: Number(t.h),
        d: Number(t.d),
        weight: Number(t.weight),
      });
    }
  });

  return items;
}

function summarizeRejectedItems(items) {
  const map = new Map();

  items.forEach((item) => {
    const key = `${item.label}|${item.w}|${item.h}|${item.d}|${item.weight}`;
    if (!map.has(key)) {
      map.set(key, {
        label: item.label,
        w: item.w,
        h: item.h,
        d: item.d,
        weight: item.weight,
        count: 0,
      });
    }
    map.get(key).count += 1;
  });

  return [...map.values()].sort((a, b) => b.count - a.count);
}

export function optimizeMixedPacking({ container, boxTypes, maxWeight = Infinity }) {
  const items = expandBoxTypes(boxTypes)
    .filter((it) => it.w > 0 && it.h > 0 && it.d > 0 && it.weight > 0)
    .sort((a, b) => {
      const volA = a.w * a.h * a.d;
      const volB = b.w * b.h * b.d;
      if (volB !== volA) return volB - volA;
      return b.weight - a.weight;
    });

  const placed = [];
  const rejectedBySpace = [];
  const rejectedByWeight = [];

  let candidates = [{ x: -container.w / 2, y: 0, z: -container.d / 2 }];
  let totalPlacedWeight = 0;

  for (const item of items) {
    if (totalPlacedWeight + item.weight > maxWeight) {
      rejectedByWeight.push(item);
      continue;
    }

    let bestPlacement = null;
    const rotations = getUniqueRotations(item);

    for (const rot of rotations) {
      for (const point of candidates) {
        const candidate = {
          x: point.x,
          y: point.y,
          z: point.z,
          w: rot.w,
          h: rot.h,
          d: rot.d,
          weight: item.weight,
          label: item.label,
          typeIndex: item.typeIndex,
          originalSize: {
            w: item.w,
            h: item.h,
            d: item.d,
          },
        };

        if (!canBePlaced(candidate, placed, container)) continue;

        const score = scorePlacement(candidate, container);

        if (!bestPlacement || score < bestPlacement.score) {
          bestPlacement = {
            ...candidate,
            score,
          };
        }
      }
    }

    if (!bestPlacement) {
      rejectedBySpace.push(item);
      continue;
    }

    placed.push(bestPlacement);
    totalPlacedWeight += item.weight;

    candidates.push(
      { x: bestPlacement.x + bestPlacement.w, y: bestPlacement.y, z: bestPlacement.z },
      { x: bestPlacement.x, y: bestPlacement.y + bestPlacement.h, z: bestPlacement.z },
      { x: bestPlacement.x, y: bestPlacement.y, z: bestPlacement.z + bestPlacement.d }
    );

    const seen = new Set();
    candidates = candidates
      .filter((p) => p.x <= container.w / 2 && p.y <= container.h && p.z <= container.d / 2)
      .sort((a, b) => a.y - b.y || a.z - b.z || a.x - b.x)
      .filter((p) => {
        const key = `${p.x}|${p.y}|${p.z}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      });
  }

  const totalRequested = items.length;
  const packedCount = placed.length;
  const remaining = totalRequested - packedCount;
  const usedVolume = placed.reduce((sum, b) => sum + b.w * b.h * b.d, 0);
  const totalVolume = container.w * container.h * container.d;
  const efficiency = totalVolume > 0 ? (usedVolume / totalVolume) * 100 : 0;

  const requestedWeight = items.reduce((sum, item) => sum + item.weight, 0);
  const overWeightRequested = requestedWeight > maxWeight;
  const overSpaceRequested =
    items.reduce((sum, item) => sum + item.w * item.h * item.d, 0) > totalVolume;

  return {
    placed,
    totalRequested,
    packedCount,
    remaining,
    usedVolume,
    totalVolume,
    efficiency,
    totalPlacedWeight,
    requestedWeight,
    maxWeight,
    overWeightRequested,
    overSpaceRequested,
    rejectedBySpaceCount: rejectedBySpace.length,
    rejectedByWeightCount: rejectedByWeight.length,
    rejectedBySpace,
    rejectedByWeight,
    rejectedBySpaceSummary: summarizeRejectedItems(rejectedBySpace),
    rejectedByWeightSummary: summarizeRejectedItems(rejectedByWeight),
  };
}