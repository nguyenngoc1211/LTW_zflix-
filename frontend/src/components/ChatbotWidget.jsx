import { useState, useRef, useEffect } from "react";
import "../assets/chatbot.css";

const ChatbotWidget = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState([
    {
      id: 1,
      type: "bot",
      text: "Chào bạn! Mình có thể giúp tìm phim, gợi ý theo thể loại/diễn viên, hoặc tóm tắt (không spoil).",
      suggestion: 'Gợi ý: "Gợi ý phim hành động giống Biệt Đội Đáp Phá"',
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSendMessage = () => {
    if (inputValue.trim() === "") return;

    // Add user message
    const userMessage = {
      id: Date.now(),
      type: "user",
      text: inputValue,
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate bot response (replace with actual API call)
    setTimeout(() => {
      const botMessage = {
        id: Date.now() + 1,
        type: "bot",
        text: "Đang xử lý yêu cầu của bạn...",
      };
      setMessages((prev) => [...prev, botMessage]);
    }, 500);
  };

  const handleKeyDown = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          className="chatbot-float-btn"
          onClick={() => setIsOpen(true)}
          aria-label="Open chatbot"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
        </button>
      )}

      {/* Chatbot Widget */}
      {isOpen && (
        <div className="chatbot-widget">
          {/* Header */}
          <div className="chatbot-header">
            <div className="chatbot-header-info">
              <div className="chatbot-avatar">
                <svg
                  width="20"
                  height="20"
                  viewBox="0 0 24 24"
                  fill="currentColor"
                >
                  <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 3c1.66 0 3 1.34 3 3s-1.34 3-3 3-3-1.34-3-3 1.34-3 3-3zm0 14.2c-2.5 0-4.71-1.28-6-3.22.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
                </svg>
              </div>
              <div className="chatbot-header-text">
                <div className="chatbot-title">Movie Assistant</div>
                <div className="chatbot-status">
                  <span className="status-dot"></span>
                  Online • trả lời nhanh
                </div>
              </div>
            </div>
            <div className="chatbot-header-actions">
              <button
                className="chatbot-action-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Minimize"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path d="M19 13H5v-2h14v2z" fill="currentColor" />
                </svg>
              </button>
              <button
                className="chatbot-action-btn"
                onClick={() => setIsOpen(false)}
                aria-label="Close"
              >
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M19 6.41L17.59 5 12 10.59 6.41 5 5 6.41 10.59 12 5 17.59 6.41 19 12 13.41 17.59 19 19 17.59 13.41 12z"
                    fill="currentColor"
                  />
                </svg>
              </button>
            </div>
          </div>

          {/* Messages */}
          <div className="chatbot-messages">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`chatbot-message ${message.type === "user" ? "user-message" : "bot-message"}`}
              >
                <div className="message-content">
                  <div className="message-text">{message.text}</div>
                  {message.suggestion && (
                    <div className="message-suggestion">
                      {message.suggestion}
                    </div>
                  )}
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="chatbot-input-container">
            <textarea
              className="chatbot-input"
              placeholder="Nhập tin nhắn... "
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              rows={1}
            />
            <button
              className="chatbot-send-btn"
              onClick={handleSendMessage}
              disabled={inputValue.trim() === ""}
              aria-label="Send message"
            >
              <svg
                width="20"
                height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ChatbotWidget;
