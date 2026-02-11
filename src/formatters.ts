import type { FlickrPhoto, FlickrPhotoInfo, FlickrGroup, FlickrComment, FlickrStatsPhoto } from "./types.js";

export function extractContent(value: string | { _content: string } | undefined): string {
  if (!value) return "";
  if (typeof value === "string") return value;
  return value._content ?? "";
}

export function formatPhotoListItem(photo: FlickrPhoto, index: number): string {
  const title = extractContent(photo.title) || "(untitled)";
  const desc = extractContent(photo.description);
  const truncDesc = desc.length > 120 ? desc.slice(0, 120) + "..." : desc;
  const tags = photo.tags || "(none)";
  const taken = photo.datetaken || "unknown";
  const views = photo.views ?? "0";
  const faves = photo.count_faves ?? "0";
  const comments = photo.count_comments ?? "0";

  let out = `**${index + 1}. ${title}** (ID: \`${photo.id}\`)`;
  if (photo.ownername) out += ` by ${photo.ownername}`;
  out += "\n";
  if (truncDesc) out += `   ${truncDesc}\n`;
  out += `   Tags: ${tags}\n`;
  out += `   Taken: ${taken} | Views: ${views} | Faves: ${faves} | Comments: ${comments}`;
  return out;
}

export function formatPhotoMetadata(info: FlickrPhotoInfo): string {
  const title = extractContent(info.title) || "(untitled)";
  const desc = extractContent(info.description) || "(no description)";
  const tags = info.tags.tag.length > 0
    ? info.tags.tag.map((t) => t.raw).join(", ")
    : "(no tags)";
  const flickrUrl = info.urls.url.find((u) => u.type === "photopage")?._content ?? "";

  let out = `## ${title}\n\n`;
  out += `**Photo ID:** \`${info.id}\`\n`;
  out += `**Description:** ${desc}\n\n`;
  out += `**Tags:** ${tags}\n`;
  out += `**Date taken:** ${info.dates.taken}\n`;
  out += `**Date uploaded:** ${new Date(parseInt(info.dates.posted) * 1000).toISOString().split("T")[0]}\n`;
  out += `**Views:** ${info.views}\n`;
  if (flickrUrl) out += `**Flickr URL:** ${flickrUrl}\n`;
  return out;
}

export function formatGroupList(groups: FlickrGroup[]): string {
  if (groups.length === 0) return "You are not a member of any groups.";

  return groups
    .map((g, i) => {
      const name = typeof g.name === "string" ? g.name : extractContent(g.name as any);
      let out = `**${i + 1}. ${name}** (NSID: \`${g.nsid}\`)\n`;
      out += `   Members: ${g.members} | Pool: ${g.pool_count} photos`;
      if (g.throttle?.remaining) {
        out += ` | Remaining submissions: ${g.throttle.remaining}`;
      }
      return out;
    })
    .join("\n\n");
}

export function formatGroupSearchResult(groups: FlickrGroup[]): string {
  if (groups.length === 0) return "No groups found matching that query.";

  return groups
    .map((g, i) => {
      const name = typeof g.name === "string" ? g.name : extractContent(g.name as any);
      const desc = extractContent(g.description);
      const truncDesc = desc.length > 200 ? desc.slice(0, 200) + "..." : desc;
      let out = `**${i + 1}. ${name}** (NSID: \`${g.nsid}\`)\n`;
      out += `   Members: ${g.members} | Pool: ${g.pool_count} photos\n`;
      if (truncDesc) out += `   ${truncDesc}\n`;
      out += `   URL: https://www.flickr.com/groups/${g.nsid}/`;
      return out;
    })
    .join("\n\n");
}

export function formatComments(comments: FlickrComment[]): string {
  if (comments.length === 0) return "No comments on this photo.";

  return comments
    .map((c, i) => {
      const date = new Date(parseInt(c.datecreate) * 1000).toISOString().split("T")[0];
      return `**${i + 1}. ${c.authorname}** (${date}):\n> ${c._content}`;
    })
    .join("\n\n");
}

export function formatStatsTable(photos: FlickrStatsPhoto[]): string {
  if (photos.length === 0) return "No stats data available.";

  let out = "| # | Title | Views | Faves | Comments |\n";
  out += "|---|-------|-------|-------|----------|\n";
  photos.forEach((p, i) => {
    const title = extractContent(p.title) || "(untitled)";
    out += `| ${i + 1} | ${title} (${p.id}) | ${p.views} | ${p.favorites ?? "-"} | ${p.comments ?? "-"} |\n`;
  });
  return out;
}
