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
  "SUBSCRIBER_FORM"
];

export const blockTypeHints: Record<BlockType, string> = {
  LINK: "Standard bio link. Use Featured or Standard display style for the public page.",
  HEADER: "Section heading only. URL and media are optional and usually not needed.",
  TEXT: "Short paragraph block for notes, announcements, or extra context.",
  SEPARATOR: "Visual divider to break the page into sections.",
  VIDEO: "Upload a video file or paste a YouTube, Vimeo, or direct video URL.",
  MUSIC: "Paste a Spotify, SoundCloud, or music landing page URL. Add an embed URL in metadata if needed.",
  PODCAST: "Paste the episode or show URL. Use metadata for a custom embed URL if the share link is different.",
  NEWSLETTER: "Signup or issue link with a clear call to action.",
  CALENDAR: "Booking or calendar link for events, appointments, or RSVPs.",
  CONTACT: "Use a mailto: or tel: URL, or any contact page URL.",
  EMBED: "Paste an embeddable URL such as YouTube, Vimeo, Spotify, or another iframe-safe page.",
  PRODUCT: "Product card with optional image, price, and custom button label.",
  SUBSCRIBER_FORM: "Collects subscriber emails locally. URL is optional."
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
  SUBSCRIBER_FORM: '{"inputPlaceholder":"Your email","submitLabel":"Join the list"}'
};
