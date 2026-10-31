import test from "node:test";
import assert from "node:assert/strict";
import handler from "../api/generate.js";

function response() {
  return {
    statusCode: 200,
    headers: {},
    body: null,
    ended: false,
    setHeader(name, value) { this.headers[name] = value; },
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
    end() { this.ended = true; return this; }
  };
}

async function invoke(req) {
  const res = response();
  await handler(req, res);
  return res;
}

function request(method, body, extraHeaders = {}) {
  return {
    method,
    body,
    headers: {
      host: "fuzzy-vm.vercel.app",
      "x-forwarded-host": "fuzzy-vm.vercel.app",
      "content-type": "application/json",
      ...extraHeaders
    }
  };
}

test("GET reports generation API health without exposing secrets", async () => {
  const res = await invoke(request("GET"));
  assert.equal(res.statusCode, 200);
  assert.equal(res.body.ok, true);
  assert.deepEqual(res.body.providers, ["openai", "anthropic", "gemini"]);
  assert.equal(res.body.rendering, "browser");
  assert.equal(res.headers["Cache-Control"], "no-store, max-age=0");
});

test("rejects methods other than GET, POST and OPTIONS", async () => {
  const res = await invoke(request("DELETE"));
  assert.equal(res.statusCode, 405);
  assert.equal(res.headers.Allow, "POST, OPTIONS");
});

test("rejects cross-origin requests", async () => {
  const res = await invoke(request("POST", {}, { origin: "https://attacker.example" }));
  assert.equal(res.statusCode, 403);
});

test("rejects unsupported providers before making a network request", async () => {
  const res = await invoke(request("POST", {
    provider: "unknown",
    model: "model",
    apiKey: "test-api-key-123",
    prompt: "hello"
  }));
  assert.equal(res.statusCode, 400);
  assert.match(res.body.error, /Provedor não suportado/);
});

test("rejects non-JSON payloads", async () => {
  const req = request("POST", "not-json");
  req.headers["content-type"] = "text/plain";
  const res = await invoke(req);
  assert.equal(res.statusCode, 415);
});

test("forwards OpenAI requests and extracts Responses API text", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, text: async () => JSON.stringify({
      output: [{ content: [{ type: "output_text", text: "function renderFrame() {}" }] }]
    }) };
  };
  try {
    const res = await invoke(request("POST", {
      provider: "openai", model: "gpt-6-mini", apiKey: "sk-test-key-123456",
      prompt: "Generate a frame function", instructions: "Only JavaScript"
    }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.text, "function renderFrame() {}");
    assert.equal(captured.url, "https://api.openai.com/v1/responses");
    assert.equal(captured.options.headers.Authorization, "Bearer sk-test-key-123456");
    assert.equal(JSON.parse(captured.options.body).store, false);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("forwards Anthropic requests and extracts text blocks", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, text: async () => JSON.stringify({
      content: [{ type: "text", text: "Claude output" }]
    }) };
  };
  try {
    const res = await invoke(request("POST", {
      provider: "anthropic", model: "claude-sonnet", apiKey: "anthropic-test-key",
      prompt: "Generate", instructions: "Only code"
    }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.text, "Claude output");
    assert.equal(captured.url, "https://api.anthropic.com/v1/messages");
    assert.equal(captured.options.headers["anthropic-version"], "2023-06-01");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("forwards Gemini requests and extracts candidate text", async () => {
  const originalFetch = globalThis.fetch;
  let captured;
  globalThis.fetch = async (url, options) => {
    captured = { url, options };
    return { ok: true, status: 200, text: async () => JSON.stringify({
      candidates: [{ content: { parts: [{ text: "Gemini output" }] } }]
    }) };
  };
  try {
    const res = await invoke(request("POST", {
      provider: "gemini", model: "gemini-2.5-flash", apiKey: "gemini-test-key",
      prompt: "Generate", instructions: "Only code"
    }));
    assert.equal(res.statusCode, 200);
    assert.equal(res.body.text, "Gemini output");
    assert.match(captured.url, /:generateContent$/);
    assert.equal(captured.options.headers["x-goog-api-key"], "gemini-test-key");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("maps provider rate limits to HTTP 429", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => ({
    ok: false, status: 429,
    text: async () => JSON.stringify({ error: { message: "Rate limit reached" } })
  });
  try {
    const res = await invoke(request("POST", {
      provider: "openai", model: "gpt-6-mini", apiKey: "sk-test-key-123456",
      prompt: "Generate"
    }));
    assert.equal(res.statusCode, 429);
    assert.match(res.body.error, /Rate limit/);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
