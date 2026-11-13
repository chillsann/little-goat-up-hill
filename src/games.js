/* =====================================================================
   小羊上山 · 5 种识字小游戏（逐册轮换，参考字卡游戏与主流识字 App）
   ===================================================================== */
const QCOUNT = {gem: 5, whack: 5, missing: 4, match: 1, build: 5};
const PRAISE = ['太棒了！', '好厉害！', '答对啦！', '超级棒！', '你真神！', '完全正确！'];

/* 高年级累计字表很大，出题优先用最近学过的字，避免一上来考 300 字前的冷门字 */
const GP = () => (F.recent && F.recent.length >= 6) ? F.recent : F.pool;
function distractors(correct, n, exclude = []) {
  const pool = GP().filter(c => c !== correct && !exclude.includes(c));
  return shuffle(pool).slice(0, n);
}
function updateCombo() {
  const chip = $('comboChip');
  chip.textContent = `🔥 连击 ×${F.combo}`;
  chip.classList.toggle('on', F.combo >= 2);
  S.best = Math.max(S.best || 0, F.combo);
}
function onRight(el) {
  if (F.locked) return;              // 防止小朋友连点把题目跳过去
  F.locked = true;
  if (el) el.classList.add('right');
  SFX.right();
  F.combo++;
  S.stars += 2 + Math.min(F.combo, 5);
  updateCombo(); save(); updateChips();
  floatText(F.combo >= 3 ? `连击 ×${F.combo}!` : pick(PRAISE),
    innerWidth / 2, innerHeight * .45, F.combo >= 3 ? '#ff9a3c' : '#ffd34a');
  if (F.combo >= 3) SFX.combo();
  const type = F.games[F.gi];
  F.q++;
  setTimeout(() => {
    if (F.q >= QCOUNT[type]) gameDone(); else renderGame();
  }, FX(800));
}
function onWrong(el, msg) {
  if (el) { el.classList.add('wrong'); setTimeout(() => el.classList.remove('wrong'), 420); }
  SFX.wrong(); F.combo = 0; updateCombo();
  $('gameMsg').className = 'msg bad';
  $('gameMsg').textContent = msg || '再听一次，你可以的！💪';
  setTimeout(() => { $('gameMsg').className = 'msg'; }, FX(1400));
}
function gameDone() {
  F.gi++; F.q = 0;
  if (F.gi >= F.games.length) { confetti(14); goRead(); }
  else renderGame();
}
function renderGame() {
  F.locked = false;
  const type = F.games[F.gi];
  const g = GAMES[type];
  $('gameTitle').textContent = `${g.emo} ${g.name}（第 ${F.gi + 1}/2 关）`;
  $('gameTip').textContent = g.tip;
  $('gameMsg').textContent = '';
  $('gameDots').innerHTML = Array.from({length: QCOUNT[type]}, (_, i) =>
    `<span class="pdot ${i < F.q ? 'done' : (i === F.q ? 'on' : '')}"></span>`).join('');
  updateCombo();
  ({gem: renderGem, whack: renderWhack, missing: renderMissing, match: renderMatch, build: renderBuild})[type]();
}
function listenBlock(correct, label) {
  return `<div class="listen-btn" id="bigListen">🔊</div>
    <div class="hint" style="margin:-4px auto 10px">${label || '点喇叭再听一次'}</div>`;
}
function bindListen(correct) {
  const b = $('bigListen');
  if (b) b.onclick = () => { unlockAudio(); SFX.tap(); b.classList.add('playing'); speakChar(correct).then(() => b.classList.remove('playing')); };
  setTimeout(() => { if (F.stage === 'game') speakChar(correct); }, FX(320));
}

/* ---------- ① 抢汉字宝石：听音选字 ---------- */
function renderGem() {
  const correct = pick(F.pool);
  const opts = shuffle([correct, ...distractors(correct, 3)]);
  F.plan = {type: 'one', selectors: [`[data-val="${correct}"]`]};
  $('gameArea').innerHTML = listenBlock(correct) +
    `<div class="tile-grid" id="gemGrid">` +
    opts.map(c => `<div class="tile gem-tile" data-val="${c}">${c}</div>`).join('') + `</div>`;
  $('gemGrid').querySelectorAll('.tile').forEach(el => {
    el.onclick = () => el.dataset.val === correct ? onRight(el) : onWrong(el, '不是这个哦，再听一听！');
  });
  bindListen(correct);
}

/* ---------- ② 敲跑迷雾怪：听音敲对的字牌 ---------- */
function renderWhack() {
  const correct = pick(F.pool);
  const need = Math.min(5, Math.max(3, F.pool.length - 1));
  const others = distractors(correct, need);
  const opts = shuffle([correct, ...others]);
  F.plan = {type: 'one', selectors: [`[data-val="${correct}"]`]};
  $('gameArea').innerHTML = listenBlock(correct, '听到哪个字，就敲举着那个字的小怪兽！') +
    `<div class="whack-grid" id="whackGrid">` + opts.map(c => `
      <div class="hole"><div class="monster up" data-val="${c}">
        <div class="monster-body"><i class="monster-eye l"></i><i class="monster-eye r"></i></div>
        <div class="monster-sign">${c}</div>
      </div></div>`).join('') + `</div>`;
  $('whackGrid').querySelectorAll('.monster').forEach(el => {
    el.onclick = () => {
      if (el.dataset.val === correct) { el.classList.add('hit'); SFX.whoosh(); onRight(null); }
      else { el.classList.add('hit'); onWrong(null, '敲错啦，听听是哪个字！'); }
    };
  });
  bindListen(correct);
}

/* ---------- ③ 谁不见了：字卡记忆（教材配套字卡游戏） ---------- */
function renderMissing() {
  const cards = shuffle(GP()).slice(0, 4);
  const hidden = pick(cards);
  const options = shuffle([hidden, ...distractors(hidden, 3, cards)]);
  F.plan = {type: 'one', selectors: [`[data-val="${hidden}"]`]};
  $('gameArea').innerHTML = `
    <div class="hint">👀 记住这 4 个字，等一下有一个会偷偷跑掉！</div>
    <div class="memory-row" id="memRow">${cards.map((c, i) =>
      `<div class="mem-card" data-c="${c}" data-i="${i}">${c}</div>`).join('')}</div>
    <div id="memAsk" style="display:none">
      <p class="sub" style="margin:2px">谁不见了？把跑掉的字找出来！</p>
      <div class="tile-grid" id="memOpts">${options.map(c =>
        `<div class="tile" data-val="${c}">${c}</div>`).join('')}</div>
    </div>`;
  const row = $('memRow');
  const reveal = () => {
    row.querySelectorAll('.mem-card').forEach(el => {
      const gone = el.dataset.c === hidden;
      el.classList.toggle('covered', gone);
      el.textContent = gone ? '' : el.dataset.c;
    });
    const ask = $('memAsk'); ask.style.display = 'block';
    ask.querySelectorAll('.tile').forEach(el => {
      el.onclick = () => el.dataset.val === hidden ? onRight(el) : onWrong(el, '再想想，刚才哪个字不见啦？');
    });
    speakChar(hidden);
  };
  setTimeout(() => {
    if (F.stage !== 'game') return;
    row.querySelectorAll('.mem-card').forEach(el => el.classList.add('covered'));
    setTimeout(reveal, FX(500));
  }, FX(2300));
  // 展示阶段逐字读一遍
  cards.forEach((c, i) => setTimeout(() => { if (F.stage === 'game') speakChar(c); }, FX(260 + i * 430)));
}

/* ---------- ④ 汉字对对碰：字 ↔ 图画翻牌 ---------- */
function renderMatch() {
  const chars = shuffle(GP()).slice(0, Math.min(6, GP().length));
  const cards = shuffle(chars.flatMap(c => [
    {k: c, t: 'char', v: c}, {k: c, t: 'pic', v: CHARS[c].e}
  ]));
  F.plan = {type: 'match', selectors: chars.map(c =>
    cards.flatMap((x, i) => x.k === c ? [`[data-idx="${i}"]`] : []))};
  $('gameArea').innerHTML = `
    <div class="hint">🃏 翻开两张：一个汉字，配它的图画！</div>
    <div class="match-grid" id="matchGrid">${cards.map((x, i) =>
      `<div class="match-card" data-idx="${i}" data-k="${x.k}" data-t="${x.t}"><span style="opacity:.5">?</span></div>`).join('')}</div>`;
  let first = null, matched = 0, lock = false;
  $('matchGrid').querySelectorAll('.match-card').forEach(el => {
    el.onclick = () => {
      if (lock || el.classList.contains('flip') || el.classList.contains('matched')) return;
      unlockAudio(); SFX.tap();
      const x = cards[+el.dataset.idx];
      el.classList.add('flip'); el.innerHTML = x.v;
      if (!first) { first = el; speakChar(x.t === 'char' ? x.k : x.k); return; }
      const y = cards[+first.dataset.idx];
      if (first !== el && x.k === y.k && x.t !== y.t) {
        first.classList.add('matched'); el.classList.add('matched');
        first = null; matched++;
        SFX.gem(); speakChar(x.k);
        if (matched === chars.length) {
          $('gameMsg').textContent = '🎉 全部配对成功！';
          setTimeout(() => onRight(null), FX(700));
        }
      } else {
        lock = true; SFX.wrong();
        const a = first, b = el; first = null;
        setTimeout(() => {
          a.classList.remove('flip'); a.innerHTML = '<span style="opacity:.5">?</span>';
          b.classList.remove('flip'); b.innerHTML = '<span style="opacity:.5">?</span>';
          lock = false;
        }, FX(720));
      }
    };
  });
}

/* ---------- ⑤ 词语拼拼乐：把两个字拼成一个词 ---------- */
function renderBuild() {
  const valid = WORDS.filter(w => w.length === 2 && w[0] !== w[1] && [...w].every(c => F.pool.includes(c)));
  const word = pick(valid.length ? valid : ['上山']);
  const tiles = shuffle([...word, ...distractors(word[0], 4, [...word])]);
  F.plan = {type: 'build', selectors: [...word].map(c => `[data-val="${c}"]`)};
  $('gameArea').innerHTML = `
    <div class="listen-btn" id="bigListen">🔊</div>
    <div class="hint">🀄 听一听「${word}」这个词，把两个字找出来放进去！</div>
    <div class="build-slots" id="slots"><div class="slot"></div><div class="slot"></div></div>
    <div class="build-pool" id="pool">${tiles.map(c =>
      `<div class="pool-tile" data-val="${c}">${c}</div>`).join('')}</div>`;
  let filled = [];
  $('pool').querySelectorAll('.pool-tile').forEach(el => {
    el.onclick = () => {
      if (filled.length >= 2) return;
      unlockAudio(); SFX.tap();
      el.classList.add('used');
      filled.push(el.dataset.val);
      const slot = $('slots').children[filled.length - 1];
      slot.textContent = el.dataset.val; slot.classList.add('filled');
      speakChar(el.dataset.val);
      if (filled.length === 2) {
        const got = filled.join('');
        if (got === word) {
          $('gameMsg').textContent = `✅ ${word}！`;
          speakWord(word); onRight(null);
        } else {
          onWrong(null, `「${got}」不是这个词，再试一次！`);
          setTimeout(() => {
            filled = [];
            $('pool').querySelectorAll('.pool-tile').forEach(x => x.classList.remove('used'));
            [...$('slots').children].forEach(s => { s.textContent = ''; s.classList.remove('filled'); });
          }, FX(700));
        }
      }
    };
  });
  $('bigListen').onclick = () => { unlockAudio(); SFX.tap(); speakWord(word); };
  setTimeout(() => { if (F.stage === 'game') speakWord(word); }, FX(420));
}

/* ---------------- 自动化测试接口（不影响正常游玩） ---------------- */
window.__test = {
  state: () => ({level: S.level, book: F.book, stage: F.stage, gi: F.gi, q: F.q,
    type: F.games[F.gi] || null, combo: F.combo, gems: S.gems.length,
    stars: S.stars, done: prog().done.slice(), unlocked: prog().unlocked,
    echo: F.echo ? F.echo.checked.slice() : []}),
  plan: () => F.plan || null,
  setLevel: l => { setLevel(l); },
  levels: () => LEVELS.map(l => ({level: l.level, chars: l.chars.length, total: l.total})),
  voice: () => voiceInfo(),
};
