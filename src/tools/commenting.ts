import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, formatFlickrError } from "../flickr-client.js";

export function registerCommentingTools(server: McpServer) {
  server.tool(
    "flickr_add_comment",
    "Add a comment to a photo. Use this to leave feedback on another user's photo or your own.",
    {
      photo_id: z.string().describe("The photo ID to comment on"),
      comment_text: z
        .string()
        .min(1)
        .describe("The comment text to post"),
    },
    async ({ photo_id, comment_text }) => {
      try {
        const flickr = getFlickr();
        const res = await flickr("flickr.photos.comments.addComment", {
          photo_id,
          comment_text,
        });

        const commentId = res.comment?.id ?? "unknown";

        return {
          content: [
            {
              type: "text",
              text: `Comment posted on photo \`${photo_id}\` (comment ID: \`${commentId}\`).\n\n> ${comment_text}`,
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
