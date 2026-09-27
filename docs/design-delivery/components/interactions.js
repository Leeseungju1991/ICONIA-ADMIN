/*
 * ICONIA 디자인 시안 — 공용 인터랙션 헬퍼 (바닐라 JS, 프레임워크 없음).
 * 5개 주제 폴더의 모든 variant-*.html이 이 파일을 <script src="../components/interactions.js">
 * 로 공유한다. DOM ID가 아닌 클릭된 요소 기준(closest/event target)으로 동작하므로
 * 같은 함수를 여러 페이지·여러 인스턴스에서 그대로 재사용할 수 있다.
 */

/* 토글 스위치 */
function toggleSwitch(btn) {
  const on = btn.dataset.on === 'true';
  btn.dataset.on = String(!on);
  btn.setAttribute('aria-checked', String(!on));
}

/* 탭 (가로 탭 · 필 탭 공용) */
function switchTab(btn, key) {
  const group = btn.closest('.tabs,.pill-tabs').parentElement;
  group.querySelectorAll('.tab,.pill-tab').forEach((b) => b.setAttribute('aria-selected', 'false'));
  btn.setAttribute('aria-selected', 'true');
  group.querySelectorAll('.tab-panel').forEach((p) => { p.hidden = p.dataset.panel !== key; });
}

/* 드롭다운 메뉴 — 바깥 클릭 시 자동 닫힘 */
let sgOpenDropdown = null;
function toggleDropdown(e, btn) {
  e.stopPropagation();
  const menu = btn.nextElementSibling;
  const willOpen = menu.hidden;
  closeDropdown();
  menu.hidden = !willOpen;
  if (willOpen) sgOpenDropdown = menu;
}
function closeDropdown() {
  if (sgOpenDropdown) { sgOpenDropdown.hidden = true; sgOpenDropdown = null; }
}
document.addEventListener('click', closeDropdown);

/* 아코디언 / 펼침 행 */
function toggleAccordion(btn) {
  const detail = btn.closest('.expand-row').querySelector('.detail');
  detail.hidden = !detail.hidden;
  btn.textContent = detail.hidden ? '펼침' : '접기';
}

/* 모달 — ESC로 닫기 지원 */
function openModal(id) { document.getElementById(id).hidden = false; }
function closeModal(id) { document.getElementById(id).hidden = true; }
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') document.querySelectorAll('.modal-overlay:not([hidden])').forEach((m) => { m.hidden = true; });
});

/* 스텝퍼 — containerId 안의 .step 들을 idx 기준으로 done/active 갱신 */
function setStepper(containerId, idx) {
  document.querySelectorAll('#' + containerId + ' .step').forEach((s, i) => {
    s.dataset.done = i < idx ? 'true' : 'false';
    s.dataset.active = i === idx ? 'true' : 'false';
    const c = s.querySelector('.circle');
    if (c) c.textContent = i < idx ? '✓' : String(i + 1);
  });
}

/* 검색 입력 — Clear(X) 버튼 */
function onSearchInput(input) {
  const wrap = input.closest('.input-wrap');
  if (wrap) wrap.classList.toggle('has-value', input.value.length > 0);
}
function clearSearch(btn) {
  const wrap = btn.closest('.input-wrap');
  const input = wrap.querySelector('input');
  input.value = '';
  input.focus();
  wrap.classList.remove('has-value');
}

/* 스낵바 — 4톤(success/warning/error/info), 자동 닫힘 시간은 길이에 비례 */
function autoMs(msg) { return msg.length <= 20 ? 2500 : msg.length <= 50 ? 4000 : 6000; }
function showSnack(tone, msg) {
  const stack = document.getElementById('snackbar-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = 'snackbar ' + tone;
  el.innerHTML = '<span class="dot"></span><span class="msg">' + msg + '</span>';
  const x = document.createElement('button');
  x.className = 'close-btn'; x.setAttribute('aria-label', '닫기'); x.textContent = '✕';
  const ms = autoMs(msg);
  const timerId = setTimeout(() => el.remove(), ms);
  x.onclick = () => { clearTimeout(timerId); el.remove(); };
  el.appendChild(x);
  stack.appendChild(el);
}

/* 클립보드 복사 (+ execCommand 폴백) */
function copyToClipboard(sourceSelector) {
  const text = document.querySelector(sourceSelector).textContent;
  const done = () => showSnack('success', '복사되었습니다.');
  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(text).then(done).catch(() => showSnack('error', '복사에 실패했습니다.'));
  } else {
    const ta = document.createElement('textarea'); ta.value = text; document.body.appendChild(ta); ta.select();
    try { document.execCommand('copy'); done(); } catch (e) { showSnack('error', '복사에 실패했습니다.'); }
    ta.remove();
  }
}

/* 다크모드 토글 — 페이지 간 localStorage로 선택 유지 (components/style-guide.html과 동일 키 사용) */
function toggleTheme() {
  const root = document.documentElement;
  const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
  root.dataset.theme = next;
  const btn = document.getElementById('theme-toggle');
  if (btn) btn.textContent = next === 'dark' ? '☀ 라이트모드' : '🌙 다크모드';
  try { localStorage.setItem('sg-theme', next); } catch (e) { /* 프라이빗 브라우징 등 — 세션 내 토글은 계속 동작 */ }
}
(function initTheme() {
  let saved = null;
  try { saved = localStorage.getItem('sg-theme'); } catch (e) { /* storage 접근 불가 시 기본(라이트) 유지 */ }
  if (saved === 'dark') {
    document.documentElement.dataset.theme = 'dark';
    document.addEventListener('DOMContentLoaded', () => {
      const btn = document.getElementById('theme-toggle');
      if (btn) btn.textContent = '☀ 라이트모드';
    });
  }
})();

/* 카드 그리드 중 하나만 선택 (템플릿/플랜 선택 등) — 같은 부모 안 형제 카드는 선택 해제 */
function selectOnlyCard(el) {
  el.parentElement.querySelectorAll('.pick-card').forEach((c) => { c.dataset.selected = 'false'; });
  el.dataset.selected = 'true';
}

/* 칸반 보드 — 카드를 다음/이전 컬럼으로 이동 (드래그 없이 버튼으로) */
function moveKanbanCard(btn, dir) {
  const card = btn.closest('.kanban-card');
  const col = card.closest('.kanban-col');
  const board = col.closest('.kanban-board');
  const target = dir === 'next' ? col.nextElementSibling : col.previousElementSibling;
  if (!target) return;
  target.querySelector('.kanban-col-body').appendChild(card);
  board.querySelectorAll('.kanban-col').forEach((c) => {
    const countEl = c.querySelector('.count');
    if (countEl) countEl.textContent = c.querySelectorAll('.kanban-card').length;
  });
}

/* 반복 입력 행 (견적서 품목 등) — 추가/삭제 + 합계 자동 계산 */
function addItemRow(containerId) {
  const container = document.getElementById(containerId);
  const rows = container.querySelectorAll('.item-row:not(.head)');
  const clone = rows[rows.length - 1].cloneNode(true);
  clone.querySelectorAll('input').forEach((i) => { i.value = i.type === 'number' ? '1' : ''; });
  clone.querySelectorAll('.line-total').forEach((t) => { t.textContent = '0원'; });
  container.appendChild(clone);
  recalcItemTotal(containerId);
}
function removeItemRow(btn, containerId) {
  const rows = document.querySelectorAll('#' + containerId + ' .item-row:not(.head)');
  if (rows.length <= 1) return;
  btn.closest('.item-row').remove();
  recalcItemTotal(containerId);
}
function recalcItemTotal(containerId) {
  let sum = 0;
  document.querySelectorAll('#' + containerId + ' .item-row:not(.head)').forEach((row) => {
    const qty = parseFloat(row.querySelector('.qty-input')?.value || '0') || 0;
    const price = parseFloat(row.querySelector('.price-input')?.value || '0') || 0;
    const total = qty * price;
    const totalEl = row.querySelector('.line-total');
    if (totalEl) totalEl.textContent = total.toLocaleString() + '원';
    sum += total;
  });
  const sumEl = document.getElementById(containerId + '-sum');
  if (sumEl) sumEl.textContent = sum.toLocaleString() + '원';
}

/* 즐겨찾기 (localStorage) — 네임스페이스(ns)별 id 배열로 저장. 문서 상세 페이지의
   "즐겨찾기" 버튼과, 그 결과를 보여주는 별도의 즐겨찾기 목록 페이지가 이 값을 공유한다. */
function sgFavKey(ns) { return 'sg-fav-' + ns; }
function sgGetFavorites(ns) {
  try { return JSON.parse(localStorage.getItem(sgFavKey(ns)) || '[]'); } catch (e) { return []; }
}
function sgIsFavorite(ns, id) { return sgGetFavorites(ns).indexOf(id) !== -1; }
function toggleFavorite(ns, id, btn) {
  let favs = sgGetFavorites(ns);
  const has = favs.indexOf(id) !== -1;
  favs = has ? favs.filter((x) => x !== id) : favs.concat([id]);
  try { localStorage.setItem(sgFavKey(ns), JSON.stringify(favs)); } catch (e) { /* storage 접근 불가 시에도 버튼 표시는 갱신 */ }
  if (btn) {
    btn.dataset.fav = String(!has);
    btn.textContent = !has ? '★ 즐겨찾기됨' : '☆ 즐겨찾기';
  }
  showSnack(!has ? 'success' : 'info', !has ? '즐겨찾기에 추가했습니다.' : '즐겨찾기에서 제거했습니다.');
  return !has;
}

/* 최근 검색·질문 기록 (localStorage) — 검색/질문형 홈 화면과 기록 페이지가 공유 */
function sgHistKey(ns) { return 'sg-hist-' + ns; }
function sgGetHistory(ns) {
  try { return JSON.parse(localStorage.getItem(sgHistKey(ns)) || '[]'); } catch (e) { return []; }
}
function sgAddHistory(ns, text) {
  if (!text || !text.trim()) return;
  let hist = sgGetHistory(ns).filter((h) => h.text !== text);
  hist.unshift({ text: text.trim(), ts: Date.now() });
  try { localStorage.setItem(sgHistKey(ns), JSON.stringify(hist.slice(0, 20))); } catch (e) { /* 저장 불가 시 화면 표시만 스킵 */ }
}
function sgClearHistory(ns, onDone) {
  try { localStorage.removeItem(sgHistKey(ns)); } catch (e) {}
  if (onDone) onDone();
}
