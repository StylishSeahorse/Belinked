import type { Block, SocialIcon } from "@prisma/client";

/** Client-safe shapes used by the visual editor (dates as ISO strings). */
export type EditorBlock = Omit<Block, "startsAt" | "endsAt" | "createdAt" | "updatedAt"> & {
  startsAt: string | null;
  endsAt: string | null;
};

export type EditorSocial = Pick<SocialIcon, "id" | "label" | "url" | "icon" | "isVisible" | "position">;

export type EditorProfile = {
  id: string;
  displayName: string;
  username: string;
  bio: string;
  badge: string | null;
  avatarUrl: string | null;
  logoUrl: string | null;
  isPublished: boolean;
  cookieNoticeEnabled: boolean;
  priorityRedirectOn: boolean;
};

/** Appearance edits are saved to this theme so presets stay untouched. */
export const CUSTOM_THEME_NAME = "My custom theme";

export type ActionResult<T = null> = { ok: true; data: T } | { ok: false; error: string };

export function serializeBlock(block: Block): EditorBlock {
  const { startsAt, endsAt, createdAt: _createdAt, updatedAt: _updatedAt, ...rest } = block;
  void _createdAt;
  void _updatedAt;
  return { ...rest, startsAt: startsAt?.toISOString() ?? null, endsAt: endsAt?.toISOString() ?? null };
}

export function serializeSocial(social: SocialIcon): EditorSocial {
  return { id: social.id, label: social.label, url: social.url, icon: social.icon, isVisible: social.isVisible, position: social.position };
}

/** Rebuild a Block-like object from the editor shape (used for live preview mapping). */
export function blockFromEditor(block: EditorBlock): Block {
  return {
    ...block,
    startsAt: block.startsAt ? new Date(block.startsAt) : null,
    endsAt: block.endsAt ? new Date(block.endsAt) : null,
    createdAt: new Date(0),
    updatedAt: new Date(0)
  };
}

/** Row grouping used by the "side by side" layout option. */
export function groupSize(block: Pick<EditorBlock, "metadata" | "type" | "featured">) {
  if (block.type !== "LINK" || block.featured) return 1;
  try {
    const size = Number(JSON.parse(block.metadata || "{}").inlineGroupSize || 1);
    return size === 2 || size === 3 ? size : 1;
  } catch {
    return 1;
  }
}

/** Converts a flat order into layout rows, honoring each anchor's group size. */
export function rowsFromOrder(blocks: Array<Pick<EditorBlock, "id" | "metadata" | "type" | "featured">>) {
  const rows: string[][] = [];
  for (let index = 0; index < blocks.length; index += 1) {
    const size = groupSize(blocks[index]);
    const row = [blocks[index].id];
    for (let offset = 1; offset < size; offset += 1) {
      const next = blocks[index + offset];
      if (!next || next.type !== "LINK" || next.featured) break;
      row.push(next.id);
    }
    rows.push(row);
    index += row.length - 1;
  }
  return rows;
}
