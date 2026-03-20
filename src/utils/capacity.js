function getUniqueRotations(boxLength, boxWidth, boxHeight) {
  const raw = [
    { l: boxLength, w: boxWidth, h: boxHeight },
    { l: boxLength, w: boxHeight, h: boxWidth },
    { l: boxWidth, w: boxLength, h: boxHeight },
    { l: boxWidth, w: boxHeight, h: boxLength },
    { l: boxHeight, w: boxLength, h: boxWidth },
    { l: boxHeight, w: boxWidth, h: boxLength },
  ];

  const map = new Map();

  raw.forEach((r) => {
    const key = `${r.l}-${r.w}-${r.h}`;
    if (!map.has(key)) map.set(key, r);
  });

  return [...map.values()];
}

function buildShockPads({
  containerLength,
  containerWidth,
  containerHeight,
  alongLength,
  alongWidth,
  alongHeight,
  rotation,
}) {
  const usedLength = alongLength * rotation.l;
  const usedWidth = alongWidth * rotation.w;
  const usedHeight = alongHeight * rotation.h;

  const leftoverLength = Math.max(0, containerLength - usedLength);
  const leftoverWidth = Math.max(0, containerWidth - usedWidth);
  const leftoverHeight = Math.max(0, containerHeight - usedHeight);

  const halfLengthGap = leftoverLength / 2;
  const halfWidthGap = leftoverWidth / 2;
  const halfHeightGap = leftoverHeight / 2;

  return {
    // kiểu cơ bản
    left: {
      width: halfWidthGap,
      height: usedHeight,
      length: usedLength,
    },
    right: {
      width: halfWidthGap,
      height: usedHeight,
      length: usedLength,
    },
    front: {
      width: usedWidth,
      height: usedHeight,
      length: halfLengthGap,
    },
    back: {
      width: usedWidth,
      height: usedHeight,
      length: halfLengthGap,
    },
    bottom: {
      width: usedWidth,
      height: halfHeightGap,
      length: usedLength,
    },
    top: {
      width: usedWidth,
      height: halfHeightGap,
      length: usedLength,
    },

    // kiểu giữa container:
    // túi nằm giữa theo CHIỀU RỘNG
    centerWidthSplit: {
      width: leftoverWidth,
      height: usedHeight,
      length: usedLength,
    },

    // túi trên nóc cho kiểu giữa container
    topFull: {
      width: usedWidth,
      height: leftoverHeight,
      length: usedLength,
    },

    summary: {
      halfLengthGap,
      halfWidthGap,
      halfHeightGap,
      leftoverLength,
      leftoverWidth,
      leftoverHeight,
      usedLength,
      usedWidth,
      usedHeight,
    },
  };
}

export function calculateCapacity({
  containerLength,
  containerWidth,
  containerHeight,
  containerMaxWeight,
  boxLength,
  boxWidth,
  boxHeight,
  boxWeight,
}) {
  const values = [
    containerLength,
    containerWidth,
    containerHeight,
    containerMaxWeight,
    boxLength,
    boxWidth,
    boxHeight,
    boxWeight,
  ];

  const invalid = values.some((v) => !v || Number(v) <= 0);

  if (invalid) {
    return {
      ok: false,
      message: 'Vui lòng nhập các giá trị lớn hơn 0.',
    };
  }

  const rotations = getUniqueRotations(boxLength, boxWidth, boxHeight);

  let best = {
    count: 0,
    alongLength: 0,
    alongWidth: 0,
    alongHeight: 0,
    rotationText: '',
    rotation: null,
    leftoverLength: 0,
    leftoverWidth: 0,
    leftoverHeight: 0,
    shockPads: null,
  };

  rotations.forEach((r) => {
    const alongLength = Math.floor(containerLength / r.l);
    const alongWidth = Math.floor(containerWidth / r.w);
    const alongHeight = Math.floor(containerHeight / r.h);
    const count = alongLength * alongWidth * alongHeight;

    const leftoverLength = containerLength - alongLength * r.l;
    const leftoverWidth = containerWidth - alongWidth * r.w;
    const leftoverHeight = containerHeight - alongHeight * r.h;

    const shockPads = buildShockPads({
      containerLength,
      containerWidth,
      containerHeight,
      alongLength,
      alongWidth,
      alongHeight,
      rotation: r,
    });

    const candidate = {
      count,
      alongLength,
      alongWidth,
      alongHeight,
      rotationText: `${r.l} × ${r.w} × ${r.h}`,
      rotation: r,
      leftoverLength,
      leftoverWidth,
      leftoverHeight,
      shockPads,
    };

    if (count > best.count) {
      best = candidate;
      return;
    }

    if (count === best.count) {
      const bestLeftoverTotal = best.leftoverLength + best.leftoverWidth + best.leftoverHeight;
      const candidateLeftoverTotal = leftoverLength + leftoverWidth + leftoverHeight;

      if (candidateLeftoverTotal < bestLeftoverTotal) {
        best = candidate;
      }
    }
  });

  const maxBySpace = best.count;
  const maxByWeight = Math.floor(containerMaxWeight / boxWeight);
  const maxBoxes = Math.min(maxBySpace, maxByWeight);

  return {
    ok: true,
    best,
    maxBySpace,
    maxByWeight,
    maxBoxes,
    boxWeight,
  };
}