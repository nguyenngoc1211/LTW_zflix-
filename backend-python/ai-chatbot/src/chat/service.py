"""
Module chat service — orchestrate RAG pipeline cho một request chat.

Cung cấp class ChatService kết nối: history → retrieval → generation → history.
"""

import time
import asyncio
from src.schemas import ChatRequest, ChatResponse, ChatMessage, MessageRole
from src.retrieval.retriever import Retriever
from src.generation.generator import ResponseGenerator
from src.history.repository import ChatHistoryRepository
from src.logger import get_logger
from src.config import CHAT_RETRIEVAL_TIMEOUT_SECONDS, CHAT_LLM_TIMEOUT_SECONDS
from src.chat.movie_catalog import load_recommended_movies

from typing import Optional

logger = get_logger(__name__)

def _to_numeric_production_id(value: object) -> Optional[int]:
    if isinstance(value, bool):
        return None
    if isinstance(value, int) and value > 0:
        return value
    try:
        numeric = int(str(value))
    except (TypeError, ValueError):
        return None
    return numeric if numeric > 0 else None

class ChatService:
    """
    Service xử lý chat qua RAG pipeline.

    Orchestrate toàn bộ luồng xử lý một request chat:
    quản lý conversation → lưu tin nhắn → truy xuất context
    → rerank → sinh câu trả lời → lưu response.

    Attributes:
        _retriever (Retriever): Orchestrator truy xuất context.
        _generator (ResponseGenerator): Sinh câu trả lời LLM.
        _history_repo (ChatHistoryRepository): CRUD lịch sử chat.

    Usage:
        service = ChatService(retriever, generator, history_repo)
        response = service.process(chat_request)
    """

    def __init__(self, 
                 retriever: Retriever, 
                 generator: ResponseGenerator, 
                 history_repo: ChatHistoryRepository):
        """
        Khởi tạo ChatService với dependencies đã inject.

        Args:
            retriever (Retriever): Instance Retriever.
            generator (ResponseGenerator): Instance ResponseGenerator.
            history_repo (ChatHistoryRepository): Instance ChatHistoryRepository.
        """
        self._retriever = retriever
        self._generator = generator
        self._history_repo = history_repo
        
        logger.info("ChatService đã nhận đủ tool: [Retriever, Generator, HistoryRepo]. Sẵn sàng phục vụ!")
        
        

    async def process(self, request: ChatRequest) -> ChatResponse:
        """
        Xử lý một request chat qua toàn bộ RAG pipeline.

        Quy trình:
        1. Xác định conversation — tạo mới hoặc lấy cũ (log conversation_id)
        2. Lưu tin nhắn user vào MongoDB (log message length)
        3. Lấy lịch sử chat gần nhất (log số messages)
        4. Retriever.retrieve(query) → chunks (log số chunks, thời gian)
        5. ResponseGenerator.generate(query, chunks, history) → answer
           (log thời gian LLM)
        6. Lưu tin nhắn assistant vào MongoDB (log response length)
        7. Trả về ChatResponse (log tổng thời gian pipeline)

        Nếu thất bại → log error kèm: bước thất bại, user_id,
        conversation_id, query (truncated 100 chars), traceback.

        Args:
            request (ChatRequest): user_id, message, conversation_id (optional).

        Returns:
            ChatResponse: conversation_id, answer, sources.

        Raises:
            Exception: Khi pipeline thất bại ở bất kỳ bước nào.
        """
        start_time = time.time()
        user_id = request.user_id
        query = request.message
        conv_id = request.conversation_id

        try:
            logger.info(f"[ChatService] Bắt đầu xử lý request từ user_id: {user_id}")
            
            # 1: Quản lý Conversation
            if not conv_id:
                conv_id = await self._history_repo.create_conversation(user_id)
                logger.info(f"[ChatService] Khởi tạo conversation mới. ID: {conv_id}")
            else:
                logger.debug(f"[ChatService] Tiếp tục conversation hiện tại. ID: {conv_id}")

            # 2: Lưu tin nhắn User
            user_msg = ChatMessage(role=MessageRole.USER, content=query)
            await self._history_repo.add_message(conv_id, user_msg)
            logger.info(f"[ChatService] Đã lưu tin nhắn user. Query: '{query[:50]}...'")

            # 3: Lấy ngữ cảnh hội thoại (History)
            recent_history = await self._history_repo.get_recent_messages(conv_id, limit=10)
            logger.debug(f"[ChatService] Đã truy xuất {len(recent_history)} tin nhắn lịch sử.")

            # 4: Truy xuất tài liệu (Retrieval)
            logger.debug("[ChatService] Bắt đầu truy xuất ngữ cảnh (Retrieval)...")
            retriever_start = time.time()
            
            try:
                retrieved_chunks = await asyncio.wait_for(
                    self._retriever.retrieve(query),
                    timeout=CHAT_RETRIEVAL_TIMEOUT_SECONDS,
                )
            except (asyncio.TimeoutError, TimeoutError) as e:
                raise TimeoutError(
                    f"Retrieval timeout after {CHAT_RETRIEVAL_TIMEOUT_SECONDS}s"
                ) from e
            
            logger.info(f"[ChatService] Truy xuất hoàn tất: {len(retrieved_chunks)} chunks trong {time.time() - retriever_start:.2f}s.")

            # 5: Sinh câu trả lời (Generation)
            logger.debug("[ChatService] Bắt đầu sinh câu trả lời (Generation)...")
            llm_start = time.time()
            
            try:
                answer = await asyncio.wait_for(
                    self._generator.generate(
                        query=query,
                        retrieved_chunks=retrieved_chunks,
                        chat_history=recent_history,
                    ),
                    timeout=CHAT_LLM_TIMEOUT_SECONDS,
                )
            except (asyncio.TimeoutError, TimeoutError) as e:
                raise TimeoutError(
                    f"LLM timeout after {CHAT_LLM_TIMEOUT_SECONDS}s"
                ) from e
            
            logger.info(f"[ChatService] Sinh câu trả lời hoàn tất trong {time.time() - llm_start:.2f}s.")

            # 6: Lưu tin nhắn Assistant
            ai_msg = ChatMessage(role=MessageRole.ASSISTANT, content=answer)
            await self._history_repo.add_message(conv_id, ai_msg)
            logger.debug("[ChatService] Đã lưu tin nhắn phản hồi của assistant.")

            # 7: Trả về Response
            # sources = []
            # if retrieved_chunks:
            #     sources = list(set([chunk.metadata.get("source", "Unknown") for chunk in retrieved_chunks]))
            source_list = []
            seen_production_ids = set()
            for chunk in retrieved_chunks:
                production_id = _to_numeric_production_id(
                    chunk.production_id
                )

                if production_id is None:
                    metadata = chunk.metadata or {}
                    production_id = _to_numeric_production_id(metadata.get("production_id"))

                if production_id is None or production_id in seen_production_ids:
                    continue

                seen_production_ids.add(production_id)
                source_list.append({"production_id": production_id})

            try:
                movies = await asyncio.to_thread(
                    load_recommended_movies,
                    [source["production_id"] for source in source_list],
                    answer,
                )
            except Exception as exc:
                logger.warning("Could not load movie cards from MongoDB: %s", exc)
                movies = []

            total_time = time.time() - start_time
            logger.info(f"[ChatService] Hoàn tất xử lý request cho user {user_id}. Tổng thời gian: {total_time:.2f}s.")

            return ChatResponse(
                conversation_id=conv_id,
                answer=answer,
                sources=source_list,
                movies=movies,
            )

        except Exception as e:
            logger.error(f"[ChatService] Lỗi xử lý request cho user {user_id} tại conversation {conv_id}: {str(e)}", exc_info=True)
            raise e
