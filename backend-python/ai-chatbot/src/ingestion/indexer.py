"""
Module indexer — orchestrate toàn bộ pipeline ingestion.

Cung cấp class DataIndexer kết nối DataLoader → DocumentChunker
→ VectorStoreManager + HybridSearchEngine.
"""
import time
from src.ingestion.chunking import DocumentChunker
from src.ingestion.data_loader import DataLoader
from src.database.vector_store import VectorStoreManager
from src.retrieval.hybrid_search import HybridSearchEngine
from src.logger import get_logger

logger = get_logger(__name__)


class DataIndexer:
    """
    Orchestrator cho pipeline nạp dữ liệu phim vào hệ thống RAG.

    Kết nối các thành phần: DataLoader, DocumentChunker, VectorStoreManager,
    HybridSearchEngine thành một pipeline thống nhất.

    Attributes:
        _data_loader (DataLoader): Trích xuất dữ liệu từ MySQL.
        _chunker (DocumentChunker): Chia nhỏ documents.
        _vector_store (VectorStoreManager): Quản lý ChromaDB.
        _search_engine (HybridSearchEngine): Khởi tạo BM25 index.

    Usage:
        indexer = DataIndexer(data_loader, chunker, vector_store, search_engine)
        stats = indexer.run(force_reload=True)
    """

    def __init__(self, 
                 data_loader: DataLoader, 
                 chunker: DocumentChunker, 
                 vector_store: VectorStoreManager, 
                 search_engine: HybridSearchEngine):
        """
        Khởi tạo DataIndexer với các dependencies đã inject.

        Args:
            data_loader (DataLoader): Instance DataLoader.
            chunker (DocumentChunker): Instance DocumentChunker.
            vector_store (VectorStoreManager): Instance VectorStoreManager.
            search_engine (HybridSearchEngine): Instance HybridSearchEngine.
        """
        logger.info("Đang khởi tạo DataIndexer (Tổng Công Trình Sư)...")
        
        # Nhận và lưu trữ các công cụ được truyền vào từ bên ngoài
        self._data_loader = data_loader
        self._chunker = chunker
        self._vector_store = vector_store
        self._search_engine = search_engine
        
        logger.info("Đã tiếp nhận đầy đủ 4 module: DataLoader, Chunker, VectorStore, và SearchEngine.")

    @classmethod
    def build_default(cls): #factory 
        """
        Factory Method: Tự động khởi tạo tất cả các công cụ mặc định 
        và lắp ráp thành một DataIndexer hoàn chỉnh.
        Dùng cái này khi bạn không muốn tự tay truyền tham số.
        """
        logger.info("Đang tự động lắp ráp DataIndexer với các module mặc định...")
        
        from src.ingestion.data_loader import DataLoader
        from src.ingestion.chunking import DocumentChunker
        from src.database.vector_store import VectorStoreManager
        from src.retrieval.hybrid_search import HybridSearchEngine
        
        from src.config import DATA_STORE
        if DATA_STORE == "mongodb":
            from src.ingestion.mongo_data_loader import MongoDataLoader
            data_loader = MongoDataLoader()
        else:
            data_loader = DataLoader()
        chunker = DocumentChunker()
        vector_store = VectorStoreManager()
        search_engine = HybridSearchEngine(vector_store=vector_store)
        
        return cls(data_loader, chunker, vector_store, search_engine)
    
    
    def run(self, force_reload: bool = False) -> dict:
        """
        Chạy toàn bộ pipeline ingestion.

        Quy trình:
        1. Log bắt đầu ingestion, ghi nhận force_reload flag
        2. Nếu force_reload=True → xóa ChromaDB collection cũ (log warning)
        3. DataLoader.load_all() → log số documents
        4. DocumentChunker.chunk_all() → log số chunks
        5. VectorStoreManager.add_documents() → log tiến trình embedding
        6. HybridSearchEngine.init_bm25() → log BM25 index size
        7. Log hoàn thành kèm elapsed time

        Mỗi bước đều log thời gian. Nếu thất bại → log error + traceback.

        Args:
            force_reload (bool): True = xóa dữ liệu cũ, ingest lại. Mặc định False.

        Returns:
            dict:
                - total_documents (int): Số MovieDocument đã load
                - total_chunks (int): Tổng chunks sau khi split
                - elapsed_time (float): Thời gian (giây)
                - status (str): "success" | "error"
                - message (str): Thông báo chi tiết

        Raises:
            Exception: Khi bất kỳ bước nào thất bại.
        """
        start_time = time.time()
        logger.info(f"--- BẮT ĐẦU PIPELINE INGESTION (force_reload={force_reload}) ---")

        try:
            # 1. Khởi tạo kết nối Thủ kho (Vector Store)
            self._vector_store.initialize()

            # Read the source before replacing an existing index.
            documents = self._data_loader.load_all()
            if not documents:
                raise RuntimeError("Nguồn phim rỗng; giữ nguyên chỉ mục hiện tại.")

            # 2. Xử lý Force Reload (Dọn kho nếu cần)
            if force_reload:
                logger.warning("Chế độ force_reload bật: Đang làm sạch dữ liệu cũ...")
                self._vector_store.delete_collection()
                self._vector_store.initialize()

            # 3. Bước Extract: DataLoader kéo dữ liệu từ MySQL
            logger.info("BƯỚC 1: ĐANG TẢI DỬ LIỆU TỪ MYSQL...")
            total_docs = len(documents)
            logger.info(f"Đã tải {total_docs} phim thành công.")

            # 4. Bước Transform: DocumentChunker băm nhỏ văn bản
            logger.info("BƯỚC 2: ĐANG TIẾN HÀNH CHUNKING VĂN BẢN...")
            chunks = self._chunker.chunk_all(documents)
            total_chunks = len(chunks)
            logger.info(f"Đã tạo ra {total_chunks} chunks.")

            # 5. Bước Load (Vector): Nạp vào ChromaDB (Chạy Embedding)
            logger.info("BƯỚC 3: ĐANG THỰC HIỆN EMBEDDING VÀ NẠP VÀO CHROMADB...")
            self._vector_store.add_documents(chunks)

            # 6. Bước Load (Keyword): Nạp vào BM25 Index
            logger.info("BƯỚC 4: ĐANG KHỞI TẠO CHỈ MỤC TỪ KHÓA BM25...")
            self._search_engine.init_bm25(chunks)

            # 7. Hoàn tất và báo cáo
            elapsed_time = round(time.time() - start_time, 2)
            logger.info(f"--- PIPELINE HOÀN TẤT THÀNH CÔNG TRONG {elapsed_time} GIÂY ---")

            return {
                "total_documents": total_docs,
                "total_chunks": total_chunks,
                "elapsed_time": elapsed_time,
                "status": "success",
                "message": f"Đã nạp thành công {total_chunks} chunks từ {total_docs} bộ phim."
            }

        except Exception as e:
            elapsed_time = round(time.time() - start_time, 2)
            logger.error(f"Pipeline thất bại tại bước: {e}", exc_info=True)
            return {
                "total_documents": 0,
                "total_chunks": 0,
                "elapsed_time": elapsed_time,
                "status": "error",
                "message": str(e)
            }
