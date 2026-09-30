type MetaSettings = {
  enabled?: unknown;
  facebookAccessToken?: unknown;
  facebookPageId?: unknown;
  graphVersion?: unknown;
  instagramAccessToken?: unknown;
  instagramUserId?: unknown;
};

export type MetaIntegrationData = {
  facebook?: {
    followers: number | null;
    name: string;
    url?: string;
  };
  instagram?: {
    followers: number | null;
    latestPost?: {
      caption?: string;
      mediaType?: string;
      mediaUrl?: string;
      permalink?: string;
      thumbnailUrl?: string;
      timestamp?: string;
    };
    username: string;
  };
  updatedAt: string;
};

type MetaConfig = {
  enabled: boolean;
  facebookAccessToken: string;
  facebookPageId: string;
  graphVersion: string;
  instagramAccessToken: string;
  instagramUserId: string;
};

function text(value: unknown) {
  return typeof value === "string" || typeof value === "number" ? String(value).trim() : "";
}

function bool(value: unknown) {
  if (typeof value === "boolean") return value;
  return ["1", "true", "yes", "on"].includes(text(value).toLowerCase());
}

export function metaConfigFromPlatform(platform: Record<string, unknown>): MetaConfig {
  const meta = (platform.meta || {}) as MetaSettings;
  return {
    enabled: bool(meta.enabled) || bool(process.env.META_INTEGRATION_ENABLED),
    facebookAccessToken: text(meta.facebookAccessToken) || text(process.env.META_FACEBOOK_ACCESS_TOKEN),
    facebookPageId: text(meta.facebookPageId) || text(process.env.META_FACEBOOK_PAGE_ID),
    graphVersion: text(meta.graphVersion) || text(process.env.META_GRAPH_VERSION) || "v23.0",
    instagramAccessToken: text(meta.instagramAccessToken) || text(process.env.META_INSTAGRAM_ACCESS_TOKEN),
    instagramUserId: text(meta.instagramUserId) || text(process.env.META_INSTAGRAM_USER_ID)
  };
}

function graphUrl(config: MetaConfig, node: string, fields: string, token: string) {
  const url = new URL(`https://graph.facebook.com/${config.graphVersion}/${encodeURI(node)}`);
  url.searchParams.set("fields", fields);
  url.searchParams.set("access_token", token);
  return url;
}

async function graphGet<T>(url: URL): Promise<T | null> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 4500);
  try {
    const response = await fetch(url, { cache: "no-store", signal: controller.signal });
    if (!response.ok) return null;
    return (await response.json()) as T;
  } catch {
    return null;
  } finally {
    clearTimeout(timeout);
  }
}

function httpsUrl(value?: string) {
  if (!value) return undefined;
  try {
    return new URL(value).protocol === "https:" ? value : undefined;
  } catch {
    return undefined;
  }
}

// Public page views must not wait on the Graph API every time: cache results in memory.
const CACHE_TTL_MS = 15 * 60 * 1000;
const FAILURE_TTL_MS = 2 * 60 * 1000;
let cache: { key: string; expires: number; value: MetaIntegrationData | null } | null = null;

export function clearMetaIntegrationCache() {
  cache = null;
}

export async function fetchMetaIntegrationData(platform: Record<string, unknown>): Promise<MetaIntegrationData | null> {
  const config = metaConfigFromPlatform(platform);
  if (!config.enabled) return null;
  const key = JSON.stringify(config);
  if (cache && cache.key === key && cache.expires > Date.now()) return cache.value;
  const value = await loadMetaIntegrationData(config);
  cache = { key, value, expires: Date.now() + (value ? CACHE_TTL_MS : FAILURE_TTL_MS) };
  return value;
}

async function loadMetaIntegrationData(config: MetaConfig): Promise<MetaIntegrationData | null> {
  if (!/^v\d+\.\d+$/.test(config.graphVersion)) return null;

  const [instagramProfile, instagramMedia, facebookPage] = await Promise.all([
    config.instagramUserId && config.instagramAccessToken
      ? graphGet<{ followers_count?: number; username?: string }>(
          graphUrl(config, config.instagramUserId, "username,followers_count", config.instagramAccessToken)
        )
      : null,
    config.instagramUserId && config.instagramAccessToken
      ? graphGet<{
          data?: Array<{
            caption?: string;
            media_type?: string;
            media_url?: string;
            permalink?: string;
            thumbnail_url?: string;
            timestamp?: string;
          }>;
        }>(graphUrl(config, `${config.instagramUserId}/media`, "caption,media_type,media_url,permalink,thumbnail_url,timestamp", config.instagramAccessToken))
      : null,
    config.facebookPageId && config.facebookAccessToken
      ? graphGet<{ fan_count?: number; followers_count?: number; link?: string; name?: string }>(
          graphUrl(config, config.facebookPageId, "name,followers_count,fan_count,link", config.facebookAccessToken)
        )
      : null
  ]);

  const latest = instagramMedia?.data?.[0];
  const instagram = instagramProfile
    ? {
        followers: typeof instagramProfile.followers_count === "number" ? instagramProfile.followers_count : null,
        latestPost: latest
          ? {
              caption: latest.caption,
              mediaType: latest.media_type,
              mediaUrl: httpsUrl(latest.media_url),
              permalink: httpsUrl(latest.permalink),
              thumbnailUrl: httpsUrl(latest.thumbnail_url),
              timestamp: latest.timestamp
            }
          : undefined,
        username: instagramProfile.username || "Instagram"
      }
    : undefined;

  const facebook = facebookPage
    ? {
        followers:
          typeof facebookPage.followers_count === "number"
            ? facebookPage.followers_count
            : typeof facebookPage.fan_count === "number"
              ? facebookPage.fan_count
              : null,
        name: facebookPage.name || "Facebook",
        url: httpsUrl(facebookPage.link)
      }
    : undefined;

  if (!instagram && !facebook) return null;
  return { facebook, instagram, updatedAt: new Date().toISOString() };
}
