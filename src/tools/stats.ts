import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, formatFlickrError } from "../flickr-client.js";
import { formatStatsTable, extractContent } from "../formatters.js";

export function registerStatsTools(server: McpServer) {
  server.tool(
    "flickr_get_stats",
    "Get photo statistics. 'popular' mode returns your top photos by views/comments/favorites. 'photo_daily' mode returns daily stats for a specific photo (last 28 days only).",
    {
      mode: z
        .enum(["popular", "photo_daily"])
        .describe("popular: top photos overall. photo_daily: daily stats for one photo"),
      photo_id: z
        .string()
        .optional()
        .describe("Required for photo_daily mode"),
      date: z
        .string()
        .optional()
        .describe(
          "YYYY-MM-DD format. For photo_daily mode. Flickr keeps 28 days."
        ),
      sort: z
        .enum(["views", "comments", "favorites"])
        .default("views")
        .describe("Sort order for popular mode"),
      count: z
        .number()
        .int()
        .min(1)
        .max(100)
        .default(25)
        .describe("Number of results for popular mode (1-100)"),
    },
    async ({ mode, photo_id, date, sort, count }) => {
      try {
        const flickr = getFlickr();

        if (mode === "popular") {
          const params: Record<string, string> = {
            sort,
            per_page: String(count),
          };
          if (date) params.date = date;

          const res = await flickr("flickr.stats.getPopularPhotos", params);
          const photos = res.photos.photo;

          const table = formatStatsTable(
            photos.map((p: any) => ({
              id: p.id,
              title: p.title,
              views: p.stats?.views ?? p.views ?? "0",
              favorites: p.stats?.favorites ?? "-",
              comments: p.stats?.comments ?? "-",
            }))
          );

          return {
            content: [
              {
                type: "text",
                text: `**Popular Photos** (sorted by ${sort})\n\n${table}`,
              },
            ],
          };
        } else {
          // photo_daily
          if (!photo_id) {
            return {
              content: [
                {
                  type: "text",
                  text: "photo_id is required for photo_daily mode.",
                },
              ],
              isError: true,
            };
          }

          const today = new Date().toISOString().split("T")[0];
          const params: Record<string, string> = {
            photo_id,
            date: date || today,
          };

          const res = await flickr("flickr.stats.getPhotoStats", params);
          const stats = res.stats;

          return {
            content: [
              {
                type: "text",
                text:
                  `**Daily Stats for photo \`${photo_id}\`** (${params.date})\n\n` +
                  `- Views: ${stats.views}\n` +
                  `- Favorites: ${stats.favorites}\n` +
                  `- Comments: ${stats.comments}\n`,
              },
            ],
          };
        }
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );
}
