// Only templates explicitly intended for bulk sending live here. Templates
// tied to a specific appointment (e.g. the per-booking review email in
// `booking-review.tsx`) stay out of this list — they're sent one-off from
// the reservation detail panel.
export type MarketingTemplateId = "comeback";

export interface MarketingTemplateMeta {
  id: MarketingTemplateId;
  label: string;
  description: string;
  subject: string;
}

export const MARKETING_TEMPLATES: MarketingTemplateMeta[] = [
  {
    id: "comeback",
    label: "Návrat zákazníka",
    description:
      "Pripomenutie starým zákazníkom — informácia o novom rezervačnom systéme + výzva na nový strih.",
    subject: "Nie je čas na nový strih? - Strojček",
  },
];

// Conservative cap for free Gmail SMTP (500/day rolling limit, ~100/h soft).
// We also leave headroom for transactional sends (confirmations, reminders).
// 20 per batch with 1s spacing ≈ 20s total — safe inside any serverless
// function timeout and well below any rate-limit threshold.
export const MAX_MARKETING_RECIPIENTS = 20;
export const MARKETING_SEND_DELAY_MS = 1000;
