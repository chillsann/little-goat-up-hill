/* =====================================================================
   小羊上山 · 汉字山能量大冒险  —— 核心
   ===================================================================== */
const $ = id => document.getElementById(id);
const delay = ms => new Promise(r => setTimeout(r, ms));
const rnd = n => Math.floor(Math.random() * n);
const pick = a => a[rnd(a.length)];
const shuffle = a => { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
const uniq = a => [...new Set(a)];

/* ---------------- 存档 ---------------- */
const KEY = 'goat_hill_v2';
const DEFAULT = {unlocked: 0, done: [], gems: [], stars: 0, mute: false, best: 0};
let S;
function loadSave() {
  try {
    const o = JSON.parse(localStorage.getItem(KEY) || 'null');
    if (o && typeof o === 'object') return {...DEFAULT, ...o, done: o.done || [], gems: o.gems || []};
  } catch (e) {}
  return {...DEFAULT, done: [], gems: []};
}
function save() { try { localStorage.setItem(KEY, JSON.stringify(S)); } catch (e) {} }
S = loadSave();

/* ---------------- 音频（必须用户手势内解锁，否则整局静音） ---------------- */
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
};
/* 真人单字发音（仓库 audio/ 下 60 个 MP3，离线也能听） */
const audioCache = {};
function speakChar(c) {
  return new Promise(resolve => {
    if (S.mute) return resolve();
    try {
      const a = audioCache[c] || (audioCache[c] = new Audio('audio/' + encodeURIComponent(c) + '.mp3'));
      a.pause(); a.currentTime = 0; a.volume = 1;
      a.onended = resolve; a.onerror = resolve;
      const pr = a.play(); if (pr && pr.catch) pr.catch(resolve);
    } catch (e) { resolve(); }
  });
}
async function speakWord(w, gap = 70) {
  for (const c of w) {
    if (!/[，。！？、…·\s\-—]/.test(c)) await speakChar(c);
    await delay(gap);
  }
}
async function speakSentence(line) {
  for (const c of line) {
    if (/[，。！？、…·\s\-—]/.test(c)) { await delay(240); continue; }
    await speakChar(c); await delay(70);
  }
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
  document.body.appendChild(el); setTimeout(() => el.remove(), 1150);
}
function confetti(n = 16) {
  const emo = ['⭐', '🎉', '💎', '✨', '🌟', '🎊'];
  for (let i = 0; i < n; i++) {
    setTimeout(() => {
      const d = document.createElement('div');
      d.className = 'confetti'; d.textContent = pick(emo);
      d.style.left = (Math.random() * 96) + '%'; d.style.top = '-30px';
      document.body.appendChild(d); setTimeout(() => d.remove(), 1800);
    }, i * 60);
  }
}
function updateChips() {
  $('gemChip').textContent = `💎 ${S.gems.length} / 60`;
  $('starChip').textContent = `⭐ ${S.stars}`;
  $('muteBtn').textContent = S.mute ? '🔇' : '🔊';
}
function show(name) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('on'));
  $('scr-' + name).classList.add('on');
  SFX.page();
}

/* ---------------- 流程状态 ---------------- */
let F = {book: 0, stage: 'home', learnIdx: 0, learnChars: [], pool: [], games: [], gi: 0, q: 0, combo: 0, traced: false, locked: false, answer: null};
function learnedChars(bookIdx) {
  return uniq(BOOKS.slice(0, bookIdx + 1).flatMap(b => b.chars));
}
function startBook(i) {
  F.book = i; F.stage = 'story'; F.learnIdx = 0; F.q = 0; F.gi = 0; F.combo = 0;
  F.learnChars = BOOKS[i].chars.slice();
  F.games = gamesForBook(i);
  F.pool = learnedChars(i);
  const b = BOOKS[i];
  $('storyTitle').textContent = `第 ${i + 1} 站 · ${b.zone}`;
  $('storySpeech').textContent = `咩～这里是「${b.zone}」！${b.villain}只要认出这里的汉字宝石，能量就会回到汉字山！`;
  $('storyVillain').textContent = `迷雾怪：「嘿嘿，这些字你肯定不认识！」`;
  $('storyMission').textContent = `🎯 任务：认 ${F.learnChars.length} 个新字 → 玩 2 个小游戏 → 自己读完一本小书`;
  show('story');
}
function goLearn() { F.stage = 'learn'; F.learnIdx = 0; renderLearn(); show('learn'); }
function goGame() { F.stage = 'game'; F.gi = 0; F.q = 0; F.combo = 0; renderGame(); show('game'); }
function goRead() { F.stage = 'read'; renderRead(); show('read'); }
function goAward() { F.stage = 'award'; finishBook(); renderAward(); show('award'); }
function goMap() { F.stage = 'map'; renderMap(); show('map'); }

/* ---------------- 首页 & 地图 ---------------- */
function renderMap() {
  const wrap = $('mapWrap');
  wrap.querySelectorAll('.node').forEach(n => n.remove());
  const POS = [[9, 85], [27, 74], [45, 81], [62, 67], [79, 73], [87, 50], [70, 37], [50, 45], [30, 27], [15, 14]];
  BOOKS.forEach((b, i) => {
    const locked = i > S.unlocked;
    const done = S.done.includes(i);
    const n = document.createElement('div');
    n.className = 'node' + (locked ? ' lock' : '') + (done ? ' done' : '') + (i === S.unlocked && !done ? ' cur' : '');
    n.style.left = POS[i][0] + '%'; n.style.top = POS[i][1] + '%';
    n.innerHTML = `<div class="node-badge">${locked ? '🔒' : b.emo}</div>
      <div class="node-name">${i + 1}. ${b.zone}</div>
      <div class="node-sub">${done ? '✅ ' + b.badge : (locked ? '未解锁' : b.chars.join('') )}</div>
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
  $('learnTitle').textContent = `第 ${F.book + 1} 站 · 认字 ${F.learnIdx + 1}/${F.learnChars.length}`;
  $('learnHint').textContent = info.x ? '看图画变汉字 → 听一听 → 描一描' : '听一听 → 组个词 → 描一描';
  $('bigChar').textContent = c;
  $('charPinyin').textContent = '🔊 点字听读音';
  $('picEmoji').textContent = info.e;
  $('picHint').textContent = info.h;
  $('traceChar').textContent = c;
  $('traceTip').textContent = '✏️ 用手指在格子里描一描';
  F.traced = false;
  $('learnDots').innerHTML = F.learnChars.map((_, i) =>
    `<span class="pdot ${i < F.learnIdx ? 'done' : (i === F.learnIdx ? 'on' : '')}"></span>`).join('');
  $('wordList').innerHTML = info.w.map(w => `<span class="word-pill" data-w="${w}">${w}</span>`).join('');
  $('wordList').querySelectorAll('.word-pill').forEach(el => {
    el.onclick = () => { SFX.tap(); speakWord(el.dataset.w); };
  });
  $('charCard').onclick = () => { SFX.tap(); speakChar(c); };
  setupTrace();
  // 象形演示：图画先出现，汉字再「长」出来
  if (info.x) {
    $('bigChar').style.opacity = '0';
    $('bigChar').style.transform = 'scale(.3)';
    $('bigChar').style.transition = 'all .45s cubic-bezier(.2,1.5,.5,1)';
    setTimeout(() => {
      $('bigChar').style.opacity = '1'; $('bigChar').style.transform = 'scale(1)';
      speakChar(c);
    }, 780);
  } else {
    $('bigChar').style.opacity = '1'; $('bigChar').style.transform = 'scale(1)';
    setTimeout(() => speakChar(c), 220);
  }
}
function setupTrace() {
  const cv = $('traceCanvas'), ctx = cv.getContext('2d');
  ctx.clearRect(0, 0, 300, 300);
  ctx.strokeStyle = 'rgba(225,165,95,.38)'; ctx.lineWidth = 2; ctx.setLineDash([6, 5]);
  [[150, 0, 150, 300], [0, 150, 300, 150], [0, 0, 300, 300], [300, 0, 0, 300]].forEach(l => {
    ctx.beginPath(); ctx.moveTo(l[0], l[1]); ctx.lineTo(l[2], l[3]); ctx.stroke();
  });
  ctx.setLineDash([]);
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
  const b = BOOKS[F.book];
  $('readTitle').textContent = `📖 我自己读 · 第 ${F.book + 1} 本`;
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
  $('bookFoot').textContent = '✨ 这些字你都认识啦，自己读一遍吧！';
}

/* ---------------- 通关结算 & 奖状 ---------------- */
function finishBook() {
  const b = BOOKS[F.book];
  let gained = 0;
  b.chars.forEach(c => { if (!S.gems.includes(c)) { S.gems.push(c); gained++; } });
  if (!S.done.includes(F.book)) S.done.push(F.book);
  S.stars += 5 + F.learnChars.length * 2 + gained;
  S.unlocked = Math.max(S.unlocked, Math.min(BOOKS.length - 1, F.book + 1));
  S.best = Math.max(S.best, F.combo);
  save(); updateChips(); confetti(22); SFX.win();
  F.gained = gained;
}
function renderAward() {
  const b = BOOKS[F.book];
  const last = F.book === BOOKS.length - 1;
  $('awardTitle').textContent = last ? '👑 你登上汉字山啦！' : `🎉 获得「${b.badge}」`;
  $('awardGems').innerHTML = b.chars.map((c, i) =>
    `<div class="gem-mini" style="animation-delay:${i * .09}s" title="${c}"></div>`).join('');
  $('awardNext').textContent = last ? '🏆 看看我的宝石' : '下一站 →';
  drawCert();
}
function drawCert() {
  const cv = $('certCanvas'), g = cv.getContext('2d');
  const b = BOOKS[F.book];
  g.fillStyle = '#fffaf0'; g.fillRect(0, 0, 1000, 660);
  g.strokeStyle = '#e8bd5c'; g.lineWidth = 16; g.strokeRect(24, 24, 952, 612);
  g.strokeStyle = '#f4d999'; g.lineWidth = 3; g.strokeRect(44, 44, 912, 572);
  g.fillStyle = '#fff3d0'; g.beginPath(); g.arc(500, 130, 74, 0, Math.PI * 2); g.fill();
  g.font = '70px serif'; g.textAlign = 'center'; g.fillText('🐑', 500, 155);
  g.fillStyle = '#b4761d'; g.font = 'bold 54px KaiTi,STKaiti,serif';
  g.fillText('阅 读 小 勇 士 奖 状', 500, 258);
  g.fillStyle = '#6b5630'; g.font = '30px KaiTi,STKaiti,serif';
  g.fillText(`恭喜你读完 ${b.book}`, 500, 322);
  g.fillText(`在「${b.zone}」认识了 ${b.chars.length} 个汉字宝石`, 500, 370);
  g.fillStyle = '#2f3b6e'; g.font = 'bold 46px KaiTi,STKaiti,serif';
  g.fillText(b.chars.join('  '), 500, 440);
  g.fillStyle = '#a0793d'; g.font = '24px "Microsoft YaHei",sans-serif';
  g.fillText(`徽章：${b.badge}　·　已收集 ${S.gems.length} / 60 颗宝石　·　⭐ ${S.stars}`, 500, 510);
  g.fillStyle = '#9a8a68'; g.font = '20px "Microsoft YaHei",sans-serif';
  g.fillText(new Date().toLocaleDateString('zh-CN') + '　小羊上山 · 汉字山能量大冒险', 500, 578);
  g.font = '40px serif'; g.fillText('⭐', 150, 560); g.fillText('⭐', 850, 560);
}

/* ---------------- 图鉴 / 家长 ---------------- */
function renderDex() {
  $('dexSub').textContent = `已点亮 ${S.gems.length} / 60 颗 · 点亮的宝石可以点一下听发音`;
  $('dexGrid').innerHTML = BOOKS.flatMap(b => b.chars).map(c => {
    const got = S.gems.includes(c);
    return `<div class="dex-cell ${got ? 'got' : ''}" data-c="${got ? c : ''}">${got ? c : '·'}</div>`;
  }).join('');
  $('dexGrid').querySelectorAll('.dex-cell.got').forEach(el => {
    el.onclick = () => { SFX.tap(); speakChar(el.dataset.c);
      floatText(el.dataset.c, innerWidth / 2, innerHeight / 2, '#ffe06a'); };
  });
}
function renderParent() {
  $('parentNote').innerHTML = `
    <b>这套游戏按什么编的？</b><br>
    严格依据《小羊上山儿童汉语分级读物》<b>第 1 级 60 个核心字</b>，按 10 册分成 10 个登山站点。
    每册的词语、绘本短句<b>只使用本册及之前学过的字</b>——这是分级读物最核心的编写原则，
    孩子认完几个新字就能自己读完一页，成就感才是坚持下来的动力。<br><br>
    <b>一关怎么玩（约 5 分钟）</b><br>
    ① <b>认字</b>：图画变汉字 → 真人发音 → 组词 → 手指描红（不考笔顺，重在参与）<br>
    ② <b>玩 2 个小游戏</b>：抢宝石 / 敲迷雾怪 / 谁不见了 / 对对碰 / 词语拼拼乐，逐关轮换<br>
    ③ <b>自己读</b>：点单字听发音，点整句听小羊朗读，读完领一张可保存的奖状<br><br>
    <b>参考了哪些识字产品的做法</b><br>
    悟空识字的「剧情闯关 + 象形演示」、洪恩识字的「玩认练写闭环 + 每几字一复习」、
    叫叫识字的「每天 6 字 + 次日复习」、以及教材配套的「字卡游戏 / 读后小游戏 / 荣誉证书」。
    针对 5 岁男孩加入了怪兽、宝石收集、连击、即时音效和登山进度。<br><br>
    <b>发音说明</b><br>
    60 个单字是仓库自带的真人录音，<b>离线也能听</b>；其余音效由浏览器合成。
    首次点击页面会解锁声音，右下角 🔊 可静音。进度自动保存在本机浏览器里。<br><br>
    <b>建议</b>：每天 1 站，读完请真的夸一句。孩子卡住时别直接报答案，陪他再点一次喇叭。`;
}

/* ---------------- 顶栏 / 按钮 ---------------- */
function bindUI() {
  $('startBtn').onclick = () => { unlockAudio(); SFX.tap(); goMap(); };
  $('dexHomeBtn').onclick = () => { unlockAudio(); renderDex(); show('dex'); F.dexFrom = 'home'; };
  $('dexBtn').onclick = () => { unlockAudio(); renderDex(); show('dex'); F.dexFrom = F.stage; };
  $('dexBack').onclick = () => { show(F.dexFrom === 'home' ? 'home' : 'map'); };
  $('homeBtn').onclick = () => { show('home'); };
  $('muteBtn').onclick = () => { S.mute = !S.mute; save(); updateChips(); if (!S.mute) { unlockAudio(); SFX.right(); } };
  $('parentBtn').onclick = () => { renderParent(); show('parent'); };
  $('parentBack').onclick = () => show('home');
  $('storyGo').onclick = () => { unlockAudio(); SFX.tap(); goLearn(); };
  $('learnBack').onclick = () => { renderLearn(); };
  $('learnNext').onclick = () => {
    SFX.tap();
    if (F.traced) { S.stars += 1; save(); updateChips(); }
    F.learnIdx++;
    if (F.learnIdx >= F.learnChars.length) goGame(); else renderLearn();
  };
  $('readDone').onclick = () => { unlockAudio(); goAward(); };
  $('certDown').onclick = () => {
    const a = document.createElement('a');
    a.download = `小羊上山-第${F.book + 1}站奖状.png`;
    a.href = $('certCanvas').toDataURL('image/png'); a.click(); SFX.tap();
  };
  $('awardNext').onclick = () => {
    if (F.book === BOOKS.length - 1) { renderDex(); F.dexFrom = 'home'; show('dex'); }
    else goMap();
  };
  $('resetBtn').onclick = () => {
    if (!confirm('确定清空所有进度，从头开始吗？')) return;
    S = {...DEFAULT, done: [], gems: []}; save(); updateChips(); renderDex(); SFX.page();
  };
}
