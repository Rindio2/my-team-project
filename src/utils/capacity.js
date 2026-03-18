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
    left: {
      name: 'Túi trái',
      width: halfWidthGap,
      height: usedHeight,
      length: usedLength,
      face: 'Mặt trái container',
    },
    right: {
      name: 'Túi phải',
      width: halfWidthGap,
      height: usedHeight,
      length: usedLength,
      face: 'Mặt phải container',
    },
    front: {
      name: 'Túi trước',
      width: usedWidth,
      height: usedHeight,
      length: halfLengthGap,
      face: 'Mặt trước container',
    },
    back: {
      name: 'Túi sau',
      width: usedWidth,
      height: usedHeight,
      length: halfLengthGap,
      face: 'Mặt sau container',
    },
    bottom: {
      name: 'Túi sàn',
      width: usedWidth,
      height: halfHeightGap,
      length: usedLength,
      face: 'Mặt sàn container',
    },
    top: {
      name: 'Túi trần',
      width: usedWidth,
      height: halfHeightGap,
      length: usedLength,
      face: 'Mặt trần container',
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
} // hàm tính toán sức chứa tối đa của container dựa trên kích thước và trọng lượng của thùng, trả về số lượng thùng có thể xếp theo không gian, theo trọng lượng và tổng số thùng tối đa có thể xếp được, cùng với thông tin chi tiết về cách xếp thùng tốt nhất và các túi chống sốc cần thiết để bảo vệ hàng hóa trong quá trình vận chuyển