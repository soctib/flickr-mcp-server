import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, formatFlickrError } from "../flickr-client.js";
import { formatComments } from "../formatters.js";

export function registerCommentTools(server: McpServer) {
  server.tool(
    "flickr_get_comments",
    "Get all comments on a photo. Useful for reading feedback and drafting replies.",
    {
      photo_id: z.string().describe("The photo ID to get comments for"),
    },
    async ({ photo_id }) => {
      try {
        const flickr = getFlickr();
        const res = await flickr("flickr.photos.comments.getList", {
          photo_id,
        });

        const comments = res.comments.comment ?? [];
        const text = formatComments(comments);

        return {
          content: [
            {
              type: "text",
              text: `**Comments on photo \`${photo_id}\`**\n\n${text}`,
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
