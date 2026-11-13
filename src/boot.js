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

/* 跟读全文关卡自检 */
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
  for (let i = 0; i < lines; i++) {
    const b = document.querySelector(`button.mini[data-act="ok"][data-i="${i}"]`);
    if (b) b.click();
  }
  const checked = F.echo.checked.filter(Boolean).length;
  const rec = !!(navigator.mediaDevices && window.MediaRecorder);
  const ok = lines === cards && checked === lines && errs.length === 0;
  const t = `ECHOTEST_${ok ? 'OK' : 'FAIL'} level=${lvl} lines=${lines} cards=${cards} `
    + `checked=${checked} recorder=${rec ? 'yes' : 'no'} voice=${voiceInfo().tts ? 'zh' : 'none'} err=${errs.length} ${errs.slice(0, 2).join('|')}`;
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

function boot() {
  if (qs.has('nofx')) document.body.classList.add('nofx');
  initSky(); updateChips(); bindUI();
  if (qs.has('layout')) layoutDebug();
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
