import { z } from "zod";

export const GetRecentPhotosInput = z.object({
  count: z
    .number()
    .int()
    .min(1)
    .max(50)
    .default(10)
    .describe("Number of photos to return (1-50)"),
  page: z
    .number()
    .int()
    .min(1)
    .default(1)
    .describe("Page number for pagination"),
});

export const ViewPhotoInput = z.object({
  photo_id: z.string().describe("The Flickr photo ID"),
});

export const SetMetadataInput = z
  .object({
    photo_id: z.string().describe("The Flickr photo ID"),
    title: z.string().optional().describe("New title for the photo"),
    description: z
      .string()
      .optional()
      .describe("New description for the photo (HTML allowed)"),
  })
  .refine((data) => data.title || data.description, {
    message: "At least one of title or description must be provided",
  });

export const SetTagsInput = z.object({
  photo_id: z.string().describe("The Flickr photo ID"),
  tags: z
    .string()
    .describe(
      'Space-separated tags. Multi-word tags must be quoted: "long exposure" night city'
    ),
});

export const GetStatsInput = z
  .object({
    mode: z
      .enum(["popular", "photo_daily"])
      .describe("popular: top photos overall. photo_daily: daily stats for one photo"),
    photo_id: z
      .string()
      .optional()
      .describe("Required for photo_daily mode"),
    date: z
      .string()
      .optional()
      .describe("YYYY-MM-DD format. For photo_daily mode. Flickr keeps 28 days."),
    sort: z
      .enum(["views", "comments", "favorites"])
      .default("views")
      .describe("Sort order for popular mode"),
    count: z
      .number()
      .int()
      .min(1)
      .max(100)
      .default(25)
      .describe("Number of results for popular mode (1-100)"),
  })
  .refine(
    (data) => data.mode !== "photo_daily" || data.photo_id,
    { message: "photo_id is required when mode is photo_daily" }
  );

export const SearchGroupsInput = z.object({
  query: z.string().describe('Search term (e.g. "industrial photography", "black and white")'),
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
});

export const AddToGroupInput = z.object({
  photo_id: z.string().describe("The photo ID to submit"),
  group_id: z
    .string()
    .describe("The group NSID (from flickr_list_groups)"),
});

export const GetCommentsInput = z.object({
  photo_id: z.string().describe("The photo ID to get comments for"),
});
