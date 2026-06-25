"use client";

import { useEffect, useMemo, useState } from "react";
import { PanelCard } from "../_components/PanelCard";
import { AdminToast, useAdminToast } from "../_components/AdminToast";
import { DataTable, type Column } from "../_components/DataTable";
import { StatCard } from "../_components/StatCard";
import {
  formatDate,
  type DeviceRow,
} from "@/lib/mockData";
import { fetchDeviceOwnershipHistoryAction } from "@/lib/actions/deviceOwnership";
import {
  listDevicesAction,
  listDeviceEventsAction,
  listFirmwareErrorEventsAction,
  listFirmwareDeploymentsAction,
  type FirmwareErrorEvent,
  type FirmwareDeploymentRow,
} from "@/lib/actions/devices";
import { getDeviceBootInvariantsAction } from "@/lib/actions/bootInvariants";
import { safeImgSrc } from "@/lib/safeUrl";
import { fetchDistributionAction } from "@/lib/actions/deviceDistribution";
import type {
  OwnershipHop,
  DeviceRow as ServerDeviceRow,
  DeviceBootInvariants,
  DistributionBy,
  DistributionItem,
  DeviceEventRow,
} from "@/lib/adminApi";

// 오늘 페어링 카운트 — paired_at 이 최근 48h 이내. mock baseline.
const PAIRING_WINDOW_HOURS = 48;

// 디바이스 모니터링 — ESP32 인형 last seen / 배터리 / 펌웨어 / 연결 상태.

function lastSeenLabel(iso: string, online: boolean): string {
  if (online) return "온라인";
  const diffMs = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diffMs / 60_000);
  if (min < 60) return `${min}분 전`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}시간 전`;
  const day = Math.floor(hr / 24);
  return `${day}일 전`;
}

function batteryChip(pct: number): string {
  if (pct >= 60) return "chip chip-success";
  if (pct >= 25) return "chip chip-warn";
  return "chip chip-error";
}

function rssiLabel(rssi: number): string {
  if (rssi >= -55) return "강";
  if (rssi >= -70) return "중";
  if (rssi >= -85) return "약";
  return "끊김";
}

// Server `ServerDeviceRow` (lib/adminApi) → UI DeviceRow shape adapter.
// Server 응답에 미존재한 필드(wifi_rssi/region/silenced) 는 null 로 두고 UI 가
// "—" 표시. 정본 추가 시 server 응답에 필드 추가 후 본 adapter 도 갱신.
function adaptServerDevice(s: ServerDeviceRow): DeviceRow {
  return {
    id: s.device_id,
    serial: s.serial ?? s.device_id,
    owner_user_id: s.user_id,
    firmware_version: s.firmware_version ?? "unknown",
    last_seen_at: s.last_seen_at ?? new Date(0).toISOString(),
    online: s.online,
    battery_pct: typeof s.last_battery_percent === "number" ? s.last_battery_percent : 0,
    wifi_rssi: null,
    region: null,
    paired_at: s.paired_at ?? new Date(0).toISOString(),
    silenced: null,
  };
}

export default function DevicesPage() {
  const [q, setQ] = useState("");
  const [state, setState] = useState<"all" | "online" | "offline" | "low_battery">("all");
  // region select 는 명시 enum (DeviceRow.region 의 null 가능성을 제외 — null 디바이스는
  // region 필터가 켜진 동안 모두 필터 아웃).
  const [region, setRegion] = useState<"all" | "KR" | "JP" | "US">("all");
  const [picked, setPicked] = useState<DeviceRow | null>(null);

  // Phase 13-C — Server `/api/v1/admin/devices` fetch.
  const [devices, setDevices] = useState<DeviceRow[]>([]);
  const [devicesError, setDevicesError] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    listDevicesAction({ limit: 200 })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setDevicesError(r.message);
        } else {
          setDevices(r.items.map(adaptServerDevice));
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Mock-15 — 기존 mockFirmwareErrors / mockOtaFirmwares 를 서버 정본으로 교체.
  // 실패 시 graceful 빈 배열 + source:"fallback".
  const [firmwareErrors, setFirmwareErrors] = useState<FirmwareErrorEvent[]>([]);
  const [firmwareErrorsSource, setFirmwareErrorsSource] = useState<
    "server" | "fallback"
  >("server");
  const [otaDeployments, setOtaDeployments] = useState<FirmwareDeploymentRow[]>([]);
  const [otaDeploymentsSource, setOtaDeploymentsSource] = useState<
    "server" | "fallback"
  >("server");
  useEffect(() => {
    let cancelled = false;
    listFirmwareErrorEventsAction().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setFirmwareErrors(r.items);
        setFirmwareErrorsSource(r.source);
      } else {
        setFirmwareErrors([]);
        setFirmwareErrorsSource("fallback");
      }
    });
    listFirmwareDeploymentsAction().then((r) => {
      if (cancelled) return;
      if (r.ok) {
        setOtaDeployments(r.items);
        setOtaDeploymentsSource(r.source);
      } else {
        setOtaDeployments([]);
        setOtaDeploymentsSource("fallback");
      }
    });
    return () => {
      cancelled = true;
    };
  }, []);
  const { toast, setToast } = useAdminToast();

  const filtered = useMemo(
    () =>
      devices.filter((d) => {
        // region 이 server 응답에 미존재 (null) — region 필터가 켜지면 모두 제외.
        if (region !== "all" && d.region !== region) return false;
        if (state === "online" && !d.online) return false;
        if (state === "offline" && d.online) return false;
        if (state === "low_battery" && d.battery_pct >= 25) return false;
        if (q) {
          const s = q.toLowerCase();
          return (
            d.serial.toLowerCase().includes(s) ||
            d.id.toLowerCase().includes(s) ||
            (d.owner_user_id ?? "").toLowerCase().includes(s)
          );
        }
        return true;
      }),
    [q, state, region, devices],
  );

  const stats = useMemo(() => {
    const total = devices.length;
    const online = devices.filter((d) => d.online).length;
    const low = devices.filter((d) => d.battery_pct < 25).length;
    const unpaired = devices.filter((d) => !d.owner_user_id).length;
    return { total, online, low, unpaired };
  }, [devices]);

  // 라운드 4 (2026-05-20) E2E QC: 디바이스 라이프사이클 지표 추가.
  const lifecycle = useMemo(() => {
    const now = Date.now();
    const windowMs = PAIRING_WINDOW_HOURS * 60 * 60 * 1000;
    const pairedRecent = devices.filter(
      (d) => d.owner_user_id && now - new Date(d.paired_at).getTime() <= windowMs,
    ).length;
    const fwErrCount = firmwareErrors.reduce((s, e) => s + (e.count ?? 0), 0);
    const rolling = otaDeployments.filter((f) => f.state === "rolling_out");
    const rolloutApplied = rolling.reduce((s, f) => s + (f.applied_count ?? 0), 0);
    const rolloutTarget = rolling.reduce((s, f) => s + (f.target_count ?? 0), 0);
    const rolloutPct =
      rolloutTarget > 0 ? Math.round((rolloutApplied / rolloutTarget) * 100) : 0;
    return { pairedRecent, fwErrCount, rolling, rolloutPct };
  }, [devices, firmwareErrors, otaDeployments]);

  // 출시준비 라운드 §8 — 배터리 분포 (high ≥60%, mid 25~59%, low 10~24%, critical <10%).
  const batteryDistribution = useMemo(() => {
    let high = 0;
    let mid = 0;
    let low = 0;
    let critical = 0;
    for (const d of devices) {
      if (d.battery_pct >= 60) high++;
      else if (d.battery_pct >= 25) mid++;
      else if (d.battery_pct >= 10) low++;
      else critical++;
    }
    const total = devices.length;
    return { high, mid, low, critical, total };
  }, [devices]);

  // 출시준비 라운드 §9 — BLE 페어링 안정성. firmware error 의 BLE_GATT_TIMEOUT 비중과
  // 최근 24h 페어링 시도 추정(=최근 페어링 카운트) 으로 실패율 근사.
  // 백엔드 연동 시 `/api/v1/admin/devices/pairings?since=24h` 의 (pair_attempt, pair_success)
  // 카운터로 정확한 실패율로 교체.
  const blePairingStability = useMemo(() => {
    const bleTimeouts = firmwareErrors
      .filter((e) => e.error_code === "BLE_GATT_TIMEOUT")
      .reduce((s, e) => s + (e.count ?? 0), 0);
    const now = Date.now();
    const windowMs = PAIRING_WINDOW_HOURS * 60 * 60 * 1000;
    const pairedRecent = devices.filter(
      (d) => d.owner_user_id && now - new Date(d.paired_at).getTime() <= windowMs,
    ).length;
    // 페어링 시도 estimate = 성공 + timeout (보수적). 백엔드 연동 후 실 카운터로 교체.
    const attempts = pairedRecent + bleTimeouts;
    const failureRate = attempts > 0 ? (bleTimeouts / attempts) * 100 : 0;
    return { bleTimeouts, attempts, failureRate };
  }, [devices, firmwareErrors]);

  // 디바이스별 펌웨어 에러 카운트 — 같은 device_id 의 fw error 누적.
  const fwErrorsByDevice = useMemo(() => {
    const map = new Map<string, number>();
    for (const e of firmwareErrors) {
      map.set(e.device_id, (map.get(e.device_id) ?? 0) + (e.count ?? 0));
    }
    return map;
  }, [firmwareErrors]);

  const columns: Column<DeviceRow>[] = [
    {
      key: "state",
      header: "상태",
      render: (r) => (
        <span className={r.online ? "chip chip-success" : "chip chip-muted"}>
          {r.online ? "온라인" : "오프라인"}
        </span>
      ),
    },
    { key: "serial", header: "시리얼", render: (r) => <span className="font-mono text-xs font-medium text-slate-800">{r.serial}</span> },
    {
      key: "owner",
      header: "소유자",
      render: (r) => (
        <span className="font-mono text-xs">{r.owner_user_id ?? <span className="text-muted">미페어링</span>}</span>
      ),
    },
    { key: "fw", header: "FW", render: (r) => <span className="chip chip-info">{r.firmware_version}</span> },
    {
      key: "bat",
      header: "배터리",
      render: (r) => <span className={batteryChip(r.battery_pct)}>{r.battery_pct}%</span>,
    },
    {
      key: "rssi",
      header: "Wi-Fi",
      render: (r) =>
        r.wifi_rssi == null ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <span className="text-xs text-slate-700">
            {rssiLabel(r.wifi_rssi)} <span className="text-muted ml-1">{r.wifi_rssi}dBm</span>
          </span>
        ),
    },
    {
      key: "region",
      header: "지역",
      render: (r) =>
        r.region == null ? (
          <span className="text-xs text-muted">—</span>
        ) : (
          <span className="chip chip-muted">{r.region}</span>
        ),
    },
    {
      key: "fwerr",
      header: "FW 에러 (예시)",
      align: "right",
      render: (r) => {
        const c = fwErrorsByDevice.get(r.id) ?? 0;
        if (c === 0) return <span className="text-xs text-muted">—</span>;
        return <span className={c > 50 ? "chip chip-error" : "chip chip-warn"}>{c.toLocaleString()}</span>;
      },
    },
    {
      key: "last",
      header: "마지막 통신",
      render: (r) => <span className="text-xs text-muted">{lastSeenLabel(r.last_seen_at, r.online)}</span>,
    },
    {
      key: "actions",
      header: "",
      align: "right",
      render: (r) => (
        <button className="btn-outline text-xs" type="button" onClick={() => setPicked(r)}>
          상세
        </button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="총 디바이스" value={stats.total.toLocaleString()} hint="등록된 인형" accent="blue" />
        <StatCard
          label="온라인"
          value={stats.online.toLocaleString()}
          delta={`${((stats.online / stats.total) * 100).toFixed(0)}%`}
          deltaTone="up"
          hint="현재 통신 중"
          accent="teal"
        />
        <StatCard label="저전력 (<25%)" value={String(stats.low)} hint="알림 권장" accent="pink" />
        <StatCard label="미페어링" value={String(stats.unpaired)} hint="소유자 미할당" accent="orange" />
      </section>

      <LiveDevicesPanel />

      <FleetDistributionPanel />

      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="최근 페어링"
          value={String(lifecycle.pairedRecent)}
          hint={`최근 ${PAIRING_WINDOW_HOURS}h (paired_at 기준)`}
          accent="teal"
        />
        <StatCard
          label="FW 에러 (24h)"
          value={lifecycle.fwErrCount.toLocaleString()}
          delta={`${firmwareErrors.length} 유형`}
          deltaTone={lifecycle.fwErrCount > 100 ? "down" : "flat"}
          hint={
            firmwareErrorsSource === "server"
              ? "Server `/api/v1/admin/devices/events`"
              : "Server 미도달 — 데이터 준비 중"
          }
          accent="pink"
        />
        <StatCard
          label="OTA 진행 중"
          value={String(lifecycle.rolling.length)}
          hint={
            otaDeploymentsSource === "server"
              ? "Server `/api/v1/admin/firmware/deployments`"
              : "Server 미도달 — 데이터 준비 중"
          }
          accent="orange"
        />
        <StatCard
          label="OTA 적용률"
          value={`${lifecycle.rolloutPct}%`}
          delta={lifecycle.rolling.length ? "활성 캠페인 합" : "—"}
          deltaTone="up"
          hint={
            otaDeploymentsSource === "server"
              ? "applied / target 합산"
              : "Server 미도달 — 데이터 준비 중"
          }
          accent="blue"
        />
      </section>

      {/* 출시준비 라운드 §9 — BLE 페어링 실패율 (firmware BLE_GATT_TIMEOUT 기반 근사).
          ⚠ 예시/데모 데이터: mockFirmwareErrors 기반 근사치로, 실 페어링 카운터 미연동. */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="BLE 페어링 실패 · 예시"
          value={blePairingStability.bleTimeouts.toLocaleString()}
          hint="예시/데모 데이터 (실데이터 미연동)"
          accent="pink"
        />
        <StatCard
          label="BLE 페어링 실패율 · 예시"
          value={`${blePairingStability.failureRate.toFixed(1)}%`}
          delta={blePairingStability.failureRate > 10 ? "임계 초과" : "정상"}
          deltaTone={blePairingStability.failureRate > 10 ? "down" : "up"}
          hint="예시/데모 데이터 (mock 근사)"
          accent={blePairingStability.failureRate > 10 ? "pink" : "teal"}
        />
        <StatCard
          label="BLE 페어링 시도 · 예시"
          value={blePairingStability.attempts.toLocaleString()}
          hint="예시/데모 데이터 (실데이터 미연동)"
          accent="blue"
        />
        <StatCard
          label="BLE kill switch"
          value="확인 →"
          hint="/dashboard/ops · ble.pairing"
          accent="orange"
        />
      </section>

      {/* 출시준비 라운드 §8 — 배터리 분포 카드 (high / mid / low / critical). */}
      <PanelCard
        title="배터리 분포"
        description="전체 기기의 배터리 잔량 분포입니다. 위험 구간은 알림이 권장됩니다."
      >
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          {([
            { label: "충분 (≥60%)", value: batteryDistribution.high, color: "bg-emerald-400", meta: "여유" },
            { label: "보통 (25~59%)", value: batteryDistribution.mid, color: "bg-sky-400", meta: "주의" },
            { label: "낮음 (10~24%)", value: batteryDistribution.low, color: "bg-amber-400", meta: "충전 권장" },
            { label: "위험 (<10%)", value: batteryDistribution.critical, color: "bg-rose-500", meta: "즉시 알림" },
          ] as const).map((b) => {
            const pct =
              batteryDistribution.total > 0
                ? (b.value / batteryDistribution.total) * 100
                : 0;
            return (
              <div
                key={b.label}
                className="rounded-2xl bg-white/55 border border-white/60 p-4"
              >
                <div className="flex items-center gap-2">
                  <span className={`inline-block w-3 h-3 rounded-sm ${b.color}`} />
                  <span className="text-xs font-medium text-slate-700">{b.label}</span>
                </div>
                <div className="text-xl font-bold text-slate-900 mt-2">
                  {b.value.toLocaleString()}
                </div>
                <div className="text-[11px] text-muted mt-0.5">
                  {pct.toFixed(0)}% · {b.meta}
                </div>
                <div className="mt-2 h-1.5 rounded-full bg-white/60 overflow-hidden">
                  <div className={`h-full ${b.color}`} style={{ width: `${pct}%` }} />
                </div>
              </div>
            );
          })}
        </div>
      </PanelCard>

      <PanelCard
        title="디바이스 목록"
        description="인형의 최근 통신·배터리·펌웨어·Wi-Fi 상태를 확인합니다."
        actions={
          <>
            <input
              className="input max-w-[220px]"
              placeholder="시리얼/디바이스 ID/소유자 검색"
              value={q}
              onChange={(e) => setQ(e.target.value)}
            />
            <select
              className="select max-w-[140px]"
              value={state}
              onChange={(e) => setState(e.target.value as typeof state)}
            >
              <option value="all">전체 상태</option>
              <option value="online">온라인</option>
              <option value="offline">오프라인</option>
              <option value="low_battery">저전력</option>
            </select>
            <select
              className="select max-w-[120px]"
              value={region}
              onChange={(e) => setRegion(e.target.value as typeof region)}
            >
              <option value="all">전체 지역</option>
              <option value="KR">KR</option>
              <option value="JP">JP</option>
              <option value="US">US</option>
            </select>
          </>
        }
      >
        <DataTable columns={columns} rows={filtered} empty="조건에 맞는 디바이스가 없습니다." />
      </PanelCard>

      <AdminToast toast={toast} onDismiss={() => setToast(null)} />

      {picked ? (
        <DeviceDrawer
          device={picked}
          onClose={() => setPicked(null)}
          onToast={(m) => setToast(m)}
        />
      ) : null}
    </div>
  );
}

function DeviceDrawer({
  device,
  onClose,
  onToast,
}: {
  device: DeviceRow;
  onClose: () => void;
  // onToast 는 상단 페이지가 주입하지만, 현재 드로어 액션이 모두 "준비 중" 으로
  // 비활성화되어 직접 사용처는 없다. 백엔드 연동 시 재사용 예정이라 시그니처는 유지.
  onToast: (msg: string) => void;
}) {
  void onToast;

  return (
    <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center sm:justify-end p-3 sm:p-6 bg-black/30">
      <div className="w-full max-w-md glass-panel rounded-3xl p-6 relative">
        <button
          className="absolute right-4 top-4 rounded-xl px-3 py-1.5 bg-white/70 border border-white/70 text-xs text-slate-600"
          onClick={onClose}
          type="button"
        >
          닫기
        </button>
        <h3 className="text-lg font-bold text-slate-900">디바이스 상세</h3>
        <p className="text-xs text-muted mt-0.5 font-mono">{device.serial}</p>

        <dl className="mt-5 space-y-3 text-sm">
          <Row k="디바이스 ID" v={<span className="font-mono text-xs">{device.id}</span>} />
          <Row
            k="상태"
            v={
              <span className={device.online ? "chip chip-success" : "chip chip-muted"}>
                {device.online ? "온라인" : "오프라인"}
              </span>
            }
          />
          <Row k="소유자" v={<span className="font-mono">{device.owner_user_id ?? "미페어링"}</span>} />
          <Row k="펌웨어" v={device.firmware_version} />
          <Row k="배터리" v={<span className={batteryChip(device.battery_pct)}>{device.battery_pct}%</span>} />
          <Row
            k="Wi-Fi"
            v={device.wifi_rssi == null ? "—" : `${rssiLabel(device.wifi_rssi)} (${device.wifi_rssi}dBm)`}
          />
          <Row k="지역" v={device.region ?? "—"} />
          <Row k="페어링" v={formatDate(device.paired_at)} />
          <Row k="마지막 통신" v={formatDate(device.last_seen_at)} />
          <Row k="음소거" v={device.silenced == null ? "—" : device.silenced ? "예" : "아니오"} />
        </dl>

        {/* 아래 액션은 Server 정본 endpoint 미연동 — 비활성 ("준비 중") 으로 표시해
            운영자가 동작하는 기능으로 오인하지 않도록 한다. */}
        <div className="mt-6 grid grid-cols-2 gap-2">
          <button className="btn-outline text-sm" type="button" disabled title="준비 중 (백엔드 미연동)">핑 전송 (준비 중)</button>
          <button className="btn-outline text-sm" type="button" disabled title="준비 중 (백엔드 미연동)">OTA 강제 (준비 중)</button>
          <button className="btn-outline text-sm" type="button" disabled title="준비 중 (백엔드 미연동)">음소거 (준비 중)</button>
          <button className="btn-danger text-sm" type="button" disabled title="준비 중 (백엔드 미연동)">페어링 해제 (준비 중)</button>
        </div>
        <p className="mt-2 text-[11px] text-muted">※ 핑/OTA/음소거/페어링 해제 액션은 백엔드 연동 준비 중입니다.</p>

        <DeviceMediaPanel deviceId={device.id} />
        <OwnershipTimeline deviceId={device.id} />
        <BootInvariantsPanel deviceId={device.id} />

        <p className="text-[11px] text-muted mt-3">※ 소유권 이력 Server `/api/v1/admin/devices/:id/ownership-history` 정본 연동.</p>
      </div>
    </div>
  );
}

// 센서/미디어 — Server `/api/v1/admin/devices/:id/events` 정본.
// 사진(image_url) / 터치 면(touch) / 배터리(battery) / 시각(at) 을 이벤트 단위로 표시.
// 시나리오 "사진/터치/센서 데이터" 운영자 조회 요건을 충족.
function DeviceMediaPanel({ deviceId }: { deviceId: string }) {
  const [items, setItems] = useState<DeviceEventRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    listDeviceEventsAction({ deviceId, limit: 30 })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
          setItems(null);
        } else {
          setItems(r.items);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  return (
    <div className="mt-5 rounded-2xl border border-white/60 bg-white/30 p-3">
      <div className="text-sm font-semibold mb-2">센서/미디어 (사진·터치·배터리)</div>
      {loading ? (
        <div className="text-xs text-muted">불러오는 중</div>
      ) : error ? (
        <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
          Server 도달 실패: {error}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-xs text-muted">센서/미디어 이벤트가 없습니다.</div>
      ) : (
        <ol className="space-y-2">
          {items.map((ev) => (
            <li
              key={ev.event_id}
              className="rounded-xl bg-white/65 border border-white/50 px-3 py-2 text-xs"
            >
              <div className="flex items-start gap-3">
                {safeImgSrc(ev.image_url) ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={safeImgSrc(ev.image_url)}
                    alt={`이벤트 ${ev.event_id} 사진`}
                    loading="lazy"
                    className="h-14 w-14 shrink-0 rounded-lg object-cover border border-white/60 bg-slate-100"
                  />
                ) : (
                  <div className="h-14 w-14 shrink-0 rounded-lg border border-white/60 bg-slate-100 grid place-items-center text-[10px] text-muted">
                    사진 없음
                  </div>
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="chip chip-info">{ev.kind}</span>
                    <span className="text-muted">{formatDate(ev.at)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 flex-wrap text-slate-700">
                    <span>
                      터치:{" "}
                      <span className="font-medium">{ev.touch ?? "—"}</span>
                    </span>
                    <span>
                      배터리:{" "}
                      <span className={ev.battery == null ? "" : batteryChip(ev.battery)}>
                        {ev.battery == null ? "—" : `${ev.battery}%`}
                      </span>
                    </span>
                  </div>
                  {ev.image_url ? (
                    <a
                      href={ev.image_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="mt-1 inline-block text-indigo-600 underline"
                    >
                      원본 보기
                    </a>
                  ) : null}
                </div>
              </div>
            </li>
          ))}
        </ol>
      )}
      <p className="mt-2 text-[11px] text-muted italic">
        ※ 운영자 전용 진단. Server `/api/v1/admin/devices/:id/events` 정본 연동.
      </p>
    </div>
  );
}

// V3.0 #27 — 디바이스 출하 잠금 invariant 검사.
// Server `/api/v1/admin/devices/:id/boot-invariants` 가 boot_invariant_mask 와 ENV
// `REQUIRED_BOOT_INVARIANT_MASK` 의 비트 AND 결과를 검증. 위반 시 audit_log 자동.
function BootInvariantsPanel({ deviceId }: { deviceId: string }) {
  const [data, setData] = useState<DeviceBootInvariants | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    getDeviceBootInvariantsAction({ deviceId })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
        } else {
          setData(r.data);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  return (
    <div className="mt-3 rounded-2xl border border-white/60 bg-white/30 p-3">
      <div className="text-sm font-semibold mb-1">출하 잠금 invariant (8-bit)</div>
      {loading ? (
        <div className="text-xs text-muted">불러오는 중</div>
      ) : error ? (
        <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
          Server 도달 실패: {error}
        </div>
      ) : !data ? (
        <div className="text-xs text-muted">자료 없음</div>
      ) : (
        <div className="space-y-2 text-xs">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={invariantBadgeClass(data)}>
              {invariantBadgeLabel(data)}
            </span>
            <span className="font-mono">
              mask 0x{(data.boot_invariant_mask ?? 0).toString(16).padStart(2, "0")} /
              required 0x{data.required_mask.toString(16).padStart(2, "0")}
            </span>
          </div>
          {data.missing_bits.length > 0 ? (
            <div className="text-amber-700">
              누락 비트: <span className="font-mono">{data.missing_bits.join(", ")}</span>
            </div>
          ) : null}
          <div className="text-muted">
            fw {data.fw_version ?? "—"} · last boot {data.last_boot_at ?? "—"} · count{" "}
            {data.boot_count ?? "—"}
          </div>
          <div className="text-[11px] text-muted italic">
            ※ 운영자 전용 진단. 사용자(소비자)에게는 노출되지 않습니다. 비트 정의는 1.HW/docs/boot_invariants.md.
          </div>
        </div>
      )}
    </div>
  );
}

// V3.0 #27 (hw-fw Phase6-B) 권고 — 위반 분류별 카피·톤.
//   0x01/0x02/0x04 누락 → 출하 차단 (회수 검토) — 빨강
//   0x40 누락 → OTA 안티-롤백 미활성 (펌웨어 리빌드) — 빨강
//   0x08/0x10/0x20 누락 → 정책 강화 옵션 미충족 (출하 가능) — 노랑
//   누락 0 → 정상 — 녹색
function invariantBadgeClass(data: DeviceBootInvariants): string {
  if (data.ok) return "chip chip-success";
  const criticalBits = ["SECURE_BOOT_ENABLED", "FLASH_ENC_ENABLED", "JTAG_DISABLED", "OTA_ANTI_ROLLBACK_ARMED"];
  const hasCritical = data.missing_bits.some((b) => criticalBits.includes(b));
  return hasCritical ? "chip chip-error" : "chip chip-warn";
}
function invariantBadgeLabel(data: DeviceBootInvariants): string {
  if (data.ok) return "출하 잠금 정상";
  const criticalBits = ["SECURE_BOOT_ENABLED", "FLASH_ENC_ENABLED", "JTAG_DISABLED"];
  if (data.missing_bits.some((b) => criticalBits.includes(b))) {
    return "출하 잠금 미충족 — 회수 검토";
  }
  if (data.missing_bits.includes("OTA_ANTI_ROLLBACK_ARMED")) {
    return "안티-롤백 미활성 — 펌웨어 재빌드";
  }
  return "강화 옵션 미충족 (출하 가능)";
}

// V1.0 #6/#11 — Server `/api/v1/admin/devices` 실 디바이스 리스트.
// 기존 devices 통계는 그대로 두고 (디자인/리포트 호환), 페이지 상단에 실 데이터 패널 추가.
function LiveDevicesPanel() {
  const [items, setItems] = useState<ServerDeviceRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    listDevicesAction({ limit: 20 })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
          setItems(null);
        } else {
          setItems(r.items);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <PanelCard
      title="실시간 디바이스 (Server)"
      description="최근 통신·배터리·펌웨어 정보가 실시간으로 표시됩니다."
    >
      {loading ? (
        <div className="text-sm text-muted">불러오는 중</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Server 도달 실패: {error}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-sm text-muted">등록된 디바이스가 없습니다.</div>
      ) : (
        <ul className="space-y-2">
          {items.slice(0, 20).map((d) => (
            <li
              key={d.device_id}
              className="rounded-xl border border-white/60 bg-white/55 px-3 py-2 text-sm"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{d.serial ?? d.device_id}</span>
                <span className={d.online ? "chip chip-success" : "chip chip-muted"}>
                  {d.online ? "online" : "offline"}
                </span>
              </div>
              <div className="mt-1 text-xs text-muted">
                fw {d.firmware_version ?? "—"}
                {typeof d.last_battery_percent === "number"
                  ? ` · 배터리 ${d.last_battery_percent}%`
                  : ""}
                {" · 최근 통신 "}
                {d.last_seen_at ?? "—"}
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

// 양산직전 #15 — Fleet 디바이스 분포 패널.
// Server `/api/v1/admin/devices/distribution?by=...` 4가지 by 토글.
function FleetDistributionPanel() {
  const [by, setBy] = useState<DistributionBy>("version");
  const [items, setItems] = useState<DistributionItem[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDistributionAction({ by })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
          setItems(null);
        } else {
          setItems(r.items);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [by]);

  const byLabel: Record<DistributionBy, string> = {
    version: "펌웨어 버전",
    region: "지역",
    cohort: "cohort",
    fw_state: "펌웨어 상태",
  };

  return (
    <PanelCard
      title="Fleet 분포 (Server)"
      description="전체 기기의 분포 현황을 확인합니다."
      actions={
        <select
          className="select max-w-[160px]"
          value={by}
          onChange={(e) => setBy(e.target.value as DistributionBy)}
        >
          {(["version", "region", "cohort", "fw_state"] as const).map((k) => (
            <option key={k} value={k}>
              {byLabel[k]} 기준
            </option>
          ))}
        </select>
      }
    >
      {loading ? (
        <div className="text-sm text-muted">불러오는 중</div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          Server 도달 실패: {error}
        </div>
      ) : !items || items.length === 0 ? (
        <div className="text-sm text-muted">분포 데이터가 없습니다.</div>
      ) : (
        <ul className="space-y-2 text-sm">
          {items.map((it) => (
            <li
              key={it.key}
              className="rounded-xl border border-white/60 bg-white/55 px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-xs">{it.key}</span>
                <span className="text-xs text-muted">
                  {it.count.toLocaleString()}대 · {it.percent.toFixed(1)}%
                </span>
              </div>
              <div className="mt-1 h-1.5 rounded-full bg-white/70 overflow-hidden">
                <div
                  className="h-full bg-accent"
                  style={{ width: `${Math.min(it.percent, 100)}%` }}
                />
              </div>
            </li>
          ))}
        </ul>
      )}
    </PanelCard>
  );
}

// V3.0 #16 — 디바이스 소유권 timeline. Server `/api/v1/admin/devices/:id/ownership-history`
// 응답을 시간 역순 리스트로 표시 (claim_attempt / paired / revoked / lost).
function OwnershipTimeline({ deviceId }: { deviceId: string }) {
  const [history, setHistory] = useState<OwnershipHop[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchDeviceOwnershipHistoryAction({ deviceId })
      .then((r) => {
        if (cancelled) return;
        if (!r.ok) {
          setError(r.message);
          setHistory(null);
        } else {
          setHistory(r.history);
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [deviceId]);

  const kindChip = (k: OwnershipHop["kind"]) =>
    k === "paired"
      ? "chip chip-success"
      : k === "revoked"
        ? "chip chip-warn"
        : k === "lost"
          ? "chip chip-error"
          : "chip chip-info";
  const kindLabel: Record<OwnershipHop["kind"], string> = {
    claim_attempt: "claim 시도",
    paired: "페어링 완료",
    revoked: "페어링 해제",
    lost: "분실/도난",
  };

  return (
    <div className="mt-5 rounded-2xl border border-white/60 bg-white/30 p-3">
      <div className="text-sm font-semibold mb-2">소유권 이력 (Server)</div>
      {loading ? (
        <div className="text-xs text-muted">불러오는 중</div>
      ) : error ? (
        <div className="text-xs text-amber-700 bg-amber-50/80 border border-amber-200 rounded-xl px-3 py-2">
          Server 도달 실패: {error}
        </div>
      ) : !history || history.length === 0 ? (
        <div className="text-xs text-muted">이력이 없습니다.</div>
      ) : (
        <ol className="space-y-1">
          {history.map((h, i) => (
            <li
              key={`${h.at}-${i}`}
              className="rounded-xl bg-white/65 border border-white/50 px-3 py-2 text-xs"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className={kindChip(h.kind)}>{kindLabel[h.kind]}</span>
                <span className="text-muted">{h.at}</span>
                {h.user_id ? (
                  <span className="font-mono text-[10px] text-slate-700">user {h.user_id}</span>
                ) : null}
                {h.operator_id ? (
                  <span className="font-mono text-[10px] text-amber-700">op {h.operator_id}</span>
                ) : null}
              </div>
              {h.reason ? <div className="mt-1 text-muted">{h.reason}</div> : null}
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

function Row({ k, v }: { k: string; v: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-xl bg-white/55 border border-white/50 px-3 py-2">
      <dt className="text-xs text-muted">{k}</dt>
      <dd className="text-sm text-slate-800 font-medium">{v}</dd>
    </div>
  );
}
