import { createServer, type IncomingMessage, type ServerResponse } from "node:http";
import { ZodError } from "zod";
import OpenAI from "openai";
import {
  createFollowupWriter,
  decideFollowup,
  workOrderSchema,
} from "./work_order_followup.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before starting the service");

const writeFollowup = createFollowupWriter(apiKey);

function sendJson(response: ServerResponse, status: number, value: unknown): void {
  response.writeHead(status, { "content-type": "application/json" });
  response.end(JSON.stringify(value));
}

async function readJson(request: IncomingMessage): Promise<unknown> {
  const chunks: Buffer[] = [];
  let size = 0;
  for await (const chunk of request) {
    const buffer = Buffer.from(chunk);
    size += buffer.length;
    if (size > 64 * 1024) throw new Error("Request body is too large");
    chunks.push(buffer);
  }
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/work-orders/follow-up") {
    sendJson(response, 404, { error: "Route not found" });
    return;
  }

  try {
    const workOrder = workOrderSchema.parse(await readJson(request));
    const action = decideFollowup(workOrder);
    const brief = await writeFollowup(workOrder, action);
    sendJson(response, 200, { workOrderId: workOrder.workOrderId, action, brief });
  } catch (error) {
    if (error instanceof ZodError || error instanceof SyntaxError) {
      sendJson(response, 400, { error: "Invalid work order", details: error.message });
      return;
    }
    if (error instanceof OpenAI.APIError) {
      const status = error.status && error.status >= 400 && error.status < 500 ? error.status : 502;
      sendJson(response, status, { error: error.message });
      return;
    }
    sendJson(response, 500, { error: error instanceof Error ? error.message : "Request failed" });
  }
});

const port = Number(process.env.PORT ?? 3000);
server.listen(port, () => console.log(`Field-service follow-up listening on http://localhost:${port}`));
