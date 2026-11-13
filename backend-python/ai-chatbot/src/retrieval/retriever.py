from typing import Optional
"""
Module retriever — orchestrate toàn bộ quy trình truy xuất context.

Cung cấp class Retriever kết hợp: query preprocessing → hybrid search
→ reranking → context formatting.
"""

import unicodedata
import re
from src.schemas import RetrievedChunk
from src.logger import get_logger
from src.retrieval.hybrid_search import HybridSearchEngine
from src.retrieval.reranker import Reranker

logger = get_logger(__name__)


class Retriever:
    """
    Orchestrator truy xuất context cho LLM generator.

    Kết hợp HybridSearchEngine và Reranker thành pipeline truy xuất
    hoàn chỉnh. Đây là entry point duy nhất mà ChatService gọi.

    Attributes:
        _search_engine (HybridSearchEngine): Engine tìm kiếm kết hợp.
        _reranker (Reranker): Cross-encoder reranker.

    Usage:
        retriever = Retriever(search_engine, reranker)
        chunks = retriever.retrieve(query, top_k=10)
        context = retriever.format_context(chunks)
    """

    def __init__(self, search_engine: HybridSearchEngine, reranker: Reranker):
        """
        Khởi tạo Retriever với dependencies đã inject.

        Args:
            search_engine (HybridSearchEngine): Instance HybridSearchEngine.
            reranker (Reranker): Instance Reranker.
        """
        logger.info("Đang khởi tạo Retriever...")
        self._search_engine = search_engine
        self._reranker = reranker


    @staticmethod
    def preprocess_query(query: str) -> str:
        """
        Tiền xử lý câu query trước khi search.

        Thực hiện:
        1. Chuẩn hóa unicode (NFC) cho tiếng Việt
        2. Loại bỏ ký tự đặc biệt không cần thiết
        3. Chuẩn hóa khoảng trắng

        Log debug: query trước và sau preprocessing.

        Args:
            query (str): Câu query gốc.

        Returns:
            str: Câu query đã chuẩn hóa.
        """
        if not query:
            return ""

        original_query = query

        # 1. Chuẩn hóa Unicode (NFC) cho tiếng Việt
        # Khắc phục lỗi gõ tiếng Việt khác nhau giữa các bộ gõ (VD: Windows vs macOS/iPhone)
        query = unicodedata.normalize('NFC', query)
        query = query.lower()

        # Loại bỏ các ký tự đặc biệt không cần thiết (chỉ giữ lại chữ, số và khoảng trắng)
        # Regex \w bao gồm cả các chữ cái có dấu của tiếng Việt
        query = re.sub(r'[^\w\s]', ' ', query)

        # Loại bỏ khoảng trắng thừa (nhiều dấu cách liền nhau)
        query = re.sub(r'\s+', ' ', query).strip()

        logger.debug(f"Preprocess query: '{original_query}' -> '{query}'")
        return query




    async def retrieve(self, query: str, top_k: int = 10) -> list[RetrievedChunk]:
        """
        Truy xuất context chunks liên quan.

        Orchestrate: preprocess → hybrid_search → rerank.
        Log: query, số chunks, thời gian retrieval.

        Args:
            query (str): Câu truy vấn.
            top_k (int): Số chunks tối đa từ hybrid search. Mặc định 10.

        Returns:
            list[RetrievedChunk]: Chunks đã rerank, sắp xếp theo relevance.

        Raises:
            Exception: Khi retrieval thất bại. Log error kèm query.
        """
        if not query or not query.strip():
            logger.warning("Query rỗng, trả về danh sách trống.")
            return []

        import time
        start_time = time.time()
        
        try:
            cleaned_query = self.preprocess_query(query)
            search_top_k = top_k * 2 
            logger.info(f"Đang thực hiện Hybrid Search cho: '{cleaned_query}'")
            
            initial_chunks = await self._search_engine.search( # HybridSearch
                query=cleaned_query, 
                top_k=search_top_k
            )

            if not initial_chunks:
                logger.warning(f"Không tìm thấy kết quả nào cho query: '{cleaned_query}'")
                return []

            #Rerank
            logger.info(f"Đang thực hiện Reranking cho {len(initial_chunks)} ứng viên...")
            
            final_chunks = self._reranker.rerank(
                query=cleaned_query,
                chunks=initial_chunks,
                top_k=top_k
            )

            elapsed = round(time.time() - start_time, 2)
            logger.info(f"Hoàn tất truy xuất trong {elapsed}s. Trả về {len(final_chunks)} chunks chất lượng nhất.")
            
            return final_chunks

        except Exception as e:
            logger.error(f"Lỗi nghiêm trọng trong quy trình Retrieval: {e}", exc_info=True)
            return []



    async def retrieve_with_filter(
        self,
        query: str,
        top_k: int = 10,
        genre_filter: Optional[str] = None,
        year_filter: Optional[int] = None,
        type_filter: Optional[str] = None,
        country_filter: Optional[str] = None
    ) -> list[RetrievedChunk]:
        """
        Truy xuất với bộ lọc metadata bổ sung.

        Mở rộng retrieve() với filtering theo metadata.
        Log: các filter đang áp dụng, số kết quả sau filter.

        Args:
            query (str): Câu truy vấn.
            top_k (int): Số chunks tối đa. Mặc định 10.
            genre_filter (Optional[str]): Lọc theo thể loại.
            year_filter (Optional[int]): Lọc theo năm.
            type_filter (Optional[str]): Lọc theo loại ('movie', 'series', 'season').
            country_filter (Optional[str]): Lọc theo quốc gia.

        Returns:
            list[RetrievedChunk]: Chunks đã lọc và rerank.
        """
        if not query or not query.strip():
            return []

        import time
        start_time = time.time()

        # 1. Gom các điều kiện lọc lại thành một bộ lọc chuẩn của ChromaDB
        # Lưu ý: Cú pháp này phụ thuộc vào cài đặt biến 'filter' trong HybridSearchEngine
        filters = {}
        if genre_filter:
            # Dùng $contains nếu thể loại lưu dạng chuỗi "Action, Sci-Fi"
            filters["genres"] = {"$contains": genre_filter} 
        if year_filter:
            filters["year"] = year_filter
        if type_filter:
            filters["type"] = type_filter
        if country_filter:
            filters["country"] = country_filter

        logger.info(f"Đang tìm kiếm với bộ lọc: {filters}")

        try:
            cleaned_query = self.preprocess_query(query)
            search_top_k = top_k * 2

            # 2. Chạy Hybrid Search nhưng truyền thêm biến filters
            initial_chunks = await self._search_engine.search(
                query=cleaned_query,
                top_k=search_top_k,
                filter=filters if filters else None # Nhớ update file hybrid_search.py để nhận biến này nhé
            )

            if not initial_chunks:
                logger.warning("Không có kết quả nào lọt qua được bộ lọc.")
                return []

            # 3. Rerank lại các kết quả đã lọc
            final_chunks = self._reranker.rerank(
                query=cleaned_query,
                chunks=initial_chunks,
                top_k=top_k
            )

            elapsed = round(time.time() - start_time, 2)
            logger.info(f"Filter + Retrieve hoàn tất trong {elapsed}s. Giữ lại {len(final_chunks)} chunks.")
            
            return final_chunks

        except Exception as e:
            logger.error(f"Lỗi khi retrieve với filter: {e}", exc_info=True)
            return []



    @staticmethod
    def format_context(chunks: list[RetrievedChunk]) -> str:
        """
        Format danh sách chunks thành context string cho LLM prompt.

        Template mỗi chunk:
        ---
        [Phim: {title}] (Thể loại: {genres} | Năm: {year} | Rating: {rating})
        {content}
        ---

        Log debug: số chunks, tổng độ dài context.

        Args:
            chunks (list[RetrievedChunk]): Chunks đã retrieve + rerank.

        Returns:
            str: Context string sẵn sàng inject vào LLM prompt.
        """
        if not chunks:
            return "Không có thông tin ngữ cảnh nào được tìm thấy."

        formatted_texts = []
        for chunk in chunks:
            # Rút trích metadata an toàn (dùng .get() để tránh lỗi nếu thiếu key)
            title = chunk.metadata.get("title", "Không rõ tên phim")
            genres = chunk.metadata.get("genres", "Không rõ")
            year = chunk.metadata.get("year", "Không rõ")
            rating = chunk.metadata.get("rating", "N/A")
            content = chunk.content

            # Bố cục chuẩn giúp LLM (Gemini/OpenAI) đọc hiểu tốt nhất
            template = (
                f"---\n"
                f"[Phim: {title}] (Thể loại: {genres} | Năm: {year} | Rating: {rating})\n"
                f"{content}\n"
                f"---"
            )
            formatted_texts.append(template)

        # Nối tất cả các khối lại bằng dấu xuống dòng
        final_context = "\n\n".join(formatted_texts)
        
        logger.debug(f"Đã format {len(chunks)} chunks. Tổng độ dài: {len(final_context)} ký tự.")
        return final_context

if __name__ == "__main__":
    import pprint
    import asyncio
    from src.logger import setup_logging
    from src.database.vector_store import VectorStoreManager
    
    setup_logging()
    logger = get_logger(__name__)
    
    async def main_test():
        logger.info("Bắt đầu test quá trình Retrieval...")
        
        try:
            vectordb = VectorStoreManager()
            vectordb.initialize() 
            
            search_engine = HybridSearchEngine(vector_store=vectordb)
            search_engine.load_bm25()
            reranker = Reranker()
            retriever = Retriever(search_engine=search_engine, reranker=reranker)
            
            # Gọi hàm truy xuất
            query = "Phim hành động hay nhất cho tôi, rating cao nhất"
            logger.info(f"Đang tìm kiếm cho câu hỏi: '{query}'")
            
            retriever_chunks = await retriever.retrieve(query=query)
            
            logger.info(f"Tìm thấy {len(retriever_chunks)} kết quả!")
            
            if retriever_chunks:
                print("\nKẾT QUẢ TỐT NHẤT (TOP 1):")
                # Dùng .model_dump() nếu chunk là Pydantic schema, in ra cho dễ nhìn
                pprint.pprint(retriever_chunks[0].model_dump() if hasattr(retriever_chunks[0], 'model_dump') else retriever_chunks[0])
            else:
                print("Không tìm thấy bộ phim nào!")
                
        except Exception as e:
            logger.error(f"Test thất bại: {e}", exc_info=True)

    asyncio.run(main_test())
    