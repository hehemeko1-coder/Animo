(() => {
  const form = document.querySelector("#chatForm");
  const input = document.querySelector("#messageInput");
  const sendButton = document.querySelector("#sendButton");
  const messageList = document.querySelector("#messageList");
  const welcome = document.querySelector("#welcome");
  const newChatButton = document.querySelector("#newChatButton");
  const clearChatButton = document.querySelector("#clearChatButton");
  const characterCount = document.querySelector("#characterCount");
  const conversation = document.querySelector("#conversation");
  const toast = document.querySelector("#toast");
  const sidebar = document.querySelector("#sidebar");
  const mobileMenu = document.querySelector("#mobileMenu");

  let messages = [];
  let busy = false;
  let toastTimeout;

  const now = () => new Date().toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });

  function showToast(message) {
    toast.textContent = message;
    toast.classList.add("show");
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => toast.classList.remove("show"), 3200);
  }

  function scrollToBottom() {
    requestAnimationFrame(() => {
      conversation.scrollTop = conversation.scrollHeight;
    });
  }

  function makeMessage(role, content, options = {}) {
    const article = document.createElement("article");
    article.className = `message ${role}`;

    const avatar = document.createElement("div");
    avatar.className = "message-avatar";
    avatar.setAttribute("aria-hidden", "true");
    avatar.textContent = role === "assistant" ? "✳" : "Y";

    const body = document.createElement("div");
    body.className = "message-body";

    const meta = document.createElement("div");
    meta.className = "message-meta";
    const name = document.createElement("strong");
    name.textContent = role === "assistant" ? "SeenAi" : "You";
    const time = document.createElement("time");
    time.textContent = now();
    meta.append(name, time);

    const text = document.createElement("div");
    text.className = "message-content";
    if (options.typing) {
      text.innerHTML = '<div class="typing-indicator" aria-label="SeenAi is thinking"><span></span><span></span><span></span></div>';
    } else {
      text.textContent = content;
    }

    body.append(meta, text);
    article.append(avatar, body);
    messageList.append(article);
    scrollToBottom();
    return article;
  }

  function setBusy(value) {
    busy = value;
    sendButton.disabled = value;
    sendButton.setAttribute("aria-label", value ? "Waiting for response" : "Send message");
    input.disabled = value;
    if (!value) input.focus();
  }

  function resizeInput() {
    input.style.height = "auto";
    input.style.height = Math.min(input.scrollHeight, 180) + "px";
  }

  function updateCount() {
    characterCount.textContent = `${input.value.length} / 4000`;
    characterCount.style.color = input.value.length > 3700 ? "#f0b97e" : "";
  }

  async function sendMessage(rawText) {
    const content = rawText.trim();
    if (!content || busy) return;
    if (content.length > 4000) {
      showToast("Please keep each message under 4,000 characters.");
      return;
    }

    welcome.hidden = true;
    messages.push({ role: "user", content });
    makeMessage("user", content);
    input.value = "";
    resizeInput();
    updateCount();
    setBusy(true);

    const typing = makeMessage("assistant", "", { typing: true });
    const context = messages.slice(-11);

    try {
      const response = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ messages: context })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || "Something went wrong. Please try again.");
      if (typeof data.reply !== "string" || !data.reply.trim()) {
        throw new Error("SeenAi returned an empty reply. Please try again.");
      }

      typing.remove();
      messages.push({ role: "assistant", content: data.reply });
      makeMessage("assistant", data.reply);
    } catch (error) {
      typing.remove();
      const errorText = error.message || "Couldn't connect to SeenAi. Check your connection and try again.";
      makeMessage("assistant", errorText);
      showToast(errorText);
    } finally {
      setBusy(false);
      scrollToBottom();
    }
  }

  function resetChat() {
    if (busy) {
      showToast("Wait for SeenAi to finish the current reply first.");
      return;
    }
    messages = [];
    messageList.replaceChildren();
    welcome.hidden = false;
    input.value = "";
    resizeInput();
    updateCount();
    input.focus();
    if (sidebar) sidebar.classList.remove("open");
    if (mobileMenu) mobileMenu.setAttribute("aria-expanded", "false");
  }

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    sendMessage(input.value);
  });

  input.addEventListener("input", () => {
    resizeInput();
    updateCount();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && !event.shiftKey && !event.isComposing) {
      event.preventDefault();
      form.requestSubmit();
    }
  });

  document.querySelectorAll("[data-prompt]").forEach((button) => {
    button.addEventListener("click", () => sendMessage(button.dataset.prompt || ""));
  });

  newChatButton.addEventListener("click", resetChat);
  clearChatButton.addEventListener("click", resetChat);

  mobileMenu.addEventListener("click", () => {
    const open = sidebar.classList.toggle("open");
    mobileMenu.setAttribute("aria-expanded", String(open));
  });

  document.addEventListener("keydown", (event) => {
    if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
      event.preventDefault();
      resetChat();
    }
    if (event.key === "Escape" && sidebar.classList.contains("open")) {
      sidebar.classList.remove("open");
      mobileMenu.setAttribute("aria-expanded", "false");
    }
  });

  updateCount();
  fetch("/api/health")
    .then((response) => response.json())
    .then((data) => {
      if (!data.configured) {
        showToast("Setup needed: add GROQ_API_KEY to your server environment to enable AI replies.");
      }
    })
    .catch(() => {
      // The page can still render if the API is temporarily unavailable.
    });
})();