import Link from "next/link";
import { CalendarDays, Code2, ExternalLink, Mail, Music, Phone, Play, Radio, ShoppingBag } from "lucide-react";
import type { CSSProperties, ReactNode } from "react";
import type { MetaIntegrationData } from "@/lib/meta-integration";
import type { PublicBlock, PublicProfileData, PublicSocial } from "@/lib/public-data";
import type { SocialPlacement } from "@/lib/socials";
import { SocialGlyph } from "@/lib/socials";
import type { ThemeSettings } from "@/lib/themes";
import { ViewBeacon } from "./ViewBeacon";

/*
 * Server component: the public page ships no React code for rendering, only the
 * small ViewBeacon client island for analytics.
 */

function iconFor(type: string) {
  const props = { size: 18, "aria-hidden": true } as const;
  if (type === "VIDEO") return <Play {...props} />;
  if (type === "MUSIC") return <Music {...props} />;
  if (type === "PODCAST") return <Radio {...props} />;
  if (type === "CALENDAR") return <CalendarDays {...props} />;
  if (type === "PRODUCT") return <ShoppingBag {...props} />;
  if (type === "CONTACT") return <Phone {...props} />;
  if (type === "EMBED") return <Code2 {...props} />;
  if (type === "SUBSCRIBER_FORM" || type === "NEWSLETTER") return <Mail {...props} />;
  return <ExternalLink {...props} />;
}

function isVideoMedia(url?: string | null) {
  return Boolean(url && /\.(mp4|webm|ogv|ogg|mov)(\?|#|$)/i.test(url));
}

function cardStyle(settings: ThemeSettings): CSSProperties {
  const fill = settings.buttonFill || "solid";
  return {
    background: fill === "outline" ? "transparent" : settings.buttonBackground,
    color: fill === "outline" ? settings.foreground : settings.buttonForeground,
    borderColor: settings.buttonBorder,
    borderWidth: settings.buttonBorderWidth,
    borderStyle: "solid",
    borderRadius: settings.radius,
    boxShadow: fill === "outline" ? "none" : settings.shadow,
    backdropFilter: fill === "soft" ? "blur(10px)" : undefined,
    ...(fill === "soft" ? { background: `color-mix(in srgb, ${settings.buttonBackground} 22%, transparent)`, color: settings.foreground } : {})
  };
}

function Media({ url, className, eager = false }: { url: string; className: string; eager?: boolean }) {
  if (isVideoMedia(url)) return <video src={url} className={className} controls playsInline preload="metadata" />;
  // eslint-disable-next-line @next/next/no-img-element -- local/remote media, dimensions are unknown
  return <img src={url} alt="" className={className} loading={eager ? "eager" : "lazy"} decoding="async" />;
}

function linkClass(block: PublicBlock, base: string) {
  return ["bl-card", base, block.animation === "pulse" ? "bl-pulse" : ""].join(" ");
}

function GenericLinkBlock({ block, settings }: { block: PublicBlock; settings: ThemeSettings }) {
  if (!block.href) {
    return (
      <div className={linkClass(block, "flex min-h-14 items-center gap-3 p-3 text-sm font-bold")} style={cardStyle(settings)}>
        <span className="flex-1">{block.title}</span>
      </div>
    );
  }
  if (block.featured) {
    return (
      <a href={block.href} className={linkClass(block, "grid overflow-hidden text-center font-bold")} style={cardStyle(settings)}>
        {/* Featured without an image is simply a larger, emphasised card. */}
        {block.imageUrl ? <Media url={block.imageUrl} className="aspect-[16/9] w-full object-cover" /> : null}
        <span className={`grid gap-1 px-4 ${block.imageUrl ? "py-3" : "py-6"}`}>
          <span className="text-base">{block.title}</span>
          {block.description ? <span className="text-xs font-medium opacity-80">{block.description}</span> : null}
        </span>
      </a>
    );
  }
  return (
    <a href={block.href} className={linkClass(block, "flex min-h-14 items-center gap-3 p-3 text-left text-sm font-bold")} style={cardStyle(settings)}>
      {block.imageUrl && !isVideoMedia(block.imageUrl) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={block.imageUrl} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" loading="lazy" decoding="async" />
      ) : (
        <span className="grid h-10 w-10 shrink-0 place-items-center">{iconFor(block.type)}</span>
      )}
      <span className="min-w-0 flex-1 break-words text-center">{block.title}</span>
      <span className="h-10 w-10 shrink-0" aria-hidden="true" />
    </a>
  );
}

function RichCard({ block, settings, children }: { block: PublicBlock; settings: ThemeSettings; children?: ReactNode }) {
  return (
    <article className="bl-card-static grid overflow-hidden" style={cardStyle(settings)}>
      {block.imageUrl && !block.embed ? <Media url={block.imageUrl} className="aspect-[16/9] w-full object-cover" /> : null}
      <div className="grid gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 shrink-0">{iconFor(block.type)}</span>
          <div className="min-w-0">
            <h3 className="text-base font-bold">{block.title}</h3>
            {block.description ? <p className="mt-1 text-sm opacity-80">{block.description}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}

function ActionLink({ href, label }: { href: string | null | undefined; label: string }) {
  if (!href) return null;
  return (
    <a href={href} className="bl-action">
      {label}
    </a>
  );
}

function Embed({ block }: { block: PublicBlock }) {
  if (!block.embed) return null;
  const height = block.embed.kind === "video" ? "aspect-video" : block.embed.kind === "tall" ? "h-[352px]" : "h-[166px]";
  return (
    <iframe
      src={block.embed.src}
      title={`${block.embed.provider}: ${block.title}`}
      className={`${height} w-full rounded-md border-0 bg-black/10`}
      loading="lazy"
      referrerPolicy="strict-origin-when-cross-origin"
      sandbox="allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox allow-presentation"
      allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
      allowFullScreen
    />
  );
}

function renderBlock(block: PublicBlock, settings: ThemeSettings, subscribed: boolean, subscribeError?: string) {
  const { meta } = block;
  switch (block.type) {
    case "HEADER":
      return <h2 key={block.id} className="mt-3 text-center text-lg font-black">{block.title}</h2>;
    case "TEXT":
      return (
        <div key={block.id} className="grid gap-1 text-center">
          {block.description && block.title ? <h3 className="font-bold">{block.title}</h3> : null}
          <p className="whitespace-pre-line text-sm leading-6" style={{ color: settings.muted }}>{block.description || block.title}</p>
        </div>
      );
    case "IMAGE": {
      if (!block.imageUrl) return null;
      const image = (
        <figure className="grid gap-2">
          <Media url={block.imageUrl} className="w-full object-cover" />
          {block.title && block.title !== "Image" ? <figcaption className="px-1 text-center text-sm opacity-80">{block.title}</figcaption> : null}
        </figure>
      );
      return block.href ? (
        <a key={block.id} href={block.href} className="bl-card block overflow-hidden" style={{ borderRadius: settings.radius }} aria-label={block.title}>
          {image}
        </a>
      ) : (
        <div key={block.id} className="overflow-hidden" style={{ borderRadius: settings.radius }}>
          {image}
        </div>
      );
    }
    case "SEPARATOR":
      return <hr key={block.id} className="border-current opacity-20" />;
    case "VIDEO":
    case "MUSIC":
    case "PODCAST":
      return (
        <RichCard key={block.id} block={block} settings={settings}>
          <Embed block={block} />
          <ActionLink href={block.href} label={meta.buttonLabel || (block.type === "VIDEO" ? "Watch" : block.type === "MUSIC" ? "Listen" : "Play episode")} />
        </RichCard>
      );
    case "EMBED":
      if (!block.embed) return null;
      return (
        <RichCard key={block.id} block={block} settings={settings}>
          <Embed block={block} />
          {meta.caption ? <p className="text-xs opacity-70">{meta.caption}</p> : null}
        </RichCard>
      );
    case "PRODUCT":
      return (
        <RichCard key={block.id} block={block} settings={settings}>
          {meta.price ? <p className="text-lg font-black">{meta.price}</p> : null}
          <ActionLink href={block.href} label={meta.buttonLabel || "Shop now"} />
        </RichCard>
      );
    case "NEWSLETTER":
    case "CALENDAR":
    case "CONTACT":
      return (
        <RichCard key={block.id} block={block} settings={settings}>
          <div className="flex flex-wrap gap-2">
            <ActionLink href={block.href} label={meta.buttonLabel || (block.type === "NEWSLETTER" ? "Subscribe" : block.type === "CALENDAR" ? "Book now" : "Get in touch")} />
            <ActionLink href={meta.secondaryUrl} label={meta.secondaryLabel || "More"} />
          </div>
        </RichCard>
      );
    case "SUBSCRIBER_FORM":
      return (
        <form key={block.id} id={`subscribe-${block.id}`} action="/api/track" method="post" className="bl-card-static grid gap-3 p-4" style={cardStyle(settings)}>
          <input type="hidden" name="subscriberBlockId" value={block.id} />
          {/* Honeypot: real visitors never fill this in. */}
          <input type="text" name="website" tabIndex={-1} autoComplete="off" className="hidden" aria-hidden="true" />
          <div className="grid gap-1">
            <h3 className="font-bold">{block.title}</h3>
            {block.description ? <p className="text-sm opacity-80">{block.description}</p> : null}
          </div>
          {subscribed ? (
            <p role="status" className="rounded-md bg-black/10 p-3 text-sm font-semibold">Thanks, you are subscribed.</p>
          ) : (
            <>
              {subscribeError ? <p role="alert" className="rounded-md bg-red-100 p-3 text-sm font-semibold text-red-900">{subscribeError}</p> : null}
              <label className="grid gap-1 text-sm font-semibold">
                <span className="sr-only">Email address</span>
                <input className="bl-input" name="email" type="email" autoComplete="email" maxLength={254} placeholder={meta.inputPlaceholder || "Email address"} required />
              </label>
              <button className="bl-action">{meta.submitLabel || "Subscribe"}</button>
            </>
          )}
        </form>
      );
    default:
      return <GenericLinkBlock key={block.id} block={block} settings={settings} />;
  }
}

function isInlineCandidate(block: PublicBlock) {
  return block.type === "LINK" && !block.featured;
}

function renderGroupedBlocks(blocks: PublicBlock[], settings: ThemeSettings, subscribed: boolean, subscribeError?: string) {
  const rendered: ReactNode[] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const requestedSize = isInlineCandidate(block) ? block.inlineGroupSize : 1;
    if (requestedSize > 1) {
      const group = [block];
      for (let offset = 1; offset < requestedSize; offset += 1) {
        const next = blocks[index + offset];
        if (!next || !isInlineCandidate(next)) break;
        group.push(next);
      }
      if (group.length > 1) {
        rendered.push(
          <div key={group.map((item) => item.id).join("-")} className={group.length === 2 ? "grid grid-cols-2 gap-3" : "grid grid-cols-2 gap-3 sm:grid-cols-3"}>
            {group.map((item) => (
              <GenericLinkBlock key={item.id} block={item} settings={settings} />
            ))}
          </div>
        );
        index += group.length - 1;
        continue;
      }
    }
    rendered.push(renderBlock(block, settings, subscribed, subscribeError));
  }
  return rendered;
}

const widthClass = { narrow: "max-w-md", normal: "max-w-xl", wide: "max-w-2xl" } as const;
const gapClass = { tight: "gap-2", normal: "gap-3", relaxed: "gap-5" } as const;
const fontClass = { small: "text-[15px]", normal: "text-base", large: "text-[17px]" } as const;
const avatarShapeClass = { circle: "rounded-full", rounded: "rounded-2xl", square: "rounded-none" } as const;

export function PublicProfile({
  profile,
  blocks,
  metaIntegration,
  socials,
  socialPlacement,
  settings,
  track,
  subscribed = false,
  subscribeError,
  previewNotice,
  footerText
}: {
  profile: PublicProfileData;
  blocks: PublicBlock[];
  metaIntegration?: MetaIntegrationData | null;
  socials: PublicSocial[];
  socialPlacement: SocialPlacement;
  settings: ThemeSettings;
  track: boolean;
  subscribed?: boolean;
  subscribeError?: string;
  previewNotice?: string;
  footerText?: string;
}) {
  const layout = settings.layout;
  const avatarSize = layout === "spotlight" ? "h-32 w-32 text-4xl" : layout === "compact" ? "h-16 w-16 text-2xl" : "h-24 w-24 text-3xl";
  const titleSize = layout === "spotlight" ? "text-4xl" : layout === "compact" ? "text-2xl" : "text-3xl";
  const avatarShape = avatarShapeClass[settings.avatarShape || "circle"];
  const blur = settings.backgroundBlur || 0;
  const overlay = settings.backgroundOverlay || 0;

  const socialRow = socials.length ? (
    <nav aria-label="Social profiles">
      <ul className="flex flex-wrap items-center justify-center gap-2">
        {socials.map((social) => (
          <li key={social.id}>
            <a
              href={social.url}
              aria-label={social.label}
              title={social.label}
              className="bl-social grid h-11 w-11 place-items-center rounded-full"
              rel="me noopener noreferrer"
              target={social.url.startsWith("http") ? "_blank" : undefined}
            >
              <SocialGlyph social={social} className="h-6 w-6" />
            </a>
          </li>
        ))}
      </ul>
    </nav>
  ) : null;

  const pageStyle = {
    "--bl-fg": settings.foreground,
    "--bl-muted": settings.muted,
    "--bl-accent": settings.accent,
    "--bl-btn-bg": settings.buttonBackground,
    "--bl-btn-fg": settings.buttonForeground,
    "--bl-radius": `${settings.radius}px`,
    color: settings.foreground,
    fontFamily: settings.fontFamily
  } as CSSProperties;

  return (
    <div
      className={`bl-page bl-hover-${settings.hoverEffect || "lift"} bl-enter-${settings.entrance || "none"} relative min-h-screen overflow-x-hidden ${fontClass[settings.fontSize || "normal"]}`}
      style={pageStyle}
    >
      <div aria-hidden="true" className="fixed inset-0 -z-10" style={{ background: settings.background }}>
        {settings.backgroundImage ? (
          <div
            className="absolute inset-0 bg-cover bg-center"
            style={{ backgroundImage: `url("${settings.backgroundImage.replace(/["\\\n]/g, "")}")`, filter: blur ? `blur(${blur}px)` : undefined, transform: blur ? "scale(1.05)" : undefined }}
          />
        ) : null}
        {settings.backgroundVideo ? (
          <video
            className="bl-bg-video absolute inset-0 h-full w-full object-cover"
            src={settings.backgroundVideo}
            autoPlay
            muted
            loop
            playsInline
            preload="metadata"
            style={{ filter: blur ? `blur(${blur}px)` : undefined }}
          />
        ) : null}
        {overlay ? <div className="absolute inset-0 bg-black" style={{ opacity: overlay / 100 }} /> : null}
      </div>

      {previewNotice ? (
        <div role="status" className="sticky top-0 z-10 bg-amber-300 px-4 py-2 text-center text-sm font-bold text-black">
          {previewNotice} <Link className="underline" href="/admin">Back to admin</Link>
        </div>
      ) : null}

      <main id="content" className={`mx-auto grid w-full ${widthClass[settings.maxWidth || "normal"]} gap-5 px-4 py-10`}>
        <header className="bl-enter grid justify-items-center gap-3 text-center">
          {profile.logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.logoUrl} alt="" className="h-10 max-w-40 object-contain" />
          ) : null}
          {profile.avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={profile.avatarUrl} alt={profile.displayName} className={`${avatarSize} ${avatarShape} object-cover shadow-soft`} fetchPriority="high" />
          ) : (
            <div aria-hidden="true" className={`${avatarSize} ${avatarShape} grid place-items-center font-black`} style={{ background: settings.accent, color: "#fff" }}>
              {profile.displayName.slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <h1 className={`${titleSize} break-words font-black`}>{profile.displayName}</h1>
            {profile.username ? (
              <p className="text-sm" style={{ color: settings.muted }}>
                @{profile.username}
              </p>
            ) : null}
          </div>
          {profile.badge ? (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: settings.accent, color: "#fff" }}>
              {profile.badge}
            </span>
          ) : null}
          {profile.bio ? (
            <p className="max-w-md whitespace-pre-line text-sm leading-6" style={{ color: settings.muted }}>
              {profile.bio}
            </p>
          ) : null}
        </header>

        {socialPlacement === "top" ? socialRow : null}

        {metaIntegration ? (
          <section aria-label="Social stats" className="bl-card-static grid gap-3 p-4" style={cardStyle(settings)}>
            <div className="grid grid-cols-2 gap-3 text-center">
              {metaIntegration.instagram ? (
                <a href={`https://instagram.com/${encodeURIComponent(metaIntegration.instagram.username)}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-current/10 p-3">
                  <span className="block text-xs uppercase tracking-wide opacity-65">Instagram</span>
                  <strong className="block text-xl">{metaIntegration.instagram.followers?.toLocaleString("en-US") ?? "-"}</strong>
                  <span className="text-xs opacity-70">@{metaIntegration.instagram.username}</span>
                </a>
              ) : null}
              {metaIntegration.facebook ? (
                <a href={metaIntegration.facebook.url || "#"} target="_blank" rel="noopener noreferrer" className="rounded-md border border-current/10 p-3">
                  <span className="block text-xs uppercase tracking-wide opacity-65">Facebook</span>
                  <strong className="block text-xl">{metaIntegration.facebook.followers?.toLocaleString("en-US") ?? "-"}</strong>
                  <span className="text-xs opacity-70">{metaIntegration.facebook.name}</span>
                </a>
              ) : null}
            </div>
            {metaIntegration.instagram?.latestPost?.permalink ? (
              <a href={metaIntegration.instagram.latestPost.permalink} target="_blank" rel="noopener noreferrer" className="grid overflow-hidden rounded-md">
                {metaIntegration.instagram.latestPost.thumbnailUrl || metaIntegration.instagram.latestPost.mediaUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={metaIntegration.instagram.latestPost.thumbnailUrl || metaIntegration.instagram.latestPost.mediaUrl}
                    alt="Latest Instagram post"
                    className="aspect-square w-full object-cover"
                    loading="lazy"
                  />
                ) : null}
                {metaIntegration.instagram.latestPost.caption ? <span className="line-clamp-3 p-3 text-sm opacity-80">{metaIntegration.instagram.latestPost.caption}</span> : null}
              </a>
            ) : null}
          </section>
        ) : null}

        <section aria-label="Links" className={`grid ${gapClass[settings.spacing || "normal"]}`}>
          {blocks.length ? renderGroupedBlocks(blocks, settings, subscribed, subscribeError) : <p className="text-center text-sm opacity-70">Nothing here yet.</p>}
        </section>

        {socialPlacement === "bottom" ? socialRow : null}
        {footerText?.trim() ? <p className="text-center text-xs opacity-70">{footerText}</p> : null}
        {profile.cookieNoticeEnabled ? <p className="text-center text-xs opacity-70">This page uses privacy-conscious first-party analytics. No cookies are set for visitors.</p> : null}
      </main>
      {track ? <ViewBeacon /> : null}
    </div>
  );
}
