// ============== MOCK DATA (더미 데이터) ============== //
const users = [
  { email: 'user0231@example.com', name: '사용자0231', dolls: 1, lastLogin: '2026-08-05 07:12', status: 'ACTIVE' },
  { email: 'user1042@example.com', name: '사용자1042', dolls: 2, lastLogin: '2026-08-04 21:03', status: 'ACTIVE' },
  { email: 'user0788@example.com', name: '사용자0788', dolls: 1, lastLogin: '2026-08-03 09:41', status: 'PAUSED' },
  { email: 'user2091@example.com', name: '사용자2091', dolls: 1, lastLogin: '2026-07-30 18:20', status: 'ACTIVE' },
  { email: 'user0512@example.com', name: '사용자0512', dolls: 0, lastLogin: '2026-07-18 12:05', status: 'PENDING_DELETION' },
];
const devices = [
  { serial: 'ICN-88213', owner: 'user0231@example.com', fw: 'v2.4.1', battery: '82%', online: true },
  { serial: 'ICN-77104', owner: 'user1042@example.com', fw: 'v2.4.1', battery: '45%', online: true },
  { serial: 'ICN-65590', owner: 'user1042@example.com', fw: 'v2.3.8', battery: '12%', online: false },
  { serial: 'ICN-90871', owner: 'user2091@example.com', fw: 'v2.4.1', battery: '97%', online: true },
];
const aiModels = [
  { model: 'Gemini Flash', calls: 8420, latency: '620ms', fallback: '0.8%' },
  { model: 'Gemini Pro', calls: 1120, latency: '1.4s', fallback: '1.9%' },
  { model: 'Claude (fallback)', calls: 94, latency: '2.1s', fallback: '—' },
];
const moderation = [
  { id: 'RPT-1042', type: '부적절 발화', target: 'ICN-65590', date: '2026-08-04', status: 'PENDING' },
  { id: 'RPT-1038', type: '스팸 신고', target: 'user0788@example.com', date: '2026-08-02', status: 'RESOLVED' },
  { id: 'RPT-1029', type: '기타', target: 'ICN-77104', date: '2026-07-29', status: 'RESOLVED' },
  { id: 'RPT-1015', type: '부적절 발화', target: 'ICN-90871', date: '2026-07-22', status: 'PENDING' },
];
const errorDomains = [
  { domain: 'SERVER', count: 2, last: '2026-08-05 03:12', status: 'ok' },
  { domain: 'APP', count: 5, last: '2026-08-05 06:40', status: 'warn' },
  { domain: 'FIRMWARE', count: 0, last: '—', status: 'ok' },
  { domain: 'AI', count: 3, last: '2026-08-04 22:01', status: 'ok' },
];
const audit = [
  { at: '2026-08-05 09:10', op: 'test@demo', action: '로그인 (superadmin)' },
  { at: '2026-08-04 16:22', op: 'ops1@soomkorea.com', action: 'user0788 계정 일시정지' },
  { at: '2026-08-03 11:05', op: 'ops2@soomkorea.com', action: 'RPT-1038 처리 완료' },
  { at: '2026-08-01 14:47', op: 'ops1@soomkorea.com', action: '펌웨어 v2.4.1 Canary 10% 배포' },
];
const trend7d = [101, 108, 112, 119, 121, 125, 128];

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
    <tr><td class="strong">${d.serial}</td><td>${d.owner}</td><td>${d.fw}</td><td>${d.battery}</td>
    <td><span class="badge ${d.online ? 'ok' : 'mute'}">${d.online ? '온라인' : '오프라인'}</span></td></tr>`).join('');
}

function renderAiUsage() {
  const totalCalls = aiModels.reduce((s, m) => s + m.calls, 0);
  document.getElementById('ai-kpi-grid').innerHTML = `
    <div class="kpi-card"><div class="kpi-label">총 호출 (24h)</div><div class="kpi-value">${totalCalls.toLocaleString()}</div></div>
    <div class="kpi-card"><div class="kpi-label">평균 Fallback율</div><div class="kpi-value">1.2%</div></div>
    <div class="kpi-card"><div class="kpi-label">추정 일일 비용</div><div class="kpi-value" style="font-size:18px">$18.40</div></div>
  `;
  document.getElementById('ai-rows').innerHTML = aiModels.map(m => `
    <tr><td class="strong">${m.model}</td><td>${m.calls.toLocaleString()}</td><td>${m.latency}</td><td>${m.fallback}</td></tr>`).join('');
}

function renderModeration() {
  document.getElementById('mod-rows').innerHTML = moderation.map(m => `
    <tr><td class="strong">${m.id}</td><td>${m.type}</td><td>${m.target}</td><td>${m.date}</td><td>${statusBadge(m.status)}</td></tr>`).join('');
}

function renderErrors() {
  document.getElementById('error-rows').innerHTML = errorDomains.map(e => `
    <tr><td class="strong">${e.domain}</td><td>${e.count}</td><td>${e.last}</td>
    <td><span class="badge ${e.status === 'ok' ? 'ok' : 'warn'}">${e.status === 'ok' ? '양호' : '주의'}</span></td></tr>`).join('');
}

function renderAudit() {
  document.getElementById('audit-rows').innerHTML = audit.map(a => `
    <tr><td>${a.at}</td><td class="strong">${a.op}</td><td>${a.action}</td></tr>`).join('');
}

function renderAll() {
  renderDashboard(); renderUsers(); renderDevices(); renderAiUsage(); renderModeration(); renderErrors(); renderAudit();
}

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
});
document.getElementById('logout-btn').addEventListener('click', () => {
  sessionStorage.removeItem(SESSION_KEY);
  document.getElementById('app').classList.remove('is-active');
  document.getElementById('login-screen').classList.remove('hidden');
});
(function initSession() {
  const u = sessionStorage.getItem(SESSION_KEY);
  if (u) showApp(u);
})();
