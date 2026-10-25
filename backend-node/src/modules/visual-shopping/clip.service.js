import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// CLIP image embeddings self-hosted qua Transformers.js (ONNX Runtime).
// Model nhẹ (clip-vit-base-patch32 ~150MB) tai ve 1 lan, load san trong bo nho.
// Doi provider chi can thay file nay — interface: embedImage(Buffer | URL string).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MODEL_ID = process.env.CLIP_MODEL || "Xenova/clip-vit-base-patch32";
const MODEL_CACHE_DIR = path.join(__dirname, "../../../models");
const TMP_DIR = path.join(__dirname, "../../../uploads");
fs.mkdirSync(TMP_DIR, { recursive: true });

let extractorPromise = null;
let loadMs = null;

const getExtractor = async () => {
  if (!extractorPromise) {
    extractorPromise = (async () => {
      const t0 = Date.now();
      const { pipeline, env } = await import("@xenova/transformers");
      env.cacheDir = MODEL_CACHE_DIR;
      env.allowLocalModels = false;
      env.backends.onnx.wasm.numThreads = Math.min(4, Number(process.env.CLIP_THREADS) || 2);
      const extractor = await pipeline("image-feature-extraction", MODEL_ID, { quantized: true });
      loadMs = Date.now() - t0;
      console.log(`[CLIP] model ${MODEL_ID} load sẵn trong ${loadMs}ms`);
      return extractor;
    })();
    extractorPromise.catch(() => {
      extractorPromise = null; // cho phép thử lại
    });
  }
  return extractorPromise;
};

export const clipReady = async () => {
  await getExtractor();
  return { model: MODEL_ID, loadMs };
};

// Chuan hoa moi dau vao thanh duong dan file tam ma RawImage.read doc duoc (fs)
let tmpCounter = 0;
const toImageFile = (imageInput) => {
  if (typeof imageInput === "string" && /^https?:\/\//.test(imageInput)) {
    return imageInput; // URL http(s) — RawImage tự tải
  }
  let buffer;
  if (Buffer.isBuffer(imageInput)) {
    buffer = imageInput;
  } else if (typeof imageInput === "string") {
    buffer = Buffer.from(imageInput.replace(/^data:image\/\w+;base64,/, ""), "base64");
  } else {
    throw new Error("imageInput phải là Buffer, dataURL, base64 hoặc URL");
  }
  const tmpFile = path.join(TMP_DIR, "embed-tmp-" + process.pid + "-" + (tmpCounter++ % 50) + ".jpg");
  fs.writeFileSync(tmpFile, buffer);
  return tmpFile;
};

// Nhan Buffer | dataURL | base64 tran | http(s) URL -> Float32Array (da normalize)
export const embedImage = async (imageInput) => {
  const extractor = await getExtractor();
  const tmpFile = typeof imageInput === "string" && /^https?:\/\//.test(imageInput) ? null : toImageFile(imageInput);
  const input = tmpFile ?? imageInput;
  const t0 = Date.now();
  try {
    const output = await extractor(input, { pooling: "mean", normalize: true });
    const embedMs = Date.now() - t0;
    const embedding = Array.from(output.data).map((v) => Number(v.toFixed(6)));
    return { embedding, embedMs, dimensions: embedding.length };
  } finally {
    if (tmpFile) fs.promises.unlink(tmpFile).catch(() => {});
  }
};

export const clipStats = () => ({ model: MODEL_ID, loadMs, warm: Boolean(extractorPromise) });
