import Alert from "@mui/material/Alert";
import Box from "@mui/material/Box";
import Card from "@mui/material/Card";
import CardContent from "@mui/material/CardContent";
import CardHeader from "@mui/material/CardHeader";
import Grid from "@mui/material/Grid";
import Table from "@mui/material/Table";
import TableBody from "@mui/material/TableBody";
import TableCell from "@mui/material/TableCell";
import TableContainer from "@mui/material/TableContainer";
import TableHead from "@mui/material/TableHead";
import TableRow from "@mui/material/TableRow";
import Typography from "@mui/material/Typography";
import CallMadeOutlined from "@mui/icons-material/CallMadeOutlined";
import TrendingDownOutlined from "@mui/icons-material/TrendingDownOutlined";
import SpeedOutlined from "@mui/icons-material/SpeedOutlined";
import { readSession } from "@/lib/authCookie";
import { getAiHealth } from "@/lib/adminApi";
import { messageForCode } from "@/lib/errorMessages";
import { StatCard } from "@/app/components/dashboard/StatCard";

export const dynamic = "force-dynamic";

export default async function AiHealthPage() {
  const jwt = readSession()!;
  const res = await getAiHealth({ jwt });

  return (
    <Box>
      <Box sx={{ mb: 3 }}>
        <Typography variant="h4" component="h1" sx={{ fontWeight: 700 }}>
          AI 상태
        </Typography>
        <Typography variant="body2" color="text.secondary">
          5분 sliding window 기준 fallback rate / latency / error code 분포.
        </Typography>
      </Box>

      {!res.ok ? (
        <Alert severity="error" role="alert">
          {messageForCode(res.code, res.message)}
        </Alert>
      ) : (
        <>
          <Grid container spacing={3} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                color="info"
                icon={<CallMadeOutlined />}
                title="total calls"
                value={res.data.total_calls}
                sub={`window ${res.data.window_seconds}s`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                color={res.data.fallback_rate > 0.1 ? "error" : "success"}
                icon={<TrendingDownOutlined />}
                title="fallback rate"
                value={`${(res.data.fallback_rate * 100).toFixed(2)}%`}
                sub={`${res.data.fallback_count} fallback`}
              />
            </Grid>
            <Grid item xs={12} sm={6} md={4}>
              <StatCard
                color="warning"
                icon={<SpeedOutlined />}
                title="p95 latency"
                value={
                  <>
                    {res.data.p95_latency_ms ?? "—"}
                    <Typography component="span" variant="body2" sx={{ color: "text.secondary", ml: 0.5 }}>
                      ms
                    </Typography>
                  </>
                }
                sub={`p50 ${res.data.p50_latency_ms ?? "—"} ms`}
              />
            </Grid>
          </Grid>

          <Card sx={{ mt: 2 }}>
            <CardHeader title="error codes" subheader="이 구간 발생 에러 분포" />
            <CardContent sx={{ p: 0, "&:last-child": { pb: 0 } }}>
              {res.data.errors.length === 0 ? (
                <Box sx={{ p: 3 }}>
                  <Alert severity="info" variant="outlined">
                    이 구간 에러 없음
                  </Alert>
                </Box>
              ) : (
                <TableContainer>
                  <Table size="small">
                    <TableHead>
                      <TableRow>
                        <TableCell>code</TableCell>
                        <TableCell>count</TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {res.data.errors.map((e) => (
                        <TableRow key={e.code}>
                          <TableCell>
                            <Box component="code" sx={{ fontSize: "0.8125rem" }}>
                              {e.code}
                            </Box>
                          </TableCell>
                          <TableCell>{e.count}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </TableContainer>
              )}
            </CardContent>
          </Card>

          <Typography variant="caption" color="text.secondary" sx={{ display: "block", mt: 2 }}>
            last_updated_at: {res.data.last_updated_at}
          </Typography>
        </>
      )}
    </Box>
  );
}
