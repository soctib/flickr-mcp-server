import { IMAGE_SIZE_PRIORITY, MAX_IMAGE_BYTES } from "./constants.js";
import type { FlickrSize } from "./types.js";

interface FetchedImage {
  data: string; // base64
  mimeType: string;
  width: number;
  height: number;
  label: string;
}

export async function fetchPhoto(
  sizes: FlickrSize[]
): Promise<FetchedImage | null> {
  // Build lookup of available sizes
  const sizeMap = new Map<string, FlickrSize>();
  for (const s of sizes) {
    sizeMap.set(s.label, s);
  }

  // Try each preferred size in order
  for (const label of IMAGE_SIZE_PRIORITY) {
    const size = sizeMap.get(label);
    if (!size) continue;

    const result = await tryFetchImage(size);
    if (result) return result;
  }

  return null;
}

async function tryFetchImage(size: FlickrSize): Promise<FetchedImage | null> {
  try {
    const response = await fetch(size.source);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > MAX_IMAGE_BYTES) {
      return null;
    }

    const base64 = Buffer.from(buffer).toString("base64");
    const mimeType = response.headers.get("content-type") || "image/jpeg";

    return {
      data: base64,
      mimeType,
      width: size.width,
      height: size.height,
      label: size.label,
    };
  } catch {
    return null;
  }
}
