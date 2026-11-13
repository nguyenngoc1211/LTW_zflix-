"""
API v2 — Placeholder cho phiên bản tiếp theo.

Khi cần thêm endpoints mới hoặc thay đổi contract mà breaking v1,
tạo routers mới trong thư mục này và đăng ký trong file __init__.py.

Ví dụ tương lai:
- Streaming response (SSE)
- Multi-modal search (text + image)
- Advanced filtering API
"""

from fastapi import APIRouter

router = APIRouter(prefix="/api/v2")

# TODO: Thêm v2 routers ở đây khi cần
# from src.api.v2.chat_router import router as chat_router
# router.include_router(chat_router)
