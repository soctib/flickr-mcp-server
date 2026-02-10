import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, getUserId, formatFlickrError } from "../flickr-client.js";
import { formatGroupList, formatGroupSearchResult } from "../formatters.js";

export function registerGroupTools(server: McpServer) {
  server.tool(
    "flickr_list_groups",
    "List the Flickr groups you are a member of, including group NSIDs needed for submitting photos.",
    {},
    async () => {
      try {
        const flickr = getFlickr();
        const res = await flickr("flickr.people.getGroups", {
          user_id: getUserId(),
        });

        const groups = res.groups.group;
        const text = formatGroupList(groups);

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
    "flickr_search_groups",
    "Search Flickr for groups matching a query. Use this to discover groups relevant to a photo's subject, style, or location. Returns group NSIDs, names, member/pool counts, and URLs.",
    {
      query: z
        .string()
        .describe(
          'Search term (e.g. "industrial photography", "black and white")'
        ),
      count: z
        .number()
        .int()
        .min(1)
        .max(50)
        .default(10)
        .describe("Number of results (1-50)"),
      page: z
        .number()
        .int()
        .min(1)
        .default(1)
        .describe("Page number for pagination"),
    },
    async ({ query, count, page }) => {
      try {
        const flickr = getFlickr();
        const res = await flickr("flickr.groups.search", {
          text: query,
          per_page: String(count),
          page: String(page),
        });

        const groups = res.groups.group;
        const totalPages = res.groups.pages;
        const total = res.groups.total;

        const header = `**Group Search: "${query}"** (page ${page}/${totalPages}, ${total} total)\n\n`;
        const text = header + formatGroupSearchResult(groups);

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
    "flickr_add_to_group",
    "Submit a photo to a Flickr group's pool. You must be a member of the group. Use flickr_list_groups to find group NSIDs.",
    {
      photo_id: z.string().describe("The photo ID to submit"),
      group_id: z
        .string()
        .describe("The group NSID (from flickr_list_groups)"),
    },
    async ({ photo_id, group_id }) => {
      try {
        const flickr = getFlickr();

        // Check if photo is public before submitting
        const info = await flickr("flickr.photos.getInfo", { photo_id });
        const isPublic = info.photo.visibility?.ispublic === 1;
        if (!isPublic) {
          return {
            content: [
              {
                type: "text",
                text: `Photo \`${photo_id}\` is not public. Only public photos can be submitted to groups.`,
              },
            ],
            isError: true,
          };
        }

        await flickr("flickr.groups.pools.add", {
          photo_id,
          group_id,
        });

        return {
          content: [
            {
              type: "text",
              text: `Photo \`${photo_id}\` submitted to group \`${group_id}\`.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "flickr_get_photo_contexts",
    "Get all groups and albums photos belong to. Pass photo IDs directly, or pass an album_id to check every photo in that album. All lookups run in parallel. Useful for checking where photos have already been submitted before adding them to more groups.",
    {
      photo_id: z
        .union([z.string(), z.array(z.string()).max(50)])
        .optional()
        .describe("A single photo ID or array of up to 50 photo IDs"),
      album_id: z
        .string()
        .optional()
        .describe("An album/photoset ID. All photos in the album will be checked."),
    },
    async ({ photo_id, album_id }) => {
      try {
        const flickr = getFlickr();

        if (!photo_id && !album_id) {
          return {
            content: [{ type: "text", text: "Provide either photo_id or album_id." }],
            isError: true,
          };
        }

        let ids: string[];
        let albumTitle = "";

        if (album_id) {
          // Fetch all photo IDs from the album (up to 500)
          const albumRes = await flickr("flickr.photosets.getPhotos", {
            photoset_id: album_id,
            user_id: getUserId(),
            per_page: "500",
            page: "1",
          });
          const photos = albumRes.photoset.photo || [];
          ids = photos.map((p: any) => p.id);
          albumTitle = albumRes.photoset.title || album_id;
          if (ids.length === 0) {
            return {
              content: [{ type: "text", text: `Album "${albumTitle}" is empty.` }],
            };
          }
        } else {
          ids = Array.isArray(photo_id) ? photo_id : [photo_id!];
        }

        const results = await Promise.all(
          ids.map(async (id) => {
            try {
              const res = await flickr("flickr.photos.getAllContexts", { photo_id: id });
              const albums = res.set ? (Array.isArray(res.set) ? res.set : [res.set]) : [];
              const pools = res.pool ? (Array.isArray(res.pool) ? res.pool : [res.pool]) : [];
              return { id, albums, pools, error: null };
            } catch (err: any) {
              return { id, albums: [], pools: [], error: err.message || String(err) };
            }
          })
        );

        let text = "";

        if (ids.length === 1) {
          // Single photo — detailed format
          const r = results[0];
          text = `## Contexts for photo \`${r.id}\`\n\n`;

          if (r.error) {
            text += `Error: ${r.error}`;
          } else if (r.pools.length === 0 && r.albums.length === 0) {
            text += "This photo is not in any groups or albums.";
          } else {
            if (r.pools.length > 0) {
              text += `### Groups (${r.pools.length})\n\n`;
              r.pools.forEach((p: any, i: number) => {
                const title = typeof p.title === "string" ? p.title : p.title?._content ?? "(unknown)";
                text += `${i + 1}. **${title}** (NSID: \`${p.id}\`)\n`;
                text += `   URL: https://www.flickr.com/groups/${p.id}/\n`;
              });
            }
            if (r.albums.length > 0) {
              text += `\n### Albums (${r.albums.length})\n\n`;
              r.albums.forEach((s: any, i: number) => {
                const title = typeof s.title === "string" ? s.title : s.title?._content ?? "(unknown)";
                text += `${i + 1}. **${title}** (ID: \`${s.id}\`)\n`;
              });
            }
          }
        } else {
          // Multiple photos — compact table format
          const heading = albumTitle
            ? `## Album "${albumTitle}" — Contexts (${ids.length} photos)`
            : `## Photo Contexts (${ids.length} photos)`;
          text = heading + "\n\n";
          for (const r of results) {
            const groupNames = r.pools.map((p: any) =>
              typeof p.title === "string" ? p.title : p.title?._content ?? "(unknown)"
            );
            const albumNames = r.albums.map((s: any) =>
              typeof s.title === "string" ? s.title : s.title?._content ?? "(unknown)"
            );

            text += `**\`${r.id}\`**`;
            if (r.error) {
              text += ` — ⚠ ${r.error}\n`;
            } else if (groupNames.length === 0 && albumNames.length === 0) {
              text += ` — no groups or albums\n`;
            } else {
              const parts: string[] = [];
              if (groupNames.length > 0) parts.push(`Groups: ${groupNames.join(", ")}`);
              if (albumNames.length > 0) parts.push(`Albums: ${albumNames.join(", ")}`);
              text += `\n   ${parts.join(" | ")}\n`;
            }
          }
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
    "flickr_remove_from_group",
    "Remove a photo from a Flickr group's pool.",
    {
      photo_id: z.string().describe("The photo ID to remove"),
      group_id: z
        .string()
        .describe("The group NSID to remove the photo from"),
    },
    async ({ photo_id, group_id }) => {
      try {
        const flickr = getFlickr();
        await flickr("flickr.groups.pools.remove", {
          photo_id,
          group_id,
        });

        return {
          content: [
            {
              type: "text",
              text: `Photo \`${photo_id}\` removed from group \`${group_id}\`.`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );
}
