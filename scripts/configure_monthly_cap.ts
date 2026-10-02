import { randomUUID } from "node:crypto";
import { setMonthlyBudget } from "../src/infrai_control.js";

const apiKey = process.env.INFRAI_API_KEY;
if (!apiKey) throw new Error("Set INFRAI_API_KEY before configuring the budget");

const hardCapUsd = Number(process.argv[2]);
if (!Number.isFinite(hardCapUsd) || hardCapUsd <= 0) {
  throw new Error("Pass a positive monthly cap, for example: npm run budget:set -- 75");
}

const result = await setMonthlyBudget({
  apiKey,
  hardCapUsd,
  idempotencyKey: randomUUID(),
});

console.log("Monthly hard cap configured:", result);
