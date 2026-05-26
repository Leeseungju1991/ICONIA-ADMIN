import { defineConfig, devices } from "@playwright/test";

// ICONIA-Admin E2E + 시각 회귀 baseline.
//
// 실행:
//   npm install --save-dev @playwright/test
//   npx playwright install --with-deps
//   npm run dev            # 별도 터미널에서 admin dev server 띄움
//   npx playwright test
//
// 시각 회귀: 첫 실행 시 `__screenshots__` 폴더에 baseline 자동 생성.
// 이후 실행에서 차이 발생 시 실패 → diff PNG 출력.
//
// 본 라운드는 골격 + 1개 smoke 시나리오. 실 운영자 시나리오는 후속.

export default defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  expect: {
    timeout: 5_000,
    toHaveScreenshot: {
      maxDiffPixelRatio: 0.02,
      threshold: 0.2,
    },
  },
  fullyParallel: false, // 운영자 세션은 직렬 권장
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 1 : 0,
  workers: 1,
  reporter: process.env.CI ? "github" : "list",

  use: {
    baseURL: process.env.E2E_BASE_URL || "http://localhost:3001",
    trace: "on-first-retry",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
  },

  projects: [
    {
      name: "chromium",
      use: { ...devices["Desktop Chrome"] },
    },
  ],
});
