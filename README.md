# SeenAi AI Chatbot

SeenAi is a responsive AI chat application powered by Groq. The browser communicates with an Express backend. The chat uses GPT-OSS 20B by default with medium reasoning effort; the model can be changed through server environment variables. Provider API keys are stored only in the server environment and must never be placed in frontend files or committed to GitHub.

## Requirements

- Node.js 20.16 or newer
- A Groq API key: https://console.groq.com/keys
- Optional: a Firecrawl API key for live web search: https://www.firecrawl.dev/
- Optional: a trusted automation webhook URL for approved external workflows

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set environment variables in your terminal. Never paste keys into `script.js`, `index.html`, or a committed file.

   macOS/Linux:
   ```bash
   export GROQ_API_KEY="your-key-here"
   export FIRECRAWL_API_KEY="your-firecrawl-key-here" # optional
   npm start
   ```

   PowerShell:
   ```powershell
   $env:GROQ_API_KEY="your-key-here"
   $env:FIRECRAWL_API_KEY="your-firecrawl-key-here" # optional
   npm start
   ```

3. Open http://localhost:3000.

## Deploy on Render

Keep the existing Render Web Service and GitHub repository connection. Render should use:

- Branch: `main`
- Build command: `npm install`
- Start command: `npm start`

Keep `GROQ_API_KEY` configured as it is. After the new commit deploys, open Render → Environment and optionally add:

| Variable | Required? | Purpose |
|---|---|---|
| `FIRECRAWL_API_KEY` | Optional, for live search | Firecrawl API key. Create one at https://www.firecrawl.dev and keep it private. Check your Firecrawl dashboard for current usage limits. |
| `GROQ_VISION_MODEL` | Optional | Defaults to `qwen/qwen3.8-27b`; must be enabled for your Groq account |
| `AUTOMATION_WEBHOOK_URL` | Optional, for external automation | HTTPS URL of a trusted automation service you control, such as a workflow webhook |
| `AUTOMATION_WEBHOOK_TOKEN` | Optional | Bearer token sent to that trusted webhook |
| `GROQ_MODEL` | Optional | Defaults to `openai/gpt-oss-20b`. `openai/gpt-oss-120b` is a stronger option but may incur higher API costs; check your Groq billing and limits before switching. |\n| `GROQ_REASONING_EFFORT` | Optional | Defaults to `medium` for GPT-OSS chat requests. Supported values include `low`, `medium`, and `high`; higher effort can take longer and use more tokens. |

Save environment changes and allow Render to redeploy. Render supplies `PORT`; the server binds to `0.0.0.0`.

## Features

### Live web search
The user can turn on Web search in the chat composer. The backend uses Firecrawl web search and passes up to five result snippets to Groq for a grounded answer. Search requires `FIRECRAWL_API_KEY`; the key remains on the server. Search requests are rate-limited.

### Long-term memory
Saved memories are stored in the browser's `localStorage` and added to future prompts from that same browser. This works across conversations on the same browser profile, but it is not synced between devices, is not tied to a user account, and can be lost if browser storage is cleared. Users can inspect and delete saved memories in the Saved memory panel. Do not store secrets or highly sensitive information.

### File uploads
PDF, DOCX and TXT files are uploaded to the backend for text extraction. Uploads are processed in memory and are not saved to disk by this application. Extracted text is truncated to 30,000 characters per file. Scanned/image-only PDFs need OCR before text extraction can work. Document text is treated as untrusted content in the AI prompt.

### Image understanding
Attach up to three JPG, PNG, WEBP or GIF images (under 4 MB each). Images are sent to Groq's vision-capable model only when the user submits the chat message. Vision access depends on the configured model being available to your Groq account. Images are not stored by this application after request processing.

### Approved automation
Users can save reusable workflow instructions in their browser. Without a webhook, they can run the workflow as an AI chat task. To send a workflow to an external system, the site owner must configure `AUTOMATION_WEBHOOK_URL` and optionally `AUTOMATION_WEBHOOK_TOKEN` in Render. SeenAi requires a confirmation before sending a workflow. Only connect a webhook you control and trust; the endpoint receives the workflow name, details, timestamp, and approval flag. This generic webhook is a connector point, not a preconfigured integration with Gmail, calendars, or other services.

## Security and limits

- Groq and Firecrawl API keys are read from server environment variables only.
- Helmet security headers and a Content Security Policy are enabled.
- Request bodies, upload size, file types, image count, message length, and request frequency are limited.
- Uploaded files are extracted in memory; this app does not persist uploads or chat history on its server.
- Web result text and uploaded document content are treated as untrusted reference data.
- Do not send passwords, secrets, or other sensitive personal information to a hosted AI service.
- Provider access, model availability, and free-tier limits can change; check the provider console if a model or API request fails.
