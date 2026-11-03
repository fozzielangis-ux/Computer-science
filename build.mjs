// Builds the whole game into ONE self-contained file: index.html
// (three.js, fonts, code and styles are all inlined so it works offline,
// on GitHub Pages, or just by double-clicking the file).
import * as esbuild from 'esbuild';
import fs from 'fs';
import path from 'path';

const root = path.dirname(new URL(import.meta.url).pathname);
const watch = process.argv.includes('--watch');

function fontFace(family, weight, file) {
  const b64 = fs.readFileSync(path.join(root, 'src/assets/fonts', file)).toString('base64');
  return `@font-face{font-family:'${family}';font-style:normal;font-weight:${weight};font-display:block;src:url(data:font/woff2;base64,${b64}) format('woff2');}`;
}

async function build() {
  const t0 = Date.now();
  const result = await esbuild.build({
    entryPoints: [path.join(root, 'src/main.js')],
    bundle: true,
    format: 'iife',
    minify: true,
    target: ['es2020'],
    write: false,
    legalComments: 'none',
  });
  let js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
  const fonts = [
    fontFace('Fredoka', 400, 'fredoka-latin-400-normal.woff2'),
    fontFace('Fredoka', 600, 'fredoka-latin-600-normal.woff2'),
    fontFace('Fredoka', 700, 'fredoka-latin-700-normal.woff2'),
    fontFace('Pacifico', 400, 'pacifico-latin-400-normal.woff2'),
  ].join('\n');
  const css = fonts + '\n' + fs.readFileSync(path.join(root, 'src/styles.css'), 'utf8');
  const tpl = fs.readFileSync(path.join(root, 'src/index.template.html'), 'utf8');
  const html = tpl
    .replace('/*__CSS__*/', () => css)
    .replace('/*__JS__*/', () => js);
  fs.writeFileSync(path.join(root, 'index.html'), html);
  console.log(`built index.html (${(html.length / 1024).toFixed(0)} KB) in ${Date.now() - t0} ms`);
}

await build();

if (watch) {
  console.log('watching src/ for changes...');
  let timer = null;
  fs.watch(path.join(root, 'src'), { recursive: true }, () => {
    clearTimeout(timer);
    timer = setTimeout(() => build().catch((e) => console.error(e.message)), 120);
  });
}
