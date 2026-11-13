/* 把 src/ 打包成单文件 index.html（音频仍用仓库 audio/ 里的真人 MP3） */
import fs from 'fs';
import path from 'path';

const dir = path.dirname(decodeURIComponent(new URL(import.meta.url).pathname).replace(/^\/([A-Za-z]:)/, '$1'));
const read = f => fs.readFileSync(path.join(dir, f), 'utf8');

const shell = read('src/shell.html');
const css = read('src/style.css');
let js = ['src/data.js', 'src/core.js', 'src/games.js', 'src/boot.js'].map(read).join('\n\n');

// 把真实存在的单字录音清单注入，缺录音的字自动走浏览器中文语音
const mp3chars = fs.readdirSync(path.join(dir, 'audio'))
  .filter(f => f.endsWith('.mp3'))
  .map(f => f.slice(0, -4))
  .filter(c => [...c].length === 1)
  .join('');
const marker = "/*__MP3_CHARS__*/ ''";
if (!js.includes(marker)) throw new Error('core.js 缺少 MP3_CHARS 注入标记');
js = js.replace(marker, JSON.stringify(mp3chars));

const html = shell
  .replace('/*CSS*/', () => css)
  .replace('/*JS*/', () => js);

fs.writeFileSync(path.join(dir, 'index.html'), html, 'utf8');
console.log('built index.html:', (Buffer.byteLength(html, 'utf8') / 1024).toFixed(1) + ' KB',
  '| mp3 chars:', mp3chars.length);
