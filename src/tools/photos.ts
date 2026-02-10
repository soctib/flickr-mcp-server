import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, formatFlickrError } from "../flickr-client.js";
import { fetchPhoto, fetchPhotoMedium } from "../image-fetcher.js";
import { formatPhotoListItem, formatPhotoMetadata } from "../formatters.js";
import type { FlickrPhoto, FlickrPhotoInfo, FlickrSize } from "../types.js";

export function registerPhotoTools(server: McpServer) {
  server.tool(
    "flickr_get_recent_photos",
    "List your most recent Flickr uploads with thumbnails and basic metadata (title, tags, dates, view/fave/comment counts). Returns photo IDs for use with other tools.",
    {
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of photos to return (1-50)"),
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Page number for pagination"),
      visibility: z
        .enum(["all", "public", "private", "friends", "family", "friends_family"])
        .default("all")
        .describe("Filter by visibility: all, public, private, friends, family, friends_family"),
    },
    async ({ count, page, visibility }) => {
      try {
        const flickr = getFlickr();
        // privacy_filter: 1=public, 2=friends, 3=family, 4=friends&family, 5=private
        const privacyMap: Record<string, string> = {
          all: "0",
          public: "1",
          friends: "2",
          family: "3",
          friends_family: "4",
          private: "5",
        };
        const params: Record<string, string> = {
          user_id: "me",
          per_page: String(count),
          page: String(page),
          extras:
            "description,tags,date_taken,date_upload,views,count_faves,count_comments,url_sq",
        };
        if (visibility !== "all") {
          params.privacy_filter = privacyMap[visibility];
        }
        const res = await flickr("flickr.people.getPhotos", params);

        const photos: FlickrPhoto[] = res.photos.photo;
        if (photos.length === 0) {
          return {
            content: [
              { type: "text", text: "No photos found." },
            ],
          };
        }

        const totalPages = res.photos.pages;
        const total = res.photos.total;

        const lines = photos.map((p, i) =>
          formatPhotoListItem(p, i + (page - 1) * count)
        );

        const filterLabel = visibility === "all" ? "" : ` [${visibility}]`;
        const header = `**Your Photos${filterLabel}** (page ${page}/${totalPages}, ${total} total)\n\n`;
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
    "flickr_view_photo",
    "Fetch a specific photo's image and full metadata so you can SEE it. Returns the image and details including title, description, tags, dates, view/fave/comment counts, and Flickr URL. Single photo: shown at large size. Array of up to 10 photo IDs: each shown at medium size to keep total response size manageable.",
    {
      photo_id: z
        .union([z.string(), z.array(z.string()).min(1).max(10)])
        .describe("A single photo ID, or an array of up to 10 photo IDs (shown at medium size)"),
    },
    async ({ photo_id }) => {
      try {
        const flickr = getFlickr();
        const ids = Array.isArray(photo_id) ? photo_id : [photo_id];
        const isBatch = ids.length > 1;

        const content: Array<
          | { type: "text"; text: string }
          | { type: "image"; data: string; mimeType: string }
        > = [];

        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const [infoRes, sizesRes] = await Promise.all([
                flickr("flickr.photos.getInfo", { photo_id: id }),
                flickr("flickr.photos.getSizes", { photo_id: id }),
              ]);
              const info: FlickrPhotoInfo = infoRes.photo;
              const sizes: FlickrSize[] = sizesRes.sizes.size;
              const image = isBatch
                ? await fetchPhotoMedium(sizes)
                : await fetchPhoto(sizes);
              return { id, info, sizes, image, error: null };
            } catch (err: any) {
              return { id, info: null, sizes: null, image: null, error: err.message || String(err) };
            }
          })
        );

        for (const r of results) {
          if (r.error) {
            content.push({
              type: "text" as const,
              text: `**Photo \`${r.id}\`:** Error — ${r.error}`,
            });
            continue;
          }

          const info = r.info!;
          const metadataText = formatPhotoMetadata(info);

          if (r.image) {
            content.push({
              type: "image" as const,
              data: r.image.data,
              mimeType: r.image.mimeType,
            });
            content.push({
              type: "text" as const,
              text:
                metadataText +
                `\n**Image size shown:** ${r.image.label} (${r.image.width}x${r.image.height})`,
            });
          } else {
            const flickrUrl =
              info.urls.url.find((u) => u.type === "photopage")?._content ?? "";
            content.push({
              type: "text" as const,
              text:
                metadataText +
                `\n**Note:** Image too large to display inline. View at: ${flickrUrl}`,
            });
          }
        }

        if (content.length === 0) {
          content.push({ type: "text" as const, text: "No photos could be loaded." });
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
