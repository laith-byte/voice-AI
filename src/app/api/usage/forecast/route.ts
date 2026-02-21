import { NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/auth";
import { FALLBACK_COST_PER_MINUTE } from "@/lib/retell-costs";

export async function GET() {
  const { user, supabase, response } = await requireAuth();
  if (response) return response;

  const { data: userData } = await supabase
    .from("users")
    .select("client_id, organization_id")
    .eq("id", user!.id)
    .single();

  if (!userData?.client_id) {
    return NextResponse.json({ error: "No client found" }, { status: 404 });
  }

  const now = new Date();
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  // Fetch last 30 days of call logs
  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("duration_seconds, started_at, created_at")
    .eq("client_id", userData.client_id)
    .gte("created_at", thirtyDaysAgo.toISOString())
    .order("created_at", { ascending: true });

  if (!callLogs || callLogs.length === 0) {
    return NextResponse.json({
      current_spend: 0,
      daily_average: 0,
      projected_month_end: 0,
      days_remaining: getDaysRemaining(),
      trend: "stable" as const,
      daily_costs: [],
    });
  }

  // Group costs by date
  const dailyCosts: Record<string, number> = {};
  let totalCost = 0;

  for (const log of callLogs) {
    const minutes = (log.duration_seconds ?? 0) / 60;
    const cost = minutes * FALLBACK_COST_PER_MINUTE;
    totalCost += cost;

    const dateKey = (log.started_at || log.created_at).split("T")[0];
    dailyCosts[dateKey] = (dailyCosts[dateKey] ?? 0) + cost;
  }

  // Current month cost
  const firstOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  let currentMonthSpend = 0;
  for (const log of callLogs) {
    const logDate = new Date(log.started_at || log.created_at);
    if (logDate >= firstOfMonth) {
      const minutes = (log.duration_seconds ?? 0) / 60;
      currentMonthSpend += minutes * FALLBACK_COST_PER_MINUTE;
    }
  }

  // Calculate daily average over active days in the last 30 days
  const sortedDates = Object.keys(dailyCosts).sort();
  const activeDays = sortedDates.length;
  const dailyAverage = activeDays > 0 ? totalCost / activeDays : 0;

  // Days remaining in current billing period (month)
  const daysRemaining = getDaysRemaining();

  // Days elapsed this month
  const dayOfMonth = now.getDate();
  const currentMonthDailyAvg = dayOfMonth > 0 ? currentMonthSpend / dayOfMonth : 0;

  // Project month-end cost
  const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
  const projectedMonthEnd = currentMonthDailyAvg * daysInMonth;

  // Trend detection: compare first half vs second half of the 30-day window
  const midpoint = Math.floor(sortedDates.length / 2);
  let firstHalfAvg = 0;
  let secondHalfAvg = 0;

  if (sortedDates.length >= 4) {
    const firstHalf = sortedDates.slice(0, midpoint);
    const secondHalf = sortedDates.slice(midpoint);
    firstHalfAvg = firstHalf.reduce((s, d) => s + dailyCosts[d], 0) / firstHalf.length;
    secondHalfAvg = secondHalf.reduce((s, d) => s + dailyCosts[d], 0) / secondHalf.length;
  }

  const trendRatio = firstHalfAvg > 0 ? secondHalfAvg / firstHalfAvg : 1;
  let trend: "increasing" | "stable" | "decreasing" = "stable";
  if (trendRatio > 1.15) trend = "increasing";
  else if (trendRatio < 0.85) trend = "decreasing";

  // Build daily cost array for chart
  const dailyCostArray = sortedDates.map((date) => ({
    date,
    cost: Math.round(dailyCosts[date] * 100) / 100,
  }));

  return NextResponse.json({
    current_spend: Math.round(currentMonthSpend * 100) / 100,
    daily_average: Math.round(dailyAverage * 100) / 100,
    projected_month_end: Math.round(projectedMonthEnd * 100) / 100,
    days_remaining: daysRemaining,
    trend,
    daily_costs: dailyCostArray,
  });
}

function getDaysRemaining(): number {
  const now = new Date();
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  return Math.max(0, endOfMonth.getDate() - now.getDate());
}
