import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { getFlickr, formatFlickrError } from "../flickr-client.js";

/**
 * Normalize a string for safe OAuth signing.
 * Replaces unicode whitespace (middots, non-breaking spaces, etc.)
 * and normalizes newlines so they don't break percent-encoding.
 */
function sanitizeText(text: string): string {
  return text
    .replace(/\u00B7/g, " ")           // middot → space
    .replace(/[\u00A0\u2007\u202F]/g, " ")  // non-breaking / figure spaces
    .replace(/[\u2000-\u200B]/g, " ")  // en/em/thin/hair spaces, zero-width
    .replace(/\u200B/g, "")            // zero-width space → remove
    .replace(/\r\n/g, "\n")            // normalize CRLF
    .replace(/\r/g, "\n");             // normalize CR
}

export function registerMetadataTools(server: McpServer) {
  server.tool(
    "flickr_set_metadata",
    "Update a photo's title and/or description. At least one of title or description must be provided.",
    {
      photo_id: z.string().describe("The Flickr photo ID"),
      title: z.string().optional().describe("New title for the photo"),
      description: z
        .string()
        .optional()
        .describe("New description for the photo (HTML allowed)"),
    },
    async ({ photo_id, title, description }) => {
      if (!title && !description) {
        return {
          content: [
            {
              type: "text",
              text: "At least one of title or description must be provided.",
            },
          ],
          isError: true,
        };
      }

      try {
        const flickr = getFlickr();
        const params: Record<string, string> = { photo_id };
        if (title !== undefined) params.title = sanitizeText(title);
        if (description !== undefined) params.description = sanitizeText(description);

        await flickr("flickr.photos.setMeta", params);

        const updates: string[] = [];
        if (title !== undefined) updates.push(`**Title:** ${title}`);
        if (description !== undefined)
          updates.push(`**Description:** ${description}`);

        return {
          content: [
            {
              type: "text",
              text: `Updated photo \`${photo_id}\`:\n${updates.join("\n")}`,
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
    "flickr_set_tags",
    "Replace ALL tags on a photo. WARNING: This replaces the entire tag list, it does not append. To add tags, first view the photo to get existing tags, then call this with the full combined list. Multi-word tags must be quoted: '\"long exposure\" night city'.",
    {
      photo_id: z.string().describe("The Flickr photo ID"),
      tags: z
        .string()
        .describe(
          'Space-separated tags. Multi-word tags must be quoted: "long exposure" night city'
        ),
    },
    async ({ photo_id, tags }) => {
      try {
        const flickr = getFlickr();
        await flickr("flickr.photos.setTags", { photo_id, tags });

        return {
          content: [
            {
              type: "text",
              text: `Replaced all tags on photo \`${photo_id}\` with:\n${tags}`,
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
