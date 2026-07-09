const originalFetch = globalThis.fetch;

export interface MockMessage {
  id: string;
  threadId: string;
  snippet: string;
  from: string;
  subject: string;
  internalDate?: string;
}

export const mockState = {
  messages: [] as MockMessage[],
  profileEmail: "test@example.com",
  calls: [] as { url: string; method: string; body?: string; headers?: HeadersInit }[],
};

export function resetMockState() {
  mockState.messages = [];
  mockState.profileEmail = "test@example.com";
  mockState.calls = [];
}

export function enableGmailMock() {
  globalThis.fetch = async function (input: RequestInfo | URL, init?: RequestInit): Promise<Response> {
    const urlStr = typeof input === "string" ? input : (input instanceof URL ? input.toString() : input.url);
    const method = init?.method?.toUpperCase() || "GET";
    const headers = init?.headers;

    let bodyText = "";
    if (init?.body) {
      if (typeof init.body === "string") {
        bodyText = init.body;
      } else if (init.body instanceof URLSearchParams) {
        bodyText = init.body.toString();
      } else if (Buffer.isBuffer(init.body)) {
        bodyText = init.body.toString("utf8");
      }
    }

    mockState.calls.push({ url: urlStr, method, body: bodyText, headers });

    // 1. Google OAuth token exchange / refresh
    if (urlStr.includes("oauth2.googleapis.com/token")) {
      const params = new URLSearchParams(bodyText);
      const grantType = params.get("grant_type");
      if (grantType === "authorization_code") {
        return new Response(
          JSON.stringify({
            access_token: "mock-access-token-abc",
            refresh_token: "mock-refresh-token-xyz",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else if (grantType === "refresh_token") {
        return new Response(
          JSON.stringify({
            access_token: "mock-refreshed-access-token-123",
            expires_in: 3600,
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 2. Gmail User Profile
    if (urlStr.includes("/users/me/profile")) {
      return new Response(
        JSON.stringify({
          emailAddress: mockState.profileEmail,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 3. Gmail List Messages (avoid matching message send or individual message fetch)
    if (urlStr.includes("/users/me/messages") && !urlStr.includes("/send") && !/\/users\/me\/messages\/[^?#/]+/.test(urlStr)) {
      const messagesList = mockState.messages.map((m) => ({ id: m.id, threadId: m.threadId }));
      return new Response(
        JSON.stringify({
          messages: messagesList,
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 4. Gmail Message Details
    const messageDetailMatch = urlStr.match(/\/users\/me\/messages\/([^?#/]+)/);
    if (messageDetailMatch && !urlStr.includes("/send")) {
      const msgId = messageDetailMatch[1];
      const found = mockState.messages.find((m) => m.id === msgId);
      if (found) {
        return new Response(
          JSON.stringify({
            id: found.id,
            threadId: found.threadId,
            snippet: found.snippet,
            internalDate: found.internalDate || String(Date.now()),
            payload: {
              headers: [
                { name: "From", value: found.from },
                { name: "Subject", value: found.subject },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      } else {
        return new Response(
          JSON.stringify({
            id: msgId,
            threadId: "thread-" + msgId,
            snippet: "Default mock snippet for " + msgId,
            internalDate: String(Date.now()),
            payload: {
              headers: [
                { name: "From", value: "Sender <sender@example.com>" },
                { name: "Subject", value: "Default Subject " + msgId },
              ],
            },
          }),
          { status: 200, headers: { "Content-Type": "application/json" } }
        );
      }
    }

    // 5. Gmail Send Message
    if (urlStr.includes("/users/me/messages/send")) {
      return new Response(
        JSON.stringify({
          id: "msg-sent-id",
          threadId: "thread-sent-id",
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // 6. Gmail Create Draft
    if (urlStr.includes("/users/me/drafts")) {
      return new Response(
        JSON.stringify({
          id: "draft-id",
          message: { id: "msg-draft-id", threadId: "thread-draft-id" },
        }),
        { status: 200, headers: { "Content-Type": "application/json" } }
      );
    }

    // Fallback to original fetch for other endpoints if exists
    if (originalFetch) {
      return originalFetch(input, init);
    }

    return new Response(JSON.stringify({ error: "No mock match" }), { status: 404 });
  };
}

export function disableGmailMock() {
  globalThis.fetch = originalFetch;
}

// Enable mock automatically by default when this helper is loaded for testing
enableGmailMock();
