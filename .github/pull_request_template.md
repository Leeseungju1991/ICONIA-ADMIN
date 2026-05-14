# 변경 요약

(이 PR 이 무엇을 왜 바꾸는지 1-3 문장)

## 영향 범위

- [ ] 운영자 콘솔 UI (`app/`, 라우트·페이지·컴포넌트)
- [ ] 인증 / 미들웨어 (`middleware.ts`, JWT 쿠키, 로그인 흐름)
- [ ] Server API 호출 레이어 (`lib/`, Server Actions, `ICONIA_SERVER_URL`)
- [ ] 보안 헤더 / CSP (`next.config.mjs`)
- [ ] 인프라 / CI / 배포 (`.github/`, `Dockerfile`, 루트 `infra/`)

## 테스트

- [ ] `npm run lint` PASS
- [ ] `npm run build` PASS (standalone 빌드 성공)
- [ ] `npx vitest run` 회귀 0
- [ ] 수동 확인: 로그인 → 주요 화면 1개 이상 동작 (스크린샷/요약 첨부)

## 계약 영향

- [ ] Server↔Admin 계약 변경 시 `docs/api-contracts.md` §2 + `admin/docs/api_contract.md` 동기화, ICONIA-SERVER 동시 PR URL 본문 첨부
- [ ] 변경 없음

## 체크리스트

- [ ] secret(.env, *.pem, *.key, API token, JWT key) 누출 없음
- [ ] CSP `connect-src` 가 새 외부 호출 도입 시 갱신됨
- [ ] CODEOWNERS reviewer 지정
