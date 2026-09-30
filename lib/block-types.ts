import type { BlockType } from "@prisma/client";

export const blockTypes: BlockType[] = [
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
  "SUBSCRIBER_FORM",
  "IMAGE"
];

export const blockTypeHints: Record<BlockType, string> = {
  LINK: "Standard bio link. Use Featured or Standard display style for the public page.",
  HEADER: "Section heading only. URL and media are optional and usually not needed.",
  TEXT: "Short paragraph block for notes, announcements, or extra context.",
  SEPARATOR: "Visual divider to break the page into sections.",
  VIDEO: "Upload a video file or paste a YouTube, Vimeo, or Twitch URL. Supported URLs play inline.",
  MUSIC: "Paste a Spotify, SoundCloud, Apple Music, Mixcloud, or Bandcamp player URL to show an inline player.",
  PODCAST: "Paste a Spotify or Apple Podcasts episode/show URL for an inline player.",
  NEWSLETTER: "Signup or issue link with a clear call to action.",
  CALENDAR: "Booking or calendar link for events, appointments, or RSVPs.",
  CONTACT: "Use a mailto: or tel: URL, or any contact page URL.",
  EMBED: "Inline player from a supported provider (YouTube, Vimeo, Spotify, SoundCloud, Apple Music/Podcasts, Mixcloud, Twitch, Bandcamp). Other sites cannot be embedded, for safety.",
  PRODUCT: "Product card with optional image, price, and custom button label.",
  SUBSCRIBER_FORM: "Collects subscriber emails locally. URL is optional.",
  IMAGE: "A picture, with an optional link when tapped."
};

export const blockMetadataExamples: Record<BlockType, string> = {
  LINK: '{"buttonLabel":"Open"}',
  HEADER: "{}",
  TEXT: "{}",
  SEPARATOR: "{}",
  VIDEO: '{"embedUrl":"https://www.youtube.com/watch?v=...","buttonLabel":"Watch"}',
  MUSIC: '{"embedUrl":"https://open.spotify.com/track/...","buttonLabel":"Listen"}',
  PODCAST: '{"embedUrl":"https://open.spotify.com/episode/...","buttonLabel":"Play episode"}',
  NEWSLETTER: '{"buttonLabel":"Subscribe"}',
  CALENDAR: '{"buttonLabel":"Book now"}',
  CONTACT: '{"buttonLabel":"Email me","secondaryUrl":"tel:+123456789","secondaryLabel":"Call"}',
  EMBED: '{"embedUrl":"https://www.youtube.com/watch?v=...","caption":"Optional note"}',
  PRODUCT: '{"price":"$29","buttonLabel":"Shop now"}',
  SUBSCRIBER_FORM: '{"inputPlaceholder":"Your email","submitLabel":"Join the list"}',
  IMAGE: "{}"
};

export const blockTypeLabels: Record<BlockType, string> = {
  LINK: "Link",
  HEADER: "Heading",
  TEXT: "Text",
  SEPARATOR: "Divider",
  VIDEO: "Video",
  MUSIC: "Music",
  PODCAST: "Podcast",
  NEWSLETTER: "Newsletter link",
  CALENDAR: "Booking / calendar",
  CONTACT: "Contact",
  EMBED: "Embed",
  PRODUCT: "Product",
  SUBSCRIBER_FORM: "Email signup form",
  IMAGE: "Image"
};
