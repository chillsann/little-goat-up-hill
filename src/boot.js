/* =====================================================================
   启动 / 预览 / 自检入口
   ===================================================================== */
const qs = new URLSearchParams(location.search);

function preview(p) {
  const type = qs.get('type') || 'gem';
  if (p === 'map') { renderMap(); show('map'); }
  else if (p === 'story') startBook(0);
  else if (p === 'learn') { startBook(4); goLearn(); }
  else if (p === 'game') {
    startBook(4); F.games = [GAMES[type] ? type : 'gem']; F.gi = 0; F.q = 0;
    F.pool = learnedChars(4); renderGame(); show('game');
  }
  else if (p === 'read') { startBook(1); goRead(); }
  else if (p === 'award') { startBook(0); F.stage = 'award'; finishBook(); renderAward(); show('award'); }
  else if (p === 'dex') {
    S.gems = BOOKS.flatMap(b => b.chars).slice(0, 26);
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
    renderMap(); renderDex(); renderParent();
    [0, 4, 9].forEach(i => { startBook(i); goLearn(); renderRead(); finishBook(); renderAward(); });
    startBook(4);
    ['gem', 'whack', 'missing', 'match', 'build'].forEach(t => {
      F.games = [t]; F.gi = 0; F.q = 0; F.pool = learnedChars(4);
      renderGame();
    });
    const t = `SMOKE_OK err=${errs.length} gems=${S.gems.length} stars=${S.stars} ${errs.join('|')}`;
    document.title = t; $('testOut').textContent = t;
  } catch (e) {
    const t = 'SMOKE_FAIL ' + (e.stack || e.message);
    document.title = t; $('testOut').textContent = t;
  }
}

/* 页面内全流程自测：真实驱动 DOM 点击，跑完 10 册 */
function autotest() {
  const errs = [];
  window.addEventListener('error', e => errs.push(e.message));
  document.body.classList.add('nofx');
  localStorage.removeItem(KEY); S = loadSave(); updateChips();
  unlockAudio();
  const gameTypes = new Set(), booksSeen = new Set();
  let loops = 0;
  const report = (ok, msg) => {
    const audio = AC ? AC.state : 'no-ctx';
    const t = `AUTOTEST_${ok ? 'OK' : 'FAIL'} ${msg} books=${booksSeen.size} `
      + `games=${[...gameTypes].join(',')} audio=${audio} err=${errs.length} ${errs.slice(0, 2).join('|')}`;
    document.title = t; $('testOut').textContent = t;
  };
  const tick = () => {
    if (++loops > 30000) return report(false, 'timeout');
    const scr = document.querySelector('.screen.on').id;
    booksSeen.add(F.book);
    if (scr === 'scr-home') $('startBtn').click();
    else if (scr === 'scr-map') {
      const n = document.querySelector('.node.cur') || document.querySelector('.node:not(.lock):not(.done)');
      if (n) n.click();
      else return report(true, `gems=${S.gems.length} stars=${S.stars} done=${S.done.length}`);
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
    else if (scr === 'scr-read') $('readDone').click();
    else if (scr === 'scr-award') $('awardNext').click();
    else if (scr === 'scr-dex') return report(true, `gems=${S.gems.length} stars=${S.stars} done=${S.done.length}`);
    setTimeout(tick, 55);
  };
  tick();
}

/* 真人 MP3 发音链路自检 */
function audioTest() {
  const chars = ['山', '马', '月', '我'];
  let ok = 0, fail = 0;
  const bad = [];
  const check = () => {
    if (ok + fail < chars.length) return;
    unlockAudio();
    const t = `AUDIOTEST_OK mp3=${ok}/${chars.length} ctx=${AC ? AC.state : 'none'} ${bad.join(',')}`;
    document.title = t; $('testOut').textContent = t;
  };
  chars.forEach(c => {
    const a = new Audio('audio/' + encodeURIComponent(c) + '.mp3');
    a.addEventListener('canplaythrough', () => { ok++; check(); });
    a.addEventListener('error', () => { fail++; bad.push(c + ':ERR'); check(); });
    a.load();
  });
  setTimeout(() => {
    if (!document.title.startsWith('AUDIOTEST')) {
      const t = `AUDIOTEST_PARTIAL mp3=${ok}/${chars.length} ctx=${AC ? AC.state : 'none'}`;
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
      app: r('#app'), frame: r('.frame'), screen: r('.screen.on'), topbar: r('.topbar'),
      homeBtns: r('.home-btns'), panel: r('.home-panel'),
      learnMain: r('.learn-main'), charCard: r('.char-card'), side: r('.side-card'),
      trace: r('.trace-wrap'), hint: r('.hint'), dexGrid: r('.dex-grid')
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
  if (qs.has('autotest')) autotest();
  else if (qs.has('smoke')) smoke();
  else if (qs.has('preview')) preview(qs.get('preview'));
  else {
    show('home');
    if (S.gems.length) $('homeTip').textContent = `已收集 ${S.gems.length} / 60 颗汉字宝石 · 继续加油！`;
  }
}
boot();
