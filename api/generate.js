const MAX_BODY_BYTES = 420_000;
const MAX_PROMPT_CHARS = 260_000;
const MAX_INSTRUCTIONS_CHARS = 24_000;

function send(res, status, body) {
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store, max-age=0");
  res.status(status).json(body);
}

function allowedOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return true;
  const host = String(req.headers["x-forwarded-host"] || req.headers.host || "").split(",")[0].trim().toLowerCase();
  try {
    const parsed = new URL(origin);
    return (parsed.protocol === "https:" || parsed.protocol === "http:") && parsed.host.toLowerCase() === host;
  } catch {
    return false;
  }
}

function parseBody(req) {
  if (req.body && typeof req.body === "object") return req.body;
  if (typeof req.body === "string") return JSON.parse(req.body);
  return {};
}

function extractOpenAI(data) {
  if (data && data.status === "incomplete" && data.incomplete_details && data.incomplete_details.reason === "max_output_tokens") {
    const error = new Error("A resposta atingiu o limite de saída do modelo. Divida o vídeo em partes ou use um modelo com maior limite de tokens.");
    error.status = 502;
    throw error;
  }
  if (typeof data.output_text === "string" && data.output_text) return data.output_text;
  const output = Array.isArray(data.output) ? data.output : [];
  return output.flatMap(function (item) {
    return Array.isArray(item.content) ? item.content : [];
  }).filter(function (part) {
    return part.type === "output_text" && typeof part.text === "string";
  }).map(function (part) {
    return part.text;
  }).join("\n");
}

function extractAnthropic(data) {
  if (data && data.stop_reason === "max_tokens") {
    const error = new Error("A resposta atingiu o limite de saída do Claude. Divida o vídeo em partes ou use um modelo com maior limite de tokens.");
    error.status = 502;
    throw error;
  }
  return (Array.isArray(data.content) ? data.content : []).filter(function (part) {
    return part.type === "text" && typeof part.text === "string";
  }).map(function (part) {
    return part.text;
  }).join("\n");
}

function extractGemini(data) {
  const candidates = Array.isArray(data.candidates) ? data.candidates : [];
  if (candidates[0] && candidates[0].finishReason === "MAX_TOKENS") {
    const error = new Error("A resposta atingiu o limite de saída do Gemini. Divida o vídeo em partes ou use um modelo com maior limite de tokens.");
    error.status = 502;
    throw error;
  }
  const parts = candidates[0] && candidates[0].content && Array.isArray(candidates[0].content.parts) ? candidates[0].content.parts : [];
  return parts.filter(function (part) {
    return typeof part.text === "string";
  }).map(function (part) {
    return part.text;
  }).join("\n");
}

async function providerRequest(input) {
  const controller = new AbortController();
  const timeout = setTimeout(function () { controller.abort(); }, 50_000);
  try {
    let url, headers = { "Content-Type": "application/json" }, body, parse;
    if (input.provider === "openai") {
      url = "https://api.openai.com/v1/responses";
      headers.Authorization = "Bearer " + input.apiKey;
      body = {
        model: input.model,
        instructions: input.instructions,
        input: input.prompt,
        max_output_tokens: 8192,
        store: false
      };
      parse = extractOpenAI;
    } else if (input.provider === "anthropic") {
      url = "https://api.anthropic.com/v1/messages";
      headers["x-api-key"] = input.apiKey;
      headers["anthropic-version"] = "2023-06-01";
      body = {
        model: input.model,
        system: input.instructions,
        max_tokens: 8192,
        messages: [{ role: "user", content: input.prompt }]
      };
      parse = extractAnthropic;
    } else {
      url = "https://generativelanguage.googleapis.com/v1beta/models/" + encodeURIComponent(input.model) + ":generateContent";
      headers["x-goog-api-key"] = input.apiKey;
      body = {
        systemInstruction: { parts: [{ text: input.instructions }] },
        contents: [{ role: "user", parts: [{ text: input.prompt }] }],
        generationConfig: { maxOutputTokens: 8192, temperature: 0.85 }
      };
      parse = extractGemini;
    }

    const response = await fetch(url, {
      method: "POST",
      headers: headers,
      body: JSON.stringify(body),
      signal: controller.signal,
      cache: "no-store"
    });
    const raw = await response.text();
    let data = {};
    try { data = raw ? JSON.parse(raw) : {}; } catch { data = {}; }

    if (!response.ok) {
      const providerMessage = data && data.error && typeof data.error.message === "string" ? data.error.message : "";
      const safeMessage = providerMessage.slice(0, 420).replace(/(sk-[A-Za-z0-9_-]{8,}|AIza[A-Za-z0-9_-]{20,})/g, "[redacted]");
      const error = new Error(safeMessage || "O provedor recusou a solicitação. Verifique o modelo e a chave.");
      error.status = response.status === 429 || response.status === 401 || response.status === 403 ? response.status : 502;
      throw error;
    }
    const text = parse(data);
    if (!text) {
      const error = new Error("O provedor respondeu, mas não retornou texto. Verifique o modelo e as permissões da chave.");
      error.status = 502;
      throw error;
    }
    return text;
  } finally {
    clearTimeout(timeout);
  }
}

export default async function handler(req, res) {
  res.setHeader("Vary", "Origin");
  if (req.method === "GET") {
    return send(res, 200, { ok: true, service: "fuzzy-vm-generation", accepts: ["POST"], providers: ["openai", "anthropic", "gemini"], rendering: "browser" });
  }
  if (req.method === "OPTIONS") {
    if (!allowedOrigin(req)) return send(res, 403, { error: "Origem não autorizada." });
    res.setHeader("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    res.setHeader("Access-Control-Max-Age", "600");
    res.status(204).end();
    return;
  }
  if (req.method !== "POST") {
    res.setHeader("Allow", "POST, OPTIONS");
    return send(res, 405, { error: "Método não permitido." });
  }
  if (!allowedOrigin(req)) return send(res, 403, { error: "Origem não autorizada." });
  if (!String(req.headers["content-type"] || "").toLowerCase().includes("application/json")) {
    return send(res, 415, { error: "Envie a solicitação como application/json." });
  }

  const size = Number(req.headers["content-length"] || 0);
  if (size > MAX_BODY_BYTES) return send(res, 413, { error: "Solicitação muito grande. Reduza o tamanho do roteiro ou das instruções." });

  let input;
  try {
    input = parseBody(req);
  } catch {
    return send(res, 400, { error: "JSON inválido." });
  }

  if (Buffer.byteLength(JSON.stringify(input), "utf8") > MAX_BODY_BYTES) return send(res, 413, { error: "Solicitação muito grande. Reduza o tamanho do roteiro ou das instruções." });

  const provider = String(input.provider || "");
  const model = String(input.model || "").trim();
  const apiKey = String(input.apiKey || "");
  const prompt = String(input.prompt || "");
  const instructions = String(input.instructions || "");

  if (!["openai", "anthropic", "gemini"].includes(provider)) return send(res, 400, { error: "Provedor não suportado." });
  if (!/^[A-Za-z0-9._:-]{1,128}$/.test(model)) return send(res, 400, { error: "Identificador de modelo inválido." });
  if (apiKey.length < 12 || apiKey.length > 4096 || /\s/.test(apiKey)) return send(res, 400, { error: "Chave de API inválida." });
  if (!prompt.trim() || prompt.length > MAX_PROMPT_CHARS) return send(res, 400, { error: "O prompt está vazio ou excede o limite permitido." });
  if (instructions.length > MAX_INSTRUCTIONS_CHARS) return send(res, 400, { error: "As instruções excedem o limite permitido." });

  try {
    const text = await providerRequest({ provider: provider, model: model, apiKey: apiKey, prompt: prompt, instructions: instructions });
    return send(res, 200, { text: text });
  } catch (error) {
    if (error && error.name === "AbortError") return send(res, 504, { error: "A solicitação demorou demais. Tente reduzir o tamanho ou a complexidade do pedido." });
    const status = error && Number.isInteger(error.status) ? error.status : 502;
    return send(res, status, { error: error && error.message ? error.message : "Falha ao contactar o provedor." });
  }
}