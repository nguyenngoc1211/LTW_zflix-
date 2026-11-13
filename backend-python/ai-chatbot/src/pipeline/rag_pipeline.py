"""
Module RAG Pipeline — khởi tạo và kết nối tất cả các thành phần.

Cung cấp class RAGPipeline đóng vai trò Composition Root (DI container),
khởi tạo tất cả dependencies và cung cấp access tập trung cho routers.

Đây là file quan trọng nhất trong hệ thống — nơi duy nhất thực hiện
dependency injection và wiring giữa các class.
"""

from src.database.mongodb import MongoDBClient
from src.database.vector_store import VectorStoreManager

from src.history.repository import ChatHistoryRepository

from src.ingestion.chunking import DocumentChunker
from src.ingestion.data_loader import DataLoader
from src.ingestion.indexer import DataIndexer

from src.retrieval.embedding import EmbeddingService
from src.retrieval.hybrid_search import HybridSearchEngine
from src.retrieval.reranker import Reranker
from src.retrieval.retriever import Retriever

from src.generation.generator import ResponseGenerator

from src.chat.service import ChatService
from src.config import CHAT_HISTORY_ENABLED, DATA_STORE

from src.logger import get_logger

logger = get_logger(__name__)


class RAGPipeline:
    """
    Composition Root — khởi tạo và kết nối tất cả thành phần RAG.

    Class này đóng vai trò DI container, tạo và inject dependencies
    cho toàn bộ hệ thống. Cung cấp facade methods cho routers sử dụng.

    Thứ tự khởi tạo:
    1. Database layer: MongoDBClient, VectorStoreManager
    2. Core services: EmbeddingService, DocumentChunker
    3. Search layer: HybridSearchEngine, Reranker
    4. Orchestrators: Retriever, ResponseGenerator
    5. Business services: ChatHistoryRepository, ChatService, DataIndexer

    Attributes:
        mongo_client (MongoDBClient): MongoDB connection.
        vector_store (VectorStoreManager): ChromaDB manager.
        embedding_service (EmbeddingService): Embedding model.
        chunker (DocumentChunker): Text splitter.
        search_engine (HybridSearchEngine): Hybrid search.
        reranker (Reranker): Cross-encoder reranker.
        retriever (Retriever): Retrieval orchestrator.
        generator (ResponseGenerator): LLM response generator.
        history_repo (ChatHistoryRepository): Chat history CRUD.
        chat_service (ChatService): Chat RAG pipeline.
        data_indexer (DataIndexer): Ingestion pipeline.

    Usage:
        pipeline = RAGPipeline()
        pipeline.initialize()

        # Trong routers:
        response = pipeline.chat_service.process(request)
        stats = pipeline.data_indexer.run(force_reload=True)
    """

    _instance = None
    _is_initialized: bool
    mongo_client: MongoDBClient
    vector_store: VectorStoreManager
    embedding_service: EmbeddingService
    chunker: DocumentChunker
    search_engine: HybridSearchEngine
    reranker: Reranker
    retriever: Retriever
    generator: ResponseGenerator
    history_repo: ChatHistoryRepository
    chat_service: ChatService
    data_indexer: DataIndexer

    def __new__(cls):
        """
        Singleton pattern — đảm bảo chỉ có một RAGPipeline trong app.

        Returns:
            RAGPipeline: Singleton instance.
        """
        if cls._instance is None:
            # Nếu chưa có, nhờ Python cấp phát một vùng nhớ mới
            cls._instance = super(RAGPipeline, cls).__new__(cls)
            
            # Khởi tạo sẵn các biến với giá trị rỗng (None) 
            cls._instance._is_initialized = False
            
            # cls._instance.mongo_client = None
            # cls._instance.vector_store = None
            # cls._instance.embedding_service = None
            # cls._instance.chunker = None
            # cls._instance.search_engine = None
            # cls._instance.reranker = None
            # cls._instance.retriever = None
            # cls._instance.generator = None
            # cls._instance.history_repo = None
            # cls._instance.chat_service = None
            # cls._instance.data_indexer = None
            
            logger.debug("Đã cấp phát vùng nhớ cho RAGPipeline (Singleton).")
            
        return cls._instance

    @classmethod
    def get_instance(cls) -> "RAGPipeline":
        """
        Lấy singleton instance đã khởi tạo.

        Returns:
            RAGPipeline: Singleton instance.

        Raises:
            RuntimeError: Khi chưa gọi initialize().
        """
        # Kiểm tra: Phải có object VÀ phải được initialize xong
        if cls._instance is None or not getattr(cls._instance, '_is_initialized', False):
            logger.error("Cảnh báo: Có ai đó đang cố gọi RAGPipeline khi nó chưa sẵn sàng!")
            raise RuntimeError(
                "RAGPipeline chưa được khởi tạo. "
                "Vui lòng đảm bảo đã gọi `await pipeline.initialize()` trong sự kiện lifespan/startup của FastAPI."
            )
            
        return cls._instance

    async def initialize(self) -> None:
        """
        Khởi tạo tất cả thành phần theo thứ tự dependency.

        Quy trình:
        1. MongoDBClient — kết nối MongoDB (log connection status)
        2. VectorStoreManager — kết nối ChromaDB (log collection info)
        3. EmbeddingService — load embedding model (log model name)
        4. DocumentChunker — cấu hình text splitter (log chunk config)
        5. HybridSearchEngine(vector_store) — khởi tạo search (log status)
        6. Reranker — load cross-encoder model (log model name, load time)
        7. DataLoader — chuẩn bị MySQL loader (log connection info)
        8. Retriever(search_engine, reranker) — wire retrieval pipeline
        9. ResponseGenerator(retriever) — wire generation pipeline
        10. ChatHistoryRepository(mongo_client) — wire history repository
        11. ChatService(retriever, generator, history_repo) — wire chat service
        12. DataIndexer(data_loader, chunker, vector_store, search_engine)

        Log: tổng thời gian khởi tạo, trạng thái từng thành phần.

        Raises:
            Exception: Khi bất kỳ thành phần nào thất bại.
                Log error kèm tên thành phần gây lỗi và traceback.
        """
        if getattr(self, '_is_initialized', False):
            logger.warning("RAGPipeline đã được khởi tạo rồi. Bỏ qua lệnh gọi trùng lặp.")
            return

        import time
        start_time = time.time()
        logger.info("========== BẮT ĐẦU KHỞI TẠO HỆ THỐNG RAG ==========")

        try:
            logger.info("[1/5] Đang khởi tạo Tầng Database...")
            if CHAT_HISTORY_ENABLED:
                self.mongo_client = MongoDBClient.get_instance()
                await self.mongo_client.connect()
                self.history_repo = ChatHistoryRepository(mongo_client=self.mongo_client)
                logger.info("Persistent chat history is enabled.")
            else:
                from src.history.noop_repository import NoOpChatHistoryRepository

                self.mongo_client = None
                self.history_repo = NoOpChatHistoryRepository()
                logger.info("Persistent chat history is disabled; MongoDB will not be connected.")
            
            self.vector_store = VectorStoreManager()
            self.vector_store.initialize() # Khởi tạo ChromaDB cục bộ

            logger.info("[2/5] Đang tải các mô hình AI (Embedding, Reranker)...")
            self.embedding_service = self.vector_store._embedding_service
            self.chunker = DocumentChunker()
            
            self.search_engine = HybridSearchEngine(self.vector_store)
            self.search_engine.load_bm25()
            self.reranker = Reranker()

            logger.info("[3/5] Đang khởi tạo các công cụ Data Ingestion...")
            if DATA_STORE == "mongodb":
                from src.ingestion.mongo_data_loader import MongoDataLoader
                self.data_loader = MongoDataLoader()
            else:
                self.data_loader = DataLoader()

            logger.info("[4/5] Đang đấu dây cho Retriever và Generator...")
            self.retriever = Retriever(search_engine=self.search_engine, reranker=self.reranker)
            self.generator = ResponseGenerator(retriever=self.retriever)

            logger.info("[5/5] Đang hoàn thiện Business Services...")
            self.chat_service = ChatService(
                retriever=self.retriever,
                generator=self.generator,
                history_repo=self.history_repo
            )
            
            self.data_indexer = DataIndexer(
                data_loader=self.data_loader,
                chunker=self.chunker,
                vector_store=self.vector_store,
                search_engine=self.search_engine
            )

            self._is_initialized = True
            
            elapsed = round(time.time() - start_time, 2)
            logger.info(f"========== KHỞI TẠO THÀNH CÔNG TRONG {elapsed}s ==========")

        except Exception as e:
            logger.critical(f"LỖI TỬ HUYỆT KHI KHỞI TẠO HỆ THỐNG: {e}", exc_info=True)
            raise RuntimeError(f"Không thể khởi động RAGPipeline: {e}")
        

    async def shutdown(self) -> None:
        """
        Giải phóng tài nguyên khi server tắt.

        Đóng kết nối MongoDB, cleanup resources.
        Log thông tin shutdown.
        """
        logger.info("Đang tiến hành Shutdown RAG Pipeline...")
        try:
            if self.mongo_client:
                # Ngắt kết nối Database tránh bị kẹt (Zombie thread)
                await self.mongo_client.close()
            
            # Xóa cờ khởi tạo
            self._is_initialized = False
            logger.info("Đã dọn dẹp xong tài nguyên. Hẹn gặp lại!")
            
        except Exception as e:
            logger.error(f"Lỗi khi dọn dẹp tài nguyên: {e}", exc_info=True)
