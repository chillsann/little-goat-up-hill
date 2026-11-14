/* =====================================================================
   启动 / 预览 / 自检入口
   ===================================================================== */
const qs = new URLSearchParams(location.search);

function preview(p) {
  const type = qs.get('type') || 'gem';
  const lvl = Math.min(6, Math.max(1, +(qs.get('level') || 1)));
  setLevel(lvl);
  if (p === 'levels') { renderLevels(); show('levels'); }
  else if (p === 'map') { renderMap(); show('map'); }
  else if (p === 'story') startBook(0);
  else if (p === 'learn') { startBook(4); goLearn(); }
  else if (p === 'game') {
    startBook(4); F.games = [GAMES[type] ? type : 'gem']; F.gi = 0; F.q = 0;
    F.pool = learnedChars(4); F.recent = F.pool.slice(-22);
    renderGame(); show('game');
  }
  else if (p === 'read') { startBook(1); goRead(); }
  else if (p === 'echo') { startBook(1); goEcho(); }
  else if (p === 'award') { startBook(0); F.stage = 'award'; finishBook(); renderAward(); show('award'); }
  else if (p === 'dex') {
    S.gems = ALL_CHARS.slice(0, 136);
    updateChips();
    F.dexFrom = 'home'; renderDex(); show('dex');
  }
  else if (p === 'trace') openChar(qs.get('char') || '上');
  else if (p === 'parent') { renderParent(); show('parent'); }
  else show('home');
}

function smoke() {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  try {
    renderLevels(); renderMap(); renderDex(); renderParent();
    let echoLines = 0;
    for (let l = 1; l <= 6; l++) {
      setLevel(l);
      [0, 4, 9].forEach(i => {
        startBook(i); goLearn(); renderRead(); goEcho();
        echoLines += document.querySelectorAll('.echo-line').length;
        finishBook(); renderAward();
      });
      startBook(4);
      ['gem', 'whack', 'missing', 'match', 'build'].forEach(t => {
        F.games = [t]; F.gi = 0; F.q = 0;
        F.pool = learnedChars(4); F.recent = F.pool.slice(-22);
        renderGame();
      });
    }
    const t = `SMOKE_OK levels=6 books=60 echoLines=${echoLines} err=${errs.length} gems=${S.gems.length} ${errs.join('|')}`;
    document.title = t; $('testOut').textContent = t;
  } catch (e) {
    const t = 'SMOKE_FAIL ' + (e.stack || e.message);
    document.title = t; $('testOut').textContent = t;
  }
}

/* 页面内全流程自测：真实驱动 DOM 点击，跑完 1 个级别或全部 6 级 */
function autotest() {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  document.body.classList.add('nofx');
  localStorage.removeItem(KEY); S = loadSave(); updateChips();
  unlockAudio();
  const all = qs.has('all');
  let curLevel = Math.min(6, Math.max(1, +(qs.get('level') || 1)));
  const gameTypes = new Set(), booksSeen = new Set(), levelsSeen = new Set();
  let loops = 0;
  const report = (ok, msg) => {
    const audio = AC ? AC.state : 'no-ctx';
    const t = `AUTOTEST_${ok ? 'OK' : 'FAIL'} ${msg} levels=${[...levelsSeen].join(',')} books=${booksSeen.size} `
      + `games=${[...gameTypes].join(',')} audio=${audio} err=${errs.length} ${errs.slice(0, 2).join('|')}`;
    document.title = t; $('testOut').textContent = t;
  };
  const tick = () => {
    if (++loops > 120000) return report(false, 'timeout');
    const scr = document.querySelector('.screen.on').id;
    booksSeen.add(`${curLevel}-${F.book}`);
    if (scr === 'scr-home') $('startBtn').click();
    else if (scr === 'scr-levels') {
      const finished = prog(curLevel).done.length >= 10;
      if (finished) {
        if (all && curLevel < 6) curLevel++;
        else return report(true, `gems=${S.gems.length} stars=${S.stars} done=${prog(curLevel).done.length} echo=${prog(curLevel).echo.length}`);
      }
      levelsSeen.add(curLevel);
      const card = document.querySelector(`.level-card[data-l="${curLevel}"]`);
      if (card) card.click(); else return report(false, 'level card missing');
    }
    else if (scr === 'scr-map') {
      const n = document.querySelector('.node.cur') || document.querySelector('.node:not(.lock):not(.done)');
      if (n) n.click();
      else return report(true, `gems=${S.gems.length} done=${prog(curLevel).done.length}`);
    }
    else if (scr === 'scr-story') $('storyGo').click();
    else if (scr === 'scr-learn') $('learnNext').click();
    else if (scr === 'scr-game') {
      const type = F.games[F.gi], plan = F.plan;
      gameTypes.add(type);
      if (plan && plan.type === 'match') {
        const busy = document.querySelector('.match-card.flip:not(.matched)');
        const un = [...document.querySelectorAll('.match-card:not(.matched)')];
        if (!busy && un.length) {
          const k = un[0].dataset.k;
          const pair = un.filter(c => c.dataset.k === k);
          if (pair.length === 2) { pair[0].click(); pair[1].click(); }
        }
      } else if (plan && type === 'missing') {
        const ask = $('memAsk');
        if (ask && ask.style.display === 'block') {
          const el = document.querySelector(plan.selectors[0]); if (el) el.click();
          F.plan = {type: 'wait', selectors: []};
        }
      } else if (plan && plan.type !== 'wait' && plan.selectors.length) {
        const el = document.querySelector(plan.selectors[0]);
        if (el) el.click();
        F.plan = {type: plan.selectors.length > 1 ? plan.type : 'wait',
                  selectors: plan.selectors.slice(1)};
      }
    }
    else if (scr === 'scr-read') $('readEcho').click();
    else if (scr === 'scr-echo') $('echoDone').click();
    else if (scr === 'scr-award') $('awardNext').click();
    else if (scr === 'scr-dex') return report(true, `gems=${S.gems.length} stars=${S.stars}`);
    setTimeout(tick, all ? 18 : 40);
  };
  tick();
}

/* 跟读全文关卡自检：同时验证「没录音不能过关」和「设备不支持时的降级通道」 */
function echotest() {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  document.body.classList.add('nofx');
  const lvl = Math.min(6, Math.max(1, +(qs.get('level') || 1)));
  setLevel(lvl);
  startBook(0); goEcho();
  const lines = BOOKS[0].story.length;
  const cards = document.querySelectorAll('.echo-line').length;
  $('echoAll').click();
  /* ① 门控：本机能录音时，一句都没录，点「领奖状」必须被拦住 */
  const canRec = recSupported();
  let gated = true;
  if (canRec) {
    F.micOK = true;
    $('echoDone').click();
    gated = F.stage === 'echo' && !F.echo.checked.some(Boolean);
  }
  /* ② 降级通道：麦克风不可用时，逐句点「读好啦」仍能全部打卡 */
  F.micOK = false;
  for (let i = 0; i < lines; i++) {
    const b = document.querySelector(`button.mini[data-act="ok"][data-i="${i}"]`);
    if (b) b.click();
  }
  const checked = F.echo.checked.filter(Boolean).length;
  const ok = lines === cards && checked === lines && gated && errs.length === 0;
  const t = `ECHOTEST_${ok ? 'OK' : 'FAIL'} level=${lvl} lines=${lines} cards=${cards} `
    + `checked=${checked} gated=${gated ? 'yes' : 'NO'} recorder=${canRec ? 'yes' : 'no'} `
    + `voice=${voiceInfo().tts ? 'zh' : 'none'} err=${errs.length} ${errs.slice(0, 2).join('|')}`;
  document.title = t; $('testOut').textContent = t;
}

/* 真人 MP3 发音链路 + 中文语音自检 */
function audioTest() {
  const chars = ['山', '马', '月', '我'];
  let ok = 0, fail = 0, ttsCalls = 0;
  const bad = [];
  const check = () => {
    if (ok + fail < chars.length) return;
    unlockAudio();
    const v = voiceInfo();
    // 找一个没有真人录音的字，确认会自动走中文语音；再测整句连读
    const noMp3 = ALL_CHARS.find(c => !MP3_CHARS.has(c)) || '人';
    if ('speechSynthesis' in window) {
      try {
        const orig = speechSynthesis.speak.bind(speechSynthesis);
        speechSynthesis.speak = u => { ttsCalls++; return orig(u); };
      } catch (e) { bad.push('hook:ERR'); }
    }
    Promise.resolve()
      .then(() => speakChar(noMp3))
      .then(() => speakSentence('小羊上山，自己读书。'))
      .then(() => {
        const t = `AUDIOTEST_OK mp3=${ok}/${chars.length} mp3chars=${v.mp3}/${v.total} `
          + `tts=${v.tts ? 'zh' : 'none'} ttsCalls=${ttsCalls} noMp3=${noMp3} `
          + `ctx=${AC ? AC.state : 'none'} ${bad.join(',')}`;
        document.title = t; $('testOut').textContent = t;
      });
  };
  chars.forEach(c => {
    const a = new Audio('audio/' + encodeURIComponent(c) + '.mp3');
    a.addEventListener('canplaythrough', () => { ok++; check(); });
    a.addEventListener('error', () => { fail++; bad.push(c + ':ERR'); check(); });
    a.load();
  });
  setTimeout(() => {
    if (!document.title.startsWith('AUDIOTEST')) {
      const v = voiceInfo();
      const t = `AUDIOTEST_PARTIAL mp3=${ok}/${chars.length} mp3chars=${v.mp3}/${v.total} ctx=${AC ? AC.state : 'none'}`;
      document.title = t; $('testOut').textContent = t;
    }
  }, 3000);
}

function layoutDebug() {
  setTimeout(() => {
    const r = sel => {
      const e = typeof sel === 'string' ? document.querySelector(sel) : sel;
      if (!e) return null;
      const b = e.getBoundingClientRect();
      return [Math.round(b.left), Math.round(b.right), Math.round(b.width)];
    };
    const out = {
      vw: innerWidth, docW: document.documentElement.scrollWidth,
      app: r('#app'), screen: r('.screen.on'), topbar: r('.topbar'),
      levelGrid: r('.level-grid'), echoList: r('.echo-list'),
      learnMain: r('.learn-main'), trace: r('.trace-wrap'), dexGrid: r('.dex-grid')
    };
    const t = 'LAYOUT ' + JSON.stringify(out);
    document.title = t; $('testOut').textContent = t;
  }, 900);
}

/* 直接打开某个字的认字页（调试 / 截图用） */
function openChar(ch) {
  let lv = 1, bk = 0, found = false;
  LEVELS.forEach(L => L.books.forEach((b, i) => {
    if (!found && b.chars.includes(ch)) { lv = L.level; bk = i; found = true; }
  }));
  setLevel(lv); startBook(bk);
  F.learnIdx = Math.max(0, F.learnChars.indexOf(ch));
  F.stage = 'learn'; renderLearn(); show('learn');
}

/* 描红自检：验证「一笔不算完成、逐笔描完才算」以及「乱画不认」 */
function tracetest() {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  const ch = qs.get('char') || '上';
  openChar(ch);
  const d = STROKES[ch];
  const n = d ? d.s.length : 0;
  const feed = pts => window.__traceFeed(pts.map(p => trXY(p)));
  const clear = () => { $('traceClear').click(); };

  /* ① 只描第 1 笔 → 不能算完成 */
  clear();
  if (d && d.m[0]) feed(d.m[0]);
  const one = window.__traceInfo();

  /* ② 补完剩下的笔画 → 全部完成 */
  if (n > 1) for (let i = 1; i < n; i++) feed(d.m[i]);
  const all = window.__traceInfo();

  /* ③ 乱画（左上角随手拐几笔）→ 不能认 */
  clear();
  window.__traceFeed([[28, 28], [55, 36], [78, 30], [48, 52]]);
  const junk = window.__traceInfo();

  const oneOk = n <= 1 ? (one.traced && one.kept === 1) : (!one.traced && one.kept === 1);
  /* 乱画的目标是「不能靠乱画过关」，短横点有可能落在第一个点的位置上，只看是否被判定完成 */
  const ok = oneOk && all.traced && all.kept === n && !junk.traced && errs.length === 0;
  const t = `TRACETEST_${ok ? 'OK' : 'FAIL'} char=${ch} strokes=${n} `
    + `oneStrokeTraced=${one.traced ? 'YES' : 'no'} kept1=${one.kept} `
    + `allTraced=${all.traced ? 'yes' : 'NO'} keptAll=${all.kept} `
    + `junkTraced=${junk.traced ? 'YES' : 'no'} err=${errs.length} ${errs.slice(0, 2).join('|')}`;
  document.title = t; $('testOut').textContent = t;
}

/* 容错度批量测试：给 390 个字喂「手抖版」理想笔迹，统计通过率（调阈值时用） */
function tracebench() {
  let seed = 20261114;
  const rnd = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
  const jit = (amt) => (rnd() * 2 - 1) * amt;
  const variants = [
    {name: 'normal', off: 6, noise: 5, trim: 0.94},
    {name: 'sloppy', off: 13, noise: 9, trim: 0.86},
  ];
  const run = (v) => {
    let pass = 0;
    const bad = [];
    for (const ch of ALL_CHARS) {
      const d = STROKES[ch]; if (!d) continue;
      $('traceChar').textContent = ch; setupTrace();
      const ox = jit(v.off), oy = jit(v.off);
      for (let i = 0; i < d.m.length && !F.traced; i++) {
        const sk = d.m[i].map(trXY);
        const a = sk[0], b = sk[sk.length - 1];
        const cx = (a[0] + b[0]) / 2, cy = (a[1] + b[1]) / 2;
        const pts = sk.map(p => [
          cx + (p[0] - cx) * v.trim + ox + jit(v.noise),
          cy + (p[1] - cy) * v.trim + oy + jit(v.noise)]);
        window.__traceFeed(pts);
      }
      if (F.traced) pass++; else bad.push(ch);
    }
    return {pass, bad};
  };
  const out = variants.map(v => ({name: v.name, ...run(v)}));
  const t = 'TRACEBENCH ' + out.map(o => `${o.name}=${o.pass}/${ALL_CHARS.length} miss=[${o.bad.slice(0, 24).join('')}]`).join(' | ');
  document.title = t; $('testOut').textContent = t;
}

function boot() {
  if (qs.has('nofx')) document.body.classList.add('nofx');
  initSky(); updateChips(); bindUI();
  if (qs.has('layout')) layoutDebug();
  if (qs.has('tracebench')) tracebench();
  if (qs.has('tracetest')) tracetest();
  if (qs.has('audiotest')) audioTest();
  if (qs.has('echotest')) echotest();
  if (qs.has('autotest')) autotest();
  else if (qs.has('smoke')) smoke();
  else if (qs.has('preview')) preview(qs.get('preview'));
  else {
    show('home');
    if (S.gems.length) $('homeTip').textContent = `已收集 ${S.gems.length} / ${TOTAL} 颗汉字宝石 · 全套 1~6 级继续加油！`;
  }
}
boot();
