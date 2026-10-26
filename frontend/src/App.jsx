import { Outlet } from "react-router-dom";
import Header from "./components/Header";
import ChatbotWidget from "./components/ChatbotWidget";

const App = () => {
  return (
    <div className="app">
      {/* Header Navigation */}
      <Header />

      {/* Main Content */}
      <main className="app-main">
        <Outlet />
      </main>

      {/* Chatbot Widget - hiển thị ở mọi trang */}
      <ChatbotWidget />
    </div>
  );
};

export default App;
