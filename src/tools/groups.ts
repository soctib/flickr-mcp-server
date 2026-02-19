import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, getUserId, formatFlickrError } from "../flickr-client.js";
import { formatGroupList, formatGroupSearchResult, extractContent } from "../formatters.js";

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
    "Submit a photo to a Flickr group's pool. You must be a member of the group. Use flickr_join_group to join groups you're not a member of.",
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
        const code = err?.code;
        const msg = err?.message?.toLowerCase() || "";

        if (code === 2 || msg.includes("group not found") || msg.includes("not a member")) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Cannot add photo to group \`${group_id}\`: you are not a member (or the group was not found). ` +
                  `Use \`flickr_join_group\` with group_id \`${group_id}\` to join first.`,
              },
            ],
            isError: true,
          };
        }

        if (code === 3) {
          return {
            content: [
              {
                type: "text",
                text: `Photo \`${photo_id}\` is already in group \`${group_id}\`'s pool.`,
              },
            ],
            isError: true,
          };
        }

        if (code === 5) {
          return {
            content: [
              {
                type: "text",
                text: `Cannot add photo: you've reached the submission limit for group \`${group_id}\`.`,
              },
            ],
            isError: true,
          };
        }

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

  server.tool(
    "flickr_join_group",
    "Join a Flickr group. If the group has rules, the first call (without user_has_read_the_rules_and_agreed) returns the rules WITHOUT joining. You MUST show the rules to the user and get their explicit confirmation, then call again with user_has_read_the_rules_and_agreed: true.",
    {
      group_id: z.string().describe("The group NSID to join"),
      user_has_read_the_rules_and_agreed: z
        .boolean()
        .optional()
        .default(false)
        .describe(
          "Set to true ONLY after you have shown the group rules to the user and they explicitly agreed."
        ),
    },
    async ({ group_id, user_has_read_the_rules_and_agreed }) => {
      try {
        const flickr = getFlickr();

        const infoRes = await flickr("flickr.groups.getInfo", { group_id });
        const group = infoRes.group;
        const groupName = extractContent(group.name);
        const rules = extractContent(group.rules);
        const hasRules = rules.length > 0;

        // If group has rules and user hasn't agreed yet, return the rules
        if (hasRules && !user_has_read_the_rules_and_agreed) {
          return {
            content: [
              {
                type: "text",
                text:
                  `## Rules for "${groupName}"\n\n` +
                  `${rules}\n\n` +
                  `---\n` +
                  `Show these rules to the user. If they agree, call this tool again ` +
                  `with \`user_has_read_the_rules_and_agreed: true\` to join.`,
              },
            ],
          };
        }

        // Join the group
        const joinParams: Record<string, string> = { group_id };
        if (hasRules) {
          joinParams.accept_rules = "1";
        }
        await flickr("flickr.groups.join", joinParams);

        return {
          content: [
            {
              type: "text",
              text: `Joined group **"${groupName}"** (\`${group_id}\`).`,
            },
          ],
        };
      } catch (err: any) {
        const code = err?.code;

        if (code === 4) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Group \`${group_id}\` requires an invitation to join. ` +
                  `Visit https://www.flickr.com/groups/${group_id}/ to request one.`,
              },
            ],
            isError: true,
          };
        }

        if (code === 6) {
          return {
            content: [
              {
                type: "text",
                text:
                  `Flickr requires accepting the group rules before joining. ` +
                  `Call this tool without \`user_has_read_the_rules_and_agreed\` to see the rules first.`,
              },
            ],
            isError: true,
          };
        }

        if (code === 7) {
          return {
            content: [
              {
                type: "text",
                text: `Cannot join: you are already a member of the maximum number of groups.`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [{ type: "text", text: formatFlickrError(err) }],
          isError: true,
        };
      }
    }
  );
}
