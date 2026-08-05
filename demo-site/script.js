// ============== MOCK DATA (더미 데이터) ============== //
const users = [
  { email: 'user0231@example.com', name: '사용자0231', dolls: 1, lastLogin: '2026-08-05 07:12', status: 'ACTIVE' },
  { email: 'user1042@example.com', name: '사용자1042', dolls: 2, lastLogin: '2026-08-04 21:03', status: 'ACTIVE' },
  { email: 'user0788@example.com', name: '사용자0788', dolls: 1, lastLogin: '2026-08-03 09:41', status: 'PAUSED' },
  { email: 'user2091@example.com', name: '사용자2091', dolls: 1, lastLogin: '2026-07-30 18:20', status: 'ACTIVE' },
  { email: 'user0512@example.com', name: '사용자0512', dolls: 0, lastLogin: '2026-07-18 12:05', status: 'PENDING_DELETION' },
];
const devices = [
  { serial: 'ICN-88213', owner: 'user0231@example.com', fw: 'v2.4.1', ota: 'STABLE', battery: '82%', online: true },
  { serial: 'ICN-77104', owner: 'user1042@example.com', fw: 'v2.4.2', ota: 'CANARY', battery: '45%', online: true },
  { serial: 'ICN-65590', owner: 'user1042@example.com', fw: 'v2.3.8', ota: 'STABLE', battery: '12%', online: false },
  { serial: 'ICN-90871', owner: 'user2091@example.com', fw: 'v2.4.1', ota: 'STABLE', battery: '97%', online: true },
];
const aiModels = [
  { model: 'Gemini Flash', calls: 8420, latency: '620ms', fallback: '0.8%',
    scenario: '동화 생성 · 일상 대화 등 저지연 요청을 처리하는 기본 모델입니다. 24시간 내 8,420건 호출, fallback 0.8%로 안정적입니다.' },
  { model: 'Gemini Pro', calls: 1120, latency: '1.4s', fallback: '1.9%',
    scenario: '복잡한 추론이 필요한 학습 콘텐츠 생성에 사용됩니다. 평균 지연 1.4s로 Flash 대비 느리지만 응답 품질이 높습니다.' },
  { model: 'Claude (fallback)', calls: 94, latency: '2.1s', fallback: '—',
    scenario: 'Gemini 계열 장애 또는 안전 필터 거부 시 대체 호출되는 fallback 모델입니다. 24시간 94건 — 정상 범위 내 fallback 비율입니다.' },
];
const moderation = [
  { id: 'RPT-1042', type: '부적절 발화', target: 'ICN-65590', date: '2026-08-04', status: 'PENDING' },
  { id: 'RPT-1038', type: '스팸 신고', target: 'user0788@example.com', date: '2026-08-02', status: 'RESOLVED' },
  { id: 'RPT-1029', type: '기타', target: 'ICN-77104', date: '2026-07-29', status: 'RESOLVED' },
  { id: 'RPT-1015', type: '부적절 발화', target: 'ICN-90871', date: '2026-07-22', status: 'PENDING' },
];
const errorDomains = [
  { domain: 'SERVER', count: 2, last: '2026-08-05 03:12', status: 'ok',
    scenario: 'API 서버 p99 지연 순간 스파이크(320ms) 2건 감지. 오토스케일링으로 자동 회복되어 현재 정상입니다.', action: '인시던트 종료 확인' },
  { domain: 'APP', count: 5, last: '2026-08-05 06:40', status: 'warn',
    scenario: '모바일 앱에서 인형 연동 화면 크래시 5건 접수 (iOS 17.4, 특정 기기군). 크래시프리율 99.7% — 주의 관찰 필요.', action: '핫픽스 배포 요청' },
  { domain: 'FIRMWARE', count: 0, last: '—', status: 'ok',
    scenario: 'v2.4.2 Canary 채널 10% 배포 중이나 펌웨어 관련 오류 보고는 없습니다.', action: '모니터링 계속' },
  { domain: 'AI', count: 3, last: '2026-08-04 22:01', status: 'ok',
    scenario: 'Gemini Pro 타임아웃 3건 — Claude fallback으로 정상 전환되어 사용자 영향은 없었습니다.', action: '로그 아카이브' },
];
const audit = [
  { at: '2026-08-05 09:10', op: 'test@demo', action: '로그인 (superadmin)' },
  { at: '2026-08-04 16:22', op: 'ops1@soomkorea.com', action: 'user0788 계정 일시정지' },
  { at: '2026-08-03 11:05', op: 'ops2@soomkorea.com', action: 'RPT-1038 처리 완료' },
  { at: '2026-08-01 14:47', op: 'ops1@soomkorea.com', action: '펌웨어 v2.4.1 Canary 10% 배포' },
];
const trend7d = [101, 108, 112, 119, 121, 125, 128];
const otaRollout = [
  { version: 'v2.4.2', channel: 'Canary', pct: 10, detail: 'v2.4.2는 배터리 소모 개선 및 음성 인식 지연 최적화를 포함합니다. Canary 10% 그룹 대상 배포 중이며 크래시율·배터리 지표 이상 없을 시 25%로 확대 예정입니다.' },
  { version: 'v2.4.1', channel: 'Stable', pct: 100, detail: 'v2.4.1은 전체 디바이스에 안정적으로 배포 완료된 버전입니다. 알려진 이슈 없음.' },
];

function statusBadge(s) {
  const map = { ACTIVE: ['활성','ok'], PAUSED: ['일시정지','warn'], PENDING_DELETION: ['삭제대기','bad'],
    PENDING: ['대기','warn'], RESOLVED: ['처리완료','ok'] };
  const [label, cls] = map[s] || [s, 'mute'];
  return `<span class="badge ${cls}">${label}</span>`;
}

function renderDashboard() {
  document.getElementById('kpi-grid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">활성 디바이스</div><div class="kpi-value">128</div><div class="kpi-delta">최근 7일 +27</div></div>
    <div class="kpi-card"><div class="kpi-label">DAU</div><div class="kpi-value">342</div><div class="kpi-delta">최근 7일 +62</div></div>
    <div class="kpi-card"><div class="kpi-label">24h 오류</div><div class="kpi-value warn">7</div><div class="kpi-delta">server 2 · app 5 · fw 0</div></div>
    <div class="kpi-card"><div class="kpi-label">신고 대기</div><div class="kpi-value warn">2</div><div class="kpi-delta">moderation 큐</div></div>
    <div class="kpi-card"><div class="kpi-label">서버 상태</div><div class="kpi-value good" style="font-size:18px">정상 (OK)</div></div>
  `;
  document.getElementById('domain-health').innerHTML = `
    <tr><td class="strong">HW (디바이스)</td><td>${statusBadge('ACTIVE')}</td><td>128 devices online</td></tr>
    <tr><td class="strong">SERVER</td><td>${statusBadge('ACTIVE')}</td><td>p99 182ms</td></tr>
    <tr><td class="strong">AI</td><td>${statusBadge('ACTIVE')}</td><td>fallback 1.2%</td></tr>
    <tr><td class="strong">APP</td><td>${statusBadge('ACTIVE')}</td><td>crash-free 99.7%</td></tr>
    <tr><td class="strong">ADMIN</td><td>${statusBadge('ACTIVE')}</td><td>데모 모드로 실행 중</td></tr>
    <tr><td class="strong">AWS</td><td><span class="badge mute">해당없음</span></td><td>데모 환경 — AWS 미연동</td></tr>
  `;
  renderTrendChart();
  renderOtaRollout();
}

function renderOtaRollout() {
  document.getElementById('ota-rollout').innerHTML = otaRollout.map((r, i) => `
    <div class="ota-rollout-row" data-idx="${i}">
      <div class="ota-rollout-label">${r.version} <span class="ota-chip ${r.channel === 'Canary' ? 'canary' : 'stable'}">${r.channel}</span></div>
      <div class="ota-rollout-track"><div class="ota-rollout-fill" style="width:${r.pct}%"></div></div>
      <div class="ota-rollout-pct">${r.pct}%</div>
    </div>`).join('');
}

function renderTrendChart() {
  const w = 320, h = 96, pad = 4;
  const max = Math.max(...trend7d), min = Math.min(...trend7d);
  const stepX = w / (trend7d.length - 1);
  const points = trend7d.map((v, i) => {
    const x = i * stepX;
    const y = pad + (h - pad * 2) * (1 - (v - min) / (max - min || 1));
    return [x, y];
  });
  const line = points.map(p => p.join(',')).join(' ');
  const area = `0,${h} ${line} ${w},${h}`;
  const dots = points.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i === points.length - 1 ? 3.5 : 2.5}" fill="#5b5bf0" />`).join('');
  document.getElementById('bars-devices').innerHTML = `
    <svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" style="width:100%;height:96px;overflow:visible">
      <defs>
        <linearGradient id="trendFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" style="stop-color:#5b5bf0;stop-opacity:0.32" />
          <stop offset="100%" style="stop-color:#5b5bf0;stop-opacity:0" />
        </linearGradient>
      </defs>
      <polygon points="${area}" fill="url(#trendFill)" />
      <polyline points="${line}" fill="none" stroke="#5b5bf0" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
      ${dots}
    </svg>
    <div class="trend-labels">${trend7d.map((_, i) => `<span>D-${6 - i}</span>`).join('')}</div>
  `;
}

function renderUsers(filterText = '') {
  const q = filterText.trim().toLowerCase();
  const filtered = users.filter(u => !q || u.email.toLowerCase().includes(q));
  document.getElementById('user-rows').innerHTML = filtered.map(u => `
    <tr><td class="strong">${u.email}</td><td>${u.name}</td><td>${u.dolls}대</td><td>${u.lastLogin}</td><td>${statusBadge(u.status)}</td></tr>`).join('')
    || '<tr><td colspan="5" style="color:var(--text-3)">검색 결과가 없습니다.</td></tr>';
}

function renderDevices() {
  document.getElementById('device-rows').innerHTML = devices.map(d => `
    <tr class="clickable" data-serial="${d.serial}"><td class="strong">${d.serial}</td><td>${d.owner}</td><td>${d.fw}</td>
    <td><span class="ota-chip ${d.ota === 'CANARY' ? 'canary' : 'stable'}">${d.ota}</span></td>
    <td>${d.battery}</td>
    <td><span class="badge ${d.online ? 'ok' : 'mute'}">${d.online ? '온라인' : '오프라인'}</span></td></tr>`).join('');
}

function renderAiUsage() {
  const totalCalls = aiModels.reduce((s, m) => s + m.calls, 0);
  document.getElementById('ai-kpi-grid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">총 호출 (24h)</div><div class="kpi-value">${totalCalls.toLocaleString()}</div></div>
    <div class="kpi-card"><div class="kpi-label">평균 Fallback율</div><div class="kpi-value">1.2%</div></div>
    <div class="kpi-card"><div class="kpi-label">추정 일일 비용</div><div class="kpi-value" style="font-size:18px">$18.40</div></div>
  `;
  document.getElementById('ai-rows').innerHTML = aiModels.map((m, i) => `
    <tr class="clickable" data-idx="${i}"><td class="strong">${m.model}</td><td>${m.calls.toLocaleString()}</td><td>${m.latency}</td><td>${m.fallback}</td></tr>`).join('');
}

function renderModeration() {
  document.getElementById('mod-rows').innerHTML = moderation.map(m => `
    <tr><td class="strong">${m.id}</td><td>${m.type}</td><td>${m.target}</td><td>${m.date}</td><td>${statusBadge(m.status)}</td></tr>`).join('');
}

function renderErrors() {
  document.getElementById('error-rows').innerHTML = errorDomains.map((e, i) => `
    <tr class="clickable" data-idx="${i}"><td class="strong">${e.domain}</td><td>${e.count}</td><td>${e.last}</td>
    <td><span class="badge ${e.status === 'ok' ? 'ok' : 'warn'}">${e.status === 'ok' ? '양호' : '주의'}</span></td></tr>`).join('');
}

function renderAudit() {
  document.getElementById('audit-rows').innerHTML = audit.map(a => `
    <tr><td>${a.at}</td><td class="strong">${a.op}</td><td>${a.action}</td></tr>`).join('');
}

function renderAll() {
  renderDashboard(); renderUsers(); renderDevices(); renderAiUsage(); renderModeration(); renderErrors(); renderAudit();
}

// ============== SNACKBAR ============== //
function showSnackbar(message, type = 'ok') {
  const stack = document.getElementById('snackbar-stack');
  if (!stack) return;
  const el = document.createElement('div');
  el.className = `snackbar ${type}`;
  el.innerHTML = `<span class="sb-dot"></span>${message}`;
  stack.appendChild(el);
  setTimeout(() => {
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 200);
  }, 2400);
}

// ============== MODAL ============== //
function openModal(html) {
  document.getElementById('modal-body').innerHTML = html;
  document.getElementById('modal-overlay').classList.add('is-open');
}
function closeModal() {
  document.getElementById('modal-overlay').classList.remove('is-open');
}
document.getElementById('modal-close')?.addEventListener('click', closeModal);
document.getElementById('modal-overlay')?.addEventListener('click', (e) => {
  if (e.target.id === 'modal-overlay') closeModal();
});
document.addEventListener('keydown', (e) => { if (e.key === 'Escape') closeModal(); });

function openDeviceModal(serial) {
  const d = devices.find(x => x.serial === serial);
  if (!d) return;
  openModal(`
    <h3 class="modal-title">${d.serial}</h3>
    <p class="modal-sub">소유자 ${d.owner}</p>
    <div class="modal-fields">
      <div><div class="modal-field-label">펌웨어</div><div class="modal-field-value">${d.fw}</div></div>
      <div><div class="modal-field-label">OTA 채널</div><div class="modal-field-value">${d.ota}</div></div>
      <div><div class="modal-field-label">배터리</div><div class="modal-field-value">${d.battery}</div></div>
      <div><div class="modal-field-label">연결 상태</div><div class="modal-field-value">${d.online ? '온라인' : '오프라인'}</div></div>
    </div>
    <div class="modal-actions">
      <button class="modal-action-btn" id="modal-ota-push" data-serial="${d.serial}">펌웨어 OTA 강제 푸시</button>
      <button class="modal-action-btn secondary" id="modal-reboot" data-serial="${d.serial}">디바이스 재부팅 명령</button>
    </div>
  `);
  document.getElementById('modal-ota-push')?.addEventListener('click', () => {
    d.fw = 'v2.4.2'; d.ota = 'CANARY';
    renderDevices();
    closeModal();
    showSnackbar(`${d.serial}에 펌웨어 v2.4.2 OTA 푸시 요청이 전송되었습니다.`);
  });
  document.getElementById('modal-reboot')?.addEventListener('click', () => {
    closeModal();
    showSnackbar(`${d.serial} 재부팅 명령이 전송되었습니다. (데모 환경)`, 'warn');
  });
}

function openErrorModal(idx) {
  const e = errorDomains[idx];
  if (!e) return;
  openModal(`
    <h3 class="modal-title">${e.domain} 도메인 오류</h3>
    <p class="modal-sub">24h 발생 ${e.count}건 · 최근 발생 ${e.last} · <span class="badge ${e.status === 'ok' ? 'ok' : 'warn'}">${e.status === 'ok' ? '양호' : '주의'}</span></p>
    <div class="modal-scenario">${e.scenario}</div>
    <div class="modal-actions">
      <button class="modal-action-btn" id="modal-error-action">${e.action}</button>
    </div>
  `);
  document.getElementById('modal-error-action')?.addEventListener('click', () => {
    e.status = 'ok'; e.count = 0;
    renderErrors();
    closeModal();
    showSnackbar(`${e.domain} 도메인: "${e.action}" 처리되었습니다.`);
  });
}

function openAiModal(idx) {
  const m = aiModels[idx];
  if (!m) return;
  openModal(`
    <h3 class="modal-title">${m.model}</h3>
    <p class="modal-sub">24h 호출 ${m.calls.toLocaleString()}건 · 평균 지연 ${m.latency} · Fallback ${m.fallback}</p>
    <div class="modal-scenario">${m.scenario}</div>
  `);
}

function openOtaModal(idx) {
  const r = otaRollout[idx];
  if (!r) return;
  openModal(`
    <h3 class="modal-title">${r.version} · ${r.channel} 배포</h3>
    <p class="modal-sub">현재 ${r.pct}% 디바이스에 적용됨</p>
    <div class="modal-scenario">${r.detail}</div>
  `);
}

document.getElementById('device-rows')?.addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-serial]');
  if (row) openDeviceModal(row.dataset.serial);
});
document.getElementById('error-rows')?.addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-idx]');
  if (row) openErrorModal(Number(row.dataset.idx));
});
document.getElementById('ai-rows')?.addEventListener('click', (e) => {
  const row = e.target.closest('tr[data-idx]');
  if (row) openAiModal(Number(row.dataset.idx));
});
document.getElementById('ota-rollout')?.addEventListener('click', (e) => {
  const row = e.target.closest('.ota-rollout-row');
  if (row) openOtaModal(Number(row.dataset.idx));
});

// ============== NAV ============== //
const pageTitles = {
  dashboard:'대시보드', users:'사용자 조회', devices:'디바이스', 'ai-usage':'AI 사용량',
  moderation:'콘텐츠 모더레이션', errors:'오류 추적', audit:'감사 로그',
};
document.querySelectorAll('.nav-item').forEach(item => {
  item.addEventListener('click', () => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('is-active'));
    item.classList.add('is-active');
    const page = item.dataset.page;
    document.querySelectorAll('.page').forEach(p => p.classList.remove('is-active'));
    document.getElementById('page-' + page).classList.add('is-active');
    document.getElementById('topbar-title').textContent = pageTitles[page];
  });
});
document.getElementById('user-search')?.addEventListener('input', (e) => renderUsers(e.target.value));

// ============== BOOT SEQUENCE ============== //
(function renderBootSequence() {
  const el = document.getElementById('boot-lines');
  if (!el) return;
  const lines = [
    ['ok', 'iconia-admin console v2.4.1 booting…'],
    ['ok', 'connecting to ops-gateway… OK (182ms)'],
    ['ok', '128 devices online · DAU 342'],
    ['warn', '2 error(s) pending review'],
    ['ok', 'awaiting operator credentials'],
  ];
  lines.forEach(([kind, text], i) => {
    setTimeout(() => {
      const div = document.createElement('div');
      div.className = 'boot-line';
      div.innerHTML = `<span class="boot-${kind}">›</span> ${text}`;
      el.appendChild(div);
      if (i === lines.length - 1) {
        const cursor = document.createElement('span');
        cursor.className = 'boot-cursor';
        div.appendChild(document.createTextNode(' '));
        div.appendChild(cursor);
      }
    }, i * 220);
  });
})();

// ============== AUTH ============== //
const SESSION_KEY = 'iconia_admin_demo_session';
function showApp(username) {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.add('is-active');
  document.getElementById('user-name').textContent = username;
  document.querySelector('.avatar').textContent = username.slice(0, 1).toUpperCase();
  renderAll();
}
document.getElementById('login-form').addEventListener('submit', (e) => {
  e.preventDefault();
  const u = document.getElementById('u').value.trim();
  const p = document.getElementById('p').value.trim();
  const err = document.getElementById('login-error');
  const valid = (u === 'test' && p === 'test') || (u === 'admin' && p === 'admin');
  if (!valid) { err.textContent = '아이디 또는 비밀번호가 올바르지 않습니다. (test / test)'; return; }
  err.textContent = '';
  sessionStorage.setItem(SESSION_KEY, u);
  showApp(u);
  showSnackbar(`인증 성공 · ${u} 세션이 시작되었습니다.`);
});
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById('app').classList.remove('is-active');
  document.getElementById('login-screen').classList.remove('hidden');
  showSnackbar('세션이 종료되었습니다.');
});
(function initSession() {
  const u = sessionStorage.getItem(SESSION_KEY);
  if (u) showApp(u);
})();
