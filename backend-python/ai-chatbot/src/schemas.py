"""
Module định nghĩa các schema (Pydantic models) cho API chatbot tư vấn phim.

Bao gồm các model cho request/response của chat, lịch sử hội thoại,
và các cấu trúc dữ liệu nội bộ dùng trong pipeline RAG.
"""

from pydantic import BaseModel, Field
from typing import Optional, Union
from datetime import datetime
from enum import Enum


class MessageRole(str, Enum):
    """Enum định nghĩa vai trò của người gửi tin nhắn."""
    USER = "user"
    ASSISTANT = "assistant"
    SYSTEM = "system"


class ChatRequest(BaseModel):
    """
    Schema cho request gửi tin nhắn chat từ người dùng.

    Attributes:
        user_id (str): ID định danh người dùng, dùng để truy xuất lịch sử chat.
        message (str): Nội dung tin nhắn người dùng gửi đến chatbot.
        conversation_id (Optional[str]): ID cuộc hội thoại. Nếu None, hệ thống sẽ
            tạo conversation mới. Nếu có giá trị, hệ thống sẽ tiếp tục cuộc hội thoại cũ.
    """
    user_id: str
    message: str
    conversation_id: Optional[str] = None


class RecommendedMovie(BaseModel):
    """Catalog fields for a movie mentioned in the assistant's answer."""

    id: int
    title: str
    poster: Optional[str] = None
    year: Optional[int] = None
    genres: list[str] = Field(default_factory=list)
    rating: Optional[float] = None
    description: Optional[str] = None


class ChatResponse(BaseModel):
    """
    Schema cho response trả về từ chatbot.

    Attributes:
        conversation_id (str): ID cuộc hội thoại (tạo mới hoặc từ request).
        answer (str): Nội dung câu trả lời của chatbot, đã được sinh bởi LLM
            dựa trên ngữ cảnh từ RAG pipeline.
        sources (list[dict]): Production IDs retrieved by the RAG search.
        movies (list[RecommendedMovie]): Verified catalog data for titles
            mentioned in the answer; empty for text-only replies.
    """
    conversation_id: str
    answer: str
    sources: list[dict] = Field(default_factory=list)
    movies: list[RecommendedMovie] = Field(default_factory=list)


class ChatMessage(BaseModel):
    """
    Schema đại diện cho một tin nhắn trong lịch sử hội thoại.

    Attributes:
        role (MessageRole): Vai trò người gửi (user/assistant/system).
        content (str): Nội dung tin nhắn.
        timestamp (datetime): Thời điểm tin nhắn được tạo.
    """
    role: MessageRole
    content: str
    timestamp: datetime = Field(default_factory=datetime.utcnow)


class ConversationHistory(BaseModel):
    """
    Schema đại diện cho toàn bộ lịch sử một cuộc hội thoại.

    Attributes:
        conversation_id (str): ID duy nhất của cuộc hội thoại.
        user_id (str): ID người dùng sở hữu cuộc hội thoại.
        messages (list[ChatMessage]): Danh sách các tin nhắn theo thứ tự thời gian.
        created_at (datetime): Thời điểm tạo cuộc hội thoại.
        updated_at (datetime): Thời điểm cập nhật cuối cùng.
    """
    conversation_id: str
    user_id: str
    messages: list[ChatMessage] = []
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)


class MovieDocument(BaseModel):
    """
    Schema đại diện cho một document phim sau khi được chuẩn hóa từ database,
    trước khi đưa vào chunking và embedding.

    Attributes:
        production_id (int): ID của production trong MySQL.
        title (str): Tên phim/series.
        content (str): Nội dung text đầy đủ đã được tổng hợp từ nhiều bảng
            (productions, genres, actors, ratings, ...) để mô tả chi tiết về phim.
        metadata (dict): Các thông tin bổ sung như type, year, country, rating,
            genres, actors, is_premium, ... dùng cho filtering khi search.
    """
    production_id: int
    title: str
    content: str
    metadata: dict = {}


class RetrievedChunk(BaseModel):
    """
    Schema đại diện cho một chunk đã được truy xuất từ vector store.

    Attributes:
        content (str): Nội dung text của chunk.
        metadata (dict): Metadata đi kèm chunk (production_id, title, chunk_index, ...).
        score (float): Điểm relevance của chunk (từ similarity search hoặc reranker).
    """
    production_id: Union[str, int]  # Rút trích rõ ràng để dễ làm Trích dẫn (Citation)
    chunk_index: int
    content: str
    metadata: dict = {}
    score: float = 0.0


class HistoryRequest(BaseModel):
    """
    Schema cho request lấy lịch sử chat của người dùng.

    Attributes:
        user_id (str): ID người dùng cần lấy lịch sử.
        limit (int): Số lượng cuộc hội thoại tối đa trả về. Mặc định là 10.
    """
    user_id: str
    limit: int = 10


class ConversationDetailRequest(BaseModel):
    """
    Schema cho request lấy chi tiết một cuộc hội thoại.

    Attributes:
        conversation_id (str): ID cuộc hội thoại cần xem chi tiết.
        user_id (str): ID người dùng (để xác thực quyền truy cập).
    """
    conversation_id: str
    user_id: str


class IngestRequest(BaseModel):
    """
    Schema cho request kích hoạt quá trình ingest dữ liệu phim
    từ MySQL vào ChromaDB.

    Attributes:
        force_reload (bool): Nếu True, xóa toàn bộ dữ liệu cũ trong ChromaDB
            và ingest lại từ đầu. Nếu False, chỉ thêm mới/cập nhật.
    """
    force_reload: bool = True
