# AWS 무료 배포 가이드 - ICONIA-ADMIN

AWS CloudFront에서 Vercel로 마이그레이션되었습니다.

## 배포 아키텍처

### ICONIA-ADMIN (Next.js 관리자 대시보드)
- **호스팅**: Vercel.com
- **자동 배포**: GitHub Actions (main, claude/aws-free-deployment-nox5zy 브랜치)
- **비용**: 완전 무료 (호스팅 + CDN 포함)

## 설정 방법

### 1. Vercel 프로젝트 생성
```bash
# 웹 브라우저에서
# https://vercel.com 접속
# GitHub 계정으로 로그인
# Import Git Repository → ICONIA-ADMIN 선택
```

### 2. 환경 변수 설정
```
Settings → Environment Variables

NEXT_PUBLIC_API_URL=https://your-server-url.railway.app
NEXT_PUBLIC_APP_ENV=production
```

### 3. GitHub Actions 시크릿 추가
Repository Settings → Secrets

```
VERCEL_TOKEN         # Vercel 개인 토큰
VERCEL_ORG_ID        # Vercel 조직 ID
VERCEL_PROJECT_ID    # Vercel 프로젝트 ID
```

Vercel 토큰 생성:
```bash
# Settings → Tokens → Personal Tokens
# 또는 CLI에서
vercel login
```

### 4. 배포 확인
```bash
npm run build
npm run start
```

## 배포 프로세스

**Production 배포** (자동)
- main 브랜치에 push → Vercel에 자동 배포
- URL: https://iconia-admin.vercel.app (또는 커스텀 도메인)

**Preview 배포**
- PR 생성 → 자동 preview URL 생성
- PR 코멘트에서 preview 링크 확인 가능

## 도메인 설정

### 커스텀 도메인 추가
```
Vercel Dashboard → Project Settings → Domains
도메인 이름 입력 → DNS 레코드 추가 지시
```

### DNS 레코드 예시
```
Type: CNAME
Name: admin
Value: cname.vercel-dns.com
```

## 모니터링

- **Vercel 대시보드**: https://vercel.com/dashboard
- **GitHub Actions**: Repository → Actions 탭
- **로그**: Vercel Dashboard → Deployments → 배포 선택

## 롤백 방법

```
Vercel Dashboard → Deployments
이전 배포 선택 → "Promote to Production"
```

또는 GitHub에서 이전 커밋으로 복귀:
```bash
git revert <commit-hash>
git push origin main
```

## 비용 비교

### AWS (이전)
- CloudFront: 트래픽 기반 요금
- EC2/Lightsail: 월 $20~50

### Vercel (현재)
- **완전 무료**: 호스팅, 배포, CDN, HTTPS 모두 무료
- Pro: 월 $20 (고급 기능 필요 시)

## 다음 단계

1. ✅ GitHub Actions 워크플로우 테스트
2. ✅ 환경 변수 검증
3. ✅ API 연결 확인 (백엔드 서버 주소)
4. ✅ 커스텀 도메인 DNS 레코드 업데이트
