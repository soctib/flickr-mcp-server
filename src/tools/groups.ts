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
