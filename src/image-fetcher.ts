import { IMAGE_SIZE_PRIORITY, IMAGE_SIZE_PRIORITY_MEDIUM, MAX_IMAGE_BYTES, MAX_IMAGE_BYTES_MEDIUM } from "./constants.js";
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
  return fetchWithPriority(sizes, IMAGE_SIZE_PRIORITY, MAX_IMAGE_BYTES);
}

export async function fetchPhotoMedium(
  sizes: FlickrSize[]
): Promise<FetchedImage | null> {
  return fetchWithPriority(sizes, IMAGE_SIZE_PRIORITY_MEDIUM, MAX_IMAGE_BYTES_MEDIUM);
}

async function fetchWithPriority(
  sizes: FlickrSize[],
  priority: readonly string[],
  maxBytes: number
): Promise<FetchedImage | null> {
  // Build lookup of available sizes
  const sizeMap = new Map<string, FlickrSize>();
  for (const s of sizes) {
    sizeMap.set(s.label, s);
  }

  // Try each preferred size in order
  for (const label of priority) {
    const size = sizeMap.get(label);
    if (!size) continue;

    const result = await tryFetchImage(size, maxBytes);
    if (result) return result;
  }

  return null;
}

async function tryFetchImage(size: FlickrSize, maxBytes: number): Promise<FetchedImage | null> {
  try {
    const response = await fetch(size.source);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();

    if (buffer.byteLength > maxBytes) {
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
