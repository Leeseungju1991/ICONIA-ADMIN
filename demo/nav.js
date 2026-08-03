const NAV_GROUPS = [
  {
    label: "사용자·디바이스",
    items: [
      { to: "placeholder.html?title=사용자 조회", label: "사용자 조회" },
      { to: "users.html", label: "회원 관리" },
      { to: "placeholder.html?title=CS 통합 조회", label: "CS 통합 조회" },
      { to: "placeholder.html?title=디바이스 모니터링", label: "디바이스 모니터링" },
      { to: "placeholder.html?title=OTA 배포", label: "OTA 배포" },
      { to: "placeholder.html?title=양산·출고 검수", label: "양산·출고 검수" },
      { to: "placeholder.html?title=AS·교환 관리", label: "AS·교환 관리" },
    ],
  },
  {
    label: "콘텐츠·모더레이션",
    items: [
      { to: "placeholder.html?title=콘텐츠 관리", label: "콘텐츠 관리" },
      { to: "placeholder.html?title=모더레이션", label: "모더레이션", badge: true },
      { to: "placeholder.html?title=분실·도난 신고", label: "분실·도난 신고" },
      { to: "placeholder.html?title=FAQ 관리", label: "FAQ 관리" },
      { to: "placeholder.html?title=공지·푸시 관리", label: "공지·푸시 관리" },
    ],
  },
  {
    label: "AI 운영",
    items: [
      { to: "placeholder.html?title=AI Key 관리", label: "AI Key 관리" },
      { to: "placeholder.html?title=AI 페르소나", label: "AI 페르소나" },
      { to: "placeholder.html?title=기능 플래그", label: "기능 플래그" },
    ],
  },
  {
    label: "시스템·운영",
    items: [
      { to: "placeholder.html?title=오류 추적", label: "오류 추적" },
      { to: "placeholder.html?title=운영 안정성", label: "운영 안정성" },
      { to: "placeholder.html?title=운영자 관리", label: "운영자 관리" },
    ],
  },
];

function renderSidebar(mountId, activeHref) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  let html = `<div class="brand"><span class="dot"></span> ICONIA ADMIN</div>`;
  html += `<a class="nav-item${activeHref === "dashboard.html" ? " active" : ""}" href="dashboard.html">🏠&nbsp; 대시보드 홈</a>`;
  for (const group of NAV_GROUPS) {
    html += `<div class="nav-group"><div class="nav-group-label">${group.label}</div>`;
    for (const item of group.items) {
      const isActive = activeHref === item.to.split("?")[0];
      html += `<a class="nav-item${isActive ? " active" : ""}" href="${item.to}">${item.label}${item.badge ? '<span class="nav-badge"></span>' : ""}</a>`;
    }
    html += `</div>`;
  }
  mount.innerHTML = html;
}

function renderTopbar(mountId, title) {
  const mount = document.getElementById(mountId);
  if (!mount) return;
  mount.innerHTML = `
    <div class="topbar-title">${title}</div>
    <div class="topbar-right">
      <span class="role-chip">데모 · 최고관리자</span>
      <span>demo@iconia.local</span>
      <a href="index.html" style="color:#EC4899;font-weight:700;">로그아웃</a>
    </div>
  `;
}
