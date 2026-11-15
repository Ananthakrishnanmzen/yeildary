import type { DashboardPayload } from "@/types";

const API_BASE =
  process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function fetchDashboard(farmId: string): Promise<DashboardPayload> {
  const res = await fetch(`${API_BASE}/api/farms/${farmId}/dashboard/`, {
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Dashboard fetch failed: ${res.status}`);
  return (await res.json()) as DashboardPayload;
}
