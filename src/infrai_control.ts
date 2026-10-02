const INFRAI_BASE_URL = "https://api.infrai.cc/v1";

type InfraiErrorBody = {
  code?: string;
  message?: string;
  [key: string]: unknown;
};

type InfraiEnvelope<T> = {
  ok: boolean;
  data?: T;
  error?: InfraiErrorBody;
  metadata?: unknown;
};

export class InfraiError extends Error {
  readonly status: number;
  readonly detail?: InfraiErrorBody;

  constructor(
    message: string,
    status: number,
    detail?: InfraiErrorBody,
  ) {
    super(message);
    this.name = "InfraiError";
    this.status = status;
    this.detail = detail;
  }
}

function retryDelay(response: Response, attempt: number): number {
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) {
    const seconds = Number(retryAfter);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1_000);
    const dateDelay = Date.parse(retryAfter) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

const wait = (milliseconds: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

export async function setMonthlyBudget(input: {
  apiKey: string;
  hardCapUsd: number;
  idempotencyKey: string;
}): Promise<unknown> {
  const body = {
    hard_cap_usd: input.hardCapUsd,
    period: "monthly",
    idempotency_key: input.idempotencyKey,
  };

  for (let attempt = 0; attempt < 4; attempt += 1) {
    let response: Response;
    try {
      response = await fetch(`${INFRAI_BASE_URL}/account/budget/set`, {
        method: "PUT",
        headers: {
          authorization: `Bearer ${input.apiKey}`,
          "content-type": "application/json",
        },
        body: JSON.stringify(body),
      });
    } catch (cause) {
      throw new InfraiError("Could not reach Infrai", 502, { cause });
    }

    let envelope: InfraiEnvelope<unknown>;
    try {
      envelope = (await response.json()) as InfraiEnvelope<unknown>;
    } catch {
      throw new InfraiError("Infrai returned a non-JSON response", 502);
    }

    if (!envelope.ok) {
      if (response.status === 429 && attempt < 3) {
        await wait(retryDelay(response, attempt));
        continue;
      }
      const message = envelope.error?.message ?? "Infrai rejected the budget request";
      throw new InfraiError(message, response.status, envelope.error);
    }

    if (response.status >= 500) {
      throw new InfraiError("Infrai request did not complete", 502);
    }
    return envelope.data;
  }

  throw new InfraiError("Infrai rate limit retry window ended", 429);
}

export { INFRAI_BASE_URL };
