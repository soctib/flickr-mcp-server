export const IMAGE_SIZE_PRIORITY = [
  "Large",
  "Medium 800",
  "Medium 640",
  "Medium",
] as const;

export const MAX_IMAGE_BYTES = 700_000;

export const FLICKR_ERROR_MESSAGES: Record<number, string> = {
  1: "Photo/resource not found or not owned by you.",
  2: "Permission denied. Check your OAuth tokens have write access.",
  3: "This photo is already in that group's pool.",
  5: "You've hit the limit for photos in this group's pool.",
  96: "OAuth signature invalid. Re-run setup-auth to refresh tokens.",
  98: "Authentication failed. Check your .env credentials.",
  99: "Flickr user not found. Check your OAuth setup.",
};
