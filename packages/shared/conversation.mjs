// Only successful exchanges enter the conversation history. Requests are serialized.
export function createConversation(request) {
  let messages = [];
  let pending = Promise.resolve();
  return {
    send(content) {
      const result = pending.then(async () => {
        const next = [...messages, { role: "user", content }];
        const response = await request(next);
        messages = [...next, { role: "assistant", content: response }];
        return response;
      });
      pending = result.catch(() => {});
      return result;
    },
  };
}
