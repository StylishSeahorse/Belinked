import { z } from "zod";

const safeUrl = z
  .string()
  .trim()
  .url()
  .refine((value) => ["http:", "https:", "mailto:", "tel:"].includes(new URL(value).protocol), {
    message: "URL must use http, https, mailto, or tel"
  });

export const optionalSafeUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(safeUrl.optional());

const localUploadPath = z
  .string()
  .trim()
  .regex(/^\/uploads\/[a-z0-9-_]+\/[a-z0-9._-]+$/i, "Local uploads must live under /uploads");

export const optionalMediaUrl = z
  .string()
  .trim()
  .optional()
  .transform((value) => (value ? value : undefined))
  .pipe(z.union([safeUrl, localUploadPath]).optional());

export const slugSchema = z
  .string()
  .min(2)
  .max(48)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/i, "Use letters, numbers, and dashes");

export const profileSchema = z.object({
  slug: slugSchema,
  displayName: z.string().trim().min(1).max(80),
  username: z.string().trim().min(1).max(80),
  bio: z.string().trim().max(280),
  badge: z.string().trim().max(60).optional(),
  isPublished: z.boolean(),
  avatarUrl: optionalMediaUrl,
  logoUrl: optionalMediaUrl,
  seoTitle: z.string().trim().max(100).optional(),
  seoDescription: z.string().trim().max(180).optional(),
  ogImageUrl: optionalMediaUrl,
  cookieNoticeEnabled: z.boolean(),
  priorityRedirectUrl: optionalSafeUrl,
  priorityRedirectOn: z.boolean()
});

export const blockSchema = z.object({
  type: z.enum([
    "LINK",
    "HEADER",
    "TEXT",
    "SEPARATOR",
    "VIDEO",
    "MUSIC",
    "PODCAST",
    "NEWSLETTER",
    "CALENDAR",
    "CONTACT",
    "EMBED",
    "PRODUCT",
    "SUBSCRIBER_FORM"
  ]),
  title: z.string().trim().min(1).max(120),
  description: z.string().trim().max(400).optional(),
  url: optionalSafeUrl,
  imageUrl: optionalMediaUrl,
  icon: z.string().trim().max(40).optional(),
  tags: z.string().trim().max(160).optional(),
  internalNote: z.string().trim().max(400).optional(),
  featured: z.boolean(),
  animation: z.string().trim().max(40).optional(),
  utmSource: z.string().trim().max(80).optional(),
  utmMedium: z.string().trim().max(80).optional(),
  utmCampaign: z.string().trim().max(80).optional(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional(),
  status: z.enum(["ACTIVE", "HIDDEN", "ARCHIVED"]),
  position: z.coerce.number().int().min(0).max(9999),
  metadata: z.string().trim().default("{}")
});

export const shortLinkSchema = z.object({
  code: z
    .string()
    .trim()
    .min(2)
    .max(40)
    .regex(/^[a-zA-Z0-9_-]+$/),
  destination: safeUrl,
  description: z.string().trim().max(160).optional(),
  isActive: z.boolean(),
  startsAt: z.string().optional(),
  endsAt: z.string().optional()
});

export function assertSafeRedirect(url: string): string {
  const parsed = safeUrl.parse(url);
  return parsed;
}
