import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, formatFlickrError } from "../flickr-client.js";
import { formatPhotoListItem, extractContent } from "../formatters.js";
import type { FlickrPhoto } from "../types.js";

export function registerPoolTools(server: McpServer) {
  server.tool(
    "flickr_get_group_recents",
    "Get the most recent photos added to a group's pool. Useful for evaluating whether a group is active and what kind of photos are posted there.",
    {
      group_id: z
        .string()
        .describe("The group NSID (from flickr_list_groups or flickr_search_groups)"),
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
    },
    async ({ group_id, count, page }) => {
      try {
        const flickr = getFlickr();
        const res = await flickr("flickr.groups.pools.getPhotos", {
          group_id,
          per_page: String(count),
          page: String(page),
          extras:
            "description,tags,date_taken,date_upload,views,count_faves,count_comments,owner_name",
        });

        const photos: FlickrPhoto[] = res.photos.photo;
        if (photos.length === 0) {
          return {
            content: [{ type: "text", text: "No photos found in this group pool." }],
          };
        }

        const totalPages = res.photos.pages;
        const total = res.photos.total;

        const lines = photos.map((p, i) => {
          const ownerName = (p as any).ownername || "unknown";
          return formatPhotoListItem(p, i + (page - 1) * count) + ` | By: ${ownerName}`;
        });

        const header = `**Group Pool** (page ${page}/${totalPages}, ${total} total)\n\n`;
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
