"""
Module chunking — chia nhỏ MovieDocument thành các text chunks.

Cung cấp class DocumentChunker sử dụng RecursiveCharacterTextSplitter
từ LangChain để chia nhỏ documents giữ nguyên ngữ nghĩa và metadata.
"""

from typing import Optional
# from langchain.schema import Document
from langchain_core.documents import Document
from langchain_text_splitters import RecursiveCharacterTextSplitter
from src.logger import get_logger
from src.config import CHUNK_OVERLAP, CHUNK_SIZE
from src.schemas import MovieDocument

logger = get_logger(__name__)


class DocumentChunker:
    """
    Chia nhỏ MovieDocument thành các text chunks có kích thước phù hợp.

    Sử dụng RecursiveCharacterTextSplitter từ LangChain với separator
    phù hợp cho nội dung tiếng Việt + tiếng Anh.

    Attributes:
        _chunk_size (int): Kích thước tối đa mỗi chunk (ký tự).
        _chunk_overlap (int): Số ký tự chồng lấp giữa các chunk.
        _text_splitter: LangChain RecursiveCharacterTextSplitter instance.

    Usage:
        chunker = DocumentChunker(chunk_size=512, chunk_overlap=50)
        chunks = chunker.chunk_all(movie_documents)
    """

    def __init__(self, chunk_size: int = CHUNK_SIZE, chunk_overlap: int = CHUNK_OVERLAP):
        """
        Khởi tạo DocumentChunker với cấu hình chunk.

        Tạo RecursiveCharacterTextSplitter với separator phù hợp.
        Log cấu hình chunk_size và chunk_overlap.

        Args:
            chunk_size (int): Kích thước tối đa mỗi chunk. Mặc định 512.
            chunk_overlap (int): Số ký tự chồng lấp. Mặc định 50.
        """
        self._chunk_size = chunk_size
        self._chunk_overlap = chunk_overlap
        
        separators = ["\n\n", "\n", ".", "!", "?", " ", ""]
        self._text_splitter = RecursiveCharacterTextSplitter(
            chunk_size=self._chunk_size,
            chunk_overlap=self._chunk_overlap,
            separators=separators,
            length_function=len
        )

        logger.info(
            f"Khởi tạo DocumentChunker (chunk_size={self._chunk_size}, chunk_overlap={self._chunk_overlap})"
        )

    def chunk_single(self, movie_document: MovieDocument) -> list[Document]:
        """
        Chia nhỏ một MovieDocument thành nhiều LangChain Document chunks.

        Mỗi chunk kế thừa metadata từ MovieDocument gốc và bổ sung
        chunk_index. Metadata gồm: production_id, title, type,
        genres, year, country, chunk_index.

        Args:
            movie_document (MovieDocument): Document cần chunk.

        Returns:
            list[Document]: Danh sách LangChain Document chunks.
        """
        texts = self._text_splitter.split_text(movie_document.content)
        chunks = []

        for i, text in enumerate(texts):
            meta = movie_document.metadata.copy() if movie_document.metadata else {}
            meta.update({
                "production_id": movie_document.production_id,
                "title": movie_document.title,
                "chunk_index": i
            })
            doc = Document(page_content=text, metadata=meta)
            chunks.append(doc)

        return chunks

    def chunk_all(self, movie_documents: list[MovieDocument]) -> list[Document]:
        """
        Chia nhỏ toàn bộ danh sách MovieDocument.

        Log: tổng documents đầu vào, tổng chunks đầu ra.

        Args:
            movie_documents (list[MovieDocument]): Danh sách documents.

        Returns:
            list[Document]: Tất cả LangChain Document chunks.
        """
        all_chunks = []
        for doc in movie_documents:
            chunks = self.chunk_single(doc)
            all_chunks.extend(chunks)

        logger.info(
            f"Chunking hoàn tất: {len(movie_documents)} documents -> {len(all_chunks)} chunks."
        )
        return all_chunks

if __name__ == "__main__":
    import pprint
    from src.logger import setup_logging
    from src.ingestion.data_loader import DataLoader
    setup_logging()
    
    logger.info("Bắt đầu test Chunking...")
    
    dataloader = DataLoader()
    chunker = DocumentChunker()
    try:
        data = dataloader.load_all()
        if data:
            chunks = chunker.chunk_all(data)
            pprint.pprint(chunks[0])
            
    except Exception as e:
        logger.error(f"Test thất bại: {e}")