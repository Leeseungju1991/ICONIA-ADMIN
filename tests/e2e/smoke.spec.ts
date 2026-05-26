import { test, expect } from "@playwright/test";

// ICONIA-Admin E2E smoke — /login 페이지 진입 + 시각 회귀 baseline.
//
// 본 시나리오는 외부 의존성 없이 통과해야 한다:
//   - admin dev server 만 떠 있으면 됨 (Server 도달 불필요).
//   - 인증 안 된 상태에서 /login 페이지 렌더링만 검증.
//
// 향후 추가할 시나리오:
//   - 로그인 → 대시보드 → 로그아웃 (실 Server 또는 mock JWT 필요)
//   - 회원 검색 (Server 라우트 통합)
//   - 운영자 초대 흐름 (server endpoint 도입 후)

test.describe("Admin login page smoke", () => {
  test("login page renders title and form", async ({ page }) => {
    await page.goto("/login");

    // 제목 검증
    await expect(page.getByText("ICONIA Project")).toBeVisible();
    await expect(page.getByText("Admin Page")).toBeVisible();

    // 입력 필드 검증
    await expect(page.getByPlaceholder("ID")).toBeVisible();
    await expect(page.getByPlaceholder("Password")).toBeVisible();
    await expect(page.getByRole("button", { name: /sign in/i })).toBeVisible();
  });

  test("login page visual regression baseline", async ({ page }) => {
    await page.goto("/login");
    // 첫 실행 → baseline 자동 생성. 이후 변경 시 diff.
    await expect(page).toHaveScreenshot("login-page.png", {
      fullPage: true,
    });
  });
});
