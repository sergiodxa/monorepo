/**
 * What a page's social card says, derived from the title, description and path its document
 * already states, and the address the card is served from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { contentVariables } from "~/app/services/content-variables";
import { absoluteUrl, SITE_DESCRIPTION, SITE_NAME, SITE_URL } from "~/config/constants";

export namespace SocialCard {
	/** The facts every page document states about itself. */
	export interface Page {
		/** The document title, `Name — Section` or the bare site name. */
		title: string;
		description: string;
		/** The page's path on this site, `/` for the home page. */
		path: string;
	}

	/** A page's card: its kind, name and summary inside the frame. */
	export interface PageContent {
		kind: "page";
		/** The small line above the title, naming what kind of page this is. */
		eyebrow: string;
		title: string;
		description: string;
		/** The page's address without the scheme, set in the card's corner. */
		url: string;
		/** The line under the frame: an install command on a package page, the site otherwise. */
		footer: string;
	}

	/** One figure in the home card's stats band, as the landing page's band states it. */
	export interface Stat {
		value: string;
		label: string;
	}

	/** The home page's card: the wordmark, the pitch, and the collection counted. */
	export interface HomeContent {
		kind: "home";
		tagline: string;
		description: string;
		stats: Stat[];
	}

	/**
	 * What a showcase item's card draws, read at build time from its case study and cover:
	 * its name, tagline and chips, the screenshot, and the palette read from that screenshot.
	 */
	export interface ShowcaseFacts {
		title: string;
		tagline: string;
		/** The status and category chips, worded as the showcase's tiles word them. */
		chips: [string, string];
		/** The cover scaled to the card, as a path on this site. */
		source: string;
		/** What the cover shows, as its case study describes it, for the card's alt text. */
		screenshotAlt: string;
		/** The source image's hash, so a re-shot cover gets a new card. */
		version: string;
		background: string;
		foreground: string;
		accent: string;
		onAccent: string;
	}

	/** A showcase item's card: its own colours and screenshot, with the showcase's address. */
	export interface ShowcaseContent extends ShowcaseFacts {
		kind: "showcase";
		/** The showcase's address without the scheme, set in the card's corner. */
		url: string;
	}

	/** The text a card draws. */
	export type Content = PageContent | HomeContent | ShowcaseContent;
}

/** The size social platforms render a large card at. */
export const SOCIAL_CARD_SIZE = { width: 1200, height: 630 } as const;

/**
 * Names the card design. Changing the drawing changes this, which changes every card's
 * storage key and URL, so platforms and storage pick up the new design with no purge.
 */
export const SOCIAL_CARD_TEMPLATE = "2";

/** This site's folder in the shared card bucket, which a lifecycle rule can target alone. */
const SOCIAL_CARD_PREFIX = "sdxc";

/** The segment the home page's card is stored under, since `/` leaves no name for a file. */
const HOME_SEGMENT = "index";

/**
 * Each showcase item's card facts, written by the extractor at build time and bundled, so the
 * layout can name a case study's card URL while it renders.
 */
const SHOWCASE_CARDS = import.meta.glob<{ cards: Record<string, SocialCard.ShowcaseFacts> }>(
	"../../resources/generated/showcase-cards.json",
	{ import: "default", eager: true },
);

/** A case study's path, whose one segment is the item's slug. */
const CASE_STUDY_PATH = /^\/showcase\/([^/]+)$/;

/** The separator every page title puts between its own name and the section it belongs to. */
const TITLE_SEPARATOR = " — ";

/**
 * Derives the card for a page. A case study gets its item's own card; elsewhere a title suffix
 * other than the site's name is the eyebrow (`Button — @sdxc/ui` reads "@sdxc/ui"), otherwise
 * the path decides it, and a package page gets its install command as the footer.
 */
export function socialCardContent(page: SocialCard.Page): SocialCard.Content {
	if (page.path === "/") return homeContent();
	let showcase = showcaseContent(page.path);
	if (showcase !== null) return showcase;
	let separator = page.title.lastIndexOf(TITLE_SEPARATOR);
	let name = separator === -1 ? page.title : page.title.slice(0, separator);
	let section = separator === -1 ? SITE_NAME : page.title.slice(separator + TITLE_SEPARATOR.length);
	let host = new URL(SITE_URL).host;
	let packageName = /^\/api\/([^/]+)$/.exec(page.path)?.[1];
	let eyebrow = section === SITE_NAME ? eyebrowFor(page.path) : section;
	return {
		kind: "page",
		eyebrow,
		title: name,
		description: page.description,
		url: page.path === "/" ? host : `${host}${page.path}`,
		footer: packageName && name.startsWith("@") ? `npm add ${name}` : host,
	};
}

/**
 * The card's alternative text, for `og:image:alt` and `twitter:image:alt`: everything the card
 * says, in reading order, and for a showcase card what its screenshot shows, so a reader who
 * cannot see the image gets what it carries.
 */
export function socialCardAlt(page: SocialCard.Page): string {
	let content = socialCardContent(page);
	if (content.kind === "home") return `${SITE_NAME}: ${content.tagline} ${content.description}`;
	if (content.kind === "page") {
		return [`${content.eyebrow}: ${content.title}.`, content.description].filter(Boolean).join(" ");
	}
	let [status, category] = content.chips;
	let kind = status === "Demo" ? `${category} demo` : `${category}, ${status.toLowerCase()}`;
	return [
		`${content.title} (${kind}): ${content.tagline}.`,
		content.screenshotAlt === "" ? "" : `Beside it, a screenshot: ${content.screenshotAlt}`,
		`From ${content.url}.`,
	]
		.filter(Boolean)
		.join(" ");
}

/**
 * The absolute URL a page advertises as its `og:image`: the page's own path with `.png`
 * added. The query names the content's hash, so a platform that caches images per URL
 * fetches again after the page changes.
 */
export function socialCardUrl(page: SocialCard.Page): string {
	let segment = page.path === "/" ? `/${HOME_SEGMENT}` : page.path.replace(/\/$/, "");
	return absoluteUrl(`${segment}.png?v=${socialCardHash(socialCardContent(page))}`);
}

/** The page path a card route's `path` parameter stands for. */
export function pagePathFromCardPath(path: string): string {
	return path === HOME_SEGMENT ? "/" : `/${path}`;
}

/**
 * Where the card whose content hashes to `hash` is stored: one object per template and
 * content, never overwritten, under this site's prefix in the bucket it shares with the
 * author's blog. A card URL's `v` is that hash, so a request names its object directly.
 */
export function socialCardKey(hash: string): string {
	return `${SOCIAL_CARD_PREFIX}/${SOCIAL_CARD_TEMPLATE}/${hash}.png`;
}

/**
 * A short, stable fingerprint of the card's content and template. It only has to tell one
 * card's text from another's, so a fast synchronous 53-bit hash (cyrb53) is enough, and the
 * layout can compute it while rendering.
 */
export function socialCardHash(content: SocialCard.Content): string {
	let input = `${SOCIAL_CARD_TEMPLATE}\u0000${JSON.stringify(content)}`;
	let h1 = 0xdeadbeef;
	let h2 = 0x41c6ce57;
	for (let index = 0; index < input.length; index++) {
		let code = input.charCodeAt(index);
		h1 = Math.imul(h1 ^ code, 2654435761);
		h2 = Math.imul(h2 ^ code, 1597334677);
	}
	h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
	h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
	return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
}

/**
 * Reads a rendered page's title and description from its Open Graph tags, the same values
 * the layout derived the advertised card URL from, or `null` when the page states no title.
 * The description falls back to the site's, as the page's own tags do.
 */
export function readPageFacts(html: string, path: string): SocialCard.Page | null {
	let title = metaContent(html, "og:title");
	if (title === null) return null;
	return { title, description: metaContent(html, "og:description") ?? SITE_DESCRIPTION, path };
}

/** The decoded `content` of the `<meta property>` tag naming `property`, or `null`. */
function metaContent(html: string, property: string): string | null {
	for (let match of html.matchAll(/<meta\b[^>]*>/g)) {
		let tag = match[0];
		if (attribute(tag, "property") !== property) continue;
		return attribute(tag, "content");
	}
	return null;
}

/** One attribute's decoded value in a tag, quoted either way, or `null`. */
function attribute(tag: string, name: string): string | null {
	let value = new RegExp(`\\s${name}=(?:"([^"]*)"|'([^']*)')`).exec(tag);
	if (!value) return null;
	return decodeEntities(value[1] ?? value[2] ?? "");
}

/** Decodes the character references an HTML serializer writes into attribute values. */
function decodeEntities(value: string): string {
	return value.replace(/&(#x[0-9a-f]+|#\d+|amp|lt|gt|quot|apos);/gi, (whole, entity: string) => {
		let lower = entity.toLowerCase();
		if (lower.startsWith("#x")) return String.fromCodePoint(Number.parseInt(lower.slice(2), 16));
		if (lower.startsWith("#")) return String.fromCodePoint(Number.parseInt(lower.slice(1), 10));
		return NAMED_ENTITIES[lower] ?? whole;
	});
}

/** The named references an attribute value can carry. */
const NAMED_ENTITIES: Record<string, string> = {
	amp: "&",
	lt: "<",
	gt: ">",
	quot: '"',
	apos: "'",
};

/**
 * The home card's text, quoting the landing page's own pitch and the counts its stats band
 * shows, read from the same source so the two always agree.
 */
function homeContent(): SocialCard.HomeContent {
	let counts = contentVariables();
	let stat = (key: string, label: string) => ({ value: counts[key] ?? "", label });
	return {
		kind: "home",
		tagline: "Take one, or take the set.",
		description: `${counts.packageCount ?? ""} packages built on web standards: Request and Response in, typed values out.`,
		stats: [
			stat("packageCount", "packages"),
			stat("rfcCount", "RFCs"),
			stat("componentCount", "components"),
			stat("utilityCount", "utilities"),
		].filter((entry) => entry.value !== ""),
	};
}

/**
 * A case study's card, drawn in its item's colours around its cover, or `null` for any other
 * path and for an item the extractor wrote no card for.
 */
function showcaseContent(path: string): SocialCard.ShowcaseContent | null {
	let slug = CASE_STUDY_PATH.exec(path)?.[1];
	if (slug === undefined) return null;
	let cards = Object.values(SHOWCASE_CARDS)[0]?.cards ?? {};
	let facts = Object.hasOwn(cards, slug) ? cards[slug] : undefined;
	if (facts === undefined) return null;
	return { kind: "showcase", ...facts, url: `${new URL(SITE_URL).host}/showcase` };
}

/** The eyebrow for a page whose title names only the site, by the part of the site it is in. */
function eyebrowFor(path: string): string {
	if (/^\/api\/[^/]+$/.test(path)) return "Package";
	if (path.startsWith("/api")) return "API reference";
	if (path.startsWith("/docs")) return "Guide";
	return SITE_NAME;
}
