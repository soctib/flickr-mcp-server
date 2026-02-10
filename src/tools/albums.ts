import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, getUserId, formatFlickrError } from "../flickr-client.js";
import { extractContent, formatPhotoListItem } from "../formatters.js";
import type { FlickrPhoto } from "../types.js";

export function registerAlbumTools(server: McpServer) {
  server.tool(
    "flickr_list_albums",
    "List your albums (photosets), or another user's public albums. Returns album IDs, titles, photo counts, and descriptions.",
    {
      user_id: z
        .string()
        .optional()
        .describe("User NSID to list albums for. Omit for your own albums."),
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Page number for pagination"),
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Number of albums to return (1-50)"),
    },
    async ({ user_id, page, count }) => {
      try {
        const flickr = getFlickr();
        const targetUser = user_id || getUserId();

        const res = await flickr("flickr.photosets.getList", {
          user_id: targetUser,
          per_page: String(count),
          page: String(page),
        });

        const photosets = res.photosets.photoset;
        if (!photosets || photosets.length === 0) {
          return {
            content: [{ type: "text", text: "No albums found." }],
          };
        }

        const totalPages = res.photosets.pages;
        const total = res.photosets.total;

        // Check visibility of each album's primary photo in parallel
        const visibilityMap = new Map<string, string>();
        await Promise.all(
          photosets.map(async (ps: any) => {
            const primaryId = ps.primary;
            if (!primaryId) return;
            try {
              const infoRes = await flickr("flickr.photos.getInfo", {
                photo_id: primaryId,
              });
              const vis = infoRes.photo.visibility;
              if (vis?.ispublic === 1) {
                visibilityMap.set(ps.id, "public");
              } else if (vis?.isfriend === 1 && vis?.isfamily === 1) {
                visibilityMap.set(ps.id, "friends & family");
              } else if (vis?.isfriend === 1) {
                visibilityMap.set(ps.id, "friends");
              } else if (vis?.isfamily === 1) {
                visibilityMap.set(ps.id, "family");
              } else {
                visibilityMap.set(ps.id, "private");
              }
            } catch {
              visibilityMap.set(ps.id, "unknown");
            }
          })
        );

        const lines = photosets.map((ps: any, i: number) => {
          const title = extractContent(ps.title) || "(untitled)";
          const desc = extractContent(ps.description);
          const truncDesc = desc.length > 120 ? desc.slice(0, 120) + "..." : desc;
          const photoCount = ps.count_photos || ps.photos || "0";
          const videoCount = ps.count_videos || ps.videos || "0";
          const visibility = visibilityMap.get(ps.id) || "unknown";
          const created = ps.date_create
            ? new Date(parseInt(ps.date_create) * 1000).toISOString().split("T")[0]
            : "unknown";
          const updated = ps.date_update
            ? new Date(parseInt(ps.date_update) * 1000).toISOString().split("T")[0]
            : "unknown";

          let out = `**${i + 1 + (page - 1) * count}. ${title}** (ID: \`${ps.id}\`) [${visibility}]\n`;
          if (truncDesc) out += `   ${truncDesc}\n`;
          out += `   Photos: ${photoCount} | Videos: ${videoCount} | Created: ${created} | Updated: ${updated}`;
          return out;
        });

        const whose = user_id ? `User ${user_id}` : "Your";
        const header = `**${whose} Albums** (page ${page}/${totalPages}, ${total} total)\n\n`;
        const text = header + lines.join("\n\n");

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "flickr_get_album",
    "Get photos in a specific album (photoset). Returns photo IDs, titles, tags, and metadata for each photo in the album.",
    {
      album_id: z.string().describe("The album/photoset ID"),
      user_id: z
        .string()
        .optional()
        .describe("User NSID who owns the album. Omit for your own albums."),
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Page number for pagination"),
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20)
        .describe("Number of photos to return per page (1-50)"),
    },
    async ({ album_id, user_id, page, count }) => {
      try {
        const flickr = getFlickr();
        const targetUser = user_id || getUserId();

        const res = await flickr("flickr.photosets.getPhotos", {
          photoset_id: album_id,
          user_id: targetUser,
          per_page: String(count),
          page: String(page),
          extras:
            "description,tags,date_taken,date_upload,views,count_faves,count_comments,url_sq",
        });

        const photoset = res.photoset;
        const photos: FlickrPhoto[] = photoset.photo;

        if (!photos || photos.length === 0) {
          return {
            content: [{ type: "text", text: "No photos found in this album." }],
          };
        }

        const totalPages = Math.ceil(parseInt(photoset.total) / count);
        const total = photoset.total;
        const albumTitle = photoset.title || "(untitled album)";

        const lines = photos.map((p, i) =>
          formatPhotoListItem(p, i + (page - 1) * count)
        );

        const header = `**Album: ${albumTitle}** (page ${page}/${totalPages}, ${total} photos)\n\n`;
        const text = header + lines.join("\n\n");

        return { content: [{ type: "text", text }] };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );
}
