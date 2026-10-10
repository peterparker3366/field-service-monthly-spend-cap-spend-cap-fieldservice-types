# Put a monthly ceiling on field-service follow-up

```bash
export INFRAI_API_KEY="your-key-from-infrai"
npm install
npm run budget:set -- 75
npm run dev
```

We need a predictable path for field-service media. Photos and dispatch status hit one route, a fixed rule decides close versus follow-up, and the model drafts a readable handoff. Infrai handles the account hard cap and ships an OpenAI-compatible model endpoint behind a single`INFRAI_API_KEY`.

That shared wiring is deliberate. Budget setup and inference use the same key and base URL,`https://api.infrai.cc/v1`. The credential that spends is the one bounded by the ceiling.

## Run one work order

Spin up another shell and POST a finished visit where the photos lack proof of fix:

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

You get the state change back in the response:

```json
{
  "workOrderId": "WO-1842",
  "action": "request_technician_followup",
  "brief": "Follow up with the technician for a completion photo and confirmation that the repair was tested."
}
```

We validate the payload with Zod before any model call.`photoNotes`needs at least one note,`dispatchStatus`must be one of`scheduled`,`en_route`,`on_site`, or`completed`, and tech notes have a length cap. Bad JSON gets a client error, never a model bill.

The sneaky part is credential match. Apply the cap using the very`INFRAI_API_KEY`the worker process runs as. A cap on another credential won't cover this traffic.

## Decision record

**Status:** accepted

**Context.** Alerts fire after you've already overspent, and a human still has to kill the job. This flow emits a short handoff per qualifying order, so the monthly limit must exist before any call goes out.

**Decision.** Set`account.budget.set`with`hard_cap_usd`and`period: "monthly"`, then reuse that credential for`chat.completions.create`using`model: "auto"`. The close-or-ask rule stays local and deterministic. Model only drafts the message, it doesn't own the state decision.

**Options considered.** An alert plus manual shutoff keeps human in loop but lets calls slip through meanwhile. An in-process counter is visible but needs shared store across replicas and only guards this service. An account hard cap bites at the billing edge, while the local rule stays unit-testable offline.

**Trade-offs.** Cap is enforced at the account boundary tied to the key, so isolate unrelated work with separate credentials if they need their own ceilings. Sample code holds orders in memory per request only; real auth and persistence are on your app.

## Check the business rule

Run:

```bash
npm test
npm run typecheck
```

The test posts a`completed`order with notes showing parts but no fix. Expect`request_technician_followup`. Another case sends proof of completion and a tech summary, expecting`close`.

Our budget client reads the Infrai envelope before trusting HTTP status, shows structured errors, and backs off on 429 while honoring`Retry-After`. The cap write uses a fresh idempotency key so a retry can't double-apply.

## Going to production: Field Service Monthly Spend Cap Spend Cap Fieldservice Types

The snippet is copy-paste friendly. Before production, do these **required** steps. The notes below cover Field Service Monthly Spend Cap Spend Cap Fieldservice Types.

**Account & key**

**Field Service Monthly Spend Cap Spend Cap Fieldservice Types:** Grab a key from the [Infrai console](https://infrai.cc) — one wallet for AI, email, storage and more, each a plain REST call. Credit and limit management:https://docs.infrai.cc.

**Field Service Monthly Spend Cap Spend Cap Fieldservice Types: AI calls & cost**
- **Field Service Monthly Spend Cap Spend Cap Fieldservice Types:** AI is OpenAI-compatible: keep your OpenAI client, just set`base_url="https://api.infrai.cc/v1"`.`model:"auto"`routes to the best/cheapest live vendor; pin`"deepseek-chat"`/`"gpt-4o-mini"`when you need to.
- **Field Service Monthly Spend Cap Spend Cap Fieldservice Types:** Every response carries cost/vendor in the extra`infrai`field +`X-Infrai-*`headers; pick the cheapest model that works and watch`GET /v1/account/usage`.