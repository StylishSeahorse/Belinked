"use client";

import type { Block, Profile, SocialIcon, Theme } from "@prisma/client";
import { CalendarDays, Code2, ExternalLink, Mail, Music, Phone, Play, Radio, ShoppingBag } from "lucide-react";
import type { ReactNode } from "react";
import { useEffect } from "react";
import { isBlockVisible } from "@/lib/blocks";
import { parseBlockMetadata, resolveEmbedUrl } from "@/lib/block-metadata";
import type { MetaIntegrationData } from "@/lib/meta-integration";
import type { SocialPlacement } from "@/lib/socials";
import { SocialGlyph } from "@/lib/socials";
import { parseTheme } from "@/lib/themes";
import { safeHref } from "@/lib/validation";

function iconFor(type: string) {
  if (type === "VIDEO") return <Play size={18} />;
  if (type === "MUSIC") return <Music size={18} />;
  if (type === "PODCAST") return <Radio size={18} />;
  if (type === "CALENDAR") return <CalendarDays size={18} />;
  if (type === "PRODUCT") return <ShoppingBag size={18} />;
  if (type === "CONTACT") return <Phone size={18} />;
  if (type === "EMBED") return <Code2 size={18} />;
  if (type === "SUBSCRIBER_FORM" || type === "NEWSLETTER") return <Mail size={18} />;
  return <ExternalLink size={18} />;
}

function isVideoMedia(url?: string | null) {
  return Boolean(url && /\.(mp4|webm|ogv|ogg|mov)(\?|#|$)/i.test(url));
}

function isImageMedia(url?: string | null) {
  return Boolean(url && !isVideoMedia(url));
}

function hrefForBlock(block: Block) {
  return block.url ? `/api/click/${block.id}` : undefined;
}

function cardStyle(settings: ReturnType<typeof parseTheme>) {
  return {
    background: settings.buttonBackground,
    color: settings.buttonForeground,
    borderColor: settings.buttonBorder,
    borderWidth: settings.buttonBorderWidth,
    borderRadius: settings.radius,
    boxShadow: settings.shadow
  } as const;
}

function actionLabel(block: Block, fallback: string) {
  const metadata = parseBlockMetadata(block.metadata);
  return metadata.buttonLabel || fallback;
}

function BlockAction({
  block,
  label,
  className
}: {
  block: Block;
  label: string;
  className?: string;
}) {
  const href = hrefForBlock(block);
  if (!href) return null;
  return (
    <a href={href} className={className || "btn-secondary"}>
      {label}
    </a>
  );
}

function GenericLinkBlock({
  block,
  settings
}: {
  block: Block;
  settings: ReturnType<typeof parseTheme>;
}) {
  const href = hrefForBlock(block) || "#";
  if (block.featured) {
    return (
      <a
        href={href}
        className={[
          "grid overflow-hidden rounded-lg border text-center font-bold transition hover:-translate-y-0.5",
          block.animation === "pulse" ? "animate-pulse" : ""
        ].join(" ")}
        style={cardStyle(settings)}
      >
        {isVideoMedia(block.imageUrl) ? (
          <video src={block.imageUrl || ""} className="aspect-[16/9] w-full object-cover" controls playsInline preload="metadata" />
        ) : block.imageUrl ? (
          <img src={block.imageUrl} alt="" className="aspect-[16/9] w-full object-cover" />
        ) : (
          <span className="grid aspect-[16/9] place-items-center">{iconFor(block.type)}</span>
        )}
        <span className="px-4 py-3 text-sm">{block.title}</span>
      </a>
    );
  }

  return (
    <a
      href={href}
      className={[
        "flex min-h-14 items-center gap-3 rounded-lg border p-3 text-left text-sm font-bold transition hover:-translate-y-0.5",
        block.animation === "pulse" ? "animate-pulse" : ""
      ].join(" ")}
      style={cardStyle(settings)}
    >
      {isVideoMedia(block.imageUrl) ? (
        <video src={block.imageUrl || ""} className="h-9 w-9 rounded-md object-cover" muted playsInline preload="metadata" />
      ) : block.imageUrl ? (
        <img src={block.imageUrl} alt="" className="h-9 w-9 rounded-md object-cover" />
      ) : (
        iconFor(block.type)
      )}
      <span className="flex-1">{block.title}</span>
    </a>
  );
}

function RichCard({
  block,
  settings,
  icon,
  children
}: {
  block: Block;
  settings: ReturnType<typeof parseTheme>;
  icon: ReactNode;
  children?: ReactNode;
}) {
  return (
    <article className="col-span-full grid overflow-hidden rounded-lg border" style={cardStyle(settings)}>
      {isVideoMedia(block.imageUrl) ? (
        <video src={block.imageUrl || ""} className="aspect-[16/9] w-full object-cover" controls playsInline preload="metadata" />
      ) : isImageMedia(block.imageUrl) ? (
        <img src={block.imageUrl || ""} alt="" className="aspect-[16/9] w-full object-cover" />
      ) : null}
      <div className="grid gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="mt-1 shrink-0">{icon}</span>
          <div className="min-w-0">
            <strong className="block text-base">{block.title}</strong>
            {block.description ? <p className="mt-1 text-sm opacity-80">{block.description}</p> : null}
          </div>
        </div>
        {children}
      </div>
    </article>
  );
}

function renderInteractiveBlock(block: Block, settings: ReturnType<typeof parseTheme>) {
  const metadata = parseBlockMetadata(block.metadata);
  const embedUrl = resolveEmbedUrl(metadata.embedUrl || block.url);

  if (block.type === "VIDEO") {
    return (
      <RichCard key={block.id} block={block} settings={settings} icon={iconFor(block.type)}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={block.title}
            className="aspect-video w-full rounded-md border border-black/10 bg-black/10"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : null}
        <BlockAction block={block} label={actionLabel(block, "Watch")} />
      </RichCard>
    );
  }

  if (block.type === "MUSIC" || block.type === "PODCAST") {
    return (
      <RichCard key={block.id} block={block} settings={settings} icon={iconFor(block.type)}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={block.title}
            className="h-40 w-full rounded-md border border-black/10 bg-white/60"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture"
          />
        ) : null}
        <BlockAction block={block} label={actionLabel(block, block.type === "MUSIC" ? "Listen" : "Play episode")} />
      </RichCard>
    );
  }

  if (block.type === "EMBED") {
    return (
      <RichCard key={block.id} block={block} settings={settings} icon={iconFor(block.type)}>
        {embedUrl ? (
          <iframe
            src={embedUrl}
            title={block.title}
            className="h-80 w-full rounded-md border border-black/10 bg-white/60"
            loading="lazy"
            allow="autoplay; clipboard-write; encrypted-media; picture-in-picture; fullscreen"
            allowFullScreen
          />
        ) : (
          <p className="text-sm opacity-80">Add a supported embed URL to the main URL field or metadata.</p>
        )}
        {metadata.caption ? <p className="text-xs opacity-70">{metadata.caption}</p> : null}
      </RichCard>
    );
  }

  if (block.type === "PRODUCT") {
    return (
      <RichCard key={block.id} block={block} settings={settings} icon={iconFor(block.type)}>
        {metadata.price ? <p className="text-lg font-black">{metadata.price}</p> : null}
        <BlockAction block={block} label={actionLabel(block, "Shop now")} />
      </RichCard>
    );
  }

  if (block.type === "NEWSLETTER" || block.type === "CALENDAR" || block.type === "CONTACT") {
    return (
      <RichCard key={block.id} block={block} settings={settings} icon={iconFor(block.type)}>
        <div className="flex flex-wrap gap-2">
          <BlockAction
            block={block}
            label={actionLabel(
              block,
              block.type === "NEWSLETTER" ? "Subscribe" : block.type === "CALENDAR" ? "Book now" : "Get in touch"
            )}
          />
          {safeHref(metadata.secondaryUrl) ? (
            <a href={safeHref(metadata.secondaryUrl)} className="btn-secondary">
              {metadata.secondaryLabel || "More"}
            </a>
          ) : null}
        </div>
      </RichCard>
    );
  }

  if (block.type === "SUBSCRIBER_FORM") {
    return (
      <form
        key={block.id}
        action="/api/track"
        method="post"
        className="col-span-full grid gap-3 rounded-lg border border-black/10 bg-white/65 p-4"
        style={{ borderRadius: settings.radius, boxShadow: settings.shadow }}
      >
        <input type="hidden" name="subscriberBlockId" value={block.id} />
        <div className="grid gap-1">
          <strong>{block.title}</strong>
          {block.description ? <p className="text-sm opacity-80">{block.description}</p> : null}
        </div>
        <input className="input" name="email" type="email" placeholder={metadata.inputPlaceholder || "Email address"} required />
        <button className="btn" style={{ background: settings.buttonBackground, color: settings.buttonForeground }}>
          {metadata.submitLabel || "Subscribe"}
        </button>
      </form>
    );
  }

  return <GenericLinkBlock key={block.id} block={block} settings={settings} />;
}

function isInlineCandidate(block: Block) {
  return block.type === "LINK" && !block.featured;
}

function inlineGroupSize(block: Block) {
  const metadata = parseBlockMetadata(block.metadata) as { inlineGroupSize?: unknown };
  const size = Number(metadata.inlineGroupSize || 1);
  return size === 2 || size === 3 ? size : 1;
}

function inlineGridClass(count: number) {
  if (count <= 1) return "col-span-full grid gap-3";
  if (count === 2) return "col-span-full grid grid-cols-2 gap-3";
  return "col-span-full grid grid-cols-2 gap-3 sm:grid-cols-3";
}

function renderBlock(block: Block, settings: ReturnType<typeof parseTheme>) {
  if (block.type === "HEADER") return <h2 key={block.id} className="mt-3 text-lg font-black">{block.title}</h2>;
  if (block.type === "TEXT") return <p key={block.id} className="text-sm leading-6" style={{ color: settings.muted }}>{block.description || block.title}</p>;
  if (block.type === "SEPARATOR") return <hr key={block.id} className="border-black/15" />;
  return renderInteractiveBlock(block, settings);
}

function renderGroupedBlocks(blocks: Block[], settings: ReturnType<typeof parseTheme>) {
  const rendered = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const block = blocks[index];
    const requestedSize = isInlineCandidate(block) ? inlineGroupSize(block) : 1;
    if (requestedSize > 1) {
      const group = [block];
      for (let offset = 1; offset < requestedSize; offset += 1) {
        const next = blocks[index + offset];
        if (!next || !isInlineCandidate(next)) break;
        group.push(next);
      }
      if (group.length > 1) {
        rendered.push(
          <div key={group.map((item) => item.id).join("-")} className={inlineGridClass(group.length)}>
            {group.map((item) => (
              <GenericLinkBlock key={item.id} block={item} settings={settings} />
            ))}
          </div>
        );
        index += group.length - 1;
        continue;
      }
    }
    rendered.push(renderBlock(block, settings));
  }
  return rendered;
}

export function PublicProfile({
  profile,
  blocks,
  metaIntegration,
  socials,
  socialPlacement,
  theme
}: {
  profile: Profile;
  blocks: Block[];
  metaIntegration?: MetaIntegrationData | null;
  socials: SocialIcon[];
  socialPlacement: SocialPlacement;
  theme: Theme | null;
}) {
  const settings = parseTheme(theme?.settings);

  useEffect(() => {
    navigator.sendBeacon?.("/api/track", JSON.stringify({ profileId: profile.id, path: location.pathname }));
  }, [profile.id]);

  const visible = blocks.filter((block) => isBlockVisible(block));
  const socialRow = socials.length ? (
    <div className="flex flex-wrap items-center justify-center gap-4">
      {socials.map((social) => (
        <a
          key={social.id}
          href={social.url}
          aria-label={social.label}
          title={social.label}
          className="grid h-11 w-11 place-items-center rounded-full text-current transition hover:-translate-y-0.5 hover:bg-black/5"
          rel="noopener noreferrer"
          target="_blank"
        >
          <SocialGlyph social={social} className="h-6 w-6" />
        </a>
      ))}
    </div>
  ) : null;

  return (
    <main
      className="min-h-screen px-4 py-8"
      style={{
        background: settings.background,
        backgroundImage: settings.backgroundImage ? `url(${settings.backgroundImage})` : undefined,
        backgroundSize: settings.backgroundImage ? "cover" : undefined,
        backgroundPosition: settings.backgroundImage ? "center" : undefined,
        color: settings.foreground,
        fontFamily: settings.fontFamily
      }}
    >
      <section className="mx-auto grid w-full max-w-xl gap-5">
        <header className="grid justify-items-center gap-3 text-center">
          {profile.logoUrl ? <img src={profile.logoUrl} alt="" className="h-10 max-w-40 object-contain" /> : null}
          {profile.avatarUrl ? (
            <img src={profile.avatarUrl} alt="" className="h-24 w-24 rounded-full object-cover shadow-soft" />
          ) : (
            <div className="grid h-24 w-24 place-items-center rounded-full bg-black text-3xl font-black text-white">
              {profile.displayName.slice(0, 1)}
            </div>
          )}
          <div>
            <h1 className="text-3xl font-black">{profile.displayName}</h1>
            <p className="text-sm" style={{ color: settings.muted }}>
              @{profile.username}
            </p>
          </div>
          {profile.badge ? (
            <span className="rounded-full px-3 py-1 text-xs font-bold" style={{ background: settings.accent, color: "#fff" }}>
              {profile.badge}
            </span>
          ) : null}
          <p className="max-w-md text-sm leading-6" style={{ color: settings.muted }}>
            {profile.bio}
          </p>
        </header>

        {socialPlacement === "top" ? socialRow : null}

        {metaIntegration ? (
          <section className="grid gap-3 rounded-lg border border-black/10 bg-white/65 p-4" style={{ borderRadius: settings.radius, boxShadow: settings.shadow }}>
            <div className="grid grid-cols-2 gap-3 text-center">
              {metaIntegration.instagram ? (
                <a href={`https://instagram.com/${metaIntegration.instagram.username}`} target="_blank" rel="noopener noreferrer" className="rounded-md border border-black/10 p-3">
                  <span className="block text-xs uppercase tracking-wide opacity-65">Instagram</span>
                  <strong className="block text-xl">{metaIntegration.instagram.followers?.toLocaleString() || "-"}</strong>
                  <span className="text-xs opacity-70">@{metaIntegration.instagram.username}</span>
                </a>
              ) : null}
              {metaIntegration.facebook ? (
                <a href={metaIntegration.facebook.url || "#"} target="_blank" rel="noopener noreferrer" className="rounded-md border border-black/10 p-3">
                  <span className="block text-xs uppercase tracking-wide opacity-65">Facebook</span>
                  <strong className="block text-xl">{metaIntegration.facebook.followers?.toLocaleString() || "-"}</strong>
                  <span className="text-xs opacity-70">{metaIntegration.facebook.name}</span>
                </a>
              ) : null}
            </div>
            {metaIntegration.instagram?.latestPost ? (
              <a href={metaIntegration.instagram.latestPost.permalink || "#"} target="_blank" rel="noopener noreferrer" className="grid overflow-hidden rounded-md border border-black/10">
                {metaIntegration.instagram.latestPost.mediaUrl || metaIntegration.instagram.latestPost.thumbnailUrl ? (
                  <img
                    src={metaIntegration.instagram.latestPost.thumbnailUrl || metaIntegration.instagram.latestPost.mediaUrl}
                    alt=""
                    className="aspect-square w-full object-cover"
                  />
                ) : null}
                {metaIntegration.instagram.latestPost.caption ? (
                  <span className="line-clamp-3 p-3 text-sm opacity-80">{metaIntegration.instagram.latestPost.caption}</span>
                ) : null}
              </a>
            ) : null}
          </section>
        ) : null}

        <div className="grid gap-3">
          {renderGroupedBlocks(visible, settings)}
        </div>
        {socialPlacement === "bottom" ? socialRow : null}
        {profile.cookieNoticeEnabled ? <p className="text-center text-xs opacity-70">This page uses privacy-conscious first-party analytics.</p> : null}
      </section>
    </main>
  );
}
