import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  addNote,
  getNotes,
  deleteNote,
  searchNotes,
  type EntityType,
  type NoteRow,
} from "../notes-db.js";

function formatNote(note: NoteRow): string {
  return `[#${note.id}] (${note.created_at})\n> ${note.note}`;
}

function formatNoteList(notes: NoteRow[]): string {
  if (notes.length === 0) return "No notes found.";
  return notes.map(formatNote).join("\n\n");
}

export function registerNoteTools(server: McpServer) {
  server.tool(
    "flickr_add_note",
    "Add a local note/remark to a photo, album, or group. Notes are stored locally and never sent to Flickr. Use for reminders, ideas, or annotations.",
    {
      entity_type: z
        .enum(["photo", "album", "group"])
        .describe("What to attach the note to"),
      entity_id: z
        .string()
        .describe("The Flickr ID of the photo, album, or group"),
      note: z.string().min(1).describe("The note text"),
    },
    async ({ entity_type, entity_id, note }) => {
      try {
        const row = addNote(entity_type as EntityType, entity_id, note);
        return {
          content: [
            {
              type: "text",
              text: `Note #${row.id} added to ${entity_type} \`${entity_id}\`:\n> ${note}`,
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Failed to add note: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "flickr_get_notes",
    "Get all local notes for a specific photo, album, or group.",
    {
      entity_type: z
        .enum(["photo", "album", "group"])
        .describe("Type of entity to get notes for"),
      entity_id: z
        .string()
        .describe("The Flickr ID of the photo, album, or group"),
    },
    async ({ entity_type, entity_id }) => {
      try {
        const notes = getNotes(entity_type as EntityType, entity_id);
        const header = `**Notes on ${entity_type} \`${entity_id}\`** (${notes.length} total)\n\n`;
        return {
          content: [
            { type: "text", text: header + formatNoteList(notes) },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Failed to get notes: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "flickr_delete_note",
    "Delete a local note by its ID.",
    {
      note_id: z.number().int().describe("The note ID to delete (from flickr_get_notes)"),
    },
    async ({ note_id }) => {
      try {
        const deleted = deleteNote(note_id);
        if (deleted) {
          return {
            content: [{ type: "text", text: `Note #${note_id} deleted.` }],
          };
        } else {
          return {
            content: [
              { type: "text", text: `Note #${note_id} not found.` },
            ],
            isError: true,
          };
        }
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Failed to delete note: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );

  server.tool(
    "flickr_search_notes",
    "Search all local notes by text content. Returns matching notes across all photos, albums, and groups.",
    {
      query: z.string().min(1).describe("Text to search for in notes"),
    },
    async ({ query }) => {
      try {
        const notes = searchNotes(query);
        const header = `**Notes matching "${query}"** (${notes.length} found)\n\n`;
        const lines = notes.map(
          (n) =>
            `[#${n.id}] ${n.entity_type} \`${n.entity_id}\` (${n.created_at})\n> ${n.note}`
        );
        return {
          content: [
            {
              type: "text",
              text: header + (lines.length > 0 ? lines.join("\n\n") : "No notes found."),
            },
          ],
        };
      } catch (err: any) {
        return {
          content: [
            { type: "text", text: `Failed to search notes: ${err.message}` },
          ],
          isError: true,
        };
      }
    }
  );
}
