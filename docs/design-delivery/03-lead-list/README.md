# 리드/고객 목록 — 시안 2종

영업팀이 담당 리드를 관리하는 화면. "전체를 표로 보고 단계는 필터로만 좁힐지",
"단계별로 그룹핑해 지금 어디에 몇 건 있는지 바로 보여줄지"에 따라 두 시안을 준비했습니다.

| 시안 | 미리보기 | 특징 | 추천 상황 |
|---|---|---|---|
| **A — 파이프라인 필터 + 표** | ![시안 A](./preview-a.svg) | 필 탭으로 단계 필터링 + 정렬 가능한 표 | 리드 수가 많고(수십~수백 건), 정렬·검색이 중요할 때 |
| **B — 단계별 그룹 리스트** | ![시안 B](./preview-b.svg) | 단계별로 묶어서 카드 리스트로 표시 | 드래그앤드롭 칸반 없이도 "단계별 분포"를 한눈에 보고 싶을 때 |

- 실제 파일: [`variant-a.html`](./variant-a.html) · [`variant-b.html`](./variant-b.html) — 브라우저로 직접 열람 가능 (빌드 불필요)
- 공용 스타일/스크립트: [`../components/tokens.css`](../components/tokens.css), [`../components/interactions.js`](../components/interactions.js)
- 부품 출처: [부품 6번 배지·칩](../components/style-guide.html#s6), [8번 필 탭](../components/style-guide.html#s8), [9번 아코디언](../components/style-guide.html#s9)
- 참고: 진짜 드래그앤드롭 칸반 보드(P13, 15개 주제 목록 참고)는 이번 배치에는 포함하지 않았습니다 — 새 부품(카드 드래그) 구현이 필요해 별도로 진행하는 게 좋습니다.
