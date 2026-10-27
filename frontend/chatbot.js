(function () {
  const chat = document.getElementById("rpChat");
  const fab = document.getElementById("rpChatFab");
  const minBtn = document.getElementById("rpChatMin");
  const clearBtn = document.getElementById("rpChatClear");
  const badge = document.getElementById("rpChatBadge");

  const body = document.getElementById("rpChatBody");
  const input = document.getElementById("rpChatInput");
  const sendBtn = document.getElementById("rpChatSend");

  if (!chat || !fab || !minBtn || !body || !input || !sendBtn) return;

  const openChat = () => {
    chat.classList.add("rp-chat--open");
    if (badge) badge.style.display = "none";
    setTimeout(() => input.focus(), 50);
    body.scrollTop = body.scrollHeight;
  };

  const closeChat = () => {
    chat.classList.remove("rp-chat--open");
  };

  const addMsg = (text, who = "me") => {
    const wrap = document.createElement("div");
    wrap.className = `rp-chat__msg rp-chat__msg--${who}`;

    const bubble = document.createElement("div");
    bubble.className = "rp-chat__bubble";
    bubble.textContent = text;

    wrap.appendChild(bubble);
    body.appendChild(wrap);
    body.scrollTop = body.scrollHeight;
  };

  const fakeBotReply = (userText) => {
    const reply =
      `Mình đã nhận: "${userText}".\n` +
      `Bạn muốn gợi ý theo: (1) thể loại, (2) quốc gia, hay (3) phim tương tự?`;
    setTimeout(() => addMsg(reply, "bot"), 450);
  };

  const send = () => {
    const text = input.value.trim();
    if (!text) return;

    addMsg(text, "me");
    input.value = "";
    input.style.height = "38px";

    // demo reply
    fakeBotReply(text);
  };

  // Events
  fab.addEventListener("click", openChat);
  minBtn.addEventListener("click", closeChat);

  sendBtn.addEventListener("click", send);

  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      body.innerHTML = "";
      addMsg(
        "Chào bạn! Mình có thể giúp tìm phim, gợi ý theo thể loại/diễn viên, hoặc tóm tắt (không spoil).",
        "bot"
      );
    });
  }

  // Enter to send, Shift+Enter newline
  input.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      send();
    }
  });

  // Auto-grow textarea
  input.addEventListener("input", () => {
    input.style.height = "38px";
    input.style.height = Math.min(input.scrollHeight, 120) + "px";
  });

  // Show badge demo on load (nếu đang đóng)
  setTimeout(() => {
    if (!chat.classList.contains("rp-chat--open") && badge) {
      badge.style.display = "block";
    }
  }, 300);
})();
