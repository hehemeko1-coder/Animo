const path = require("node:path");
const express = require("express");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const GROQ_API_KEY = process.env.GROQ_API_KEY;
const GROQ_MODEL = process.env.GROQ_MODEL || "openai/gpt-oss-20b";

app.disable("x-powered-by");
if (process.env.NODE_ENV === "production") app.set("trust proxy", 1);

app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      baseUri: ["'self'"],
      objectSrc: ["'none'"],
      frameAncestors: ["'none'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com"],
      imgSrc: ["'self'", "data:"],
      connectSrc: ["'self'"],
      upgradeInsecureRequests: []
    }
  },
  crossOriginEmbedderPolicy: false
}));
app.use(express.json({ limit: "20kb", strict: true }));

const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: { error: "You're sending messages a little too quickly. Please wait a minute and try again." }
});

app.get("/api/health", (_req, res) => {
  res.json({ ok: true, provider: "Groq", configured: Boolean(GROQ_API_KEY) });
});

app.post("/api/chat", chatLimiter, async (req, res) => {
  if (!GROQ_API_KEY) {
    return res.status(503).json({
      error: "SeenAi's AI service isn't configured yet. Add GROQ_API_KEY to your server environment, then redeploy."
    });
  }

  const incoming = req.body && req.body.messages;
  if (!Array.isArray(incoming) || incoming.length === 0 || incoming.length > 12) {
    return res.status(400).json({ error: "Send between 1 and 12 recent chat messages." });
  }

  const messages = [];
  for (const item of incoming) {
    if (!item || !["user", "assistant"].includes(item.role) || typeof item.content !== "string") {
      return res.status(400).json({ error: "One of the messages has an invalid format." });
    }
    const content = item.content.trim();
    if (!content || content.length > 4000) {
      return res.status(400).json({ error: "Each message must contain 1–4,000 characters." });
    }
    messages.push({ role: item.role, content });
  }
  if (messages[messages.length - 1].role !== "user") {
    return res.status(400).json({ error: "The last message must be from you." });
  }

  try {
    const upstream = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${GROQ_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        messages: [
          {
            role: "system",
            content: "You are SeenAi, a thoughtful, capable, friendly AI assistant. Help users think clearly, learn, create, solve problems, and take useful next steps. Be accurate and honest about uncertainty. Use clear formatting and concise answers by default. Match the user's language when possible. Never claim to have browsed the web, run code, or performed an action unless you actually have."
          },
          ...messages
        ],
        temperature: 0.7,
        max_completion_tokens: 1200
      }),
      signal: AbortSignal.timeout(30000)
    });

    if (!upstream.ok) {
      const status = upstream.status;
      if (status === 429) {
        return res.status(429).json({ error: "The AI provider is at its current usage limit. Please wait a little and try again." });
      }
      if (status === 401 || status === 403) {
        console.error("Groq authentication/configuration error:", status);
        return res.status(502).json({ error: "The AI service credentials need attention. Please try again later." });
      }
      console.error("Groq API returned status:", status);
      return res.status(502).json({ error: "The AI service couldn't complete that request. Please try again." });
    }

    const data = await upstream.json();
    const reply = data?.choices?.[0]?.message?.content;
    if (typeof reply !== "string" || !reply.trim()) {
      return res.status(502).json({ error: "The AI returned an empty response. Please try again." });
    }
    return res.json({ reply: reply.trim() });
  } catch (error) {
    if (error.name === "TimeoutError" || error.name === "AbortError") {
      return res.status(504).json({ error: "That response took too long. Please try again." });
    }
    console.error("Chat request failed:", error.message);
    return res.status(502).json({ error: "Couldn't reach the AI service. Please try again shortly." });
  }
});

app.get("/", (_req, res) => {
  res.setHeader("Cache-Control", "no-cache");
  res.sendFile(path.join(__dirname, "index.html"));
});
app.get("/style.css", (_req, res) => {
  res.type("text/css").sendFile(path.join(__dirname, "style.css"));
});
app.get("/script.js", (_req, res) => {
  res.type("application/javascript").sendFile(path.join(__dirname, "script.js"));
});

app.use((_req, res) => res.status(404).json({ error: "Not found." }));

app.listen(PORT, "0.0.0.0", () => {
  console.log(`SeenAi is listening on port ${PORT}`);
  if (!GROQ_API_KEY) console.warn("GROQ_API_KEY is missing. Add it to the server environment to enable AI replies.");
});
