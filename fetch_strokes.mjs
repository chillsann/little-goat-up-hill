// 拉取 390 个汉字的笔顺数据（hanzi-writer-data，MIT），生成 strokes.json
// 仅保留 strokes（SVG 路径）与 medians（中线点），压缩为单文件注入用
import fs from 'fs';
import https from 'https';

const chars = JSON.parse(fs.readFileSync('/tmp/chars.json', 'utf8'));
const URL = c => `https://cdn.jsdelivr.net/npm/hanzi-writer-data@2.0.1/${encodeURIComponent(c)}.json`;

function get(url) {
  return new Promise((resolve, reject) => {
    https.get(url, res => {
      if (res.statusCode !== 200) { res.resume(); return reject(new Error('HTTP ' + res.statusCode)); }
      let d = ''; res.on('data', c => d += c); res.on('end', () => resolve(d));
    }).on('error', reject);
  });
}

const out = {};
const missing = [];
const CONC = 12;
let i = 0;
async function worker() {
  while (i < chars.length) {
    const ch = chars[i++];
    let ok = false;
    for (let tryN = 0; tryN < 4 && !ok; tryN++) {
      try {
        const txt = await get(URL(ch));
        const j = JSON.parse(txt);
        if (Array.isArray(j.strokes) && Array.isArray(j.medians) && j.strokes.length) {
          out[ch] = { s: j.strokes, m: j.medians };
          ok = true;
        }
      } catch (e) { await new Promise(r => setTimeout(r, 300 * (tryN + 1))); }
    }
    if (!ok) missing.push(ch);
    if ((i) % 50 === 0) console.log(`进度 ${i}/${chars.length}，已得 ${Object.keys(out).length}`);
  }
}
await Promise.all(Array.from({ length: CONC }, worker));
fs.writeFileSync('/workspace/little-goat-up-hill/strokes.json', JSON.stringify(out));
console.log('完成：成功', Object.keys(out).length, '/', chars.length, '  缺失:', missing.join(''));
if (missing.length) fs.writeFileSync('/tmp/missing.json', JSON.stringify(missing));
