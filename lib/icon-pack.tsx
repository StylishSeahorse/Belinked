import type { LucideIcon } from "lucide-react";
import {
  Award,
  Bike,
  Book,
  BookOpen,
  Bookmark,
  Briefcase,
  Brush,
  Building2,
  Cake,
  CalendarDays,
  Camera,
  Car,
  Cat,
  Clock,
  Cloud,
  Code2,
  Coffee,
  CreditCard,
  Crown,
  DollarSign,
  Dog,
  Download,
  Dumbbell,
  Feather,
  FileText,
  Film,
  Flame,
  Flower2,
  Gamepad2,
  Gem,
  Gift,
  Globe,
  GraduationCap,
  HandHeart,
  Handshake,
  Headphones,
  Heart,
  Home,
  Image,
  Laptop,
  Leaf,
  Lightbulb,
  Link2,
  Mail,
  MapPin,
  Megaphone,
  MessageCircle,
  Mic,
  Moon,
  Mountain,
  Music,
  Newspaper,
  Package,
  Palette,
  PartyPopper,
  PenTool,
  Phone,
  Pizza,
  Plane,
  PlayCircle,
  Podcast,
  Radio,
  Rocket,
  Rss,
  Send,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Smile,
  Sparkles,
  Star,
  Store,
  Sun,
  Tag,
  Ticket,
  Trophy,
  Truck,
  Tv,
  Users,
  Utensils,
  Video,
  Waves,
  Wine,
  Zap
} from "lucide-react";
import { SocialGlyph, socialPlatforms } from "./socials";

/**
 * Built-in thumbnail icons, so a link can have a picture without uploading anything.
 * Icons come from Lucide (ISC licence) plus the social platform marks in lib/socials.
 * Stored on Block.icon as "i:<name>" (general) or "s:<platform>" (social).
 */
type GeneralIcon = { id: string; label: string; Icon: LucideIcon; keywords: string; group: string };

const general: GeneralIcon[] = [
  // Links & web
  { id: "link", label: "Link", Icon: Link2, keywords: "url chain", group: "Essentials" },
  { id: "globe", label: "Website", Icon: Globe, keywords: "web internet site", group: "Essentials" },
  { id: "star", label: "Star", Icon: Star, keywords: "favourite featured", group: "Essentials" },
  { id: "heart", label: "Heart", Icon: Heart, keywords: "love like", group: "Essentials" },
  { id: "sparkles", label: "Sparkles", Icon: Sparkles, keywords: "new magic", group: "Essentials" },
  { id: "zap", label: "Bolt", Icon: Zap, keywords: "lightning fast energy", group: "Essentials" },
  { id: "flame", label: "Hot", Icon: Flame, keywords: "fire trending", group: "Essentials" },
  { id: "rocket", label: "Launch", Icon: Rocket, keywords: "start new release", group: "Essentials" },
  { id: "megaphone", label: "Announcement", Icon: Megaphone, keywords: "news promo", group: "Essentials" },
  { id: "download", label: "Download", Icon: Download, keywords: "file get", group: "Essentials" },
  { id: "file", label: "Document", Icon: FileText, keywords: "pdf cv resume", group: "Essentials" },
  { id: "bookmark", label: "Bookmark", Icon: Bookmark, keywords: "save", group: "Essentials" },
  // Shop & money
  { id: "shopping-bag", label: "Shop", Icon: ShoppingBag, keywords: "store merch buy", group: "Shop" },
  { id: "cart", label: "Cart", Icon: ShoppingCart, keywords: "buy checkout", group: "Shop" },
  { id: "store", label: "Store", Icon: Store, keywords: "shop market", group: "Shop" },
  { id: "tag", label: "Sale", Icon: Tag, keywords: "price discount", group: "Shop" },
  { id: "package", label: "Product", Icon: Package, keywords: "box item", group: "Shop" },
  { id: "truck", label: "Shipping", Icon: Truck, keywords: "delivery", group: "Shop" },
  { id: "shirt", label: "Merch", Icon: Shirt, keywords: "clothing tshirt apparel", group: "Shop" },
  { id: "gift", label: "Gift", Icon: Gift, keywords: "present", group: "Shop" },
  { id: "card", label: "Payment", Icon: CreditCard, keywords: "pay card", group: "Shop" },
  { id: "dollar", label: "Money", Icon: DollarSign, keywords: "pay tip cash", group: "Shop" },
  { id: "donate", label: "Donate", Icon: HandHeart, keywords: "support tip charity", group: "Shop" },
  { id: "coffee", label: "Coffee", Icon: Coffee, keywords: "tip kofi support cafe", group: "Shop" },
  { id: "gem", label: "Premium", Icon: Gem, keywords: "diamond exclusive", group: "Shop" },
  { id: "crown", label: "VIP", Icon: Crown, keywords: "members exclusive", group: "Shop" },
  // Media
  { id: "music", label: "Music", Icon: Music, keywords: "song track album", group: "Media" },
  { id: "headphones", label: "Listen", Icon: Headphones, keywords: "audio stream", group: "Media" },
  { id: "mic", label: "Mic", Icon: Mic, keywords: "voice sing", group: "Media" },
  { id: "podcast", label: "Podcast", Icon: Podcast, keywords: "episode audio show", group: "Media" },
  { id: "radio", label: "Radio", Icon: Radio, keywords: "live broadcast", group: "Media" },
  { id: "play", label: "Play", Icon: PlayCircle, keywords: "video watch", group: "Media" },
  { id: "video", label: "Video", Icon: Video, keywords: "camera film watch", group: "Media" },
  { id: "film", label: "Film", Icon: Film, keywords: "movie cinema", group: "Media" },
  { id: "tv", label: "Stream", Icon: Tv, keywords: "live twitch watch", group: "Media" },
  { id: "camera", label: "Photos", Icon: Camera, keywords: "photography gallery", group: "Media" },
  { id: "image", label: "Gallery", Icon: Image, keywords: "picture photo", group: "Media" },
  { id: "gamepad", label: "Gaming", Icon: Gamepad2, keywords: "games play", group: "Media" },
  { id: "book", label: "Book", Icon: Book, keywords: "read author", group: "Media" },
  { id: "book-open", label: "Read", Icon: BookOpen, keywords: "blog story", group: "Media" },
  { id: "newspaper", label: "Newsletter", Icon: Newspaper, keywords: "news blog articles", group: "Media" },
  { id: "rss", label: "Blog", Icon: Rss, keywords: "feed posts", group: "Media" },
  // Contact & events
  { id: "mail", label: "Email", Icon: Mail, keywords: "contact newsletter", group: "Contact & events" },
  { id: "phone", label: "Phone", Icon: Phone, keywords: "call contact", group: "Contact & events" },
  { id: "message", label: "Chat", Icon: MessageCircle, keywords: "dm message community", group: "Contact & events" },
  { id: "send", label: "Send", Icon: Send, keywords: "message telegram", group: "Contact & events" },
  { id: "calendar", label: "Calendar", Icon: CalendarDays, keywords: "event book schedule", group: "Contact & events" },
  { id: "clock", label: "Time", Icon: Clock, keywords: "hours schedule", group: "Contact & events" },
  { id: "ticket", label: "Tickets", Icon: Ticket, keywords: "event gig concert tour", group: "Contact & events" },
  { id: "party", label: "Party", Icon: PartyPopper, keywords: "event celebrate", group: "Contact & events" },
  { id: "map-pin", label: "Location", Icon: MapPin, keywords: "map address venue", group: "Contact & events" },
  { id: "users", label: "Community", Icon: Users, keywords: "group team members", group: "Contact & events" },
  { id: "handshake", label: "Work with me", Icon: Handshake, keywords: "collab hire partner", group: "Contact & events" },
  { id: "briefcase", label: "Portfolio", Icon: Briefcase, keywords: "work job cv", group: "Contact & events" },
  // Lifestyle & hobbies
  { id: "smile", label: "Smile", Icon: Smile, keywords: "happy", group: "Lifestyle" },
  { id: "home", label: "Home", Icon: Home, keywords: "house", group: "Lifestyle" },
  { id: "building", label: "Business", Icon: Building2, keywords: "office company", group: "Lifestyle" },
  { id: "graduation", label: "Course", Icon: GraduationCap, keywords: "learn class education", group: "Lifestyle" },
  { id: "lightbulb", label: "Ideas", Icon: Lightbulb, keywords: "tips learn", group: "Lifestyle" },
  { id: "palette", label: "Art", Icon: Palette, keywords: "design paint", group: "Lifestyle" },
  { id: "brush", label: "Design", Icon: Brush, keywords: "art paint", group: "Lifestyle" },
  { id: "pen", label: "Writing", Icon: PenTool, keywords: "design write", group: "Lifestyle" },
  { id: "feather", label: "Poetry", Icon: Feather, keywords: "write", group: "Lifestyle" },
  { id: "code", label: "Code", Icon: Code2, keywords: "developer software", group: "Lifestyle" },
  { id: "laptop", label: "Laptop", Icon: Laptop, keywords: "tech work", group: "Lifestyle" },
  { id: "smartphone", label: "App", Icon: Smartphone, keywords: "mobile download", group: "Lifestyle" },
  { id: "plane", label: "Travel", Icon: Plane, keywords: "trip flight", group: "Lifestyle" },
  { id: "car", label: "Car", Icon: Car, keywords: "drive auto", group: "Lifestyle" },
  { id: "bike", label: "Cycling", Icon: Bike, keywords: "bicycle ride", group: "Lifestyle" },
  { id: "dumbbell", label: "Fitness", Icon: Dumbbell, keywords: "gym workout health", group: "Lifestyle" },
  { id: "utensils", label: "Food", Icon: Utensils, keywords: "restaurant recipe menu", group: "Lifestyle" },
  { id: "pizza", label: "Pizza", Icon: Pizza, keywords: "food", group: "Lifestyle" },
  { id: "cake", label: "Bakery", Icon: Cake, keywords: "birthday food", group: "Lifestyle" },
  { id: "wine", label: "Drinks", Icon: Wine, keywords: "bar wine", group: "Lifestyle" },
  { id: "leaf", label: "Nature", Icon: Leaf, keywords: "plant eco green", group: "Lifestyle" },
  { id: "flower", label: "Flower", Icon: Flower2, keywords: "garden", group: "Lifestyle" },
  { id: "mountain", label: "Outdoors", Icon: Mountain, keywords: "hike adventure", group: "Lifestyle" },
  { id: "waves", label: "Beach", Icon: Waves, keywords: "sea surf ocean", group: "Lifestyle" },
  { id: "sun", label: "Sun", Icon: Sun, keywords: "summer", group: "Lifestyle" },
  { id: "moon", label: "Moon", Icon: Moon, keywords: "night", group: "Lifestyle" },
  { id: "cloud", label: "Cloud", Icon: Cloud, keywords: "weather", group: "Lifestyle" },
  { id: "dog", label: "Dog", Icon: Dog, keywords: "pet", group: "Lifestyle" },
  { id: "cat", label: "Cat", Icon: Cat, keywords: "pet", group: "Lifestyle" },
  { id: "trophy", label: "Trophy", Icon: Trophy, keywords: "win award", group: "Lifestyle" },
  { id: "award", label: "Award", Icon: Award, keywords: "prize badge", group: "Lifestyle" }
];

export type PackIcon = { id: string; label: string; group: string; keywords: string };

/** Every selectable icon, in display order. */
export const iconPack: PackIcon[] = [
  // Several platforms share a generic glyph (e.g. a music note); list each look once.
  ...socialPlatforms
    .filter((platform, index, all) => all.findIndex((other) => (other.icon || other.glyph) === (platform.icon || platform.glyph)) === index)
    .map((platform) => ({ id: `s:${platform.id}`, label: platform.label, group: "Social", keywords: platform.hosts?.join(" ") || "" })),
  ...general.map((icon) => ({ id: `i:${icon.id}`, label: icon.label, group: icon.group, keywords: icon.keywords }))
];

export const iconPackGroups = ["Social", "Essentials", "Shop", "Media", "Contact & events", "Lifestyle"] as const;

const generalById = new Map(general.map((icon) => [icon.id, icon]));
const socialIds = new Set(socialPlatforms.map((platform) => platform.id));

/** Only known icon ids are ever stored or rendered. */
export function isPackIcon(value?: string | null): value is string {
  if (!value) return false;
  if (value.startsWith("i:")) return generalById.has(value.slice(2));
  if (value.startsWith("s:")) return socialIds.has(value.slice(2));
  return false;
}

export function packIconLabel(value?: string | null) {
  return iconPack.find((icon) => icon.id === value)?.label;
}

export function PackIconGlyph({ id, className = "h-5 w-5", strokeWidth = 2 }: { id: string; className?: string; strokeWidth?: number }) {
  if (id.startsWith("s:")) {
    const platform = id.slice(2);
    return <SocialGlyph social={{ icon: platform, label: packIconLabel(id) || platform }} className={className} />;
  }
  const icon = generalById.get(id.slice(2));
  if (!icon) return null;
  const Icon = icon.Icon;
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
