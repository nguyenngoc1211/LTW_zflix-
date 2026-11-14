"""
Module kết nối và quản lý ChromaDB vector store.

Cung cấp class VectorStoreManager để khởi tạo ChromaDB client,
quản lý collection, thêm/xóa documents, và lấy LangChain wrapper.
"""

import os
import chromadb
from typing import Optional
# from langchain.schema import Document
from langchain_core.documents import Document
from langchain_chroma import Chroma
from src.config import CHROMA_PERSIST_DIR, CHROMA_COLLECTION_NAME
from src.retrieval.embedding import EmbeddingService
from src.logger import get_logger

logger = get_logger(__name__)


class VectorStoreManager:
    """
    Quản lý toàn bộ vòng đời của ChromaDB vector store.

    Class này đóng gói mọi thao tác với ChromaDB bao gồm:
    khởi tạo client, quản lý collection, thêm/xóa documents,
    và cung cấp LangChain wrapper cho search.

    Attributes:
        _client: ChromaDB PersistentClient instance.
        _collection: ChromaDB Collection đang sử dụng.
        _langchain_chroma: LangChain Chroma wrapper instance.

    Usage:
        manager = VectorStoreManager()
        manager.initialize()
        manager.add_documents(documents)
        chroma = manager.get_langchain_chroma()
    """


    def __init__(self):
        """
        Khởi tạo VectorStoreManager.

        Chưa kết nối ChromaDB, cần gọi initialize() trước khi sử dụng.
        """
        self._client = None
        self._collection = None
        self._langchain_chroma = None
        self._embedding_service = EmbeddingService()



    def initialize(self) -> None:
        """
        Khởi tạo kết nối đến ChromaDB và lấy/tạo collection.

        Sử dụng CHROMA_PERSIST_DIR và CHROMA_COLLECTION_NAME từ config.
        Log thông tin kết nối và tên collection.

        Raises:
            Exception: Khi không thể kết nối hoặc tạo collection.
                Log error chi tiết ra console.
        """
        persist_dir = CHROMA_PERSIST_DIR or "./data/chroma_db"
        collection_name = CHROMA_COLLECTION_NAME or "movie_streaming_collection"
        
        os.makedirs(persist_dir, exist_ok=True)
        
        logger.info(f"Đang kết nối ChromaDB tại: {persist_dir}")

        try:
            # Khởi tạo PersistentClient (Lưu thẳng xuống ổ cứng)
            self._client = chromadb.PersistentClient(path=persist_dir)

            # Tạo hoặc lấy Collection (Kèm theo thuật toán đo khoảng cách)
            self._collection = self._client.get_or_create_collection(
                name=collection_name,
                metadata={"hnsw:space": "cosine"}
            )
            
            logger.info(f"Khởi tạo thành công collection: '{collection_name}'")
            
        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng khi khởi tạo ChromaDB: {e}", exc_info=True)
            raise RuntimeError(f"Không thể khởi tạo Vector Store: {e}")



    def get_langchain_chroma(self):
        """
        Trả về LangChain Chroma wrapper để sử dụng cho search.

        Tạo đối tượng LangChain Chroma kết nối đến collection hiện tại,
        sử dụng embedding model từ EmbeddingService.

        Returns:
            langchain_chroma.Chroma: LangChain Chroma vector store wrapper.

        Raises:
            RuntimeError: Khi chưa gọi initialize().
            Exception: Khi khởi tạo wrapper thất bại.
                Log error chi tiết ra console.
        """
        if not self._client or not self._collection:
            logger.error("Chưa khởi tạo ChromaDB client/collection.")
            raise RuntimeError("Vui lòng gọi initialize() trước khi lấy LangChain wrapper.")

        # Khởi tạo Wrapper (Chỉ tạo 1 lần duy nhất)
        if self._langchain_chroma is None:
            logger.info("Đang tạo LangChain Chroma Wrapper...")
            
            self._langchain_chroma = Chroma(
                client=self._client,
                collection_name=self._collection.name,
                embedding_function=self._embedding_service.get_model()
            )
            logger.info("Tạo LangChain Chroma Wrapper thành công.")

        return self._langchain_chroma



    def add_documents(self, documents: list[Document]) -> None:
        """
        Thêm danh sách LangChain Documents vào ChromaDB collection.

        Mỗi Document sẽ được embedding tự động. Document IDs được tạo
        dựa trên production_id và chunk_index từ metadata.
        Log số lượng documents được thêm thành công.

        Args:
            documents (list[Document]): Danh sách LangChain Documents
                đã chunk. Metadata phải có: production_id, chunk_index.

        Raises:
            Exception: Khi thêm documents thất bại.
                Log error kèm số lượng documents đang thêm.
        """
        if not documents:
            logger.warning("Danh sách documents rỗng. Không có gì để thêm.")
            return

        logger.info(f"Đang chuẩn bị nạp {len(documents)} chunks vào Vector Store...")
        
        try:
            # Tạo danh sách ID duy nhất cho từng chunk
            ids = []
            for doc in documents:
                p_id = doc.metadata.get('production_id', 'unknown')
                c_idx = doc.metadata.get('chunk_index', 0)
                doc_id = f"prod_{p_id}_chunk_{c_idx}" # Tạo ID theo format: prod_1_chunk_0
                ids.append(doc_id)

            vector_store = self.get_langchain_chroma()
            
            # Nạp dữ liệu
            # Hàm này sẽ tự động gọi _embedding_service để dịch text -> vector 
            # rồi mới lưu vào ChromaDB cùng với metadata và ID.
            vector_store.add_documents(documents=documents, ids=ids)
            
            logger.info(f"Hoàn tất! Đã nạp thành công {len(documents)} chunks vào ChromaDB.")
            
        except Exception as e:
            logger.error(f"Lỗi khi nạp documents vào ChromaDB: {e}", exc_info=True)
            raise


    def delete_movie(self, production_id: int):
        """Xóa toàn bộ chunk của một bộ phim cụ thể"""
        if self._collection is not None:
            self._collection.delete(where={"production_id": production_id})
            logger.info(f"Đã xóa vĩnh viễn phim {production_id} khỏi Não bộ AI!")


    def delete_collection(self) -> None:
        """
        Xóa toàn bộ ChromaDB collection hiện tại.

        Log warning trước khi xóa và log success sau khi xóa.

        Raises:
            Exception: Khi xóa collection thất bại. Log error ra console.
        """
        if not self._client or not self._collection:
            return
            
        try:
            collection_name = self._collection.name
            logger.warning(f"CẢNH BÁO: Đang xóa toàn bộ collection '{collection_name}'...")
            self._client.delete_collection(name=collection_name)
            
            # Reset lại biến collection và wrapper để hệ thống buộc phải tạo mới nếu dùng lại
            self._collection = None
            self._langchain_chroma = None
            logger.info("Đã xóa collection thành công.")
            
        except Exception as e:
            logger.error(f"Lỗi khi xóa collection: {e}")
            raise



    def get_collection_stats(self) -> dict:
        """
        Lấy thống kê của ChromaDB collection hiện tại.

        Returns:
            dict: {"count": int, "collection_name": str}

        Raises:
            Exception: Khi truy vấn thất bại. Log error ra console.
        """
        if not self._collection:
            return {"count": 0, "collection_name": "None"}
            
        try:
            count = self._collection.count()
            return {
                "count": count,
                "collection_name": self._collection.name
            }
            
        except Exception as e:
            logger.error(f"Lỗi khi lấy thống kê collection: {e}")
            return {"count": 0, "collection_name": "Error"}
        