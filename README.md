# SeenAi AI Assistant

SeenAi is a responsive AI assistant built with Express. It supports configurable OpenAI, Anthropic Claude, and Groq model providers, live web search through Firecrawl, PDF/DOCX/TXT extraction, image input, browser-local saved memory, and user-approved automation webhooks.

Provider API keys stay in server environment variables. Never put them in frontend files or commit them to GitHub.

## Requirements

- Node.js 20.16 or newer
- At least one supported AI provider API key:
  - OpenAI: https://platform.openai.com/api-keys
  - Anthropic Claude: https://console.anthropic.com/
  - Groq: https://console.groq.com/keys
- Optional Firecrawl key for live web search: https://www.firecrawl.dev/

## Run locally

Install dependencies:

```bash
npm install
```

Set the key for the provider you intend to use. Do not set keys in frontend code.

macOS/Linux examples:

```bash
export AI_PROVIDER="anthropic"
export ANTHROPIC_API_KEY="your-anthropic-key"
# Alternative: use OpenAI instead
# export AI_PROVIDER="openai"
# export OPENAI_API_KEY="your-openai-key"
# Alternative: keep using Groq
# export AI_PROVIDER="groq"
# export GROQ_API_KEY="your-groq-key"
export FIRECRAWL_API_KEY="your-firecrawl-key"
npm start
```

PowerShell examples:

```powershell
$env:AI_PROVIDER="anthropic"
$env:ANTHROPIC_API_KEY="your-anthropic-key"
$env:FIRECRAWL_API_KEY="your-firecrawl-key"
npm start
```

Open http://localhost:3000.

## Deploy on Render

Keep the existing Render Web Service and GitHub repository connection.

- Branch: `main`
- Build command: `npm install`
- Start command: `npm start`

Add provider keys in Render → Environment. Never commit keys to the repository.

| Variable | Required? | Purpose |
|---|---|---|
| `AI_PROVIDER` | Optional | `auto` (default), `openai`, `anthropic`, or `groq`. Auto prefers OpenAI when its key exists, then Anthropic, then Groq. |
| `OPENAI_API_KEY` | Optional | Enables OpenAI API models. |
| `OPENAI_MODEL` | Optional | Defaults to `gpt-6-astra`; requires API access to that model. |
| `OPENAI_REASONING_EFFORT` | Optional | Defaults to `high`. Check the selected model's API documentation for supported values. |
| `ANTHROPIC_API_KEY` | Optional | Enables Claude API models. |
| `ANTHROPIC_MODEL` | Optional | Defaults to `claude-opus-5-5`; requires access to that model. |
| `ANTHROPIC_EFFORT` | Optional | Defaults to `high`; supported values depend on the selected model. |
| `GROQ_API_KEY` | Optional | Enables Groq as the provider or fallback option. |
| `GROQ_MODEL` | Optional | Defaults to `openai/gpt-oss-120b`. |
| `GROQ_VISION_MODEL` | Optional | Defaults to `qwen/qwen3.8-27b`; must be enabled for your Groq account. |
| `GROQ_REASONING_EFFORT` | Optional | Defaults to `high` for GPT-OSS requests. |
| `FIRECRAWL_API_KEY` | Optional | Enables live web search. Check Firecrawl's dashboard for current usage limits. |
| `AUTOMATION_WEBHOOK_URL` | Optional | HTTPS URL for a trusted automation endpoint you control. |
| `AUTOMATION_WEBHOOK_TOKEN` | Optional | Bearer token sent to the configured automation endpoint. |
| `DATABASE_URL` | Optional for local-only memory; required for persistent learning | PostgreSQL connection string from Neon or Render Postgres. Keep it secret. |
| `DATABASE_SSL` | Optional | Set to `disable` only for a trusted local database; otherwise TLS is enabled. |
| `SEENAI_ADMIN_TOKEN` | Required to submit fine-tuning jobs | Long random secret used as a Bearer token for `/api/learning/train`. Never expose it in frontend code. |
| `OPENAI_FINE_TUNE_BASE_MODEL` | Optional | Fine-tuning-compatible OpenAI base model; defaults to `gpt-4o-mini-2024-07-18`. Check current API eligibility and pricing first. |

**Important:** OpenAI and Anthropic API usage may incur charges. API access is separate from a ChatGPT or Claude consumer subscription. Verify model access, prices, quotas, and billing in the provider dashboard before enabling a premium model. A configured model ID does not guarantee that the account has access to it.

## Features

### Model providers and reasoning
The selected provider is configured server-side. By default, `AI_PROVIDER=auto` chooses OpenAI if `OPENAI_API_KEY` exists, otherwise Anthropic if `ANTHROPIC_API_KEY` exists, otherwise Groq. To force a provider, set `AI_PROVIDER` explicitly. The app reports its selected provider and model through `/api/health`.

The system prompt emphasizes careful reasoning, software-engineering discipline, grounded research, explicit uncertainty, context tracking, security, and testable recommendations. When Anthropic is selected, SeenAi can call a bounded live web-search tool (requires FIRECRAWL_API_KEY) and a restricted arithmetic calculator. Tool execution is server-side, search calls are capped per response, and retrieved content is treated as untrusted data. A prompt and tool loop can improve behavior but cannot reproduce another model's training or guarantee equal benchmark performance.

### Automated tests

Run deterministic tests for the safe calculator and web-search result parsing:

```bash
npm test
```

GitHub Actions runs JavaScript syntax checks and these deterministic tests on pushes and pull requests to `main`. These checks do not call a paid model API.

## Automated quality evaluation
The repository includes a lightweight model-based regression suite. Run it locally with an Anthropic API key:

```bash
# PowerShell
$env:ANTHROPIC_API_KEY="your-anthropic-key"
npm run eval
```

It checks arithmetic, coding edge cases, honest uncertainty, prompt-injection resistance, structured answers, and debugging guidance. It makes paid API requests and uses simple expected-signal checks; it is a regression smoke test, not a comprehensive benchmark. Run it manually, not as part of every Render deployment.

### Live web search
Users can turn on Web search in the chat composer. The backend uses Firecrawl and passes up to five source snippets to the selected model for a grounded answer. Search requires `FIRECRAWL_API_KEY`; the key remains on the server. Search requests are rate-limited.

### Saved memory
Saved memories are stored in the browser's `localStorage` and added to future prompts from that same browser. This works on the same browser profile, is not synced between devices, is not tied to a user account, and can be lost if browser storage is cleared. Users can inspect and delete saved memories in the Saved memory panel. Do not store secrets or highly sensitive information.

### File uploads
PDF, DOCX and TXT files are uploaded to the backend for text extraction. Uploads are processed in memory and are not saved to disk by this application. Extracted text is truncated to 30,000 characters per file. Scanned/image-only PDFs need OCR before text extraction can work. Document text is treated as untrusted content in the AI prompt.

### Image understanding
Attach up to three JPG, PNG, WEBP or GIF images (under 4 MB each). OpenAI and Anthropic provider paths accept image input with supported models; the Groq path uses the configured vision model. Images are not stored by this application after request processing.

### Approved automation
Users can save reusable workflow instructions in their browser. Without a webhook, they can run a workflow as an AI chat task. To send a workflow to an external system, the site owner must configure `AUTOMATION_WEBHOOK_URL` and optionally `AUTOMATION_WEBHOOK_TOKEN` in Render. SeenAi requires confirmation before sending a workflow. Only connect a webhook you control and trust. This generic webhook is a connector point, not a preconfigured integration with email, calendars, or other services.

## Security and limits

- AI provider and Firecrawl API keys are read from server environment variables only.
- Helmet security headers and a Content Security Policy are enabled.
- Request bodies, upload size, file types, image count, message length, and request frequency are limited.
- Uploaded files are extracted in memory; this app does not persist uploads or chat history on its server.
- Web result text and uploaded document content are treated as untrusted reference data.
- Do not send passwords, secrets, or sensitive personal information to a hosted AI service.
- Provider access, model availability, pricing, and rate limits can change; check the provider dashboard if a request fails.


## Persistent learning and fine-tuning

Set `DATABASE_URL` to a PostgreSQL database connection string in Render Environment. On startup, SeenAi creates its learning tables automatically. Without this variable, the existing browser-local memory still works, while persistent learning endpoints return a setup message.

When the database is configured, chat examples are stored under a browser-generated client ID. The chat UI offers **Helpful** and **Improve** feedback controls. Positive ratings and explicit corrections are eligible for training; unreviewed conversations are not automatically treated as correct. The client ID separates browser profiles but is not account authentication, so add a proper sign-in system before treating stored memory as private account data.

OpenAI fine-tuning is a separate, paid operation. To submit a job, configure `OPENAI_API_KEY` and a strong `SEENAI_ADMIN_TOKEN` in Render Environment, then send an authenticated POST to `/api/learning/train` with header `Authorization: Bearer YOUR_ADMIN_TOKEN`. The endpoint requires at least 10 eligible, unrated-as-bad training examples, uploads a JSONL training file, and submits an OpenAI fine-tuning job. This endpoint does not run automatically; an administrator explicitly starts each paid training job. Check model eligibility, pricing, and job status in the OpenAI dashboard. A fine-tuned model is not automatically selected for chat; deploying it requires setting `OPENAI_MODEL` to the completed fine-tuned model ID and using the OpenAI provider.

Learning endpoints include:
- `GET /api/learning/memories?clientId=...`
- `POST /api/learning/memories` with `{ "clientId": "...", "memory": "..." }`
- `DELETE /api/learning/memories/:id` with a JSON body containing `clientId`
- `DELETE /api/learning/memories` with `{ "clientId": "..." }`
- `POST /api/learning/feedback` for ratings and corrections
- `POST /api/learning/train` for admin-only fine-tuning submission
