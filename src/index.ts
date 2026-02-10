import "dotenv/config";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { initFlickrClient } from "./flickr-client.js";
import { registerPhotoTools } from "./tools/photos.js";
import { registerMetadataTools } from "./tools/metadata.js";
import { registerStatsTools } from "./tools/stats.js";
import { registerGroupTools } from "./tools/groups.js";
import { registerCommentTools } from "./tools/comments.js";
import { registerCommentingTools } from "./tools/commenting.js";
import { registerPoolTools } from "./tools/pools.js";
import { registerThumbTools } from "./tools/thumbs.js";
import { registerAlbumTools } from "./tools/albums.js";
import { registerNoteTools } from "./tools/notes.js";
import { initNotesDb } from "./notes-db.js";

async function main() {
  // Validate credentials and connect to Flickr
  let userId: string;
  let username: string;
  try {
    const result = await initFlickrClient();
    userId = result.userId;
    username = result.username;
    console.error(`Flickr MCP Server: authenticated as ${username} (${userId})`);
    initNotesDb();
    console.error("Flickr MCP Server: notes database initialized");
  } catch (err: any) {
    console.error(`Flickr MCP Server startup failed: ${err.message}`);
    process.exit(1);
  }

  // Create MCP server
  const server = new McpServer({
    name: "flickr",
    version: "1.0.0",
  });

  // Register all tools
  registerPhotoTools(server);
  registerMetadataTools(server);
  registerStatsTools(server);
  registerGroupTools(server);
  registerCommentTools(server);
  registerCommentingTools(server);
  registerPoolTools(server);
  registerThumbTools(server);
  registerAlbumTools(server);
  registerNoteTools(server);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error("Flickr MCP Server running on stdio");
}

main().catch((err) => {
  console.error("Fatal error:", err);
  process.exit(1);
});
