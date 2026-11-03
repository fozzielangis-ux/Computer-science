import * as THREE from 'three';
import { Font } from 'three/examples/jsm/loaders/FontLoader.js';
import { TextGeometry } from 'three/examples/jsm/geometries/TextGeometry.js';
import fontData from '../assets/fredoka-bold-typeface.js';
import { foilMaterial } from './balloon.js';

let _font = null;
export function getFont() {
  if (!_font) _font = new Font(fontData);
  return _font;
}

const _geoCache = new Map();

// Puffy "foil balloon" letter geometry, centred on its own origin.
export function letterGeometry(ch, size = 1, { puff = 1 } = {}) {
  const key = ch + '|' + size + '|' + puff;
  if (_geoCache.has(key)) return _geoCache.get(key);
  const geo = new TextGeometry(ch, {
    font: getFont(),
    size,
    depth: size * 0.12,
    curveSegments: 14,
    bevelEnabled: true,
    bevelThickness: size * 0.16 * puff,
    bevelSize: size * 0.065 * puff,
    bevelOffset: 0,
    bevelSegments: 8,
  });
  geo.computeBoundingBox();
  const bb = geo.boundingBox;
  const cx = (bb.min.x + bb.max.x) / 2;
  const cz = (bb.min.z + bb.max.z) / 2;
  // centre horizontally & in depth, baseline-aligned vertically with letter centred around cap height
  geo.translate(-cx, -size * 0.36, -cz);
  geo.computeVertexNormals();
  geo.userData.width = bb.max.x - bb.min.x;
  geo.userData.advance = getFont().data.glyphs[ch] ? (getFont().data.glyphs[ch].ha / getFont().data.resolution) * size : size * 0.5;
  _geoCache.set(key, geo);
  return geo;
}

// Builds a word out of individual foil letters so each can bob & spin.
export function createFoilWord(text, { size = 1, colors = [0xffc75a], spacing = 0.06, roughness = 0.2, puff = 1, castShadow = true } = {}) {
  const group = new THREE.Group();
  const letters = [];
  const chars = Array.from(text);
  let x = 0;
  const widths = chars.map((ch) => (ch === ' ' ? size * 0.35 : letterGeometry(ch, size, { puff }).userData.advance));
  const total = widths.reduce((a, b) => a + b, 0) + spacing * size * (chars.length - 1);
  x = -total / 2;
  const mats = new Map();
  chars.forEach((ch, i) => {
    const w = widths[i];
    if (ch !== ' ') {
      const color = colors[i % colors.length];
      if (!mats.has(color)) mats.set(color, foilMaterial(color, { roughness }));
      const mesh = new THREE.Mesh(letterGeometry(ch, size, { puff }), mats.get(color));
      mesh.castShadow = castShadow;
      mesh.receiveShadow = false;
      const holder = new THREE.Group();
      holder.position.x = x + w / 2;
      holder.add(mesh);
      holder.userData = { index: i, char: ch, baseX: x + w / 2, mesh, color };
      group.add(holder);
      letters.push(holder);
    }
    x += w + spacing * size;
  });
  group.userData.letters = letters;
  group.userData.width = total;
  return group;
}
