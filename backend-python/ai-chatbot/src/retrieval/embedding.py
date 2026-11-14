from typing import Union
"""
Module embedding — tạo embedding vectors từ text.

Cung cấp class EmbeddingService để khởi tạo embedding model
và tạo vectors cho documents hoặc query.
"""

# from langchain.schema import Document
import os
from src.config import EMBEDDING_MODEL_NAME, HF_TOKEN, HF_CACHE_DIR

# Load config before importing Hugging Face so its cache constants use the
# writable project directory configured in src.config.
from langchain_core.documents import Document
from langchain_huggingface import HuggingFaceEmbeddings
from src.logger import get_logger

logger = get_logger(__name__)


class EmbeddingService:
    """
    Service tạo embedding vectors sử dụng LangChain embedding models.

    Hỗ trợ OpenAI Embeddings và HuggingFace Embeddings.
    Xử lý batch embedding cho documents và single embedding cho query.

    Attributes:
        _model: LangChain embedding model instance.
        _model_name (str): Tên model đang sử dụng.

    Usage:
        service = EmbeddingService()
        vectors = service.embed_documents(documents)
        query_vector = service.embed_query("phim hành động hay")
    """

    _instance = None # Biến tĩnh lưu trữ phiên bản duy nhất của class
    _is_initialized: bool = False

    def __new__(cls): # tuân thử Singleton
        # Nếu chưa có ai tạo class này, thì cấp phát bộ nhớ mới
        if cls._instance is None:
            cls._instance = super(EmbeddingService, cls).__new__(cls)
            cls._instance._is_initialized = False # Đánh dấu là chưa nạp model
        return cls._instance
    
    def __init__(self):
        """
        Khởi tạo EmbeddingService và load embedding model.

        Sử dụng EMBEDDING_MODEL_NAME và OPENAI_API_KEY từ config.
        Log tên model đang sử dụng.

        Raises:
            ValueError: Khi API key không được cấu hình.
                Log error cảnh báo thiếu API key.
        """
        if self._is_initialized:
            return
        
        self._model_name = EMBEDDING_MODEL_NAME or "BAAI/bge-m3"
        logger.info(f"Đang khởi tạo EmbeddingService với model: {self._model_name}")
        logger.info("Quá trình này có thể mất một chút thời gian ở lần chạy đầu tiên để tải weights...")

        self._is_initialized = True
        
        if HF_TOKEN:
            os.environ["HF_TOKEN"] = HF_TOKEN
            logger.info("Đã nhận diện HF_TOKEN, sẽ tải model với quyền xác thực.")
        else:
            logger.warning("Không có HF_TOKEN. Đang tải ẩn danh (có nguy cơ bị rate-limit).")

        logger.info(f"Hugging Face cache: {HF_CACHE_DIR}")
            
        try:
            import torch
            device = 'cuda' if torch.cuda.is_available() else 'cpu'
            encode_kwargs = {'normalize_embeddings': True}

            self._model = HuggingFaceEmbeddings( # Khởi tạo mô hình thông qua LangChain Wrapper
                model_name=self._model_name,
                model_kwargs={'device': device},
                encode_kwargs=encode_kwargs
            )
            
            logger.info(f"Load embedding model '{self._model_name}' thành công trên thiết bị: {device.upper()}")
            
        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng khi load embedding model {self._model_name}: {e}")
            raise

    def get_model(self):
        """
        Trả về embedding model instance.

        Returns:
            langchain_openai.Union[OpenAIEmbeddings, HuggingFaceEmbeddings]:
                Embedding model sẵn sàng sử dụng.
        """
        return self._model

    def embed_documents(self, documents: list[Document]) -> list[list[float]]:
        """
        Tạo embedding vectors cho danh sách Documents.

        Trích xuất page_content và gửi đến model theo batch.
        Log tiến trình: tổng documents, batch hiện tại.

        Args:
            documents (list[Document]): Documents cần embed.

        Returns:
            list[list[float]]: Embedding vectors tương ứng 1-1.

        Raises:
            Exception: Khi API call thất bại.
                Log error kèm batch index gây lỗi.
        """
        logger.info(f"Đang tiến hành dịch (embed) {len(documents)} chunks thành vector...")
        try:
            texts = [doc.page_content for doc in documents] # chỉ lấy phần content của Document
            
            # Gửi toàn bộ danh sách text lên model để băm thành vector (Batch processing)
            vectors = self._model.embed_documents(texts)
            
            logger.info("Hoàn tất tạo vectors cho documents.")
            return vectors
        
        except Exception as e:
            logger.error(f"Lỗi trong quá trình embed_documents: {e}")
            raise

    def embed_query(self, query: str) -> list[float]:
        """
        Tạo embedding vector cho một câu query.

        Args:
            query (str): Câu query cần embed.

        Returns:
            list[float]: Embedding vector.

        Raises:
            Exception: Khi API call thất bại. Log error kèm query.
        """
        try:
            vector = self._model.embed_query(query)
            return vector
        
        except Exception as e:
            logger.error(f"Lỗi khi tạo embedding cho query '{query}': {e}")
            raise
