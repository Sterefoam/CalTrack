import assert from "node:assert/strict";
import test from "node:test";
import { createChatGate } from "../lib/chat/concurrency";

test("chat inference limits parallel work, isolates users, and safely releases failed or repeated leases", async () => {
  const gate = createChatGate(2);
  const releaseA = gate.acquire("a")!;
  assert.equal(gate.acquire("a"), null);
  const releaseB = gate.acquire("b")!;
  assert.equal(gate.acquire("c"), null);
  releaseA();
  const secondA = gate.acquire("a")!;
  releaseA(); // An old lease must not remove a newer lease for the same account.
  assert.equal(gate.acquire("a"), null);
  secondA(); releaseB();
  await assert.rejects(async () => { const release = gate.acquire("a")!; try { throw new Error("provider failure"); } finally { release(); } }, /provider failure/);
  const recovered = gate.acquire("a"); assert.equal(typeof recovered, "function"); recovered!();
});
