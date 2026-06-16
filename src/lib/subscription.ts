import { supabase } from "@/integrations/supabase/client";

export type SubStatus = "trialing" | "active" | "expired" | "canceled" | "admin_override";

export interface SubscriptionRow {
  user_id: string;
  subscription_status: SubStatus;
  trial_started_at: string;
  trial_ends_at: string;
  paid_plan_type: string | null;
  payment_provider: string | null;
  payment_status: string | null;
  access_expires_at: string | null;
  is_admin_override: boolean;
  admin_override_reason: string | null;
}

export interface SubscriptionInfo {
  row: SubscriptionRow | null;
  status: SubStatus;
  isAllowed: boolean; // true if user can access core features
  trialEndsAt: Date | null;
  daysLeft: number; // floor of remaining days; negative when expired
  hoursLeft: number;
  endingSoon: boolean; // within 24h
}

export function deriveInfo(row: SubscriptionRow | null): SubscriptionInfo {
  if (!row) {
    return {
      row: null,
      status: "expired",
      isAllowed: false,
      trialEndsAt: null,
      daysLeft: 0,
      hoursLeft: 0,
      endingSoon: false,
    };
  }
  const now = Date.now();
  const ends = new Date(row.trial_ends_at).getTime();
  const access = row.access_expires_at ? new Date(row.access_expires_at).getTime() : null;
  const msLeft =
    row.subscription_status === "trialing"
      ? ends - now
      : access != null
        ? access - now
        : Infinity;
  const daysLeft = Math.floor(msLeft / (1000 * 60 * 60 * 24));
  const hoursLeft = Math.floor(msLeft / (1000 * 60 * 60));

  let status = row.subscription_status;
  if (status === "trialing" && msLeft <= 0) status = "expired";

  const isAllowed =
    status === "active" ||
    status === "admin_override" ||
    row.is_admin_override ||
    (status === "trialing" && msLeft > 0);

  return {
    row,
    status,
    isAllowed,
    trialEndsAt: new Date(row.trial_ends_at),
    daysLeft,
    hoursLeft,
    endingSoon: status === "trialing" && msLeft > 0 && hoursLeft <= 48,
  };
}

export async function fetchSubscription(userId: string): Promise<SubscriptionInfo> {
  const { data } = (await supabase
    .from("user_subscriptions" as any)
    .select("*")
    .eq("user_id", userId)
    .maybeSingle()) as { data: SubscriptionRow | null };
  return deriveInfo(data ?? null);
}

export function formatTrialBadge(info: SubscriptionInfo): string {
  if (info.status === "admin_override") return "관리자 승인 (무제한)";
  if (info.status === "active") return "이용권 활성";
  if (info.status === "expired") return "무료체험 종료";
  if (info.status === "canceled") return "구독 취소";
  if (info.endingSoon) return "무료체험이 곧 종료됩니다";
  if (info.daysLeft <= 0) return "무료체험 1일 미만";
  return `무료체험 ${info.daysLeft}일 남음`;
}

export const STATUS_LABEL: Record<SubStatus, string> = {
  trialing: "무료체험 중",
  active: "이용권 활성",
  expired: "무료체험 종료",
  canceled: "구독 취소",
  admin_override: "관리자 승인",
};
