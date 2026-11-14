from typing import Optional
"""
Module generator — sinh câu trả lời từ LLM dựa trên RAG context.

Cung cấp class ResponseGenerator sử dụng LangChain để quản lý
prompt template và gọi LLM.
"""
import os
from langchain_google_genai import ChatGoogleGenerativeAI
from src.schemas import ChatMessage, RetrievedChunk
from src.retrieval.retriever import Retriever
from src.logger import get_logger
from src.config import LLM_API_KEY, LLM_MAX_TOKENS, LLM_MODEL_NAME, LLM_TEMPERATURE

logger = get_logger(__name__)
from dotenv import load_dotenv

load_dotenv()


class ResponseGenerator:
    """
    Sinh câu trả lời từ LLM dựa trên context và lịch sử chat.

    Quản lý LLM instance, system prompt, và prompt engineering.
    Kết hợp context từ retrieval với chat history để tạo
    multi-turn conversation.

    Attributes:
        _llm: LangChain ChatOpenAI instance.
        _system_prompt (str): System prompt đã build.
        _retriever (Retriever): Retriever để format context.

    Usage:
        generator = ResponseGenerator(retriever)
        answer = generator.generate(query, chunks, chat_history)
    """

    def __init__(self, retriever: Retriever):
        """
        Khởi tạo ResponseGenerator.

        Load LLM với tham số từ config (model name, temperature, max_tokens).
        Build system prompt. Log tên model và cấu hình.

        Args:
            retriever (Retriever): Instance Retriever để format context.

        Raises:
            ValueError: Khi GEMINI_API_KEY chưa cấu hình.
                Log error cảnh báo.
        """
        logger.info("Đang khởi tạo Response Generator (Tầng Sinh văn bản)...")
        
        self._retriever = retriever
        self._llm = self._init_llm()
        self._system_prompt = self._build_system_prompt()
        
        logger.info("Response Generator đã sẵn sàng hoạt động!")

    def _init_llm(self):
        """
        Khởi tạo LLM instance từ LangChain.

        Sử dụng ChatOpenAI với LLM_MODEL_NAME, LLM_TEMPERATURE,
        LLM_MAX_TOKENS, LLM_API_KEY từ config.
        Log tên model, temperature, max_tokens.

        Returns:
            langchain_openai.ChatOpenAI: LLM instance.

        Raises:
            ValueError: Khi API key chưa cấu hình.
        """
        api_key = LLM_API_KEY or os.getenv("GOOGLE_API_KEY")
        
        if not api_key:
            logger.critical("LỖI NGHIÊM TRỌNG: Chưa cấu hình LLM_API_KEY / GOOGLE_API_KEY.")
            raise ValueError("Thiếu API Key để gọi Gemini. Vui lòng kiểm tra file .env!")

        model_name = LLM_MODEL_NAME or "gemini-3-flash-preview"
        temperature = LLM_TEMPERATURE or 0.3 

        logger.info(f"Đang thiết lập kết nối tới mô hình: '{model_name}' (Temp: {temperature})")

        try:
            # Khởi tạo object quản lý API
            llm = ChatGoogleGenerativeAI(
                model=model_name,
                temperature=temperature,
                google_api_key=api_key,
                max_retries=3, # Tự động gọi lại nếu API của Google bị nghẽn mạng chớp nhoáng
                convert_system_message_to_human=False # Gemini hỗ trợ system prompt chuẩn
            )
            return llm
            
        except Exception as e:
            logger.error(f"Không thể khởi tạo LangChain Gemini: {e}", exc_info=True)
            raise RuntimeError(f"Khởi tạo LLM thất bại: {e}")



    def _build_system_prompt(self) -> str:
        """
        Tạo system prompt cho chatbot tư vấn phim.

        Định nghĩa:
        - Vai trò: Chuyên gia tư vấn phim trên web MovieHub
        - Ngôn ngữ: Tiếng Việt, thân thiện, nhiệt tình
        - Quy tắc: Chỉ trả lời dựa trên context, thông báo nếu không tìm thấy
        - Format: Gợi ý phim kèm lý do, đánh giá, thông tin diễn viên
        - Nếu có link chi tiết phim thì chèn link trực tiếp vào tên phim theo Markdown, không dùng tiền tố "Đường link:".

        Returns:
            str: System prompt string.
        """
        frontend_watch_url = os.getenv("FRONTEND_WATCH_URL", "http://localhost:5173/watch/slug")
        
        prompt = f"""Bạn là một Chuyên gia tư vấn phim ảnh nhiệt tình, tinh tế và am hiểu của nền tảng MovieHub.

                    NHIỆM VỤ CỦA BẠN:
                    Lắng nghe nhu cầu của người dùng, giải đáp thắc mắc và đưa ra các gợi ý phim xuất sắc nhất bằng tiếng Việt hoặc ngôn ngữ người dùng yêu cầu (nếu có).

                    QUY TẮC SỐNG CÒN (BẮT BUỘC PHẢI TUÂN THỦ):
                    1. CHỐNG ẢO GIÁC (NO HALLUCINATION): Bạn CHỈ ĐƯỢC PHÉP trả lời dựa trên thông tin được cung cấp trong phần [NGỮ CẢNH (CONTEXT)]. Tuyệt đối KHÔNG tự bịa ra tên phim, diễn viên, năm phát hành, hay cốt truyện nếu nó không xuất hiện trong ngữ cảnh. Ngoại trừ phần mô tả phim, nếu phần mô tả quá ngắn mà cần thông tin chi tiết thì có thể dựa vào tri thức của bạn để trả lời.
                    2. XỬ LÝ KHI THIẾU DỮ LIỆU: Nếu thông tin trong ngữ cảnh không đủ để trả lời câu hỏi, hãy thành thật từ chối một cách lịch sự. (Ví dụ: "Dạ, hệ thống của em hiện tại chưa cập nhật thông tin về bộ phim này. Bạn có muốn em tìm thử một bộ phim khác cùng thể loại không?").
                    3. ĐỊNH DẠNG TRÌNH BÀY: Khi bạn gợi ý một hoặc nhiều bộ phim, hãy trình bày thật rõ ràng, dễ đọc:
                    - **[Tên phim (Năm phát hành)]({frontend_watch_url})** | Thể loại: ... | Rating: ...
                    - **Lý do gợi ý:** (Trích xuất 1-2 câu tóm tắt nội dung từ ngữ cảnh để thuyết phục người dùng).
                    - KHÔNG viết dòng "Đường link:" riêng.
                    4. XỬ LÝ INTENT TÓM TẮT: Nếu người dùng yêu cầu tóm tắt/nội dung của MỘT phim cụ thể, chỉ tập trung trả lời phim đó, không liệt kê danh sách nhiều phim khác trừ khi người dùng hỏi thêm gợi ý.
                    5. GIỌNG ĐIỆU: Gần gũi, tự nhiên như một người bạn thân đang rủ đi xem phim.

                    Hãy phân tích kỹ ngữ cảnh được cung cấp và đưa ra câu trả lời xuất sắc nhất!
                """
        
        logger.debug("Đã khởi tạo xong System Prompt.")
        return prompt + (
            "\nZflix uses movie detail pages managed by the web app. "
            "Do not write URLs or Markdown links in the answer. "
            "Mention movie titles as plain text; the interface provides the movie links."
        )
    
    

    def build_messages(
        self,
        query: str,
        context: str,
        chat_history: Optional[list[ChatMessage]] = None
    ) -> list[dict]:
        """
        Xây dựng danh sách messages cho LLM.

        Cấu trúc:
        1. System message: persona + quy tắc
        2. Chat history: N tin nhắn gần nhất (tối đa 10)
        3. User message: context + câu hỏi hiện tại

        Log debug: số messages history, độ dài context.

        Args:
            query (str): Câu hỏi hiện tại.
            context (str): Context string từ Retriever.format_context().
            chat_history (Optional[list[ChatMessage]]): Lịch sử hội thoại.

        Returns:
            list[dict]: Messages format [{"role": "...", "content": "..."}, ...]
        """
        messages = []

        messages.append({
            "role": "system",
            "content": self._system_prompt
        })

        if chat_history:
            recent_history = chat_history[-10:]
            if recent_history and recent_history[0].role != "user": # role đầu tiên phải là user
                recent_history = recent_history[1:] 
                
            for msg in recent_history:
                # Chuyển đổi role cho chuẩn form của LangChain/OpenAI format
                role = "user" if msg.role == "user" else "assistant"
                messages.append({
                    "role": role,
                    "content": msg.content
                })

        current_content = (
            f"[NGỮ CẢNH (CONTEXT)]\n"
            f"Dưới đây là các tài liệu tôi tìm được từ cơ sở dữ liệu phim:\n"
            f"{context}\n\n"
            f"----------------------------------------------------------------------\n"
            f"[CÂU HỎI CỦA NGƯỜI DÙNG]\n"
            f"{query}"
        )
        
        messages.append({
            "role": "user",
            "content": current_content
        })

        logger.debug(f"Đã đóng gói xong {len(messages)} messages (gồm system, history và current query).")
        return messages



    async def generate(
        self,
        query: str,
        retrieved_chunks: list[RetrievedChunk],
        chat_history: Optional[list[ChatMessage]] = None
    ) -> str:
        """
        Sinh câu trả lời từ LLM.

        Orchestrate:
        1. Retriever.format_context(chunks) → context string
        2. build_messages(query, context, history) → messages
        3. LLM.ainvoke(messages) → response
        4. Trích xuất text response

        Log: số chunks, số messages, thời gian LLM, độ dài response.

        Args:
            query (str): Câu hỏi người dùng.
            retrieved_chunks (list[RetrievedChunk]): Chunks đã rerank.
            chat_history (Optional[list[ChatMessage]]): Lịch sử chat.

        Returns:
            str: Câu trả lời text từ LLM.

        Raises:
            Exception: Khi LLM API thất bại.
                Log error kèm query, số chunks, error chi tiết.
        """
        import time
        start_time = time.time()
        
        logger.info(f"Bắt đầu quy trình Generate (Gọi LLM) cho câu hỏi: '{query}'")

        try:
            context_string = self._retriever.format_context(retrieved_chunks)
            
            messages_list = self.build_messages(query, context_string, chat_history)

            logger.info("Đang chờ Gemini trả lời... (Tác vụ mạng I/O-bound)")
            
            ai_response = await self._llm.ainvoke(messages_list) # hàm await để nhả CPU ra trong lúc chờ
            content = ai_response.content
            if isinstance(content, list):
                # Nếu là list, bóc tách lấy riêng phần text
                return "".join([item.get("text", "") for item in content if isinstance(item, dict)])

            elapsed_time = round(time.time() - start_time, 2)
            logger.info(f"Gemini đã trả lời xong trong {elapsed_time}s! Độ dài: {len(content)} ký tự.")
            
            return str(content)                                                                             # type: ignore

        except Exception as e:
            logger.error(f"LỖI TẦNG LLM: Gọi Gemini thất bại! Nguyên nhân: {e}", exc_info=True)
            return (
                "Dạ, hệ thống tư vấn của em đang bị quá tải hoặc gặp chút sự cố mạng. "
                "Anh/chị thông cảm đợi em một lát rồi thử hỏi lại nhé!"
            )


if __name__ == "__main__":
    import pprint
    import asyncio
    from src.logger import setup_logging
    from src.database.vector_store import VectorStoreManager
    from src.retrieval.hybrid_search import HybridSearchEngine
    from src.retrieval.reranker import Reranker
    
    setup_logging()
    logger = get_logger(__name__)
    
    async def main():
        logger.info("Bắt đầu test Generator...")
        
        try:
            vectordb = VectorStoreManager()
            vectordb.initialize() 
            
            search_engine = HybridSearchEngine(vector_store=vectordb)
            search_engine.load_bm25()
            reranker = Reranker()
            retriever = Retriever(search_engine=search_engine, reranker=reranker)
            
            query = "Phim hành động hay nhất cho tôi, rating cao nhất"
            logger.info(f"Đang tìm kiếm cho câu hỏi: '{query}'")
            
            retriever_chunks = await retriever.retrieve(query=query)
            
            logger.info(f"Tìm thấy {len(retriever_chunks)} kết quả!")
            
            
            respond = ResponseGenerator(retriever = retriever)
            answer = await respond.generate(query = query, retrieved_chunks = retriever_chunks)
            print(answer)
            
        except Exception as e:
            logger.error(f"Test thất bại: {e}", exc_info=True)
    asyncio.run(main())
