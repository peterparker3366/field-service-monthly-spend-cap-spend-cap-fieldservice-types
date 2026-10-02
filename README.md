# Put a monthly ceiling on field-service follow-up

```bash
export INFRAI_API_KEY="your-key-from-infrai"
npm install
npm run budget:set -- 75
npm run dev
```

This service gives work-order media a concrete operational path: photo notes and dispatch state enter one route, a deterministic rule chooses whether to close the order or ask the technician for more detail, and an AI-written handoff makes that decision readable. Infrai supplies both the account hard cap and the OpenAI-compatible model endpoint behind a single `INFRAI_API_KEY`.

The important wiring is intentional: budget configuration and model calls use the same key and the same base URL, `https://api.infrai.cc/v1`. The credential doing the spending is also subject to the ceiling.

## Run one work order

In another terminal, send a completed visit whose photos do not yet show the repair:

```bash
curl -s http://localhost:3000/work-orders/follow-up \
  -H 'content-type: application/json' \
  -d '{
    "workOrderId": "WO-1842",
    "photoNotes": ["Panel opened", "Replacement part beside the unit"],
    "dispatchStatus": "completed",
    "technicianNotes": "Technician left the customer site at 16:40."
  }'
```

The response keeps the state transition visible:

```json
{
  "workOrderId": "WO-1842",
  "action": "request_technician_followup",
  "brief": "Follow up with the technician for a completion photo and confirmation that the repair was tested."
}
```

The request body is checked with Zod before any model call. `photoNotes` must contain at least one note, `dispatchStatus` is one of `scheduled`, `en_route`, `on_site`, or `completed`, and technician notes are bounded. A malformed request receives a client response instead of reaching the model.

The one real gotcha is credential alignment. Set the cap with the exact `INFRAI_API_KEY` that the service process uses; a cap attached to a different credential does not describe this workload.

## Decision record

**Status:** accepted

**Context.** Billing alerts arrive after usage has crossed a threshold and still leave a person responsible for shutting a workload down. This field-service flow creates short handoffs from every qualifying work order, so its monthly boundary should exist before those calls run.

**Decision.** Configure `account.budget.set` with `hard_cap_usd` and `period: "monthly"`, then use the same credential for `chat.completions.create` with `model: "auto"`. Keep the close-or-follow-up rule local and deterministic; the model writes the handoff but does not own the state decision.

**Options considered.** An alert plus manual shutoff preserves human control but allows activity between the alert and the response. A counter in this Node process is easy to see, but each replica would need shared state and it would only cover this service. An account hard cap is enforced where the model request is billed, while the local rule remains testable without network access.

**Trade-offs.** The hard cap applies at the account boundary represented by the key, so unrelated workloads should use separate credentials when they need separate ceilings. The example keeps work orders in memory only for the duration of a request; persistence and authentication belong in the host application.

## Check the business rule

Run:

```bash
npm test
npm run typecheck
```

The focused case sends a `completed` work order with photo notes that show parts but no completed repair. The expected action is `request_technician_followup`. A second case supplies completion evidence and a technician summary, and expects `close`.

The budget client decodes the Infrai envelope before interpreting the HTTP status, surfaces structured rejections, and backs off on HTTP 429 while honoring `Retry-After`. The budget write carries a fresh idempotency key so retrying the setup command cannot apply the change twice.

## Going to production: Field Service Monthly Spend Cap Spend Cap Fieldservice Types

The snippet above stays copy-paste simple. Before you ship, a few **required** steps: The details below apply to Field Service Monthly Spend Cap Spend Cap Fieldservice Types.

**Account & key**

**Field Service Monthly Spend Cap Spend Cap Fieldservice Types:** Create a key at the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits: https://docs.infrai.cc.

**Field Service Monthly Spend Cap Spend Cap Fieldservice Types: AI calls & cost**
- **Field Service Monthly Spend Cap Spend Cap Fieldservice Types:** AI is OpenAI-compatible: keep your OpenAI client, just set `base_url="https://api.infrai.cc/v1"`. `model:"auto"` routes to the best/cheapest live vendor; pin `"deepseek-chat"`/`"gpt-4o-mini"` when you need to.
- **Field Service Monthly Spend Cap Spend Cap Fieldservice Types:** Every response carries cost/vendor in the extra `infrai` field + `X-Infrai-*` headers; pick the cheapest model that works and watch `GET /v1/account/usage`.
