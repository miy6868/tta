'use strict';
const DATA = JSON.parse(document.getElementById('quiz-data').textContent);
const KEY = 'korean-history2-1200-v2';
const LEGACY_KEY = 'korean-history2-400-v1';
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"']/g, c => ({
  '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
}[c]));
const normalize = s => String(s).normalize('NFKC').toLowerCase().replace(/×/g, 'x').replace(/[^a-z0-9가-힣]/g, '');
const stateKey = (id, round) => `${id}:${round}`;
function isCorrect(q, value) {
  return !!normalize(value) && q.answers.some(a => normalize(a) === normalize(value));
}
function validState(t) {
  return t && Array.isArray(t.answers) && t.answers.length === 20
    && t.answers.every(a => typeof a === 'string' && a.length < 1000);
}
let states = {}, current = 0, currentRound = 1, onlyWrong = false, storageOK = true;
try {
  const stored = localStorage.getItem(KEY);
  let raw = {};
  try { raw = JSON.parse(stored || '{}') || {}; } catch (_) { /* Ignore damaged records. */ }
  for (const s of DATA) {
    for (const round of s.rounds) {
      const key = stateKey(s.id, round.id), t = raw[key];
      if (validState(t)) states[key] = { answers: t.answers, graded: t.graded === true };
    }
  }
  // Migrate only on the first v2 visit, so resetting round 1 stays reset.
  if (stored === null) {
    let legacy = {};
    try { legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || '{}') || {}; } catch (_) { /* Ignore damaged legacy data. */ }
    for (const s of DATA) {
      const t = legacy[s.id];
      if (validState(t)) states[stateKey(s.id, 1)] = { answers: t.answers, graded: t.graded === true };
    }
    localStorage.setItem(KEY, JSON.stringify(states));
  }
} catch (_) { storageOK = false; }

function state(id, round = currentRound) {
  const key = stateKey(id, round);
  return states[key] || (states[key] = { answers: Array(20).fill(''), graded: false });
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(states)); } catch (_) { storageOK = false; }
}
function answered(st) { return st.answers.filter(a => a.trim()).length; }
function questions(s, round = currentRound) { return s.rounds[round - 1].questions; }
function score(s, round = currentRound) {
  return questions(s, round).reduce((n, q, i) => n + Number(isCorrect(q, state(s.id, round).answers[i])), 0);
}
function completed(s) { return s.rounds.filter(r => state(s.id, r.id).graded).length; }
function roundStatus(s, round) {
  const st = state(s.id, round), n = answered(st);
  return st.graded ? `${score(s, round)}/20 정답` : n ? `${n}/20 풀이 중` : '시작하기';
}
function renderNav() {
  let text = '';
  DATA.forEach((s, i) => {
    if (i === 0 || i === 17) text += `<div class="navgroup">${i === 0 ? 'Ⅰ 일제 식민 통치와 민족 운동' : 'Ⅱ 대한민국의 발전'}</div>`;
    text += `<button class="navbtn ${current === s.id ? 'active' : ''}" data-open="${s.id}" ${current === s.id ? 'aria-current="page"' : ''}>
      <span class="num">${String(s.id).padStart(2, '0')}</span><span>${esc(s.title.replace(/^\d+ /, ''))}</span>
      <span class="done" aria-label="${completed(s)}회차 채점 완료">${completed(s)}/3</span></button>`;
  });
  $('nav').innerHTML = text;
  $('mobile-select').innerHTML = '<option value="0">학습할 섹션 선택</option>' + DATA.map(s =>
    `<option value="${s.id}">${String(s.id).padStart(2, '0')} · ${esc(s.title.replace(/^\d+ /, ''))}</option>`).join('');
  $('mobile-select').value = String(current);
}
function saveMessage() {
  return storageOK
    ? '회차별 풀이 기록은 이 브라우저에 자동 저장됩니다. 파일 위치·브라우저를 바꾸거나 기록을 삭제하면 이어지지 않을 수 있어요.'
    : '현재 브라우저에서는 기록 저장이 제한됩니다. 페이지를 닫기 전까지는 계속 풀 수 있어요.';
}
function roundButtons(s, isQuiz = false) {
  return `<div class="rounds ${isQuiz ? 'quiz-rounds' : ''}" aria-label="${esc(s.title)} 회차 선택">${s.rounds.map(r =>
    `<button class="round-button ${isQuiz && currentRound === r.id ? 'selected' : ''}" data-open="${s.id}" data-round="${r.id}"
      ${isQuiz ? `aria-pressed="${currentRound === r.id}"` : ''}>
      <b>${r.id}회차</b><span>${esc(r.title)}</span><small>${roundStatus(s, r.id)}</small></button>`).join('')}</div>`;
}
function renderHome() {
  const finished = DATA.reduce((n, s) => n + completed(s), 0);
  $('main').innerHTML = `<div class="eyebrow">한 섹션씩, 세 번의 개념 확인</div>
    <h1>한국사 개념,<br>3회차로 완성해 볼까요?</h1>
    <p class="intro">20개 섹션마다 1~3회차, 회차당 20문제를 준비했어요. 기본 개념 확인 → 개념 연결 → 핵심 내용 쓰기로 복습해 보세요.</p>
    <div class="stats"><div class="stat"><strong>20</strong><span>학습 섹션</span></div>
      <div class="stat"><strong>1,200</strong><span>전체 문제</span></div>
      <div class="stat"><strong>${finished}<span> / 60</span></strong><span>채점한 회차</span></div></div>
    ${[0, 17].map((start, g) => `<h2 class="section-label">${g === 0 ? 'Ⅰ 일제 식민 통치와 민족 운동' : 'Ⅱ 대한민국의 발전'}</h2>
      <div class="grid">${DATA.slice(start, g === 0 ? 17 : 20).map(s =>
        `<article class="tile"><small>SECTION ${String(s.id).padStart(2, '0')} · PDF ${s.id * 2}쪽</small>
          <h3>${esc(s.title)}</h3><p class="tile-note">각 20문제 · 총 60문제</p>${roundButtons(s)}</article>`).join('')}</div>`).join('')}
    <p class="save-note">${saveMessage()}<br>기존 버전의 풀이 기록은 같은 브라우저·같은 주소에서 1회차로 이어집니다.
    <br>출처: 업로드한 「한국사2_배움책_개념정리_1-40쪽」. 인터넷 연결이나 별도 설치 없이 사용할 수 있습니다.</p>`;
  $('bottom').hidden = true;
}
function renderQuiz() {
  const s = DATA[current - 1], round = s.rounds[currentRound - 1], st = state(current);
  const points = score(s), n = answered(st);
  const visible = round.questions.map((q, i) => ({ q, i })).filter(({ q, i }) => !onlyWrong || !isCorrect(q, st.answers[i]));
  $('main').innerHTML = `<button class="back" data-home>← 전체 섹션</button>
    <div class="eyebrow">SECTION ${String(s.id).padStart(2, '0')} / 20 · ${currentRound}회차 / 3</div>
    <h1>${esc(s.title)}</h1><p class="meta">${esc(s.meta)}</p>${roundButtons(s, true)}
    <h2 class="round-heading">${currentRound}회차 · ${esc(round.title)}</h2>
    <p class="intro">${esc(round.guide)} ${currentRound !== 2 ? '짧은 답은 핵심 용어로 입력하세요. 띄어쓰기와 문장부호는 채점에 영향을 주지 않습니다.' : '보기에서 하나를 선택한 뒤 채점해 보세요.'}</p>
    <div class="progress"><i id="progress-fill" style="width:${n * 5}%"></i></div>
    <div id="progress-text" class="progress-text" aria-live="polite">${currentRound}회차 · ${n} / 20문제 응답</div>
    ${st.graded ? `<div class="result" tabindex="-1" id="result" role="status"><div>${currentRound}회차 결과</div>
      <strong>${points} / 20 정답</strong><p>${points * 5}점 · 오답 ${20 - points}개${20 - n ? ' (미응답 ' + (20 - n) + '개 포함)' : ''}</p>
      <p>정답과 해설을 확인한 후, 다른 회차나 다시 풀기로 복습해 보세요.</p></div>` : ''}
    <div class="toolbar">${st.graded ? `<button id="filter" aria-pressed="${onlyWrong}">${onlyWrong ? '전체 20문제 보기' : '틀린 문제만 보기'}</button>` : ''}
      <button id="reset">${currentRound}회차 다시 풀기</button></div>
    <div id="questions">${visible.map(({ q, i }) => questionHTML(q, i, st)).join('') || '<div class="empty">모두 맞혔어요! 다른 회차에도 도전해 보세요.</div>'}</div>
    <div class="footnav round-footnav">
      <button data-open="${current}" data-round="${currentRound - 1}" ${currentRound === 1 ? 'disabled' : ''}>← 이전 회차</button>
      <button data-open="${current}" data-round="${currentRound + 1}" ${currentRound === 3 ? 'disabled' : ''}>다음 회차 →</button></div>
    <details><summary>원문 함께 보기 · ${esc(s.title)}</summary><pre>${esc(s.source)}</pre></details>
    <div class="footnav"><button data-open="${current - 1}" ${current === 1 ? 'disabled' : ''}>← 이전 섹션</button>
      <button data-open="${current + 1}" ${current === 20 ? 'disabled' : ''}>다음 섹션 →</button></div>
    <p class="save-note" id="save-note">${saveMessage()}</p>`;
  $('bottom').hidden = false;
  $('bottom').innerHTML = `<span id="bottom-count">${currentRound}회차 · ${st.graded ? points + '/20 정답' : n + '/20 응답'}</span>
    <button class="primary" id="grade" ${st.graded ? 'disabled' : ''}>${st.graded ? '채점 완료' : '채점하기'}</button>`;
}
function questionHTML(q, i, st) {
  const right = isCorrect(q, st.answers[i]);
  const typeName = q.type === 'choice' ? '4지선다' : q.type === 'ox' ? 'OX' : currentRound === 3 ? '빈칸 채우기' : '짧은 답';
  let input;
  if (q.type === 'short') {
    input = `<input class="short" type="text" data-answer="${i}" aria-labelledby="q-${i}" placeholder="정답을 입력하세요"
      autocomplete="off" spellcheck="false" maxlength="150" value="${esc(st.answers[i])}" ${st.graded ? 'disabled' : ''}>`;
  } else {
    const choices = q.type === 'ox' ? ['O', 'X'] : q.choices;
    input = `<div class="${q.type === 'ox' ? 'ox' : 'options'}" role="radiogroup" aria-labelledby="q-${i}">
      ${choices.map((v, j) => `<label class="choice"><input type="radio" name="answer-${i}" data-answer="${i}" value="${esc(v)}"
        ${st.answers[i] === v ? 'checked' : ''} ${st.graded ? 'disabled' : ''}>
        ${q.type === 'ox' ? `<b>${v}</b><span>${v === 'O' ? '맞아요' : '아니에요'}</span>` : `<span class="choice-number">${j + 1}</span><span>${esc(v)}</span>`}</label>`).join('')}</div>`;
  }
  return `<section class="question ${st.graded && !right ? 'miss' : ''}" aria-labelledby="q-${i}">
    <div class="qtop"><span class="qno">${String(i + 1).padStart(2, '0')}</span><span>${typeName}</span>
      ${st.graded ? `<span class="badge">${right ? '정답' : st.answers[i].trim() ? '오답' : '미응답'}</span>` : ''}</div>
    <div id="q-${i}" class="qtext">${esc(q.q)}</div>${input}
    ${st.graded ? `<div class="feedback"><strong class="${right ? 'correct' : 'wrong'}">정답: ${esc(q.answers[0])}</strong>
      <p>${esc(q.explanation)}</p>${q.type === 'short' && !right ? '<p>같은 뜻의 답이라면 정답 표현과 원문을 비교해 보세요. 자동 채점은 등록된 정답 표현을 기준으로 합니다.</p>' : ''}</div>` : ''}</section>`;
}
function render() { renderNav(); current ? renderQuiz() : renderHome(); }
function route() {
  const m = location.hash.match(/^#section-(\d+)(?:-round-([1-3]))?$/);
  current = m && Number(m[1]) >= 1 && Number(m[1]) <= 20 ? Number(m[1]) : 0;
  currentRound = current && m[2] ? Number(m[2]) : 1;
  onlyWrong = false;
  render();
  window.scrollTo(0, 0);
  $('main').focus({ preventScroll: true });
  document.title = current ? `${DATA[current - 1].title} · ${currentRound}회차 · 한국사2` : '한국사2 · 개념 확인 1,200';
}
function openSection(id, round = 1) {
  const valid = Number.isInteger(id) && id >= 1 && id <= 20;
  const r = Number.isInteger(round) && round >= 1 && round <= 3 ? round : 1;
  location.hash = valid ? `section-${id}-round-${r}` : 'home';
}
document.addEventListener('click', e => {
  const b = e.target.closest('button');
  if (!b || b.disabled) return;
  if (b.hasAttribute('data-open')) openSection(Number(b.dataset.open), Number(b.dataset.round || 1));
  else if (b.hasAttribute('data-home') || b.id === 'brand' || b.id === 'mobile-home') openSection(0);
  else if (b.id === 'grade') {
    state(current).graded = true;
    save(); onlyWrong = false; render();
    $('result').focus(); $('result').scrollIntoView({ block: 'start', behavior: 'auto' });
  } else if (b.id === 'filter') {
    onlyWrong = !onlyWrong; renderQuiz(); $('filter').focus();
  } else if (b.id === 'reset') {
    if (answered(state(current)) && !confirm(`${currentRound}회차의 답안과 채점 결과를 지우고 다시 풀까요? 다른 회차 기록은 유지됩니다.`)) return;
    states[stateKey(current, currentRound)] = { answers: Array(20).fill(''), graded: false };
    save(); onlyWrong = false; render(); window.scrollTo(0, 0);
  }
});
document.addEventListener('input', e => {
  if (!e.target.matches('[data-answer]') || !current) return;
  const st = state(current);
  if (st.graded) return;
  st.answers[Number(e.target.dataset.answer)] = e.target.value;
  save();
  const n = answered(st);
  $('progress-fill').style.width = n * 5 + '%';
  $('progress-text').textContent = `${currentRound}회차 · ${n} / 20문제 응답`;
  $('bottom-count').textContent = `${currentRound}회차 · ${n}/20 응답`;
  $('save-note').textContent = saveMessage();
});
$('mobile-select').addEventListener('change', e => openSection(Number(e.target.value)));
window.addEventListener('hashchange', route);
route();
