/* =====================================================================
   小羊上山 · 汉字山能量大冒险 —— 核心（1~6 级 / 跟读全文）
   ===================================================================== */
const $ = id => document.getElementById(id);
const delay = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const uniq = a => [...new Set(a)];
const QS = new URLSearchParams(location.search);
/* 自动测试时跳过真实发声，避免 60 册 × 逐字播放把测试拖死 */
const FAST = QS.has('autotest') || QS.has('smoke') || QS.has('echotest');
/* 自动测试时把过场动画等待压到 0，避免 60 册 × 逐题动画把虚拟时间耗尽 */
const FX = ms => (FAST ? 0 : ms);

/* ---------------- 存档（按级别独立，兼容 v2） ---------------- */
const KEY = 'goat_hill_v3';
const DEFAULT = {level: 1, prog: {}, gems: [], stars: 0, mute: false, best: 0};
let S;
function normalize(o) {
  const s = {...DEFAULT, ...o};
  s.prog = {};
  for (let l = 1; l <= 6; l++) s.prog[l] = {unlocked: 0, done: [], echo: [], ...((o.prog || {})[l] || {})};
  s.gems = Array.isArray(s.gems) ? s.gems : [];
  s.level = Math.min(6, Math.max(1, +s.level || 1));
  return s;
}
function loadSave() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') return normalize(o);
  } catch (e) {}
  try {  // 旧版只有第 1 级，迁移过来
    const old = JSON.parse(localStorage.getItem('goat_hill_v2') || 'null');
    if (old) return normalize({level: 1, gems: old.gems || [], stars: old.stars || 0,
      mute: old.mute || false, best: old.best || 0,
      prog: {1: {unlocked: old.unlocked || 0, done: old.done || [], echo: []}}});
  } catch (e) {}
  return normalize(DEFAULT);
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
S = loadSave();
function prog(l = S.level) { return S.prog[l] || (S.prog[l] = {unlocked: 0, done: [], echo: []}); }
let BOOKS = LEVELS[S.level - 1].books;
function setLevel(l) { S.level = l; BOOKS = LEVELS[l - 1].books; save(); }

/* ---------------- 音效 / 发音 ---------------- */
let AC = null;
function ensureAudio() {
  try {
    if (!AC) AC = new (window.AudioContext || window.webkitAudioContext)();
    if (AC.state === 'suspended') AC.resume().catch(() => {});
    return AC;
  } catch (e) { return null; }
}
function unlockAudio() {
  const ac = ensureAudio(); if (!ac) return;
  try {
    const o = ac.createOscillator(), g = ac.createGain();
    g.gain.value = 0.00001; o.connect(g); g.connect(ac.destination);
    o.start(); o.stop(ac.currentTime + 0.02);
  } catch (e) {}
}
['pointerdown', 'mousedown', 'touchstart', 'keydown', 'click'].forEach(ev =>
  document.addEventListener(ev, unlockAudio, {capture: true, passive: true}));

function tone(freq, dur = .12, type = 'sine', vol = .13, delayS = 0) {
  if (S.mute) return;
  const ac = ensureAudio(); if (!ac) return;
  try {
    const t0 = ac.currentTime + delayS;
    const o = ac.createOscillator(), g = ac.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, t0);
    g.gain.setValueAtTime(0, t0);
    g.gain.linearRampToValueAtTime(vol, t0 + .012);
    g.gain.exponentialRampToValueAtTime(.0001, t0 + dur);
    o.connect(g); g.connect(ac.destination); o.start(t0); o.stop(t0 + dur + .02);
  } catch (e) {}
}
const SFX = {
  tap:    () => tone(620, .07, 'triangle', .09),
  page:   () => { tone(520, .08, 'sine', .1); tone(780, .1, 'sine', .09, .07); },
  right:  () => { tone(660, .12, 'sine', .14); tone(880, .14, 'sine', .13, .1); tone(1175, .2, 'sine', .12, .2); },
  wrong:  () => { tone(200, .18, 'triangle', .11); tone(150, .22, 'triangle', .09, .1); },
  gem:    () => { [880, 1175, 1568].forEach((f, i) => tone(f, .16, 'triangle', .12, i * .07)); },
  combo:  () => { [784, 988, 1318].forEach((f, i) => tone(f, .1, 'square', .07, i * .06)); },
  win:    () => { [523, 659, 784, 1047, 1318].forEach((f, i) => tone(f, .26, 'sine', .15, i * .12)); },
  whoosh: () => tone(300, .18, 'sawtooth', .05),
  rec:    () => { tone(880, .1, 'sine', .12); tone(660, .16, 'sine', .1, .1); },
};

/* 真人单字 MP3（构建时注入清单）；没有录音的字用浏览器中文语音 */
const MP3_CHARS = new Set(/*__MP3_CHARS__*/ '');
/* 笔顺数据（构建时注入：每字 {s: 笔画SVG路径[], m: 中线点[][]})，用于描红引导箭头 */
const STROKES = /*__STROKES__*/ {};
const audioCache = {};
function playMp3(c) {
  return new Promise(resolve => {
    if (S.mute || FAST) return resolve();
    try {
      const a = audioCache[c] || (audioCache[c] = new Audio('audio/' + encodeURIComponent(c) + '.mp3'));
      a.pause(); a.currentTime = 0; a.volume = 1;
      a.onended = resolve; a.onerror = resolve;
      const pr = a.play(); if (pr && pr.catch) pr.catch(resolve);
    } catch (e) { resolve(); }
  });
}
function zhVoice() {
  if (!('speechSynthesis' in window)) return null;
  try {
    const vs = speechSynthesis.getVoices() || [];
    return vs.find(v => /zh[-_]?CN/i.test(v.lang)) || vs.find(v => /^zh/i.test(v.lang)) || null;
  } catch (e) { return null; }
}
function tts(text, rate = .85) {
  return new Promise(resolve => {
    if (S.mute || FAST || !('speechSynthesis' in window) || !text) return resolve(false);
    let done = false;
    const fin = v => { if (!done) { done = true; resolve(v); } };
    try {
      speechSynthesis.cancel();
      const u = new SpeechSynthesisUtterance(text);
      u.lang = 'zh-CN'; u.rate = rate; u.pitch = 1.05;
      const v = zhVoice(); if (v) u.voice = v;
      u.onend = () => fin(true); u.onerror = () => fin(false);
      speechSynthesis.speak(u);
      setTimeout(() => fin(true), 900 + text.length * 320);   // 兜底，防止个别浏览器不触发 onend
    } catch (e) { fin(false); }
  });
}
function speakChar(c) {
  if (S.mute) return Promise.resolve();
  if (MP3_CHARS.has(c)) return playMp3(c);
  return tts(c, .8);
}
async function speakWord(w, gap) {
  const g = gap === undefined ? (FAST ? 0 : 70) : gap;
  for (const c of w) {
    if (!/[，。！？、…·\s\-—]/.test(c)) await speakChar(c);
    await delay(g);
  }
}
async function speakSentence(line) {
  // 有中文语音时整句连读，语调更自然；否则用真人单字 MP3 依次拼读
  if (zhVoice()) { await tts(line, .82); return; }
  for (const c of line) {
    if (/[，。！？、…·\s\-—]/.test(c)) { await delay(FAST ? 0 : 240); continue; }
    await speakChar(c); await delay(FAST ? 0 : 70);
  }
}
function voiceInfo() { return {mp3: MP3_CHARS.size, total: TOTAL, tts: !!zhVoice()}; }
if ('speechSynthesis' in window) {
  try {
    speechSynthesis.getVoices();   // 部分浏览器要等 voiceschanged 才返回语音列表
    speechSynthesis.addEventListener && speechSynthesis.addEventListener('voiceschanged', () => speechSynthesis.getVoices());
  } catch (e) {}
}

/* ---------------- 特效 ---------------- */
function initSky() {
  const box = $('stars-bg');
  let h = '';
  for (let i = 0; i < 46; i++) {
    h += `<span class="sky-star" style="left:${(Math.random() * 100).toFixed(1)}%;top:${(Math.random() * 62).toFixed(1)}%;animation-delay:${(Math.random() * 3).toFixed(1)}s"></span>`;
  }
  box.innerHTML = h;
}
function floatText(txt, x, y, color) {
  const el = document.createElement('div');
  el.className = 'float-txt'; el.textContent = txt;
  el.style.left = (x || innerWidth / 2) + 'px'; el.style.top = (y || innerHeight / 2) + 'px';
  if (color) el.style.color = color;
  document.body.appendChild(el); setTimeout(() => el.remove(), FX(1150));
}
function confetti(n = 16) {
  const emo = ['⭐', '🎉', '💎', '✨', '🌟', '🎊'];
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'confetti'; d.textContent = pick(emo);
      d.style.left = (Math.random() * 96) + '%'; d.style.top = '-30px';
      document.body.appendChild(d); setTimeout(() => d.remove(), FX(1800));
    }, FX(i * 60));
  }
}
function updateChips() {
  $('gemChip').textContent = `💎 ${S.gems.length} / ${TOTAL}`;
  $('starChip').textContent = `⭐ ${S.stars}`;
  $('muteBtn').textContent = S.mute ? '🔇' : '🔊';
}
function show(name) {
  if (name !== 'echo' && F.recording >= 0) stopRec();
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  $('scr-' + name).classList.add('on');
  SFX.page();
}

/* ---------------- 流程状态 ---------------- */
let F = {book: 0, stage: 'home', learnIdx: 0, learnChars: [], pool: [], recent: [],
         games: [], gi: 0, q: 0, combo: 0, traced: false, locked: false,
         echo: null, recording: -1, reading: false, echoSkipped: false};
function learnedChars(bookIdx) {
  const all = [];
  for (let l = 1; l < S.level; l++) all.push(...LEVELS[l - 1].chars);
  all.push(...BOOKS.slice(0, bookIdx + 1).flatMap(b => b.chars));
  return uniq(all);
}
function startBook(i) {
  F.book = i; F.stage = 'story'; F.learnIdx = 0; F.q = 0; F.gi = 0; F.combo = 0;
  F.echoSkipped = false; F.echo = null; F.recording = -1;
  F.learnChars = BOOKS[i].chars.slice();
  F.games = gamesForBook(i);
  F.pool = learnedChars(i);
  F.recent = F.pool.slice(-22);
  const b = BOOKS[i], L = LEVELS[S.level - 1];
  $('storyTitle').textContent = `${L.name} · 第 ${i + 1} 站 · ${b.zone}`;
  $('storySpeech').textContent = `咩～这里是「${b.zone}」！${b.villain}只要认出这里的汉字宝石，能量就会回到汉字山！`;
  $('storyVillain').textContent = `迷雾怪：「嘿嘿，这些字你肯定不认识！」`;
  $('storyMission').textContent = `🎯 任务：认 ${F.learnChars.length} 个新字 → 玩 2 个小游戏 → 自己读 → 跟读全文`;
  show('story');
}
function goLevels() { F.stage = 'levels'; renderLevels(); show('levels'); }
function goLearn() { F.stage = 'learn'; F.learnIdx = 0; renderLearn(); show('learn'); }
function goGame() { F.stage = 'game'; F.gi = 0; F.q = 0; F.combo = 0; renderGame(); show('game'); }
function goRead() { F.stage = 'read'; renderRead(); show('read'); }
function goEcho() { F.stage = 'echo'; F.echoSkipped = false; renderEcho(); show('echo'); }
function goAward() { F.stage = 'award'; finishBook(); renderAward(); show('award'); }
function goMap() { F.stage = 'map'; renderMap(); show('map'); }

/* ---------------- 选级 ---------------- */
function renderLevels() {
  $('levelGrid').innerHTML = LEVELS.map(l => {
    const p = prog(l.level), pct = Math.round(p.done.length / 10 * 100);
    const got = l.chars.filter(c => S.gems.includes(c)).length;
    const done = p.done.length >= 10;
    return `<div class="level-card ${done ? 'clear' : ''}" data-l="${l.level}" style="--lc:${l.color}">
      <div class="lv-badge">${l.level}</div>
      <div class="lv-body">
        <div class="lv-name">${l.name}${done ? ' <span class="lv-ok">✅ 已通关</span>' : ''}</div>
        <div class="lv-sub">${l.sub} · ${l.theme}</div>
        <div class="lv-bar"><i style="width:${pct}%"></i></div>
        <div class="lv-foot">📖 ${p.done.length}/10 册　🎤 ${p.echo.length}/10 本　💎 ${got}/${l.chars.length} 字</div>
      </div>
      <div class="lv-go">${p.done.length ? '继续 →' : '开始 →'}</div>
    </div>`;
  }).join('');
  $('levelGrid').querySelectorAll('.level-card').forEach(el => {
    el.onclick = () => { unlockAudio(); SFX.tap(); setLevel(+el.dataset.l); goMap(); };
  });
  $('levelSub').textContent = `全套 6 级 · 60 册绘本 · ${TOTAL} 个核心字 · 每本都能跟读全文`;
}

/* ---------------- 登山地图 ---------------- */
function renderMap() {
  const L = LEVELS[S.level - 1], p = prog();
  $('mapTitle').textContent = `🗺️ ${L.name} · ${L.theme}`;
  $('mapSub').textContent = `${L.sub} · 点亮 ${L.chars.length} 颗本级宝石，读完 10 册登顶！`;
  const wrap = $('mapWrap');
  wrap.querySelectorAll('.node').forEach(n => n.remove());
  const POS = [[9, 85], [27, 74], [45, 81], [62, 67], [79, 73], [87, 50], [70, 37], [50, 45], [30, 27], [15, 14]];
  BOOKS.forEach((b, i) => {
    const locked = i > p.unlocked;
    const done = p.done.includes(i);
    const echo = p.echo.includes(i);
    const n = document.createElement('div');
    n.className = 'node' + (locked ? ' lock' : '') + (done ? ' done' : '') + (i === p.unlocked && !done ? ' cur' : '');
    n.style.left = POS[i][0] + '%'; n.style.top = POS[i][1] + '%';
    n.innerHTML = `<div class="node-badge">${locked ? '🔒' : b.emo}</div>
      <div class="node-name">${i + 1}. ${b.zone}</div>
      <div class="node-sub">${done ? (echo ? '🎤 ' : '✅ ') + b.badge : (locked ? '未解锁' : b.chars.join(''))}</div>
      ${done ? '<span class="tick">⭐</span>' : ''}`;
    n.onclick = () => {
      if (locked) { SFX.wrong(); floatText('先通过上一站哦！', innerWidth / 2, innerHeight / 2, '#fff'); return; }
      unlockAudio(); startBook(i);
    };
    wrap.appendChild(n);
  });
}

/* ---------------- 认字（看图 → 听音 → 组词 → 描红） ---------------- */
function renderLearn() {
  const c = F.learnChars[F.learnIdx];
  const info = CHARS[c];
  const L = LEVELS[S.level - 1];
  $('learnTitle').textContent = `${L.name} · 第 ${F.book + 1} 站 · 认字 ${F.learnIdx + 1}/${F.learnChars.length}`;
  $('learnHint').textContent = info.x ? '看图画变汉字 → 听一听 → 描一描' : '听一听 → 组个词 → 描一描';
  $('bigChar').textContent = c;
  $('charPinyin').textContent = MP3_CHARS.has(c) ? '🔊 点字听真人读音' : '🔊 点字听读音';
  $('picEmoji').textContent = info.e;
  $('picHint').textContent = info.h;
  $('traceChar').textContent = c;
  $('traceTip').textContent = '✏️ 看编号箭头，照顺序描一描';
  F.traced = false;
  $('learnDots').innerHTML = F.learnChars.map((_, i) =>
    `<span class="pdot ${i < F.learnIdx ? 'done' : (i === F.learnIdx ? 'on' : '')}"></span>`).join('');
  const ws = wordsFor(c, new Set(F.pool));
  $('wordList').innerHTML = ws.map(w => `<span class="word-pill" data-w="${w}">${w}</span>`).join('');
  $('wordList').querySelectorAll('.word-pill').forEach(el => {
    el.onclick = () => { SFX.tap(); speakWord(el.dataset.w); };
  });
  $('charCard').onclick = () => { SFX.tap(); speakChar(c); };
  setupTrace();
  if (info.x) {
    $('bigChar').style.opacity = '0';
    $('bigChar').style.transform = 'scale(.3)';
    $('bigChar').style.transition = 'all .45s cubic-bezier(.2,1.5,.5,1)';
    setTimeout(() => {
      $('bigChar').style.opacity = '1'; $('bigChar').style.transform = 'scale(1)';
      speakChar(c);
    }, FX(780));
  } else {
    $('bigChar').style.opacity = '1'; $('bigChar').style.transform = 'scale(1)';
    setTimeout(() => speakChar(c), FX(220));
  }
}
/* 笔顺引导：把标准笔顺数据画成「淡色字形模板 + 编号起笔点 + 方向箭头」，
   并可「看示范」逐笔写一遍。坐标来自 hanzi-writer-data（Make Me a Hanzi），
   原始坐标 y 向上、范围 0~1024，需变换到 300×300 画布：x*K, (900-y)*K，K=300/1024 */
const TR_K = 300 / 1024;
const traceState = {char: null, strokes: null, demoTimer: null};
function trXY(p) { return [p[0] * TR_K, (900 - p[1]) * TR_K]; }
function guideTransform(g) { g.setTransform(TR_K, 0, 0, -TR_K, 0, 900 * TR_K); }

function clearGuide() {
  const g = $('traceGuide').getContext('2d');
  g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, 300, 300);
}
/* 画一字的笔顺引导：template=淡色字形，arrows=编号起点+方向箭头 */
function drawGuide(c, opts) {
  opts = opts || {};
  const g = $('traceGuide').getContext('2d');
  clearGuide();
  const d = STROKES[c];
  if (!d) return;
  const upTo = opts.upTo == null ? d.s.length : opts.upTo;     /* 示范时只画到第 upTo 笔 */
  const cur = opts.cur == null ? -1 : opts.cur;                /* 当前正在写的这一笔（高亮） */
  // 字形模板（淡色）
  guideTransform(g);
  for (let i = 0; i < upTo; i++) {
    g.lineJoin = g.lineCap = 'round';
    g.strokeStyle = (i === cur) ? 'rgba(255,122,47,.95)' : 'rgba(225,170,110,.5)';
    g.lineWidth = (i === cur) ? 13 : 11;
    g.beginPath(); g.stroke(new Path2D(d.s[i]));
  }
  g.setTransform(1, 0, 0, 1, 0, 0);
  if (!opts.arrows) return;
  // 编号起笔点 + 方向箭头
  for (let i = 0; i < d.m.length; i++) {
    const med = d.m[i]; if (!med || !med.length) continue;
    const a = trXY(med[0]);
    let b = med[Math.min(3, med.length - 1)];
    const ab = [b[0] - med[0][0], b[1] - med[0][1]];
    const len = Math.hypot(ab[0], ab[1]) || 1;
    const ux = ab[0] / len, uy = ab[1] / len;
    const tip = [a[0] + ux * 15, a[1] + uy * 15];
    // 方向箭头（细线 + 三角）
    g.strokeStyle = '#ff7a2f'; g.fillStyle = '#ff7a2f'; g.lineWidth = 2.4; g.lineCap = 'round';
    g.beginPath(); g.moveTo(a[0], a[1]); g.lineTo(tip[0], tip[1]); g.stroke();
    const ang = Math.atan2(uy, ux);
    g.beginPath();
    g.moveTo(tip[0], tip[1]);
    g.lineTo(tip[0] - 7 * Math.cos(ang - 0.5), tip[1] - 7 * Math.sin(ang - 0.5));
    g.lineTo(tip[0] - 7 * Math.cos(ang + 0.5), tip[1] - 7 * Math.sin(ang + 0.5));
    g.closePath(); g.fill();
    // 起笔编号
    g.beginPath(); g.arc(a[0], a[1], 9.5, 0, Math.PI * 2);
    g.fillStyle = '#ff7a2f'; g.fill();
    g.fillStyle = '#fff'; g.font = 'bold 13px sans-serif';
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText(String(i + 1), a[0], a[1] + 0.5);
  }
}
/* 看示范：逐笔写一遍（高亮当前笔 + 已写笔），写完恢复模板+箭头 */
function playDemo() {
  const c = traceState.char; if (!c || !traceState.strokes) return;
  const n = traceState.strokes.s.length;
  if (traceState.demoTimer) { clearInterval(traceState.demoTimer); traceState.demoTimer = null; }
  let k = 0;
  const step = () => {
    if (k > n) { drawGuide(c, {arrows: true}); traceState.demoTimer = null; return; }
    drawGuide(c, {upTo: k, cur: k - 1, arrows: k <= n});
    k++;
  };
  step();
  traceState.demoTimer = setInterval(step, 420);
}

function setupTrace() {
  const cv = $('traceCanvas'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 300, 300);
  ctx.strokeStyle = 'rgba(225,165,95,.38)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  [[150, 0, 150, 300], [0, 150, 300, 150], [0, 0, 300, 300], [300, 0, 0, 300]].forEach(l => {
    ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
  });
  ctx.setLineDash([]);
  const c = $('traceChar').textContent;
  traceState.char = c; traceState.strokes = STROKES[c] || null;
  if (traceState.demoTimer) { clearInterval(traceState.demoTimer); traceState.demoTimer = null; }
  if (traceState.strokes) {                       /* 有笔顺数据：用引导层，隐藏 DOM 字形 */
    $('traceChar').classList.add('hide');
    drawGuide(c, {arrows: true});
  } else {                                         /* 没数据：退回淡色字模板 */
    $('traceChar').classList.remove('hide');
    clearGuide();
  }
  const cells = new Set();
  let drawing = false, last = null, done = false;
  const pos = e => {
    const r = cv.getBoundingClientRect();
    return {x: (e.clientX - r.left) / r.width * 300, y: (e.clientY - r.top) / r.height * 300};
  };
  const move = e => {
    if (!drawing || done) return;
    e.preventDefault();
    const p = pos(e);
    ctx.strokeStyle = 'rgba(255,155,45,.9)'; ctx.lineWidth = 17;
    ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    ctx.beginPath(); ctx.moveTo(last ? last.x : p.x, last ? last.y : p.y); ctx.lineTo(p.x, p.y); ctx.stroke();
    cells.add(`${Math.floor(p.x / 37.5)},${Math.floor(p.y / 37.5)}`);
    last = p;
    if (cells.size >= 12 && !done) {
      done = true; F.traced = true;
      SFX.right(); floatText('描得真棒！⭐', innerWidth / 2, innerHeight * .6, '#ffe06a');
      $('traceTip').textContent = '✅ 描完啦！你真棒';
    }
  };
  cv.onpointerdown = e => { unlockAudio(); drawing = true; last = pos(e); cv.setPointerCapture(e.pointerId); };
  cv.onpointermove = move;
  cv.onpointerup = () => { drawing = false; last = null; };
  cv.onpointercancel = () => { drawing = false; last = null; };
}

/* ---------------- 绘本自主阅读 ---------------- */
function renderRead() {
  const b = BOOKS[F.book], L = LEVELS[S.level - 1];
  $('readTitle').textContent = `📖 我自己读 · ${L.name} 第 ${F.book + 1} 本`;
  $('bookTitle').textContent = b.book;
  const box = $('bookLines'); box.innerHTML = '';
  b.story.forEach(line => {
    const row = document.createElement('div'); row.className = 'book-line';
    [...line].forEach(ch => {
      const sp = document.createElement('span');
      if (/[，。！？、…·\s\-—]/.test(ch)) { sp.className = 'punc'; sp.textContent = ch; }
      else {
        sp.className = 'hz'; sp.textContent = ch;
        sp.onclick = ev => {
          ev.stopPropagation(); unlockAudio(); SFX.tap();
          sp.classList.add('speaking'); setTimeout(() => sp.classList.remove('speaking'), 320);
          speakChar(ch);
        };
      }
      row.appendChild(sp);
    });
    row.onclick = () => {
      unlockAudio(); row.classList.add('read');
      speakSentence(line);
      $('bookFoot').textContent = '🔊 小羊在读：' + line;
    };
    box.appendChild(row);
  });
  $('bookFoot').textContent = '✨ 这些字你都认识啦，自己读一遍，再去跟读全文！';
}

/* ---------------- 跟读全文（示范 → 录音 → 回放 → 打卡） ---------------- */
const REC = {stream: null, rec: null, chunks: [], line: -1};
/* 本机是否支持录音（有麦克风 API + MediaRecorder）。不支持时走降级通道 */
function recSupported() { return !!(navigator.mediaDevices && window.MediaRecorder); }
function echoInit() {
  const n = BOOKS[F.book].story.length;
  if (!F.echo) F.echo = {checked: Array(n).fill(false), audio: Array(n).fill(null)};
  F.recording = -1;
  F.micOK = recSupported();          /* 默认按“支持”处理，被拒/不可用会在 startRec 里改回 false */
}
function echoMsg(t) { $('echoTip').textContent = t; }
function markLine(i, fromRec) {
  if (F.echo.checked[i]) return;
  F.echo.checked[i] = true;
  S.stars += fromRec ? 4 : 2;
  save(); updateChips(); SFX.right();
  floatText(fromRec ? '录好啦！⭐⭐' : '读得真棒！⭐', innerWidth / 2, innerHeight * .45, '#ffe06a');
}
async function startRec(i) {
  if (F.recording >= 0) return stopRec();
  if (!navigator.mediaDevices || !window.MediaRecorder) {
    F.micOK = false; renderEcho();           /* 不支持录音：开放降级通道，不卡住 */
    echoMsg('这台设备不支持录音，点「✅ 读好啦」一样能过关哦～'); return;
  }
  try {
    REC.stream = await navigator.mediaDevices.getUserMedia({audio: true});
    REC.chunks = []; REC.line = i;
    REC.rec = new MediaRecorder(REC.stream);
    REC.rec.ondataavailable = e => { if (e.data && e.data.size) REC.chunks.push(e.data); };
    REC.rec.onstop = () => {
      try {
        const blob = new Blob(REC.chunks, {type: REC.rec.mimeType || 'audio/webm'});
        if (blob.size) F.echo.audio[i] = URL.createObjectURL(blob);
      } catch (e) {}
      if (REC.stream) { REC.stream.getTracks().forEach(t => t.stop()); REC.stream = null; }
      F.recording = -1; markLine(i, true); renderEcho();
    };
    REC.rec.start();
    F.recording = i; SFX.rec(); renderEcho();
    echoMsg('🎤 正在录音……大声读这一句，读完点「⏹ 停一停」');
    setTimeout(() => { if (F.recording === i) stopRec(); }, 9000);
  } catch (e) {
    F.micOK = false; renderEcho();           /* 麦克风被拒/不可用：开放降级通道 */
    echoMsg('麦克风没打开（可以点「✅ 读好啦」自己读，也一样棒！）');
    if (REC.stream) { REC.stream.getTracks().forEach(t => t.stop()); REC.stream = null; }
  }
}
function stopRec() {
  if (REC.rec && REC.rec.state === 'recording') { try { REC.rec.stop(); } catch (e) {} }
  else { F.recording = -1; }
}
function playMyVoice(i) {
  const url = F.echo.audio[i]; if (!url) return;
  const a = new Audio(url); a.play().catch(() => {});
  echoMsg('▶ 听听自己的声音，是不是很棒？');
}
async function echoReadAll() {
  if (F.reading) return;
  F.reading = true;
  const lines = BOOKS[F.book].story;
  for (let i = 0; i < lines.length; i++) {
    if (F.stage !== 'echo') break;
    document.querySelectorAll('.echo-line').forEach((el, j) => el.classList.toggle('playing', j === i));
    echoMsg(`🔊 小羊读第 ${i + 1} 句：${lines[i]}`);
    await speakSentence(lines[i]);
    await delay(FAST ? 0 : 240);
  }
  document.querySelectorAll('.echo-line').forEach(el => el.classList.remove('playing'));
  F.reading = false;
  echoMsg('✨ 听完啦！现在一句一句跟着读吧～');
}
function renderEcho() {
  echoInit();
  const b = BOOKS[F.book], L = LEVELS[S.level - 1], lines = b.story;
  $('echoTitle').textContent = `🎤 跟读全文 · ${L.name} 第 ${F.book + 1} 本`;
  $('echoBook').textContent = b.book;
  const done = F.echo.checked.filter(Boolean).length;
  $('echoProg').textContent = `已跟读 ${done} / ${lines.length} 句`;
  $('echoStars').innerHTML = lines.map((_, i) =>
    `<span class="estar ${F.echo.checked[i] ? 'lit' : ''}" style="animation-delay:${i * .12}s">★</span>`).join('');
  $('echoCheer').textContent = done >= lines.length ? '🎉 整本都读完啦！你是朗读小达人！'
    : (done ? `已经点亮 ${done} 颗星星，再读 ${lines.length - done} 句就满啦！` : '大声读出来，小羊在听哦！');
  echoMsg('① 点「🔊 听示范」→ ② 点「🎤 我来读」录下自己的声音 → ③ 点「✅ 读好啦」');
  $('echoList').innerHTML = lines.map((line, i) => `
    <div class="echo-line ${F.echo.checked[i] ? 'ok' : ''} ${F.recording === i ? 'rec' : ''}" data-i="${i}">
      <div class="echo-no">${i + 1}</div>
      <div class="echo-text">${line}</div>
      <div class="echo-ops">
        <button class="mini" data-act="listen" data-i="${i}">🔊 听示范</button>
        <button class="mini ${F.recording === i ? 'hot' : ''}" data-act="rec" data-i="${i}">${F.recording === i ? '⏹ 停一停' : '🎤 我来读'}</button>
        ${F.echo.audio[i] ? `<button class="mini" data-act="play" data-i="${i}">▶ 听我的</button>` : ''}
        <button class="mini okbtn ${F.micOK && !F.echo.audio[i] && !F.echo.checked[i] ? 'need-rec' : ''}" data-act="ok" data-i="${i}">${F.echo.checked[i] ? '✅ 读过啦' : (F.micOK && !F.echo.audio[i] ? '🔒 先录音' : '✅ 读好啦')}</button>
      </div>
    </div>`).join('');
  $('echoList').querySelectorAll('button.mini').forEach(btn => {
    btn.onclick = () => {
      const i = +btn.dataset.i, act = btn.dataset.act;
      unlockAudio(); SFX.tap();
      if (act === 'listen') { echoMsg('🔊 听：' + lines[i]); speakSentence(lines[i]); }
      else if (act === 'rec') startRec(i);
      else if (act === 'play') playMyVoice(i);
      else if (act === 'ok') {
        /* 麦克风可用时必须先录这一句，否则只是“看”没“读”，不能算打卡 */
        if (F.micOK && !F.echo.audio[i]) {
          echoMsg('先录一下这一句吧～🎤 点「我来读」，读完点「⏹ 停一停」，再点读好啦');
          return;
        }
        markLine(i, false); renderEcho();
      }
    };
  });
  $('echoDone').textContent = done >= lines.length ? '🏅 全部读完，领奖状！' : `🏅 我全读完啦（${done}/${lines.length}）`;
}

/* ---------------- 通关结算 & 奖状 ---------------- */
function finishBook() {
  const b = BOOKS[F.book], p = prog();
  let gained = 0;
  b.chars.forEach(c => { if (!S.gems.includes(c)) { S.gems.push(c); gained++; } });
  if (!p.done.includes(F.book)) p.done.push(F.book);
  const echoOK = !F.echoSkipped && F.echo && F.echo.checked.length && F.echo.checked.every(Boolean);
  if (echoOK && !p.echo.includes(F.book)) p.echo.push(F.book);
  S.stars += 5 + F.learnChars.length * 2 + gained + (echoOK ? 6 : 0);
  p.unlocked = Math.max(p.unlocked, Math.min(BOOKS.length - 1, F.book + 1));
  S.best = Math.max(S.best, F.combo);
  save(); updateChips(); confetti(22); SFX.win();
  F.gained = gained; F.echoOK = !!echoOK;
}
function renderAward() {
  const b = BOOKS[F.book], L = LEVELS[S.level - 1];
  const last = F.book === BOOKS.length - 1;
  $('awardTitle').textContent = last ? `👑 ${L.name} 全部读完啦！` : `🎉 获得「${b.badge}」`;
  $('awardGems').innerHTML = b.chars.map((c, i) =>
    `<div class="gem-mini" style="animation-delay:${i * .09}s" title="${c}"></div>`).join('');
  $('awardBadge').textContent = F.echoOK ? '🎤 本册跟读全文完成 · 朗读小达人 +6⭐' : '📖 本册自主阅读完成';
  $('awardNext').textContent = last ? '🏆 选下一级' : '下一站 →';
  drawCert();
}
function drawCert() {
  const cv = $('certCanvas'), g = cv.getContext('2d');
  const b = BOOKS[F.book], L = LEVELS[S.level - 1];
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 1000, 660);
  g.strokeStyle = '#e8bd5c'; g.lineWidth = 16; g.strokeRect(24, 24, 952, 612);
  g.strokeStyle = '#f4d999'; g.lineWidth = 3; g.strokeRect(44, 44, 912, 572);
  g.fillStyle = '#fff3d0'; g.beginPath(); g.arc(500, 130, 74, 0, Math.PI * 2); g.fill();
  g.font = '70px serif'; g.textAlign = 'center'; g.fillText('🐑', 500, 155);
  g.fillStyle = '#b4761d'; g.font = 'bold 54px KaiTi,STKaiti,serif';
  g.fillText('阅 读 小 勇 士 奖 状', 500, 258);
  g.fillStyle = '#6b5630'; g.font = '30px KaiTi,STKaiti,serif';
  g.fillText(`恭喜你读完 ${L.name} ${b.book}`, 500, 322);
  g.fillText(`在「${b.zone}」认识了 ${b.chars.length} 个汉字宝石`, 500, 370);
  g.fillStyle = '#2f3b6e'; g.font = 'bold 46px KaiTi,STKaiti,serif';
  g.fillText(b.chars.join('  '), 500, 440);
  g.fillStyle = F.echoOK ? '#c2601c' : '#a0793d'; g.font = 'bold 26px "Microsoft YaHei",sans-serif';
  g.fillText(F.echoOK ? '🎤 跟读全文完成 · 朗读小达人' : `徽章：${b.badge}`, 500, 500);
  g.fillStyle = '#a0793d'; g.font = '22px "Microsoft YaHei",sans-serif';
  g.fillText(`已收集 ${S.gems.length} / ${TOTAL} 颗宝石　·　⭐ ${S.stars}`, 500, 540);
  g.fillStyle = '#9a8a68'; g.font = '20px "Microsoft YaHei",sans-serif';
  g.fillText(new Date().toLocaleDateString('zh-CN') + '　小羊上山 · 汉字山能量大冒险', 500, 590);
}

/* ---------------- 图鉴 / 家长 ---------------- */
function renderDex() {
  $('dexSub').textContent = `全套 1~6 级 ${TOTAL} 字 · 已点亮 ${S.gems.length} 颗 · 点亮的宝石可以听发音`;
  $('dexGrid').innerHTML = LEVELS.map(l => `
    <div class="dex-sec" style="--lc:${l.color}">${l.name} · ${l.sub}</div>` +
    l.chars.map(c => {
      const got = S.gems.includes(c);
      return `<div class="dex-cell ${got ? 'got' : ''}" data-c="${got ? c : ''}">${got ? c : '·'}</div>`;
    }).join('')).join('');
  $('dexGrid').querySelectorAll('.dex-cell.got').forEach(el => {
    el.onclick = () => { SFX.tap(); speakChar(el.dataset.c);
      floatText(el.dataset.c, innerWidth / 2, innerHeight / 2, '#ffe06a'); };
  });
}
function renderParent() {
  const v = voiceInfo();
  $('parentNote').innerHTML = `
    <b>这套游戏按什么编的？</b><br>
    依据《小羊上山儿童汉语分级读物》<b>1~6 级</b>公开整理字表，按官方分级字数编排：
    60 / 120 / 180 / 240 / 310 / 390 字，每级 10 册，共 <b>60 册绘本</b>。
    词语和绘本短句<b>只使用本级及之前学过的字</b>——这是分级读物最核心的编写原则。
    个别整理表缺字用同级高频常用字补齐；<b>绘本为配合游戏的原创改写，不是原书全文</b>。<br><br>
    <b>一关怎么玩（约 6 分钟）</b><br>
    ① <b>认字</b>：图画变汉字 → 发音 → 组词 → 手指描红（不考笔顺，重在参与）<br>
    ② <b>玩 2 个小游戏</b>：抢宝石 / 敲迷雾怪 / 谁不见了 / 对对碰 / 词语拼拼乐，逐关轮换<br>
    ③ <b>自己读</b>：点单字听发音，点整句听小羊朗读<br>
    ④ <b>🎤 跟读全文</b>：逐句听示范 → 按「我来读」录下孩子的声音 → 回放给自己听 → 逐句打卡。
    也能一键「听整本」连续朗读。麦克风没打开也没关系，点「✅ 读好啦」或「先不跟读」同样能过关。<br><br>
    <b>发音说明</b><br>
    有真人录音的 <b>${v.mp3} / ${v.total}</b> 个字用仓库自带的 MP3（离线也能听），
    其余字用<b>浏览器中文语音</b>朗读${v.tts ? '（本机已检测到中文语音 ✅）' : '（本机暂未检测到中文语音，建议用 Chrome / Edge 打开）'}。
    整句朗读优先用中文语音，语调更自然；没有语音时自动退回单字拼读。
    首次点击页面会解锁声音，右下角 🔊 可静音。<br><br>
    <b>参考了哪些识字产品的做法</b><br>
    悟空识字的「剧情闯关 + 象形演示」、洪恩识字的「玩认练写闭环」、
    叫叫识字的「每天几字 + 次日复习」、以及教材配套的「字卡游戏 / 读后小游戏 / 荣誉证书」，
    再加上分级读物官方推荐的「家长读多 → 孩子读多 → 独立阅读 → 朗读」三步过渡。<br><br>
    <b>建议</b>：5 岁孩子从第 1 级开始，每天 1 册；跟读环节请真的听一遍孩子的录音并夸一句。
    进度按级别分别保存在本机浏览器里，换级别不会丢。读完 10 册会自动提示挑战下一级。`;
}

/* ---------------- 顶栏 / 按钮 ---------------- */
function bindUI() {
  $('startBtn').onclick = () => { unlockAudio(); SFX.tap(); goLevels(); };
  $('dexHomeBtn').onclick = () => { unlockAudio(); renderDex(); show('dex'); F.dexFrom = 'home'; };
  $('dexBtn').onclick = () => { unlockAudio(); renderDex(); show('dex'); F.dexFrom = F.stage; };
  $('dexBack').onclick = () => { show(F.dexFrom === 'home' ? 'home' : (F.dexFrom === 'levels' ? 'levels' : 'map')); };
  $('homeBtn').onclick = () => { show('home'); };
  $('muteBtn').onclick = () => { S.mute = !S.mute; save(); updateChips(); if (!S.mute) { unlockAudio(); SFX.right(); } };
  $('parentBtn').onclick = () => { renderParent(); show('parent'); };
  $('parentBack').onclick = () => show('home');
  $('levelBack').onclick = () => show('home');
  $('mapBack').onclick = () => goLevels();
  $('storyGo').onclick = () => { unlockAudio(); SFX.tap(); goLearn(); };
  $('learnBack').onclick = () => { renderLearn(); };
  $('learnNext').onclick = () => {
    SFX.tap();
    if (F.traced) { S.stars += 1; save(); updateChips(); }
    F.learnIdx++;
    if (F.learnIdx >= F.learnChars.length) goGame(); else renderLearn();
  };
  $('traceDemo').onclick = () => { unlockAudio(); SFX.tap(); playDemo(); };
  $('readEcho').onclick = () => { unlockAudio(); goEcho(); };
  $('readDone').onclick = () => { unlockAudio(); F.echoSkipped = true; goAward(); };
  $('echoBack').onclick = () => goRead();
  $('echoAll').onclick = () => { unlockAudio(); echoReadAll(); };
  $('echoDone').onclick = () => {
    unlockAudio();
    /* 麦克风可用时，必须每句都录过音才能领奖状，防止没读就直接过关 */
    if (F.micOK && F.echo && F.echo.audio.some(a => !a)) {
      const left = F.echo.audio.filter(a => !a).length;
      echoMsg(`还有 ${left} 句没录呢～🎤 点「我来读」录完每一句，再点领奖状`);
      return;
    }
    if (F.echo) { F.echo.checked = F.echo.checked.map(() => true); }
    goAward();
  };
  $('echoSkip').onclick = () => { F.echoSkipped = true; goAward(); };
  $('certDown').onclick = () => {
    const a = document.createElement('a');
    a.download = `小羊上山-第${S.level}级-第${F.book + 1}册奖状.png`;
    a.href = $('certCanvas').toDataURL('image/png'); a.click(); SFX.tap();
  };
  $('awardNext').onclick = () => {
    if (F.book === BOOKS.length - 1) {
      goLevels();
      floatText(prog().done.length >= 10 ? '本级通关！试试下一级吧 🎉' : '继续加油！', innerWidth / 2, innerHeight * .45, '#ffe06a');
    } else goMap();
  };
  $('resetBtn').onclick = () => {
    if (!confirm('确定清空所有级别的全部进度，从头开始吗？')) return;
    S = normalize({...DEFAULT, prog: {}}); save(); updateChips(); renderDex(); SFX.page();
  };
}
