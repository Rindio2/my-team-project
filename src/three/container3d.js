import * as THREE from 'three';

export function createContainerGroup() {
  return {
    group: new THREE.Group(),
    box3: new THREE.Box3(),
  };
}

export function updateContainerMesh({ group, box3, width, height, depth, opacity = 0.18 }) {
  group.clear();

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

  box3.setFromObject(group);
} // tạo hình dạng 3d của container, gồm vỏ ngoài trong suốt, khung dây nổi bật và sàn container, có thể tùy chỉnh độ dày vỏ và màu sắc nếu muốn