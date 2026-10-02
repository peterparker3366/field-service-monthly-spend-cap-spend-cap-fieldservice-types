import assert from "node:assert/strict";
import test from "node:test";
import { decideFollowup, workOrderSchema } from "../src/work_order_followup.js";

test("keeps a completed order open when the photos do not prove completion", () => {
  const workOrder = workOrderSchema.parse({
    workOrderId: "WO-1842",
    photoNotes: ["Panel opened", "Replacement part beside the unit"],
    dispatchStatus: "completed",
    technicianNotes: "Technician left the customer site at 16:40.",
  });

  assert.equal(decideFollowup(workOrder), "request_technician_followup");
});

test("closes a completed order with photo evidence and a technician summary", () => {
  const workOrder = workOrderSchema.parse({
    workOrderId: "WO-1843",
    photoNotes: ["Installed control board", "Completed system test"],
    dispatchStatus: "completed",
    technicianNotes: "Replaced the board and verified normal operation.",
  });

  assert.equal(decideFollowup(workOrder), "close");
});
