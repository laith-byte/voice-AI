import { createServiceClient } from "@/lib/supabase/server";

export interface ScoringRule {
  criterion: string;
  points: number;
  label: string;
}

interface CallLog {
  id: string;
  agent_id: string;
  status: string;
  duration_seconds: number;
  summary?: string;
  post_call_analysis?: Record<string, unknown>;
  metadata?: Record<string, unknown>;
  from_number?: string;
}

interface ScoreBreakdown {
  [criterion: string]: { points: number; label: string };
}

const DEFAULT_RULES: ScoringRule[] = [
  { criterion: "call_completed", points: 20, label: "Call completed successfully" },
  { criterion: "duration_over_2min", points: 10, label: "Call lasted over 2 minutes" },
  { criterion: "appointment_booked", points: 30, label: "Appointment booked" },
  { criterion: "callback_requested", points: 15, label: "Callback requested" },
  { criterion: "positive_sentiment", points: 10, label: "Positive sentiment detected" },
  { criterion: "repeat_caller", points: 5, label: "Repeat caller" },
  { criterion: "voicemail_left", points: 5, label: "Voicemail left" },
];

function qualificationTier(score: number): string {
  if (score >= 70) return "qualified";
  if (score >= 40) return "hot";
  if (score >= 20) return "warm";
  if (score > 0) return "cold";
  return "unscored";
}

function evaluateCriterion(criterion: string, callLog: CallLog): boolean {
  switch (criterion) {
    case "call_completed":
      return callLog.status === "completed";
    case "duration_over_2min":
      return callLog.duration_seconds > 120;
    case "appointment_booked": {
      const analysis = callLog.post_call_analysis;
      const summary = callLog.summary?.toLowerCase() ?? "";
      const appointmentInAnalysis =
        analysis &&
        (JSON.stringify(analysis).toLowerCase().includes("appointment") ||
          JSON.stringify(analysis).toLowerCase().includes("booked") ||
          JSON.stringify(analysis).toLowerCase().includes("scheduled"));
      return !!(
        appointmentInAnalysis ||
        summary.includes("appointment") ||
        summary.includes("booked") ||
        summary.includes("scheduled")
      );
    }
    case "callback_requested": {
      const summary2 = callLog.summary?.toLowerCase() ?? "";
      const analysis2 = callLog.post_call_analysis;
      const callbackInAnalysis =
        analysis2 && JSON.stringify(analysis2).toLowerCase().includes("callback");
      return !!(callbackInAnalysis || summary2.includes("callback") || summary2.includes("call back"));
    }
    case "positive_sentiment": {
      const analysis3 = callLog.post_call_analysis;
      if (analysis3) {
        const str = JSON.stringify(analysis3).toLowerCase();
        return str.includes("positive") || str.includes("interested") || str.includes("satisfied");
      }
      return false;
    }
    case "voicemail_left": {
      const meta = callLog.metadata;
      const reason = meta?.reason_call_ended;
      return reason === "voicemail_reached" || reason === "voicemail";
    }
    case "repeat_caller":
      // Handled separately in scoreLeadFromCall via isRepeatCaller check
      return false;
    default:
      return false;
  }
}

export async function scoreLeadFromCall(
  leadId: string,
  callLog: CallLog,
  clientId: string
): Promise<{ score: number; qualification: string; breakdown: ScoreBreakdown }> {
  const supabase = await createServiceClient();

  // Fetch custom scoring rules for the agent's client, or use defaults
  let rules = DEFAULT_RULES;
  const { data: rulesRow } = await supabase
    .from("lead_scoring_rules")
    .select("rules")
    .eq("client_id", clientId)
    .or(`agent_id.eq.${callLog.agent_id},agent_id.is.null`)
    .order("agent_id", { ascending: false, nullsFirst: false })
    .limit(1)
    .single();

  if (rulesRow?.rules && Array.isArray(rulesRow.rules)) {
    rules = rulesRow.rules as ScoringRule[];
  }

  // Check for repeat caller
  let isRepeatCaller = false;
  if (callLog.from_number && callLog.agent_id) {
    const { count } = await supabase
      .from("call_logs")
      .select("id", { count: "exact", head: true })
      .eq("agent_id", callLog.agent_id)
      .eq("from_number", callLog.from_number)
      .eq("status", "completed");
    isRepeatCaller = (count ?? 0) > 1;
  }

  // Evaluate each rule
  const breakdown: ScoreBreakdown = {};
  let totalScore = 0;

  for (const rule of rules) {
    let matched = false;
    if (rule.criterion === "repeat_caller") {
      matched = isRepeatCaller;
    } else {
      matched = evaluateCriterion(rule.criterion, callLog);
    }

    if (matched) {
      breakdown[rule.criterion] = { points: rule.points, label: rule.label };
      totalScore += rule.points;
    }
  }

  // Get existing score to accumulate (for repeat_caller incremental scoring)
  const { data: existingLead } = await supabase
    .from("leads")
    .select("score, score_breakdown")
    .eq("id", leadId)
    .single();

  // Merge breakdowns - take max score per criterion
  const existingBreakdown = (existingLead?.score_breakdown as ScoreBreakdown) ?? {};
  const mergedBreakdown: ScoreBreakdown = { ...existingBreakdown };
  for (const [key, val] of Object.entries(breakdown)) {
    if (!mergedBreakdown[key] || mergedBreakdown[key].points < val.points) {
      mergedBreakdown[key] = val;
    }
  }

  const mergedScore = Object.values(mergedBreakdown).reduce((sum, v) => sum + v.points, 0);
  const qualification = qualificationTier(mergedScore);

  // Update lead
  await supabase
    .from("leads")
    .update({
      score: mergedScore,
      score_breakdown: mergedBreakdown,
      qualification,
      last_scored_at: new Date().toISOString(),
    })
    .eq("id", leadId);

  return { score: mergedScore, qualification, breakdown: mergedBreakdown };
}

export async function rescoreLead(leadId: string): Promise<{ score: number; qualification: string; breakdown: ScoreBreakdown } | null> {
  const supabase = await createServiceClient();

  // Fetch lead details
  const { data: lead } = await supabase
    .from("leads")
    .select("id, agent_id, phone, organization_id")
    .eq("id", leadId)
    .single();

  if (!lead) return null;

  // Get client_id from agent
  const { data: agent } = await supabase
    .from("agents")
    .select("client_id")
    .eq("id", lead.agent_id)
    .single();

  if (!agent?.client_id) return null;

  // Find all completed call_logs for this lead's phone + agent
  const { data: callLogs } = await supabase
    .from("call_logs")
    .select("*")
    .eq("agent_id", lead.agent_id)
    .or(`from_number.eq.${lead.phone},to_number.eq.${lead.phone}`)
    .order("started_at", { ascending: false })
    .limit(50);

  if (!callLogs || callLogs.length === 0) {
    // No calls found, reset score
    await supabase
      .from("leads")
      .update({
        score: 0,
        score_breakdown: {},
        qualification: "unscored",
        last_scored_at: new Date().toISOString(),
      })
      .eq("id", leadId);
    return { score: 0, qualification: "unscored", breakdown: {} };
  }

  // Score against the most recent call
  const latestCall = callLogs[0];
  return scoreLeadFromCall(leadId, latestCall, agent.client_id);
}
