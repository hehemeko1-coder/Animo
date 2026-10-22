# SeenAi AI Chatbot

SeenAi is a responsive dark-mode chat interface powered by Groq's hosted language-model API. The browser talks only to this app's Express backend; the Groq API key is never shipped to the frontend or committed to this repository.

## Requirements

- Node.js 20 or newer
- A Groq API key: https://console.groq.com/keys

## Run locally

1. Install dependencies:

   ```bash
   npm install
   ```

2. Set your key in your terminal. Do not paste it into `script.js`, `index.html`, or any committed file.

   macOS/Linux:
   ```bash
   export GROQ_API_KEY="your-key-here"
   npm start
   ```

   PowerShell:
   ```powershell
   $env:GROQ_API_KEY="your-key-here"
   npm start
   ```

3. Open http://localhost:3000.

Optional: set `GROQ_MODEL` to a model available to your Groq account. The default is `llama-3.1-8b-instant`.

## Deploy on Render

Because SeenAi now has a backend, deploy it as a **Web Service**, not a static site.

1. In Render, choose **New → Web Service** and connect this repository.
2. Branch: `main`.
3. Build command: `npm install`.
4. Start command: `npm start`.
5. In the service's **Environment** settings, add `GROQ_API_KEY` with the key you created in the Groq console. Optionally add `GROQ_MODEL`.
6. Save and deploy. Render supplies `PORT`; the app binds to `0.0.0.0`.

The service may take a little time to wake up on a free hosting plan after inactivity. Groq free-tier model access and rate limits can change; check https://console.groq.com/docs/rate-limits. Requests are limited by this app to 10 per minute per client IP, and the provider may enforce additional limits.

## Security notes

- API key is read from the server environment only.
- Helmet security headers and a Content Security Policy are enabled.
- The chat endpoint limits request size, message length, history size, and request frequency.
- No chat history is stored in a database; conversations live in the browser tab and are sent to the model when you submit a message.
- Avoid sending passwords, secrets, or other sensitive personal information to any hosted AI service.
