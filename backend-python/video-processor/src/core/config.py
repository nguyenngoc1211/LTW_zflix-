import os
from dotenv import load_dotenv

load_dotenv()

R2_ACCOUNT_ID = os.getenv('R2_ACCOUNT_ID')
R2_ACCESS_KEY_ID = os.getenv("R2_ACCESS_KEY_ID")
R2_SECRET_ACCESS_KEY = os.getenv("R2_SECRET_ACCESS_KEY")
BUCKET_NAME = os.getenv("R2_BUCKET_NAME")
PUBLIC_DOMAIN = os.getenv("R2_PUBLIC_DOMAIN")

# Đảm bảo trỏ đúng vào Route Webhook mới của Node.js
NODE_WEBHOOK_URL = os.getenv("NODE_WEBHOOK_URL")