const NAV_GROUPS = [
  {
    label: "사용자·디바이스",
    items: [
      { to: "user-360.html", label: "사용자 조회" },
      { to: "users.html", label: "회원 관리" },
      { to: "cs.html", label: "CS 통합 조회" },
      { to: "devices.html", label: "디바이스 모니터링" },
      { to: "ota-deploy.html", label: "OTA 배포" },
      { to: "factory-test.html", label: "양산·출고 검수" },
      { to: "as.html", label: "AS·교환 관리" },
    ],
  },
  {
    label: "콘텐츠·모더레이션",
    items: [
      { to: "content.html", label: "콘텐츠 관리" },
      { to: "moderation.html", label: "모더레이션", badge: true },
      { to: "lost-reports.html", label: "분실·도난 신고" },
      { to: "faqs.html", label: "FAQ 관리" },
      { to: "notice-push.html", label: "공지·푸시 관리" },
    ],
  },
  {
    label: "AI 운영",
    items: [
      { to: "gemini.html", label: "AI Key 관리" },
      { to: "personas.html", label: "AI 페르소나" },
      { to: "feature-flags.html", label: "기능 플래그" },
    ],
  },
  {
    label: "시스템·운영",
    items: [
      { to: "error-tracking.html", label: "오류 추적" },
      { to: "ops.html", label: "운영 안정성" },
      { to: "operators.html", label: "운영자 관리" },
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
