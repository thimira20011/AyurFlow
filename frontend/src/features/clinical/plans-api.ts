import { apiGet, apiMutation } from "@/lib/api-client";

export type Plan = {
  id: string;
  patientId: string;
  status: "active" | "held" | "cancelled" | "completed";
  currentStageOrdinal: number;
  version: number;
  pathwayState: string;
};

export type PlanStage = {
  id: string;
  code: string;
  ordinal: number;
  label: string;
  requiredChecks: string[];
  confirmedChecks: string[];
  status: "pending" | "approved" | "completed";
  approvedAt: string | null;
  completedAt: string | null;
};

export type PlanDecision = {
  id: string;
  action: string;
  actorId: string;
  recordedAt: string;
  reason: string | null;
};

export type PlanDetail = Plan & { stages: PlanStage[]; decisions: PlanDecision[] };

export async function listPlans(patientId: string): Promise<Plan[]> {
  const result = await apiGet<{ items: Plan[] }>(`/patients/${encodeURIComponent(patientId)}/plans`);
  return result.items;
}

export function getPlan(id: string): Promise<PlanDetail> {
  return apiGet<PlanDetail>(`/plans/${encodeURIComponent(id)}`);
}

export function createPlan(patientId: string, sourceConsultationId: string): Promise<Plan> {
  return apiMutation<Plan>(`/patients/${encodeURIComponent(patientId)}/plans`, { sourceConsultationId });
}

export function approveStage(plan: PlanDetail, stage: PlanStage): Promise<Plan> {
  return apiMutation<Plan>(`/plans/${encodeURIComponent(plan.id)}/stages/${encodeURIComponent(stage.id)}/approve`,
    { version: plan.version, confirmedChecks: stage.requiredChecks });
}

export function advancePlan(plan: PlanDetail): Promise<Plan> {
  return apiMutation<Plan>(`/plans/${encodeURIComponent(plan.id)}/advance`, { version: plan.version });
}

export function changePlanState(plan: PlanDetail, action: "hold" | "resume" | "cancel", reason: string): Promise<Plan> {
  return apiMutation<Plan>(`/plans/${encodeURIComponent(plan.id)}/${action}`, { version: plan.version, reason });
}
