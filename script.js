(() => {
  const $ = (selector) => document.querySelector(selector);
  const form = $("#chatForm"), input = $("#messageInput"), sendButton = $("#sendButton");
  const messageList = $("#messageList"), welcome = $("#welcome"), newChatButton = $("#newChatButton");
  const clearChatButton = $("#clearChatButton"), characterCount = $("#characterCount"), conversation = $("#conversation");
  const toast = $("#toast"), sidebar = $("#sidebar"), mobileMenu = $("#mobileMenu");
  const fileInput = $("#fileInput"), attachButton = $("#attachButton"), attachmentList = $("#attachmentList");
  const webSearchToggle = $("#webSearchToggle"), webStatus = $("#webStatus");
  const memoryModal = $("#memoryModal"), automationModal = $("#automationModal");
  const memoryForm = $("#memoryForm"), memoryInput = $("#memoryInput"), savedMemoryList = $("#savedMemoryList");
  const memoryCount = $("#memoryCount"), workflowForm = $("#automationForm"), workflowName = $("#workflowName");
  const workflowDetails = $("#workflowDetails"), workflowList = $("#workflowList");
  const STORAGE = { memory: "seenai.memory.v1", workflows: "seenai.workflows.v1" };
  let messages = [], busy = false, toastTimeout, images = [], documents = [], webSources = [], features = {};
  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function readStore(key, fallback = []) {
    try { const value = JSON.parse(localStorage.getItem(key) || "null"); return Array.isArray(value) ? value : fallback; }
    catch { return fallback; }
  }
  function writeStore(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { showToast("Browser storage is full or unavailable. Remove some saved items and try again."); return false; }
  }
  function showToast(message) {
    toast.textContent = message; toast.classList.add("show");
    clearTimeout(toastTimeout); toastTimeout = setTimeout(() => toast.classList.remove("show"), 3600);
  }
  function scrollToBottom() { requestAnimationFrame(() => { conversation.scrollTop = conversation.scrollHeight; }); }
  function renderInline(container, source) {
    const pattern = /(\*\*[^*]+?\*\*|__[^_]+?__|\x60[^\x60]+?\x60|\*[^*\n]+?\*|_[^_\n]+?_|\[[^\]]+?\]\(https?:\/\/[^)\s]+\)|https?:\/\/[^\s<>"']+)/g;
    let last = 0, match;
    while ((match = pattern.exec(source)) !== null) {
      container.append(document.createTextNode(source.slice(last, match.index)));
      const token = match[0];
      if ((token.startsWith("**") && token.endsWith("**")) || (token.startsWith("__") && token.endsWith("__"))) {
        const strong = document.createElement("strong"); strong.textContent = token.slice(2, -2); container.append(strong);
      } else if ((token.startsWith("*") && token.endsWith("*")) || (token.startsWith("_") && token.endsWith("_"))) {
        const em = document.createElement("em"); em.textContent = token.slice(1, -1); container.append(em);
      } else if (token.charCodeAt(0) === 96 && token.charCodeAt(token.length - 1) === 96) {
        const code = document.createElement("code"); code.textContent = token.slice(1, -1); container.append(code);
      } else if (token.startsWith("[")) {
        const link = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
        if (link) { const a = document.createElement("a"); a.href = link[2]; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = link[1]; container.append(a); }
        else container.append(document.createTextNode(token));
      } else {
        const trailing = token.match(/[),.!?;:]+$/)?.[0] || "";
        const url = trailing ? token.slice(0, -trailing.length) : token;
        try {
          const parsed = new URL(url);
          if (parsed.protocol === "http:" || parsed.protocol === "https:") {
            const a = document.createElement("a"); a.href = parsed.href; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = url; container.append(a);
          } else container.append(document.createTextNode(token));
        } catch { container.append(document.createTextNode(token)); }
        if (trailing) container.append(document.createTextNode(trailing));
      }
      last = match.index + token.length;
    }
    container.append(document.createTextNode(source.slice(last)));
  }
  function renderMarkdown(container, content) {
    container.replaceChildren();
    const lines = String(content || "").replace(/\r\n?/g, "\n").split("\n");
    let paragraph = [], list = null, codeLines = null;
    const flushParagraph = () => {
      if (!paragraph.length) return;
      const p = document.createElement("p");
      paragraph.forEach((line, index) => { if (index) p.append(document.createElement("br")); renderInline(p, line); });
      container.append(p); paragraph = [];
    };
    const closeList = () => { list = null; };
    for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
      const line = lines[lineIndex];
      if (line.includes("|") && lineIndex + 1 < lines.length && /^\s*\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?\s*$/.test(lines[lineIndex + 1])) {
        flushParagraph(); closeList();
        const cells = (row) => row.trim().replace(/^\|/, "").replace(/\|$/, "").split("|").map(cell => cell.trim());
        const table = document.createElement("table"); table.className = "response-table";
        const thead = document.createElement("thead"), headRow = document.createElement("tr");
        cells(line).forEach(value => { const th = document.createElement("th"); renderInline(th, value); headRow.append(th); });
        thead.append(headRow); table.append(thead);
        lineIndex += 2;
        const tbody = document.createElement("tbody");
        while (lineIndex < lines.length && lines[lineIndex].includes("|") && lines[lineIndex].trim()) {
          const row = document.createElement("tr");
          cells(lines[lineIndex]).forEach(value => { const td = document.createElement("td"); renderInline(td, value); row.append(td); });
          tbody.append(row); lineIndex++;
        }
        table.append(tbody); container.append(table); lineIndex--; continue;
      }
      if (line.trim().startsWith("```")) {
        flushParagraph(); closeList();
        if (codeLines) {
          const pre = document.createElement("pre"), code = document.createElement("code");
          code.textContent = codeLines.join("\n"); pre.append(code); container.append(pre); codeLines = null;
        } else codeLines = [];
        continue;
      }
      if (codeLines) { codeLines.push(line); continue; }
      const heading = line.match(/^(#{1,3})\s+(.+)$/);
      const bullet = line.match(/^\s*[-*+]\s+(.+)$/);
      const numbered = line.match(/^\s*\d+[.)]\s+(.+)$/);
      if (heading) {
        flushParagraph(); closeList();
        const h = document.createElement("h" + Math.min(heading[1].length + 1, 4));
        renderInline(h, heading[2]); container.append(h); continue;
      }
      if (bullet || numbered) {
        flushParagraph(); const type = bullet ? "ul" : "ol";
        if (!list || list.tagName.toLowerCase() !== type) { closeList(); list = document.createElement(type); container.append(list); }
        const li = document.createElement("li"); renderInline(li, (bullet || numbered)[1]); list.append(li); continue;
      }
      if (/^\s*([-*_])(?:\s*\1){2,}\s*$/.test(line)) {
        flushParagraph(); closeList(); container.append(document.createElement("hr")); continue;
      }
      if (!line.trim()) { flushParagraph(); closeList(); continue; }
      closeList(); paragraph.push(line);
    }
    if (codeLines) {
      const pre = document.createElement("pre"), code = document.createElement("code");
      code.textContent = codeLines.join("\n"); pre.append(code); container.append(pre);
    }
    flushParagraph();
  }
  function makeMessage(role, content, options = {}) {
    const article = document.createElement("article"); article.className = "message " + role;
    const avatar = document.createElement("div"); avatar.className = "message-avatar"; avatar.setAttribute("aria-hidden", "true");
    const body = document.createElement("div"); body.className = "message-body";
    const meta = document.createElement("div"); meta.className = "message-meta";
    const name = document.createElement("strong"); name.textContent = role === "assistant" ? "SeenAi" : "You";
    const time = document.createElement("time"); time.textContent = now(); meta.append(name, time);
    const text = document.createElement("div"); text.className = "message-content";
    if (options.typing) text.innerHTML = '<div class="typing-indicator" aria-label="SeenAi is thinking"><span></span><span></span><span></span></div>';
    else renderMarkdown(text, content);
    body.append(meta, text);
    if (role === "assistant" && !options.typing && content) {
      const actions = document.createElement("div"); actions.className = "message-actions";
      const copy = document.createElement("button"); copy.type = "button"; copy.className = "message-action"; copy.textContent = "Copy";
      copy.addEventListener("click", async () => {
        try { await navigator.clipboard.writeText(content); copy.textContent = "Copied"; setTimeout(() => { copy.textContent = "Copy"; }, 1400); }
        catch { showToast("Copy failed. Select the response text and copy it manually."); }
      });
      actions.append(copy); body.append(actions);
    }
    if (options.sources?.length) {
      const sourceBox = document.createElement("div"); sourceBox.className = "message-sources";
      const label = document.createElement("strong"); label.textContent = "Sources"; sourceBox.append(label);
      options.sources.forEach(source => {
        const a = document.createElement("a"); a.href = source.url; a.target = "_blank"; a.rel = "noopener noreferrer"; a.textContent = source.title || source.url;
        sourceBox.append(a);
      });
      body.append(sourceBox);
    }
    article.append(avatar, body); messageList.append(article); scrollToBottom(); return article;
  }
  function setBusy(value) {
    busy = value; sendButton.disabled = value; sendButton.setAttribute("aria-label", value ? "Waiting for response" : "Send message");
    input.disabled = value; attachButton.disabled = value; if (!value) input.focus();
  }
  function resizeInput() { input.style.height = "auto"; input.style.height = Math.min(input.scrollHeight, 180) + "px"; }
  function updateCount() { characterCount.textContent = input.value.length + " / 4000"; characterCount.style.color = input.value.length > 3700 ? "#f0b97e" : ""; }

  function getMemories() { return readStore(STORAGE.memory).filter(x => x && typeof x.text === "string" && x.text.trim()); }
  function getWorkflows() { return readStore(STORAGE.workflows).filter(x => x && typeof x.name === "string" && typeof x.details === "string"); }
  function renderMemories() {
    const memories = getMemories(); memoryCount.textContent = String(memories.length); savedMemoryList.replaceChildren();
    if (!memories.length) { const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "No saved memories yet. Add a preference or fact above."; savedMemoryList.append(empty); }
    memories.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "saved-item";
      const text = document.createElement("p"); text.textContent = item.text; const remove = document.createElement("button");
      remove.className = "remove-item"; remove.type = "button"; remove.textContent = "Delete"; remove.addEventListener("click", () => {
        const next = getMemories(); next.splice(index, 1); if (writeStore(STORAGE.memory, next)) renderMemories();
      });
      row.append(text, remove); savedMemoryList.append(row);
    });
  }
  function renderWorkflows() {
    const workflows = getWorkflows(); workflowList.replaceChildren();
    if (!workflows.length) { const empty = document.createElement("p"); empty.className = "empty-state"; empty.textContent = "No workflows saved yet. Create a reusable task above."; workflowList.append(empty); }
    workflows.forEach((item, index) => {
      const row = document.createElement("div"); row.className = "saved-item workflow-item";
      const details = document.createElement("div"); const title = document.createElement("strong"); title.textContent = item.name;
      const desc = document.createElement("p"); desc.textContent = item.details; details.append(title, desc);
      const actions = document.createElement("div"); actions.className = "workflow-actions";
      const run = document.createElement("button"); run.className = "mini-button"; run.type = "button"; run.textContent = "Run";
      run.addEventListener("click", () => runWorkflow(item));
      const remove = document.createElement("button"); remove.className = "remove-item"; remove.type = "button"; remove.textContent = "Delete";
      remove.addEventListener("click", () => { const next = getWorkflows(); next.splice(index, 1); if (writeStore(STORAGE.workflows, next)) renderWorkflows(); });
      actions.append(run, remove); row.append(details, actions); workflowList.append(row);
    });
  }
  function openModal(modal) { modal.hidden = false; const first = modal.querySelector("input,textarea,button"); if (first) first.focus(); }
  function closeModal(modal) { modal.hidden = true; }
  function memoryContext() { return getMemories().map(x => "- " + x.text).join("\n").slice(0, 6000); }

  function renderAttachments() {
    attachmentList.replaceChildren();
    [...documents.map((x, i) => ({ name: x.name, type: "doc", index: i })), ...images.map((x, i) => ({ name: x.name, type: "image", index: i }))].forEach(item => {
      const chip = document.createElement("div"); chip.className = "attachment-chip";
      const label = document.createElement("span"); label.textContent = (item.type === "image" ? "▧ " : "▤ ") + item.name;
      const remove = document.createElement("button"); remove.type = "button"; remove.textContent = "×"; remove.setAttribute("aria-label", "Remove " + item.name);
      remove.addEventListener("click", () => {
        if (item.type === "image") images.splice(item.index, 1); else documents.splice(item.index, 1);
        renderAttachments();
      });
      chip.append(label, remove); attachmentList.append(chip);
    });
  }
  function readAsDataUrl(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader(); reader.onload = () => resolve(String(reader.result)); reader.onerror = () => reject(new Error("Couldn't read " + file.name)); reader.readAsDataURL(file);
    });
  }
  async function handleFiles(files) {
    for (const file of files) {
      const isImage = file.type.startsWith("image/");
      if (isImage) {
        if (!["image/jpeg", "image/png", "image/webp", "image/gif"].includes(file.type)) { showToast("Use JPG, PNG, WEBP, or GIF images."); continue; }
        if (file.size > 4 * 1024 * 1024) { showToast("Each image must be smaller than 4 MB."); continue; }
        if (images.length >= 3) { showToast("Attach up to 3 images per message."); break; }
        try { images.push({ name: file.name, data: await readAsDataUrl(file) }); } catch (error) { showToast(error.message); }
      } else {
        if (documents.length >= 2) { showToast("Attach up to 2 documents per message."); break; }
        if (file.size > 10 * 1024 * 1024) { showToast("Each document must be smaller than 10 MB."); continue; }
        const allowed = [".pdf", ".docx", ".txt"];
        if (!allowed.some(ext => file.name.toLowerCase().endsWith(ext))) { showToast("Supported documents: PDF, DOCX, and TXT."); continue; }
        const data = new FormData(); data.append("file", file);
        showToast("Reading " + file.name + "…");
        try {
          const response = await fetch("/api/upload", { method: "POST", body: data });
          const result = await response.json().catch(() => ({}));
          if (!response.ok) throw new Error(result.error || "Document upload failed.");
          documents.push(result); showToast("Read " + file.name + (result.truncated ? " (text shortened to fit)." : "."));
        } catch (error) { showToast(error.message || "Couldn't read the document."); }
      }
    }
    renderAttachments(); fileInput.value = "";
  }

  async function sendMessage(rawText) {
    const content = rawText.trim();
    if ((!content && !images.length && !documents.length) || busy) return;
    if (content.length > 4000) { showToast("Please keep your message under 4,000 characters."); return; }
    welcome.hidden = true;
    let userContent = content;
    if (!userContent && documents.length) userContent = "Please review the attached document(s) and summarize their key points.";
    if (documents.length) userContent += (userContent ? "\n\n" : "") + "Attached document text (combined and truncated if needed):\n" + documents.map(d => "[File: " + d.name + "]\n" + d.text).join("\n\n").slice(0, 26_000);
    if (images.length) userContent += (userContent ? "\n\n" : "") + "Please inspect the " + images.length + " attached image(s) and answer my question.";
    messages.push({ role: "user", content: userContent });
    makeMessage("user", content || (documents.length ? "Please review the attached document(s)." : "Please analyze the attached image(s)."));
    if (documents.length || images.length) makeMessage("assistant", "Attachments included: " + [...documents.map(d => d.name), ...images.map(i => i.name)].join(", "));
    input.value = ""; resizeInput(); updateCount(); setBusy(true);
    const typing = makeMessage("assistant", "", { typing: true });
    let sources = [];
    const attachedImages = images.map(item => item.data);
    const attachedDocuments = documents.slice();
    images = []; documents = []; renderAttachments();
    try {
      if (webSearchToggle.checked) {
        webStatus.textContent = "Searching…";
        const searchResponse = await fetch("/api/search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ query: content || "Explain the attached files and find related current information" }) });
        const searchData = await searchResponse.json().catch(() => ({}));
        if (!searchResponse.ok) throw new Error(searchData.error || "Web search failed. You can turn Web search off and retry.");
        sources = Array.isArray(searchData.sources) ? searchData.sources : [];
        webSources = sources;
      } else { webSources = []; }
      const response = await fetch("/api/chat", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: messages.slice(-11), images: attachedImages, memory: memoryContext(), webSources: sources })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (typeof data.reply !== "string" || !data.reply.trim()) throw new Error("SeenAi returned an empty reply. Please try again.");
      typing.remove(); messages.push({ role: "assistant", content: data.reply });
      makeMessage("assistant", data.reply, { sources });
    } catch (error) {
      typing.remove(); const errorText = error.message || "Couldn't connect to SeenAi. Check your connection and try again.";
      makeMessage("assistant", errorText); showToast(errorText);
    } finally {
      webStatus.textContent = ""; setBusy(false); scrollToBottom();
    }
  }
  function resetChat() {
    if (busy) { showToast("Wait for SeenAi to finish the current reply first."); return; }
    messages = []; messageList.replaceChildren(); welcome.hidden = false; input.value = ""; images = []; documents = []; renderAttachments();
    resizeInput(); updateCount(); input.focus(); sidebar.classList.remove("open"); mobileMenu.setAttribute("aria-expanded", "false");
  }
  async function runWorkflow(workflow) {
    const approved = window.confirm('Run "' + workflow.name + '"? This may send the workflow details to the external automation endpoint configured by the site owner.');
    if (!approved) return;
    if (!features.automation) {
      closeModal(automationModal);
      input.value = "Please run this saved workflow as an AI task. Do not claim external actions were completed. Workflow: " + workflow.name + "\nInstructions: " + workflow.details;
      resizeInput(); updateCount(); showToast("No external connector is configured. Running this as a SeenAi chat task instead."); form.requestSubmit(); return;
    }
    try {
      const response = await fetch("/api/automation", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ approved: true, workflow: workflow.name, details: workflow.details }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || "Automation failed.");
      showToast(result.message || "Workflow sent."); closeModal(automationModal);
    } catch (error) { showToast(error.message || "Automation failed."); }
  }

  form.addEventListener("submit", event => { event.preventDefault(); sendMessage(input.value); });
  input.addEventListener("input", () => { resizeInput(); updateCount(); });
  input.addEventListener("keydown", event => { if (event.key === "Enter" && !event.shiftKey && !event.isComposing) { event.preventDefault(); form.requestSubmit(); } });
  document.querySelectorAll("[data-prompt]").forEach(button => button.addEventListener("click", () => sendMessage(button.dataset.prompt || "")));
  newChatButton.addEventListener("click", resetChat); clearChatButton.addEventListener("click", resetChat);
  mobileMenu.addEventListener("click", () => { const open = sidebar.classList.toggle("open"); mobileMenu.setAttribute("aria-expanded", String(open)); });
  attachButton.addEventListener("click", () => fileInput.click());
  fileInput.addEventListener("change", () => handleFiles(Array.from(fileInput.files || [])));
  $("#memoryButton").addEventListener("click", () => { renderMemories(); openModal(memoryModal); });
  $("#memoryQuickButton").addEventListener("click", () => { renderMemories(); openModal(memoryModal); });
  $("#automationButton").addEventListener("click", () => { renderWorkflows(); openModal(automationModal); });
  document.querySelectorAll("[data-close-modal]").forEach(button => button.addEventListener("click", () => closeModal($("#" + button.dataset.closeModal))));
  document.querySelectorAll(".modal-backdrop").forEach(modal => modal.addEventListener("click", event => { if (event.target === modal) closeModal(modal); }));
  memoryForm.addEventListener("submit", event => {
    event.preventDefault(); const text = memoryInput.value.trim(); if (!text) return;
    const memories = getMemories(); if (memories.length >= 40) { showToast("You can save up to 40 memories."); return; }
    memories.unshift({ text, createdAt: new Date().toISOString() });
    if (writeStore(STORAGE.memory, memories)) { memoryInput.value = ""; renderMemories(); showToast("Memory saved on this browser."); }
  });
  $("#clearMemoryButton").addEventListener("click", () => {
    if (!window.confirm("Delete every saved memory from this browser?")) return;
    localStorage.removeItem(STORAGE.memory); renderMemories(); showToast("Saved memories deleted.");
  });
  workflowForm.addEventListener("submit", event => {
    event.preventDefault(); const name = workflowName.value.trim(), details = workflowDetails.value.trim(); if (!name || !details) return;
    const workflows = getWorkflows(); workflows.unshift({ name, details, createdAt: new Date().toISOString() });
    if (writeStore(STORAGE.workflows, workflows.slice(0, 20))) { workflowName.value = ""; workflowDetails.value = ""; renderWorkflows(); showToast("Workflow saved in this browser."); }
  });
  $("#automationRunDraft").addEventListener("click", () => {
    const name = workflowName.value.trim(), details = workflowDetails.value.trim();
    if (!name || !details) { showToast("Enter a workflow name and instructions first."); return; }
    closeModal(automationModal); input.value = "Help me perform this workflow as an AI task. Do not claim any external action was completed. Workflow: " + name + "\nInstructions: " + details;
    resizeInput(); updateCount(); form.requestSubmit();
  });
  document.addEventListener("keydown", event => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") { event.preventDefault(); resetChat(); }
    if (event.key === "Escape") { if (sidebar.classList.contains("open")) { sidebar.classList.remove("open"); mobileMenu.setAttribute("aria-expanded", "false"); } [memoryModal, automationModal].forEach(modal => { if (!modal.hidden) closeModal(modal); }); }
  });
  updateCount(); renderMemories(); renderWorkflows();
  fetch("/api/health").then(response => response.json()).then(data => {
    features = data.features || {};
    if (!data.configured) showToast("Setup needed: add GROQ_API_KEY to Render Environment.");
    if (features.webSearch) webStatus.textContent = "Ready";
    else { webSearchToggle.title = "Set FIRECRAWL_API_KEY in Render to enable live search."; webStatus.textContent = "Setup"; }
  }).catch(() => {});
})();