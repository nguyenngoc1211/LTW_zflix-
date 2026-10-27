import { Upload } from "@aws-sdk/lib-storage";
import { ListObjectsV2Command, DeleteObjectsCommand } from "@aws-sdk/client-s3";
import s3 from "./r2.js";
import dotenv from "dotenv";

dotenv.config();

export const uploadFileToR2 = async (file, folder) => {
  if (!file) return null;

  const fileExt = file.originalname.split(".").pop();
  const fileName = `${folder}/${Date.now()}-${Math.round(Math.random() * 1000)}.${fileExt}`;

  const s3Upload = new Upload({
    client: s3,
    params: {
      Bucket: process.env.R2_BUCKET_NAME,
      Key: fileName,
      Body: file.buffer,
      ContentType: file.mimetype,
    },
  });

  await s3Upload.done();
  return fileName;
};

// Hàm này có thể xóa 1 file đơn lẻ, hoặc xóa cả 1 thư mục (nhờ quét theo prefix)
export const deleteFilesFromR2 = async (prefix) => {
  if (!prefix) return;

  try {
    let isTruncated = true;
    let continuationToken = undefined;

    while (isTruncated) {
      const listParams = {
        Bucket: process.env.R2_BUCKET_NAME,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      };

      const listResult = await s3.send(new ListObjectsV2Command(listParams));

      if (listResult.Contents && listResult.Contents.length > 0) {
        const deleteParams = {
          Bucket: process.env.R2_BUCKET_NAME,
          Delete: {
            Objects: listResult.Contents.map((item) => ({ Key: item.Key })),
          },
        };
        await s3.send(new DeleteObjectsCommand(deleteParams));
      }

      isTruncated = listResult.IsTruncated;
      continuationToken = listResult.NextContinuationToken;
    }
    console.log(`🗑️ Đã xóa sạch file/folder trên R2 với tiền tố: ${prefix}`);
  } catch (error) {
    console.error(`❌ Lỗi xóa file trên R2 (${prefix}):`, error);
  }
};
