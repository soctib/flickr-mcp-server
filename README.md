# Flickr MCP Server

An MCP server that lets AI assistants see, describe, tag, and manage photos on your Flickr account. Browse photos and albums, draft titles/descriptions/tags, check stats, discover and submit to groups, read and post comments, and keep local notes — all through the Model Context Protocol.

## Prerequisites

- **Node.js 18+**
- **Flickr API key** (free at flickr.com/services/apps/create/)
- An MCP-compatible client (Claude Desktop, Claude Code, etc.)

## Setup

### 1. Install and build

```bash
git clone https://github.com/soctib/flickr-mcp-server.git
cd flickr-mcp-server
npm install
npm run build
```

### 2. Get Flickr API credentials

1. Go to https://www.flickr.com/services/apps/create/
2. Create a new app to get your **API Key** (consumer key) and **Secret** (consumer secret)

### 3. Authorize with Flickr

```bash
npm run setup-auth
```

This will:
- Prompt for your API key and secret (if not already in `.env`)
- Open a browser window for you to authorize the app on Flickr
- Save OAuth tokens to `.env` automatically

Flickr OAuth tokens don't expire, so you only need to do this once.

### 4. Configure your MCP client

Add to your Claude Desktop config:

**macOS:** `~/Library/Application Support/Claude/claude_desktop_config.json`
**Windows:** `%APPDATA%\Claude\claude_desktop_config.json`

```json
{
  "mcpServers": {
    "flickr": {
      "command": "node",
      "args": ["/absolute/path/to/flickr-mcp-server/dist/index.js"],
      "env": {
        "FLICKR_CONSUMER_KEY": "your_key",
        "FLICKR_CONSUMER_SECRET": "your_secret",
        "FLICKR_OAUTH_TOKEN": "your_token",
        "FLICKR_OAUTH_TOKEN_SECRET": "your_token_secret"
      }
    }
  }
}
```

Alternatively, leave credentials in the `.env` file and omit the `env` block.

## Available Tools

### Photos

| Tool | Description |
|------|-------------|
| `flickr_get_recent_photos` | List your recent uploads with metadata. Filter by visibility (public, private, friends, family). |
| `flickr_view_photo` | Fetch a photo's image and full metadata (title, description, tags, dates, views, faves, comments, Flickr URL). |
| `flickr_view_thumbs` | View multiple photos as 150px square thumbnails for quick browsing. Pass up to 20 photo IDs. |
| `flickr_set_metadata` | Update a photo's title and/or description. |
| `flickr_set_tags` | Replace all tags on a photo. Multi-word tags must be quoted. |

### Albums

| Tool | Description |
|------|-------------|
| `flickr_list_albums` | List your albums (or another user's public albums) with photo counts and visibility labels. |
| `flickr_get_album` | Get photos in a specific album with full metadata. |

### Groups

| Tool | Description |
|------|-------------|
| `flickr_list_groups` | List groups you're a member of, with submission limits. |
| `flickr_search_groups` | Search Flickr for groups by topic. |
| `flickr_get_group_recents` | Browse recent photos in a group's pool to evaluate activity and fit. |
| `flickr_add_to_group` | Submit a photo to a group pool. Blocks private photos from being submitted. |
| `flickr_remove_from_group` | Remove a photo from a group pool. |

### Stats & Comments

| Tool | Description |
|------|-------------|
| `flickr_get_stats` | View your most popular photos by views/comments/favorites, or daily stats for a specific photo (last 28 days). |
| `flickr_get_comments` | Read all comments on a photo. |
| `flickr_add_comment` | Post a comment on any photo. |

### Local Notes

Notes are stored in a local SQLite database (`notes.db`) and never sent to Flickr. Use them for reminders, ideas, group submission plans, or any personal annotations.

| Tool | Description |
|------|-------------|
| `flickr_add_note` | Add a note to a photo, album, or group. |
| `flickr_get_notes` | Get all notes for a specific photo, album, or group. |
| `flickr_delete_note` | Delete a note by ID. |
| `flickr_search_notes` | Search all notes by text content. |

## Troubleshooting

- **"OAuth signature invalid"** — Re-run `npm run setup-auth` to refresh tokens.
- **"Authentication failed"** — Check that all 4 credentials in `.env` are correct.
- **Image not displaying** — The server caps images at ~700KB. Very large photos fall back to text-only with a Flickr URL.
- **Stats returning empty** — `photo_daily` mode only covers the last 28 days (Flickr limitation). Use `popular` mode for all-time totals.
- **"Not a member" when adding to group** — You must join the group on Flickr's website first.
- **`better-sqlite3` version mismatch** — If the server crashes on startup with a `NODE_MODULE_VERSION` error, run `npm rebuild better-sqlite3` using the same Node version that runs the server.

## Development

```bash
npm run build          # Compile TypeScript
npm start              # Run the server (stdio)
npm run setup-auth     # Re-run OAuth setup
```

Test with MCP Inspector:

```bash
npx @modelcontextprotocol/inspector node dist/index.js
```

## Disclaimer

This project was vibecoded with Claude. It works, it's tested, but set your expectations accordingly.

## License

MIT
