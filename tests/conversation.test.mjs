import test from "node:test";
import assert from "node:assert/strict";
import { createConversation } from "../packages/cli/lib/conversation.mjs";

test("a failed request does not leak an unanswered turn into the next exchange", async () => {
  const calls = [];
  const chat = createConversation(async (messages) => {
    calls.push(messages);
    if (calls.length === 1) throw new Error("network unavailable");
    return "Hello";
  });
  await assert.rejects(chat.send("failed"), /network/);
  assert.equal(await chat.send("retry"), "Hello");
  assert.deepEqual(calls[1], [{ role: "user", content: "retry" }]);
});

test("concurrent sends include the preceding completed reply in order", async () => {
  const calls = [];
  const chat = createConversation(async (messages) => {
    calls.push(messages);
    await new Promise(resolve => setTimeout(resolve, 5));
    return `reply ${calls.length}`;
  });
  assert.deepEqual(await Promise.all([chat.send("one"), chat.send("two")]), ["reply 1", "reply 2"]);
  assert.deepEqual(calls[1], [
    { role: "user", content: "one" },
    { role: "assistant", content: "reply 1" },
    { role: "user", content: "two" },
  ]);
});
