import opentype from 'opentype.js';
import fs from 'fs';
const [,, input, output, family] = process.argv;
const buf = fs.readFileSync(input);
const font = opentype.parse(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789!?'.,&-+♥ ";
const r = v => Math.round(v);
const glyphs = {};
let xMin=Infinity,xMax=-Infinity,yMin=Infinity,yMax=-Infinity;
for (const ch of chars) {
  const g = font.charToGlyph(ch);
  if (!g || (g.index === 0 && ch !== ' ')) continue;
  const out = [];
  for (const c of g.path.commands) {
    if (c.type === 'M') out.push('m', r(c.x), r(c.y));
    else if (c.type === 'L') out.push('l', r(c.x), r(c.y));
    else if (c.type === 'Q') out.push('q', r(c.x), r(c.y), r(c.x1), r(c.y1));
    else if (c.type === 'C') out.push('b', r(c.x), r(c.y), r(c.x1), r(c.y1), r(c.x2), r(c.y2));
  }
  const bb = g.getBoundingBox();
  if (out.length) { xMin=Math.min(xMin,bb.x1); xMax=Math.max(xMax,bb.x2); yMin=Math.min(yMin,bb.y1); yMax=Math.max(yMax,bb.y2); }
  glyphs[ch] = { ha: r(g.advanceWidth), x_min: r(bb.x1), x_max: r(bb.x2), o: out.join(' ') };
}
const data = { glyphs, familyName: family, ascender: r(font.ascender), descender: r(font.descender),
  underlinePosition: -100, underlineThickness: 50,
  boundingBox: { xMin: r(xMin), xMax: r(xMax), yMin: r(yMin), yMax: r(yMax) },
  resolution: font.unitsPerEm, original_font_information: { license: 'SIL Open Font License 1.1', family } };
fs.writeFileSync(output, 'export default ' + JSON.stringify(data) + ';\n');
console.log(output, Object.keys(glyphs).length, 'glyphs', fs.statSync(output).size, 'bytes', 'upm', font.unitsPerEm);
