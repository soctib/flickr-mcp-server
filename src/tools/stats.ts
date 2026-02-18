import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, getUserId, formatFlickrError } from "../flickr-client.js";
import { formatStatsTable, extractContent } from "../formatters.js";

export function registerStatsTools(server: McpServer) {
  server.tool(
    "flickr_get_activity",
    "Get a summary of recent activity on your account. Single day (default): total views breakdown plus which photos got views/faves/comments. Multi-day trend: pass days (2-28) to see a daily views trend with a visual bar chart. Defaults to yesterday.",
    {
      date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD format. Defaults to yesterday. Flickr keeps 28 days of daily data."),
      days: z
        .number()
        .int()
        .min(1)
        .max(28)
        .optional()
        .describe("Number of days to show (1-28). When >1, shows a daily trend instead of single-day detail."),
    },
    async ({ date, days }) => {
      try {
        const flickr = getFlickr();
        const yesterday = new Date(Date.now() - 86_400_000).toISOString().split("T")[0];
        const numDays = days || 1;

        if (numDays === 1) {
          // Single day — detailed view
          const targetDate = date || yesterday;

          const [totalsRes, popularRes] = await Promise.all([
            flickr("flickr.stats.getTotalViews", { date: targetDate }),
            flickr("flickr.stats.getPopularPhotos", {
              date: targetDate,
              per_page: "10",
              sort: "views",
            }),
          ]);

          const totals = totalsRes.stats;
          const photos = popularRes.photos?.photo || [];

          let text = `## Activity for ${targetDate}\n\n`;
          text += `### Total views\n`;
          text += `- **Photos:** ${totals.photos?.views ?? 0}\n`;
          text += `- **Photostream:** ${totals.photostream?.views ?? 0}\n`;
          text += `- **Sets:** ${totals.sets?.views ?? 0}\n`;
          text += `- **Collections:** ${totals.collections?.views ?? 0}\n`;
          const totalViews =
            (parseInt(totals.photos?.views) || 0) +
            (parseInt(totals.photostream?.views) || 0) +
            (parseInt(totals.sets?.views) || 0) +
            (parseInt(totals.collections?.views) || 0);
          text += `- **Total:** ${totalViews}\n`;

          if (photos.length > 0) {
            text += `\n### Most active photos\n\n`;
            text += `| # | Photo | Views | Faves | Comments |\n`;
            text += `|---|-------|-------|-------|----------|\n`;
            photos.forEach((p: any, i: number) => {
              const title = extractContent(p.title) || "(untitled)";
              const views = p.stats?.views ?? "0";
              const faves = p.stats?.favorites ?? "0";
              const comments = p.stats?.comments ?? "0";
              text += `| ${i + 1} | ${title} (\`${p.id}\`) | ${views} | ${faves} | ${comments} |\n`;
            });
          } else {
            text += `\nNo photo activity recorded for this date.`;
          }

          return { content: [{ type: "text", text }] };
        } else {
          // Multi-day trend
          const endDate = date ? new Date(date) : new Date(Date.now() - 86_400_000);
          const dates: string[] = [];
          for (let i = numDays - 1; i >= 0; i--) {
            const d = new Date(endDate.getTime() - i * 86_400_000);
            dates.push(d.toISOString().split("T")[0]);
          }

          // Fetch all days in parallel
          const results = await Promise.all(
            dates.map(async (d) => {
              try {
                const res = await flickr("flickr.stats.getTotalViews", { date: d });
                const s = res.stats;
                const total =
                  (parseInt(s.photos?.views) || 0) +
                  (parseInt(s.photostream?.views) || 0) +
                  (parseInt(s.sets?.views) || 0) +
                  (parseInt(s.collections?.views) || 0);
                return { date: d, views: total, error: null };
              } catch (err: any) {
                return { date: d, views: 0, error: err.message || String(err) };
              }
            })
          );

          const maxViews = Math.max(...results.map((r) => r.views), 1);
          const barScale = 30; // max bar width in characters
          const totalViews = results.reduce((sum, r) => sum + r.views, 0);
          const avgViews = Math.round(totalViews / results.length);

          let text = `## Activity Trend (${numDays} days, ending ${dates[dates.length - 1]})\n\n`;
          text += `**Total:** ${totalViews} views | **Daily avg:** ${avgViews}\n\n`;
          text += `| Date | Views | |\n`;
          text += `|------|------:|---|\n`;
          for (const r of results) {
            const barLen = Math.round((r.views / maxViews) * barScale);
            const bar = "\u2588".repeat(barLen);
            text += `| ${r.date} | ${r.views} | ${bar} |\n`;
          }

          return { content: [{ type: "text", text }] };
        }
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "flickr_get_photo_referrers",
    "Get which Flickr pages (groups, photostream, search, etc.) drove views to a photo. Shows where your traffic comes from within Flickr. Only the last 28 days of data are available.",
    {
      photo_id: z
        .union([z.string(), z.number().transform(String)])
        .optional()
        .describe("Photo ID. If omitted, returns referrers across all your photos."),
      date: z
        .string()
        .optional()
        .describe("YYYY-MM-DD format. Defaults to yesterday."),
      days: z
        .number()
        .int()
        .min(1)
        .max(28)
        .optional()
        .describe("Aggregate referrers over this many days (1-28). Defaults to 1."),
    },
    async ({ photo_id, date, days }) => {
      try {
        const flickr = getFlickr();
        const numDays = days || 1;
        const endDate = date
          ? new Date(date)
          : new Date(Date.now() - 86_400_000);

        const dates: string[] = [];
        for (let i = numDays - 1; i >= 0; i--) {
          const d = new Date(endDate.getTime() - i * 86_400_000);
          dates.push(d.toISOString().split("T")[0]);
        }

        // Fetch referrers for flickr.com for each day in parallel
        const allReferrers = await Promise.all(
          dates.map(async (d) => {
            try {
              const params: Record<string, string> = {
                date: d,
                domain: "flickr.com",
                per_page: "100",
              };
              if (photo_id) params.photo_id = String(photo_id);
              const res = await flickr("flickr.stats.getPhotoReferrers", params);
              return (res.domain?.referrer || []) as Array<{ url: string; views: string }>;
            } catch {
              return [];
            }
          })
        );

        // Normalize a referrer URL to a key for aggregation
        // Group URLs get a "group:" prefix so we can resolve names later
        function normalizeReferrer(url: string): string {
          const groupMatch = url.match(/flickr\.com\/groups\/([^/]+)/);
          if (groupMatch) return `group:${groupMatch[1]}`;
          const searchMatch = url.match(/flickr\.com\/search/);
          if (searchMatch) return "Flickr Search";
          const exploreMatch = url.match(/flickr\.com\/explore/);
          if (exploreMatch) return "Flickr Explore";
          const photostreamMatch = url.match(/flickr\.com\/photos\/([^/]+)\/?$/);
          if (photostreamMatch) return `Photostream: ${photostreamMatch[1]}`;
          const favesMatch = url.match(/flickr\.com\/photos\/([^/]+)\/favorites/);
          if (favesMatch) return `Favorites: ${favesMatch[1]}`;
          return url.replace(/^https?:\/\//, "");
        }

        // Aggregate views by normalized source across all days
        const sourceViews = new Map<string, number>();
        for (const dayReferrers of allReferrers) {
          for (const r of dayReferrers) {
            const key = normalizeReferrer(r.url);
            sourceViews.set(key, (sourceViews.get(key) || 0) + parseInt(r.views || "0"));
          }
        }

        if (sourceViews.size === 0) {
          const period = numDays === 1
            ? dates[0]
            : `${dates[0]} to ${dates[dates.length - 1]}`;
          return {
            content: [{
              type: "text",
              text: photo_id
                ? `No Flickr referrer data for photo \`${photo_id}\` on ${period}.`
                : `No Flickr referrer data for ${period}.`,
            }],
          };
        }

        // Resolve group slugs/NSIDs to human-readable names
        const groupKeys = [...sourceViews.keys()].filter((k) => k.startsWith("group:"));
        const groupNames = new Map<string, string>();

        if (groupKeys.length > 0) {
          // Fetch user's groups for bulk lookup
          try {
            const res = await flickr("flickr.people.getGroups", { user_id: getUserId() });
            const groups = res.groups?.group || [];
            for (const g of groups) {
              const name = typeof g.name === "string" ? g.name : g.name?._content ?? "";
              if (name) {
                // Map both NSID and path_alias to the name
                groupNames.set(g.nsid, name);
                if (g.path_alias) groupNames.set(g.path_alias, name);
              }
            }
          } catch {
            // Non-fatal — we'll just show slugs
          }

          // Resolve any remaining unknown groups individually
          const unknownSlugs = groupKeys
            .map((k) => k.slice(6))
            .filter((slug) => !groupNames.has(slug));

          if (unknownSlugs.length > 0) {
            await Promise.all(
              unknownSlugs.map(async (slug) => {
                try {
                  const res = await flickr("flickr.groups.getInfo", { group_id: slug });
                  const name = typeof res.group?.name === "string"
                    ? res.group.name
                    : res.group?.name?._content;
                  if (name) groupNames.set(slug, name);
                } catch {
                  // Leave as slug
                }
              })
            );
          }
        }

        // Sort by views descending
        const sorted = [...sourceViews.entries()].sort((a, b) => b[1] - a[1]);
        const totalViews = sorted.reduce((sum, [, v]) => sum + v, 0);

        const period = numDays === 1
          ? dates[0]
          : `${dates[0]} to ${dates[dates.length - 1]}`;
        const target = photo_id ? `photo \`${photo_id}\`` : "all photos";

        let text = `## Flickr Referrers for ${target} (${period})\n\n`;
        text += `**Total Flickr views:** ${totalViews}\n\n`;
        text += `| Views | Source |\n`;
        text += `|------:|--------|\n`;
        for (const [key, views] of sorted) {
          let label = key;
          if (key.startsWith("group:")) {
            const slug = key.slice(6);
            const name = groupNames.get(slug);
            label = name ? `Group: ${name}` : `Group: ${slug}`;
          }
          text += `| ${views} | ${label} |\n`;
        }

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
