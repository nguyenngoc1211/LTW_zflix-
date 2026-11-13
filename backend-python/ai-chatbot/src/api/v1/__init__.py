"""
API v1 — Gom tất cả routers của phiên bản v1.

Import file này trong main.py để đăng ký toàn bộ endpoints v1
dưới prefix /api/v1.
"""

from fastapi import APIRouter
from src.api.v1.chat_router import router as chat_router

router = APIRouter(prefix="/api/v1")

router.include_router(chat_router)
