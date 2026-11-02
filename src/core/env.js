import * as THREE from 'three';

// Builds a custom HDR "party room" environment map: a soft overhead light, colourful
// softboxes (pink / cyan / gold / violet) and a ring of fairy lights. Glossy balloons
// and foil letters pick up these reflections, which makes them look really shiny.
export function createPartyEnvironment(renderer, { mood = 'party' } = {}) {
  const scene = new THREE.Scene();

  const sphereGeo = new THREE.SphereGeometry(30, 48, 24);
  const colors = [];
  const pos = sphereGeo.attributes.position;
  const top = new THREE.Color(mood === 'night' ? 0x1a1640 : 0x3b2a5e);
  const mid = new THREE.Color(mood === 'night' ? 0x2a1438 : 0x5a3060);
  const bottom = new THREE.Color(mood === 'night' ? 0x0a0812 : 0x22142a);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const y = pos.getY(i) / 30;
    if (y > 0) c.lerpColors(mid, top, y);
    else c.lerpColors(mid, bottom, -y);
    colors.push(c.r, c.g, c.b);
  }
  sphereGeo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  scene.add(new THREE.Mesh(sphereGeo, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.BackSide })));

  const panel = (color, intensity, x, y, z, w, h) => {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(w, h),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(color).multiplyScalar(intensity), side: THREE.DoubleSide })
    );
    m.position.set(x, y, z);
    m.lookAt(0, 0, 0);
    scene.add(m);
  };

  if (mood === 'night') {
    panel(0xfff1d6, 3.0, 0, 22, 4, 14, 14);
    panel(0xffb46b, 4.0, 6, 3, 14, 10, 6);
    panel(0x7f6bff, 1.6, -18, 6, -6, 10, 14);
    panel(0xff5fa8, 1.6, 18, 4, -8, 10, 12);
  } else {
    panel(0xffffff, 5.0, 0, 24, 0, 18, 18); // big overhead softbox
    panel(0xff5fa8, 3.2, -20, 6, 6, 9, 16); // pink left
    panel(0x47d4ff, 3.0, 20, 6, 6, 9, 16); // cyan right
    panel(0xffcf5a, 4.0, 4, 8, 20, 16, 8); // warm gold front
    panel(0xa77bff, 2.5, 0, 4, -22, 18, 10); // violet back
    panel(0xffffff, 2.0, -8, -4, 18, 8, 3); // floor bounce
  }

  // ring of fairy lights
  const bulbGeo = new THREE.SphereGeometry(0.5, 12, 8);
  const bulbColors = [0xffd27a, 0xff7ac0, 0x7fe0ff, 0xfff4d6];
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * Math.PI * 2;
    const m = new THREE.Mesh(bulbGeo, new THREE.MeshBasicMaterial({ color: new THREE.Color(bulbColors[i % 4]).multiplyScalar(14) }));
    m.position.set(Math.cos(a) * 24, 9 + Math.sin(a * 3) * 1.5, Math.sin(a) * 24);
    scene.add(m);
  }

  const pmrem = new THREE.PMREMGenerator(renderer);
  const rt = pmrem.fromScene(scene, 0.035);
  pmrem.dispose();
  scene.traverse((o) => {
    if (o.geometry) o.geometry.dispose();
    if (o.material) o.material.dispose();
  });
  return rt.texture;
}
