"use client";

import type { BlockType } from "@prisma/client";
import { blockMetadataExamples, blockTypeHints, blockTypes } from "@/lib/block-types";
import { useState } from "react";
import { DisplayStylePicker } from "./DisplayStylePicker";
import { LinkPreviewFields } from "./LinkPreviewFields";

type BlockTypeFieldsProps = {
  defaultAnimation?: string;
  defaultFeatured?: boolean;
  defaultImageUrl?: string;
  defaultInternalNote?: string;
  defaultMetadata?: string;
  defaultTitle?: string;
  defaultType?: BlockType;
  defaultUrl?: string;
  defaultDescription?: string;
  defaultUtmCampaign?: string;
  defaultUtmMedium?: string;
  defaultUtmSource?: string;
};

function mediaField(copy: { currentMedia?: string; label: string; help: string }) {
  return (
    <label className="field md:col-span-2">
      {copy.label}
      <input className="input" name="mediaFile" type="file" accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm,video/ogg,video/quicktime" />
      {copy.currentMedia ? <span className="text-xs text-black/55">Current media: {copy.currentMedia}</span> : null}
      <span className="text-xs text-black/55">{copy.help}</span>
    </label>
  );
}

const metadataPresets: Record<string, string> = {
  action: '{"buttonLabel":"Open"}',
  embed: '{"embedUrl":"https://www.youtube.com/watch?v=...","caption":"Featured video"}',
  secondary: '{"buttonLabel":"Open","secondaryUrl":"https://example.com","secondaryLabel":"More"}',
  product: '{"price":"$29","buttonLabel":"Shop now"}',
  subscriber: '{"inputPlaceholder":"Your email","submitLabel":"Join"}',
  empty: "{}"
};

export function BlockTypeFields({
  defaultAnimation = "",
  defaultFeatured = false,
  defaultImageUrl = "",
  defaultInternalNote = "",
  defaultMetadata = "{}",
  defaultTitle = "",
  defaultType = "LINK",
  defaultUrl = "",
  defaultDescription = "",
  defaultUtmCampaign = "",
  defaultUtmMedium = "",
  defaultUtmSource = ""
}: BlockTypeFieldsProps) {
  const [type, setType] = useState<BlockType>(defaultType);
  const [metadata, setMetadata] = useState(defaultMetadata);

  return (
    <>
      <label className="field">
        Type
        <select className="input" name="type" value={type} onChange={(event) => setType(event.target.value as BlockType)}>
          {blockTypes.map((blockType) => (
            <option key={blockType} value={blockType}>
              {blockType}
            </option>
          ))}
        </select>
        <span className="text-xs text-black/55">{blockTypeHints[type]}</span>
      </label>

      {type === "LINK" ? (
        <>
          <LinkPreviewFields title={defaultTitle} url={defaultUrl} description={defaultDescription} imageUrl={defaultImageUrl} />
          {mediaField({
            currentMedia: defaultImageUrl,
            label: "Upload image or video",
            help: "Standard links use the thumbnail as a compact row image. Featured links use it as the hero media."
          })}
          <DisplayStylePicker featured={defaultFeatured} />
          <label className="field">
            Animation
            <select className="input" name="animation" defaultValue={defaultAnimation}>
              <option value="">None</option>
              <option value="pulse">Pulse</option>
            </select>
          </label>
          <label className="field">
            UTM source
            <input className="input" name="utmSource" defaultValue={defaultUtmSource} placeholder="instagram" />
          </label>
          <label className="field">
            UTM medium
            <input className="input" name="utmMedium" defaultValue={defaultUtmMedium} placeholder="bio" />
          </label>
          <label className="field">
            UTM campaign
            <input className="input" name="utmCampaign" defaultValue={defaultUtmCampaign} placeholder="tour-drop" />
          </label>
        </>
      ) : null}

      {type === "HEADER" ? (
        <label className="field md:col-span-2">
          Heading text
          <input className="input" name="title" required defaultValue={defaultTitle} placeholder="Latest releases" />
        </label>
      ) : null}

      {type === "TEXT" ? (
        <>
          <label className="field">
            Block title
            <input className="input" name="title" required defaultValue={defaultTitle} placeholder="About this drop" />
          </label>
          <label className="field md:col-span-2">
            Body text
            <textarea className="input" name="description" rows={4} defaultValue={defaultDescription} placeholder="Add a short note, event details, or any extra context." />
          </label>
        </>
      ) : null}

      {type === "SEPARATOR" ? <input type="hidden" name="title" value="Separator" /> : null}

      {type === "VIDEO" ? (
        <>
          <LinkPreviewFields
            title={defaultTitle}
            url={defaultUrl}
            description={defaultDescription}
            imageUrl={defaultImageUrl}
            titleLabel="Video title"
            urlLabel="Video or share URL"
            urlPlaceholder="https://youtube.com/watch?v=..."
            imageLabel="Poster image or direct video URL"
          />
          {mediaField({
            currentMedia: defaultImageUrl,
            label: "Upload poster image or video",
            help: "Upload a video file for direct playback, or upload a poster image for an embedded video."
          })}
        </>
      ) : null}

      {type === "MUSIC" || type === "PODCAST" ? (
        <>
          <LinkPreviewFields
            title={defaultTitle}
            url={defaultUrl}
            description={defaultDescription}
            imageUrl={defaultImageUrl}
            titleLabel={type === "MUSIC" ? "Track, release, or set title" : "Episode or show title"}
            urlLabel={type === "MUSIC" ? "Music URL" : "Podcast URL"}
            urlPlaceholder={type === "MUSIC" ? "https://open.spotify.com/track/..." : "https://open.spotify.com/episode/..."}
            imageLabel="Cover image URL"
          />
          {mediaField({
            currentMedia: defaultImageUrl,
            label: "Upload cover image or media",
            help: "Use artwork for the card, or upload media for a richer visual tile."
          })}
        </>
      ) : null}

      {type === "NEWSLETTER" || type === "CALENDAR" || type === "CONTACT" ? (
        <>
          <LinkPreviewFields
            title={defaultTitle}
            url={defaultUrl}
            description={defaultDescription}
            imageUrl={defaultImageUrl}
            titleLabel={type === "NEWSLETTER" ? "Newsletter title" : type === "CALENDAR" ? "Booking title" : "Contact title"}
            urlLabel={type === "NEWSLETTER" ? "Signup URL" : type === "CALENDAR" ? "Calendar URL" : "Contact URL"}
            urlPlaceholder={
              type === "NEWSLETTER"
                ? "https://newsletter.example.com"
                : type === "CALENDAR"
                  ? "https://cal.com/you"
                  : "mailto:hello@example.com"
            }
            imageLabel="Optional image URL"
            previewEnabled={type !== "CONTACT"}
          />
          {mediaField({
            currentMedia: defaultImageUrl,
            label: "Upload optional image or video",
            help: "Adds extra visual weight to the card, but the main action stays on the button."
          })}
        </>
      ) : null}

      {type === "EMBED" ? (
        <>
          <LinkPreviewFields
            title={defaultTitle}
            url={defaultUrl}
            description={defaultDescription}
            imageUrl={defaultImageUrl}
            titleLabel="Embed title"
            urlLabel="Embed or share URL"
            urlPlaceholder="https://youtube.com/watch?v=..."
            imageLabel="Fallback image URL"
            descriptionLabel="Caption"
          />
          {mediaField({
            currentMedia: defaultImageUrl,
            label: "Upload fallback image or video",
            help: "Used when you want a visual cover around the embedded content."
          })}
        </>
      ) : null}

      {type === "PRODUCT" ? (
        <>
          <LinkPreviewFields
            title={defaultTitle}
            url={defaultUrl}
            description={defaultDescription}
            imageUrl={defaultImageUrl}
            titleLabel="Product title"
            urlLabel="Product URL"
            urlPlaceholder="https://shop.example.com/product"
            imageLabel="Product image URL"
          />
          {mediaField({
            currentMedia: defaultImageUrl,
            label: "Upload product image or video",
            help: "Product blocks look best with strong artwork or a short product clip."
          })}
        </>
      ) : null}

      {type === "SUBSCRIBER_FORM" ? (
        <>
          <label className="field">
            Form title
            <input className="input" name="title" required defaultValue={defaultTitle} placeholder="Join the list" />
          </label>
          <label className="field md:col-span-2">
            Supporting text
            <textarea className="input" name="description" rows={3} defaultValue={defaultDescription} placeholder="Tell people what they are signing up for." />
          </label>
        </>
      ) : null}

      <label className="field md:col-span-2">
        Metadata JSON
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(blockMetadataExamples[type])}>
            Type example
          </button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(metadataPresets.action)}>
            Button label
          </button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(metadataPresets.embed)}>
            Embed
          </button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(metadataPresets.secondary)}>
            Secondary CTA
          </button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(metadataPresets.product)}>
            Product
          </button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(metadataPresets.subscriber)}>
            Subscriber
          </button>
          <button type="button" className="btn-secondary px-3 py-2 text-xs" onClick={() => setMetadata(metadataPresets.empty)}>
            Empty
          </button>
        </div>
        <textarea
          className="input font-mono text-xs"
          name="metadata"
          rows={4}
          value={metadata}
          onChange={(event) => setMetadata(event.target.value)}
          placeholder={blockMetadataExamples[type]}
        />
      </label>

      <label className="field md:col-span-2">
        Internal note
        <textarea className="input" name="internalNote" rows={2} defaultValue={defaultInternalNote} placeholder="Private notes for scheduling, campaigns, or reminders." />
      </label>
    </>
  );
}
