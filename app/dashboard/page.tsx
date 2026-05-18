import Link from "next/link";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Grid from "@mui/material/Grid";
import Typography from "@mui/material/Typography";
import TrendingDownOutlined from "@mui/icons-material/TrendingDownOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import RouterOutlined from "@mui/icons-material/RouterOutlined";
import MemoryOutlined from "@mui/icons-material/MemoryOutlined";
import { readSession } from "@/lib/authCookie";
import { getAiHealth, listDevices } from "@/lib/adminApi";
import { StatCard } from "@/app/components/dashboard/StatCard";

// Dashboard overview — thin tile grid that calls a few cheap admin
// endpoints and surfaces health at a glance. Failures render as "—".

export const dynamic = "force-dynamic";

async function safeAiHealth(jwt: string) {
  const res = await getAiHealth({ jwt });
  return res.ok ? res.data : null;
}
async function safeDevicesCount(jwt: string) {
  const res = await listDevices({ jwt, limit: 1 });
  return res.ok ? res.data.items.length : null;
}

export default async function DashboardHome() {
  const jwt = readSession()!;
  const [aiHealth, devicesProbe] = await Promise.all([
    safeAiHealth(jwt),
    safeDevicesCount(jwt),
  ]);

  const fallbackPct = aiHealth ? `${(aiHealth.fallback_rate * 100).toFixed(1)}%` : "—";
  const p95Ms = aiHealth?.p95_latency_ms != null ? `${aiHealth.p95_latency_ms} ms` : "—";

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          개요
        </Typography>
        <Typography variant="body2" color="text.secondary">
          AI 운영 현황 요약. 좌측 내비게이션에서 세부 페이지로 이동.
        </Typography>
      </Box>

      <Grid container spacing={3} sx={{ mb: 1 }}>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            color="error"
            icon={<TrendingDownOutlined />}
            title="AI fallback rate (5분)"
            value={fallbackPct}
            sub={aiHealth ? `${aiHealth.total_calls} calls / ${aiHealth.fallback_count} fallback` : "데이터 없음"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            color="warning"
            icon={<SpeedOutlined />}
            title="AI p95 latency"
            value={p95Ms}
            sub={aiHealth?.last_updated_at ?? "—"}
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            color="success"
            icon={<RouterOutlined />}
            title="디바이스 API"
            value={devicesProbe === null ? "—" : "OK"}
            sub="/api/v1/admin/devices"
          />
        </Grid>
        <Grid item xs={12} sm={6} md={3}>
          <StatCard
            color="info"
            icon={<MemoryOutlined />}
            title="디바이스"
            value={devicesProbe ?? "—"}
            sub="현재 표본"
          />
        </Grid>
      </Grid>

      <Grid container spacing={3} sx={{ mt: 1 }}>
        <Grid item xs={12} md={8}>
          <Card>
            <CardHeader title="빠른 이동" subheader="자주 가는 페이지 바로가기" />
            <CardContent>
              <Box
                component="ul"
                sx={{
                  m: 0,
                  p: 0,
                  listStyle: "none",
                  display: "grid",
                  gridTemplateColumns: { xs: "1fr", sm: "1fr 1fr" },
                  rowGap: 1.5,
                  columnGap: 3,
                }}
              >
                <li><Link href="/dashboard/users">사용자 검색 →</Link></li>
                <li><Link href="/dashboard/devices">디바이스 목록 →</Link></li>
                <li><Link href="/dashboard/firmware">펌웨어 배포 상태 →</Link></li>
                <li><Link href="/dashboard/posts">대기 중인 신고 게시물 →</Link></li>
                <li><Link href="/dashboard/commerce/orders">최근 주문 →</Link></li>
                <li><Link href="/dashboard/commerce/webhooks?only_failures=1">실패한 웹훅 이벤트 →</Link></li>
              </Box>
            </CardContent>
          </Card>
        </Grid>
        <Grid item xs={12} md={4}>
          <Card>
            <CardHeader title="환경 정보" subheader="ICONIA Admin 운영 콘솔" />
            <CardContent>
              <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>
                상단 환경 배지로 현재 환경을 확인하세요. PROD 작업 시 audit 로그가 모두 기록됩니다.
              </Typography>
              <Typography variant="caption" color="text.secondary">
                차트는 다음 PR에서 추가 예정.
              </Typography>
            </CardContent>
          </Card>
        </Grid>
      </Grid>
    </Box>
  );
}
