import { loadCredentials, createAuthenticatedClient, validateCredentials } from "./auth.js";
import { FLICKR_ERROR_MESSAGES } from "./constants.js";

let _flickr: any = null;
let _userId: string | null = null;

export async function initFlickrClient(): Promise<{
  userId: string;
  username: string;
}> {
  const creds = loadCredentials();
  const { flickr } = createAuthenticatedClient(creds);
  _flickr = flickr;
  const result = await validateCredentials(flickr as any);
  _userId = result.userId;
  return result;
}

export function getFlickr(): (method: string, params?: Record<string, string>) => Promise<any> {
  if (!_flickr) {
    throw new Error("Flickr client not initialized. Call initFlickrClient() first.");
  }
  return _flickr as any;
}

export function getUserId(): string {
  if (!_userId) {
    throw new Error("Flickr client not initialized. Call initFlickrClient() first.");
  }
  return _userId;
}

export function formatFlickrError(err: any): string {
  if (err?.code && FLICKR_ERROR_MESSAGES[err.code]) {
    return FLICKR_ERROR_MESSAGES[err.code];
  }
  if (err?.message) {
    return `Flickr API error: ${err.message}`;
  }
  return `Flickr API error: ${String(err)}`;
}
