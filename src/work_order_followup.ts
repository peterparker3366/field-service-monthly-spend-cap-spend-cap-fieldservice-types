import OpenAI from "openai";
import { z } from "zod";
import { INFRAI_BASE_URL } from "./infrai_control.js";

export const workOrderSchema = z.object({
  workOrderId: z.string().min(1),
  photoNotes: z.array(z.string().min(1)).min(1).max(12),
  dispatchStatus: z.enum(["scheduled", "en_route", "on_site", "completed"]),
  technicianNotes: z.string().max(2_000).default(""),
});

export type WorkOrder = z.infer<typeof workOrderSchema>;
export type FollowupAction = "close" | "request_technician_followup";

export function decideFollowup(workOrder: WorkOrder): FollowupAction {
  const hasCompletionEvidence = workOrder.photoNotes.some((note) =>
    /completed|repaired|installed|resolved/i.test(note),
  );
  const hasTechnicianSummary = workOrder.technicianNotes.trim().length >= 12;
  return workOrder.dispatchStatus === "completed" && hasCompletionEvidence && hasTechnicianSummary
    ? "close"
    : "request_technician_followup";
}

export function createFollowupWriter(apiKey: string) {
  const ai = new OpenAI({
    apiKey,
    baseURL: INFRAI_BASE_URL,
    maxRetries: 3,
  });

  return async (workOrder: WorkOrder, action: FollowupAction): Promise<string> => {
    const response = await ai.chat.completions.create({
      model: "auto",
      messages: [
        {
          role: "system",
          content: "Write a concise field-service handoff. Use only supplied facts. State the next action clearly.",
        },
        {
          role: "user",
          content: JSON.stringify({
            work_order_id: workOrder.workOrderId,
            dispatch_status: workOrder.dispatchStatus,
            photo_notes: workOrder.photoNotes,
            technician_notes: workOrder.technicianNotes,
            decided_action: action,
          }),
        },
      ],
    });

    return response.choices[0]?.message.content?.trim() || `Next action: ${action}`;
  };
}
