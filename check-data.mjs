/* 教材数据体检：确保词语/绘本只用本级 60 字，且每册故事不出现未学字 */
import fs from 'fs';
import vm from 'vm';

const src = fs.readFileSync(new URL('./src/data.js', import.meta.url), 'utf8');
const ctx = {};
vm.createContext(ctx);
vm.runInContext(src + '\nthis.__D = {CHARS, BOOKS, WORDS, GAMES, gamesForBook};', ctx);
const {CHARS, BOOKS, WORDS, gamesForBook} = ctx.__D;

const known = new Set(Object.keys(CHARS));
const problems = [];
const strip = s => s.replace(/[，。！？、…·\s\-—]/g, '');

// 1) 字表完整性
const bookChars = BOOKS.flatMap(b => b.chars);
if (bookChars.length !== 60) problems.push(`字表总数 ${bookChars.length}，应为 60`);
if (new Set(bookChars).size !== 60) problems.push('字表有重复字');
for (const c of bookChars) if (!known.has(c)) problems.push(`字表里的「${c}」缺少图解数据`);
for (const c of known) if (!bookChars.includes(c)) problems.push(`图解里的「${c}」没有编进册子`);

// 2) 词组 / 字卡词，只能由 60 字组成
const checkText = (text, where) => {
  for (const c of strip(text)) if (!known.has(c)) problems.push(`${where}: 出现超纲字「${c}」(${text})`);
};
WORDS.forEach(w => checkText(w, 'WORDS'));
for (const [c, info] of Object.entries(CHARS)) {
  info.w.forEach(w => checkText(w, `CHARS[${c}].w`));
  if (!info.w.some(w => w.includes(c))) problems.push(`CHARS[${c}].w 没有包含自己`);
  if (!info.e || !info.h) problems.push(`CHARS[${c}] 缺少图形或提示`);
}

// 3) 每册绘本：只能用本册及之前学过的字
let learned = new Set();
BOOKS.forEach((b, i) => {
  b.chars.forEach(c => learned.add(c));
  b.story.forEach(line => {
    for (const c of strip(line)) {
      if (!learned.has(c)) problems.push(`第${i + 1}册绘本「${line}」出现未学字「${c}」`);
    }
  });
  if (b.chars.length < 4 || b.chars.length > 8) problems.push(`第${i + 1}册新字 ${b.chars.length} 个，超出 4~8 范围`);
  const gs = gamesForBook(i);
  if (gs.length !== 2 || gs[0] === gs[1]) problems.push(`第${i + 1}册游戏配置异常: ${gs}`);
});

// 4) MP3 覆盖
const missingMp3 = [...known].filter(c => !fs.existsSync(new URL(`./audio/${c}.mp3`, import.meta.url)));
if (missingMp3.length) problems.push(`缺真人发音: ${missingMp3.join('')}`);

// 5) 输出
console.log(`字表 ${known.size} 字 / ${BOOKS.length} 册`);
BOOKS.forEach((b, i) => console.log(`  ${String(i + 1).padStart(2)}. ${b.zone.padEnd(7, '　')} ${b.chars.join('')}  ${gamesForBook(i).join('+')}  《${b.book}》`));
if (problems.length) {
  console.log('\n❌ 发现 ' + problems.length + ' 个问题:');
  [...new Set(problems)].forEach(p => console.log('  - ' + p));
  process.exit(1);
}
console.log('\n✅ 数据体检通过：所有词语与绘本短句均只使用本级 60 字，真人发音齐全');
