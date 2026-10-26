import os
import shutil
import requests
import ffmpeg
from core.storage import s3_client
from core.config import BUCKET_NAME, PUBLIC_DOMAIN, NODE_WEBHOOK_URL

def process_hls_task(file_name: str, production_id: int, episode_id: int):
    try:
        print(f"🎬 Bắt đầu xử lý: {file_name}")

        base_name = os.path.splitext(os.path.basename(file_name))[0]
        work_dir = f"./temp/{base_name}"
        os.makedirs(work_dir, exist_ok=True)

        local_input_path = f"{work_dir}/input.mp4"
        hls_output_dir = f"{work_dir}/hls"
        os.makedirs(hls_output_dir, exist_ok=True)

        print("⬇️ Đang tải file gốc từ Cloudflare R2...")
        s3_client.download_file(BUCKET_NAME, file_name, local_input_path)

        print("✂️ Đang cắt video ra HLS (m3u8)...")
        (
            ffmpeg.input(local_input_path)
            .output(
                f"{hls_output_dir}/playlist.m3u8",
                format="hls",
                start_number=0,
                hls_time=10,
                hls_list_size=0,
                c="copy"
            )
            .run(capture_stdout=True, capture_stderr=True)
        )

        print("☁️ Đang upload các đoạn phim đã cắt lên R2...")
        r2_hls_path = f"hls/{base_name}" 

        for root, _, files in os.walk(hls_output_dir):
            for file in files:
                local_file = os.path.join(root, file)
                r2_key = f"{r2_hls_path}/{file}"
                content_type = "application/x-mpegURL" if file.endswith(".m3u8") else "video/MP2T"
                s3_client.upload_file(
                    local_file, BUCKET_NAME, r2_key,
                    ExtraArgs={"ContentType": content_type},
                )

        shutil.rmtree(work_dir)

        final_hls_url = f"{PUBLIC_DOMAIN}/{r2_hls_path}/playlist.m3u8"
        print(f"✅ XỬ LÝ XONG! Link phim HLS: {final_hls_url}")

        print("🔔 Đang báo cáo kết quả về Node.js...")
        webhook_data = {
            "production_id": production_id,
            "episode_id": episode_id,
            "m3u8_url": final_hls_url
        }
        
        response = requests.post(NODE_WEBHOOK_URL, json=webhook_data)
        
        if response.status_code == 200:
            print("🎉 Cập nhật Database thành công!")
        else:
            print(f"⚠️ Node.js phản hồi lỗi: {response.text}")

    except Exception as e:
        print(f"❌ LỖI XỬ LÝ VIDEO: {str(e)}")