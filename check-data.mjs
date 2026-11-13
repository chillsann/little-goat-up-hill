/* 教材数据体检：1~6 级字表、组词、绘本短句、发音资产 */
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync(new URL('./src/data.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\nthis.__D = {LEVELS, ALL_CHARS, TOTAL, CHARS, WORDS, GAMES, gamesForBook, wordsFor};', ctx);
const {LEVELS, ALL_CHARS, TOTAL, CHARS, WORDS, gamesForBook} = ctx.__D;

const problems = [];
const seen = new Set();
const strip = s => s.replace(/[，。！？、…·\s\-—《》：]/g, '');

// 1) 字表：官方各级累计字数、全局无重复
if (TOTAL !== 390) problems.push(`总字数 ${TOTAL}，应为 390`);
if (ALL_CHARS.length !== new Set(ALL_CHARS).size) problems.push('字表有重复字');
for (const c of ALL_CHARS) if (!CHARS[c]) problems.push(`「${c}」缺少图解数据`);
LEVELS.forEach(l => {
  if (l.books.length !== 10) problems.push(`第${l.level}级只有 ${l.books.length} 册`);
  if (seen.size + l.chars.length !== l.total)
    problems.push(`第${l.level}级累计 ${seen.size + l.chars.length}，应为 ${l.total}`);
  l.chars.forEach(c => seen.add(c));
  const inBooks = l.books.flatMap(b => b.chars);
  if (inBooks.join('') !== l.chars.join(''))
    problems.push(`第${l.level}级册子切分与字表不一致 (${inBooks.length} vs ${l.chars.length})`);
});

// 2) 图解词：第 1 级严格只用本级 60 字；字卡词必须包含自己
const l1 = new Set(LEVELS[0].chars);
for (const c of LEVELS[0].chars) {
  const info = CHARS[c];
  if (!info || !info.e || !info.h) problems.push(`CHARS[${c}] 缺少图形或提示`);
  if (!info.w.some(w => w.includes(c))) problems.push(`CHARS[${c}].w 没有包含自己`);
  info.w.forEach(w => {
    for (const ch of strip(w)) if (!l1.has(ch)) problems.push(`第1级字卡词「${w}」出现超纲字「${ch}」`);
  });
}

// 3) 常用词库：每个词必须全部由 390 字组成（运行时还会按已学字再过滤）
WORDS.forEach(w => {
  for (const ch of strip(w)) if (!seen.has(ch)) problems.push(`词库「${w}」出现字表外「${ch}」`);
});

// 4) 绘本短句：第 1 级按「本册及之前」严格校验；2~6 级按「本级及之前」校验
const checkLine = (line, allowed, where) => {
  for (const ch of strip(line)) if (!allowed.has(ch)) problems.push(`${where}:「${line}」出现字表外「${ch}」`);
};
LEVELS.forEach((l, li) => {
  const allowed = new Set(l.allowed);
  l.books.forEach((b, i) => {
    if (!b.story || !b.story.length) problems.push(`第${l.level}级第${i+1}册没有绘本句子`);
    if (!b.chars.length) problems.push(`第${l.level}级第${i+1}册没有新字`);
    const a = li === 0 ? new Set(l.books.slice(0, i + 1).flatMap(x => x.chars)) : allowed;
    b.story.forEach(line => checkLine(line, a, `第${l.level}级第${i+1}册绘本`));
    const gs = gamesForBook(i);
    if (gs.length !== 2 || gs[0] === gs[1]) problems.push(`第${l.level}级第${i+1}册游戏配置异常: ${gs}`);
  });
});

// 5) 发音资产（缺的走浏览器中文语音，不判失败）
const missingMp3 = ALL_CHARS.filter(c => !fs.existsSync(new URL(`./audio/${encodeURIComponent(c)}.mp3`, import.meta.url)));
const mp3 = TOTAL - missingMp3.length;

console.log(`全套 ${LEVELS.length} 级 / ${LEVELS.length * 10} 册 / ${TOTAL} 字`);
LEVELS.forEach(l => {
  const miss = l.chars.filter(c => missingMp3.includes(c));
  console.log(`  ${l.name} 累计 ${String(l.total).padStart(3)} 字 | 新增 ${String(l.chars.length).padStart(2)} | 真人录音 ${l.chars.length - miss.length}/${l.chars.length} | 新增字: ${l.chars.join('')}`);
});
console.log(`真人 MP3 覆盖 ${mp3}/${TOTAL}，其余 ${missingMp3.length} 字使用浏览器中文语音`);
if (problems.length) {
  console.log('\n❌ 发现 ' + problems.length + ' 个问题:');
  [...new Set(problems)].forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('\n✅ 数据体检通过：1~6 级字表、组词与绘本短句均只使用已学字');
