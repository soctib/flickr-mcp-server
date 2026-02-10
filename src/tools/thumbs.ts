import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, getUserId, formatFlickrError } from "../flickr-client.js";
import { extractContent } from "../formatters.js";
import type { FlickrPhoto } from "../types.js";

const MAX_THUMBS = 20;
const THUMB_MAX_BYTES = 50_000; // 50KB per thumbnail, plenty for 150px squares

async function fetchThumbnail(
  url: string
): Promise<{ data: string; mimeType: string } | null> {
  try {
    const response = await fetch(url);
    if (!response.ok) return null;

    const buffer = await response.arrayBuffer();
    if (buffer.byteLength > THUMB_MAX_BYTES) return null;

    return {
      data: Buffer.from(buffer).toString("base64"),
      mimeType: response.headers.get("content-type") || "image/jpeg",
    };
  } catch {
    return null;
  }
}

export function registerThumbTools(server: McpServer) {
  server.tool(
    "flickr_view_thumbs",
    "View multiple photos as small thumbnails (150px squares) for browsing. Returns images with titles and IDs. Pass photo IDs directly, or pass an album_id to browse all photos in that album.",
    {
      photo_ids: z
        .array(z.string())
        .min(1)
        .max(MAX_THUMBS)
        .optional()
        .describe(`Array of photo IDs to view as thumbnails (max ${MAX_THUMBS})`),
      album_id: z
        .string()
        .optional()
        .describe("An album/photoset ID. Shows thumbnails for all photos in the album (first 20)."),
    },
    async ({ photo_ids, album_id }) => {
      try {
        const flickr = getFlickr();

        if (!photo_ids && !album_id) {
          return {
            content: [{ type: "text", text: "Provide either photo_ids or album_id." }],
            isError: true,
          };
        }

        let ids: string[];

        if (album_id) {
          const albumRes = await flickr("flickr.photosets.getPhotos", {
            photoset_id: album_id,
            user_id: getUserId(),
            per_page: String(MAX_THUMBS),
            page: "1",
          });
          const photos = albumRes.photoset.photo || [];
          ids = photos.map((p: any) => p.id);
          if (ids.length === 0) {
            return {
              content: [{ type: "text", text: "Album is empty." }],
            };
          }
        } else {
          ids = photo_ids!;
        }

        const photo_ids_resolved = ids;

        // Fetch info for all photos in parallel to get thumbnail URLs
        const infoResults = await Promise.all(
          photo_ids_resolved.map(async (photo_id) => {
            try {
              const res = await flickr("flickr.photos.getSizes", { photo_id });
              const infoRes = await flickr("flickr.photos.getInfo", { photo_id });
              const sizes = res.sizes.size;
              // Prefer "Square" (150px) or "Large Square" or fall back to smallest
              const square =
                sizes.find((s: any) => s.label === "Large Square") ||
                sizes.find((s: any) => s.label === "Square") ||
                sizes[0];
              const title = extractContent(infoRes.photo.title) || "(untitled)";
              return { photo_id, url: square?.source, title };
            } catch {
              return { photo_id, url: null, title: "(error)" };
            }
          })
        );

        // Fetch all thumbnails in parallel
        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: string }
        > = [];

        const thumbResults = await Promise.all(
          infoResults.map(async (info) => {
            if (!info.url) return { ...info, thumb: null };
            const thumb = await fetchThumbnail(info.url);
            return { ...info, thumb };
          })
        );

        for (const result of thumbResults) {
          if (result.thumb) {
            content.push({
              type: "image" as const,
              data: result.thumb.data,
              mimeType: result.thumb.mimeType,
            });
          }
          content.push({
            type: "text" as const,
            text: `**${result.title}** (ID: \`${result.photo_id}\`)`,
          });
        }

        if (content.length === 0) {
          content.push({
            type: "text" as const,
            text: "No thumbnails could be loaded.",
          });
        }

        return { content };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );
}
