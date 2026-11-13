/* 把 src/ 打包成单文件 index.html（音频仍用仓库 audio/ 里的真人 MP3） */
import fs from 'fs';
import path from 'path';

const dir = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const shell = read('src/shell.html');
const css = read('src/style.css');
const js = ['src/data.js', 'src/core.js', 'src/games.js', 'src/boot.js'].map(read).join('\n\n');

const html = shell
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js);

fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
console.log('built index.html:', (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB');
