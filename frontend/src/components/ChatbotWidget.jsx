import { useEffect, useRef, useState } from "react";
import {
  FiArrowDown, FiMessageCircle, FiMinus, FiRotateCcw, FiSend, FiX,
} from "react-icons/fi";
import ChatMessage from "./chatbot/ChatMessage.jsx";
import { normalizeChatResponse } from "./chatbot/normalizeChatResponse.js";
import "../assets/chatbot.css";

const suggestions = [
  "Gợi ý phim hành động",
  "Có phim nào nhẹ nhàng cuối tuần?",
  "Tìm phim có cốt truyện bất ngờ",
];

const greeting = () => ({
  id: "greeting",
  role: "assistant",
  text: "Chào bạn! Mình là Zflix AI. Bạn muốn xem phim theo tâm trạng hay thể loại nào?",
});

const chatEndpoint = () => import.meta.env.VITE_AI_CHATBOT_API_URL?.trim() ||
  `${window.location.protocol}//${window.location.hostname}:8002/api/v1/chat`;

const visitorId = () => {
  let id = sessionStorage.getItem("zflix_chat_visitor_id");
  if (!id) {
    id = `web-${crypto.randomUUID()}`;
    sessionStorage.setItem("zflix_chat_visitor_id", id);
  }
  return id;
};

export default function ChatbotWidget() {
  const [view, setView] = useState("closed");
  const [input, setInput] = useState("");
  const [busy, setBusy] = useState(false);
  const [connectionError, setConnectionError] = useState(false);
  const [showJump, setShowJump] = useState(false);
  const [conversationId, setConversationId] = useState(null);
  const [messages, setMessages] = useState([greeting]);
  const listRef = useRef(null);
  const inputRef = useRef(null);
  const nearBottomRef = useRef(true);
  const inFlightRef = useRef(false);
  const controllerRef = useRef(null);
  const requestRef = useRef(0);

  useEffect(() => {
    if (view === "open") inputRef.current?.focus();
  }, [view]);

  useEffect(() => {
    if (view !== "open" || !nearBottomRef.current) return;
    const list = listRef.current;
    if (list) list.scrollTop = list.scrollHeight;
  }, [messages, view]);

  useEffect(() => () => { controllerRef.current?.abort(); }, []);

  const reset = () => {
    requestRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    inFlightRef.current = false;
    nearBottomRef.current = true;
    setShowJump(false);
    setBusy(false);
    setConnectionError(false);
    setConversationId(null);
    setInput("");
    setMessages([greeting()]);
    inputRef.current?.focus();
  };

  const send = async (text = input, retryId = null) => {
    const message = text.trim();
    if (!message || inFlightRef.current) return;
    inFlightRef.current = true;
    const requestNumber = ++requestRef.current;
    const controller = new AbortController();
    controllerRef.current = controller;
    const replyId = retryId || crypto.randomUUID();
    nearBottomRef.current = true;
    setShowJump(false);
    setInput("");
    setBusy(true);
    setConnectionError(false);
    if (retryId) {
      setMessages((items) => items.map((item) => item.id === retryId
        ? { id: replyId, role: "assistant", pending: true, text: "" }
        : item));
    } else {
      setMessages((items) => [...items,
        { id: `user-${replyId}`, role: "user", text: message },
        { id: replyId, role: "assistant", pending: true, text: "" },
      ]);
    }

    try {
      const response = await fetch(chatEndpoint(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          user_id: visitorId(), message, conversation_id: conversationId,
        }),
        signal: controller.signal,
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(
        typeof result.detail === "string" ? result.detail : `Chatbot lỗi (${response.status})`,
      );
      if (requestRef.current !== requestNumber) return;
      setConversationId(result.conversation_id || null);
      const content = normalizeChatResponse(result);
      setMessages((items) => items.map((item) => item.id === replyId
        ? { id: replyId, role: "assistant", ...content }
        : item));
    } catch (error) {
      if (requestRef.current !== requestNumber || error.name === "AbortError") return;
      setConnectionError(true);
      setMessages((items) => items.map((item) => item.id === replyId
        ? {
          id: replyId,
          role: "assistant",
          error: error.message || "Không kết nối được với trợ lý phim.",
          retryText: message,
        }
        : item));
    } finally {
      if (requestRef.current === requestNumber) {
        inFlightRef.current = false;
        controllerRef.current = null;
        setBusy(false);
      }
    }
  };

  const onScroll = () => {
    const list = listRef.current;
    if (!list) return;
    nearBottomRef.current = list.scrollHeight - list.scrollTop - list.clientHeight < 64;
    setShowJump(!nearBottomRef.current);
  };

  const jumpToBottom = () => {
    nearBottomRef.current = true;
    setShowJump(false);
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
  };

  const status = busy ? "Đang trả lời" : connectionError ? "Kết nối gián đoạn" : "Sẵn sàng trò chuyện";
  const hasUserMessage = messages.some((item) => item.role === "user");

  return <div className="zflix-chat" data-view={view}>
    {view === "closed" && <button type="button" className="zflix-chat-fab" onClick={() => setView("open")} aria-label="Mở trợ lý phim">
      <FiMessageCircle aria-hidden="true" /><span>Hỏi Zflix AI</span>
    </button>}
    {view === "minimized" && <button type="button" className="zflix-chat-minimized" onClick={() => setView("open")} aria-label="Mở lại trợ lý phim">
      <span className="zflix-chat-mini-mark">Z</span><span>Zflix AI</span><span className="zflix-chat-mini-hint">Mở cuộc trò chuyện</span>
    </button>}
    {view === "open" && <section className="zflix-chat-panel" role="dialog" aria-label="Trợ lý phim Zflix" aria-modal="false">
      <header className="zflix-chat-header">
        <div className="zflix-chat-identity">
          <span className="zflix-chat-logo" aria-hidden="true">Z<span>AI</span></span>
          <div><strong>Zflix AI</strong><span className="zflix-chat-status"><i className={connectionError ? "is-error" : ""} />{status}</span></div>
        </div>
        <div className="zflix-chat-actions">
          <button type="button" onClick={reset} aria-label="Bắt đầu cuộc trò chuyện mới" title="Bắt đầu lại"><FiRotateCcw aria-hidden="true" /></button>
          <button type="button" onClick={() => setView("minimized")} aria-label="Thu nhỏ chatbot" title="Thu nhỏ"><FiMinus aria-hidden="true" /></button>
          <button type="button" onClick={() => setView("closed")} aria-label="Đóng chatbot" title="Đóng"><FiX aria-hidden="true" /></button>
        </div>
      </header>

      <div className="zflix-chat-conversation">
        <div ref={listRef} className="zflix-chat-messages" role="log" aria-live="polite" onScroll={onScroll}>
          <div className="zflix-chat-day">Hôm nay</div>
          {messages.map((item) => <ChatMessage key={item.id} message={item} onRetry={() => send(item.retryText, item.id)} />)}
          {!hasUserMessage && <div className="zflix-chat-suggestions" aria-label="Gợi ý câu hỏi">
            <span>Thử hỏi mình</span>
            {suggestions.map((suggestion) => <button type="button" key={suggestion} disabled={busy} onClick={() => send(suggestion)}>{suggestion}</button>)}
          </div>}
        </div>
        {showJump && <button type="button" className="zflix-chat-jump" onClick={jumpToBottom} aria-label="Cuộn xuống tin nhắn mới"><FiArrowDown aria-hidden="true" /></button>}
      </div>

      <form className="zflix-chat-compose" onSubmit={(event) => { event.preventDefault(); send(); }}>
        <div className="zflix-chat-input-wrap">
          <textarea ref={inputRef} value={input} maxLength={500} rows={1} placeholder="Hỏi Zflix AI về phim..." aria-label="Tin nhắn cho Zflix AI" onChange={(event) => setInput(event.target.value)} onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey && !event.nativeEvent.isComposing) {
              event.preventDefault();
              send();
            }
          }} />
          <button type="submit" className="zflix-chat-send" disabled={busy || !input.trim()} aria-label="Gửi tin nhắn" title="Gửi tin nhắn"><FiSend aria-hidden="true" /></button>
        </div>
        <span className="zflix-chat-input-hint">Enter để gửi · Shift + Enter để xuống dòng</span>
      </form>
    </section>}
  </div>;
}
