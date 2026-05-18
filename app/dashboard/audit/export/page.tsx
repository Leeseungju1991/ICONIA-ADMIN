import Link from "next/link";
import Box from "@mui/material/Box";
import Button from "@mui/material/Button";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Stack from "@mui/material/Stack";
import TextField from "@mui/material/TextField";
import Typography from "@mui/material/Typography";
import DownloadOutlined from "@mui/icons-material/DownloadOutlined";

export const dynamic = "force-dynamic";

// Audit log CSV export 페이지 (P1 §5.2 #32).
// since/until 입력 + 다운로드 버튼. 실제 CSV 응답은 sibling route handler
// (./download/route.ts) 가 streaming 으로 반환.
// IMPORTANT: form action="/dashboard/audit/export/download" method="get" 컨트랙트 유지 — route handler 가 GET 으로 받는다.

function defaultIsoSince(): string {
  const d = new Date(Date.now() - 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 16);
}

function defaultIsoUntil(): string {
  return new Date().toISOString().slice(0, 16);
}

export default async function AuditExportPage() {
  return (
    <Box>
      <Box sx={{ mb: 2 }}>
        <Link href="/dashboard/audit">← Audit 로그</Link>
      </Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          Audit 로그 CSV Export
        </Typography>
        <Typography variant="body2" color="text.secondary">
          시작/종료 시각을 입력하면 audit_log 의 sequence_no, action, operator, target, outcome, ip,
          created_at, prev_hash, current_hash 컬럼을 CSV 로 내려받습니다.
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 1 }}>
          한 번에 최대 <strong>10,000 row</strong> 까지 export. 더 큰 범위가 필요하면 시간 구간을 좁히세요.
        </Typography>
      </Box>

      <Card sx={{ maxWidth: 560 }}>
        <CardHeader title="CSV 내보내기" subheader="조건 입력 후 다운로드" />
        <CardContent>
          {/* IMPORTANT: action="/dashboard/audit/export/download" method="get" — route handler 컨트랙트 (변경 금지). */}
          <form action="/dashboard/audit/export/download" method="get">
            <Stack spacing={2}>
              <TextField
                id="since"
                name="since"
                type="datetime-local"
                label="since (시작)"
                InputLabelProps={{ shrink: true }}
                defaultValue={defaultIsoSince()}
                required
                size="small"
                fullWidth
              />
              <TextField
                id="until"
                name="until"
                type="datetime-local"
                label="until (종료, 선택)"
                InputLabelProps={{ shrink: true }}
                defaultValue={defaultIsoUntil()}
                size="small"
                fullWidth
              />
              <TextField
                id="action_filter"
                name="action"
                type="text"
                label="action 필터 (선택)"
                placeholder="예: device_unpaired"
                size="small"
                fullWidth
              />
              <Button
                type="submit"
                variant="contained"
                startIcon={<DownloadOutlined />}
                size="large"
                sx={{ alignSelf: "flex-start" }}
              >
                CSV 다운로드
              </Button>
            </Stack>
          </form>
        </CardContent>
      </Card>

      <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 3 }}>
        본 export 는 SOC2 / ISO27001 감사 대비용. 다운로드 자체가 audit_log 에 기록됩니다
        (server 측 audit_log_exported action) — operator_id + ip + since/until 가 남습니다.
      </Typography>
    </Box>
  );
}
