import sharp from "sharp";

const clamp = (value, min, max) => Math.min(max, Math.max(min, Number(value)));

const jpeg = (pipeline) => pipeline.jpeg({ quality: 90 }).toBuffer();

// Build a small set of query views for one crop:
// - original: current behaviour
// - tight: centre crop, useful when the selected region includes background
// - padded: the crop over a blurred cover background, useful for context
export const buildQueryVariants = async (buffer, options = {}) => {
  const variants = [{ label: "original", buffer }];
  if (!Buffer.isBuffer(buffer) || buffer.length === 0) return variants;

  const tightRatio = clamp(options.tightRatio ?? 0.82, 0.55, 1);
  const paddedScale = clamp(options.paddedScale ?? 0.82, 0.55, 1);
  const blurSigma = clamp(options.blurSigma ?? 18, 0, 60);

  try {
    const metadata = await sharp(buffer).metadata();
    const width = Number(metadata.width) || 0;
    const height = Number(metadata.height) || 0;
    if (width < 64 || height < 64) return variants;

    if (tightRatio < 0.999) {
      const tightWidth = Math.max(32, Math.round(width * tightRatio));
      const tightHeight = Math.max(32, Math.round(height * tightRatio));
      const tight = await jpeg(sharp(buffer).extract({
        left: Math.max(0, Math.round((width - tightWidth) / 2)),
        top: Math.max(0, Math.round((height - tightHeight) / 2)),
        width: tightWidth,
        height: tightHeight,
      }));
      variants.push({ label: "tight", buffer: tight });
    }

    if (paddedScale < 0.999) {
      const foregroundWidth = Math.max(32, Math.round(width * paddedScale));
      const foregroundHeight = Math.max(32, Math.round(height * paddedScale));
      const background = await sharp(buffer)
        .resize(width, height, { fit: "cover" })
        .blur(blurSigma)
        .toBuffer();
      const foreground = await sharp(buffer)
        .resize(foregroundWidth, foregroundHeight, { fit: "inside" })
        .toBuffer();
      const padded = await jpeg(sharp(background).composite([
        { input: foreground, gravity: "center" },
      ]));
      variants.push({ label: "padded", buffer: padded });
    }
  } catch {
    // A broken or unsupported image must not break the scan flow.
  }

  return variants;
};
