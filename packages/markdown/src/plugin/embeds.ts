/**
 * A `Markdown.walk` visitor that turns a URL pasted on a line of its own into a block tag
 * a renderer draws as an embed, plus built-in providers for YouTube, Vimeo, GitHub Gists
 * and X. Matching reads the URL alone, so embedding never touches the network.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Markdown } from "../index.js";

/** Recognises the URLs one kind of embed is made from. */
export interface EmbedProvider {
	/** The produced tag's name, which is the key its renderer is registered under. */
	name: string;
	/**
	 * Reads what the embed needs out of the URL, so the renderer never parses it again.
	 *
	 * @returns The tag's attributes, or `null` when the URL is not this provider's
	 */
	match(url: URL): Markdown.Attributes | null;
}

/** How a built-in provider names the tag it produces. */
export interface EmbedProviderOptions {
	/**
	 * The tag name, for a vocabulary that already uses the default for something else.
	 * @default the provider's own name, e.g. "youtube"
	 */
	name?: string;
}

/** A YouTube video id is always eleven URL-safe base64 characters. */
const YOUTUBE_ID = /^[\w-]{11}$/;

/** `42`, `42s`, `1m30s` and `1h2m3s`: the forms YouTube writes a start time in. */
const YOUTUBE_TIME = /^(?:(\d+)h)?(?:(\d+)m)?(?:(\d+)s?)?$/;

/** The hosts that serve a YouTube video page or player, with its path. */
const YOUTUBE_HOSTS = new Set([
	"youtube.com",
	"www.youtube.com",
	"m.youtube.com",
	"youtube-nocookie.com",
	"www.youtube-nocookie.com",
]);

/** The path prefixes after which a YouTube path names the video id. */
const YOUTUBE_ID_PATHS = new Set(["shorts", "embed", "live", "v"]);

/** The hosts that serve a post on X, under either of its names. */
const X_HOSTS = new Set([
	"x.com",
	"www.x.com",
	"twitter.com",
	"www.twitter.com",
	"mobile.twitter.com",
]);

/**
 * Builds the visitor for one list of providers. Each provider is tried in order and the
 * first match wins; a paragraph no provider claims is handed back as the same object.
 *
 * @param providers - The providers to try, in priority order
 * @returns A visitor to pass to `Markdown.walk`, alone or spread beside others
 * @example Markdown.walk(document, embeds([youtube(), vimeo(), gist(), x()]))
 */
export function embeds(providers: EmbedProvider[]) {
	/**
	 * A paragraph holding one pasted URL, with whitespace around it at most, becomes the
	 * first matching provider's tag. Its annotation sits under the matched attributes, and
	 * `url` always holds the link's href so a renderer can fall back to a plain link.
	 */
	function paragraph(node: Markdown.Paragraph): Markdown.Tag | undefined {
		let href = pastedURL(node);
		if (href === null) return undefined;

		let url = URL.parse(href);
		if (url === null) return undefined;

		for (let provider of providers) {
			let matched = provider.match(url);
			if (matched === null) continue;
			return {
				type: "tag",
				name: provider.name,
				attributes: { ...node.attributes, ...matched, url: href },
				children: [],
				position: node.position,
			};
		}

		return undefined;
	}

	return { paragraph } satisfies Markdown.Visitor;
}

/**
 * The href of the paragraph's only link when that link shows its own URL, which is what a
 * pasted URL parses to; a link with a label of its own is prose and stays a link. A `www.`
 * autolink counts, since its href differs from its text only by the scheme it gained.
 *
 * @returns The href, or `null` when the paragraph is anything else
 */
function pastedURL(node: Markdown.Paragraph): string | null {
	let links = node.children.filter((child) => !isBlank(child));
	let [link] = links;
	if (links.length !== 1 || link?.type !== "link") return null;

	let [text] = link.children;
	if (link.children.length !== 1 || text?.type !== "text") return null;
	if (text.value !== link.href && `http://${text.value}` !== link.href) return null;

	return link.href;
}

/** Whitespace around a URL is layout, so it leaves the line a URL on its own. */
function isBlank(node: Markdown.Inline): boolean {
	return node.type === "text" && node.value.trim() === "";
}

/** The path's segments, so a trailing slash or a doubled one never changes a match. */
function segments(url: URL): string[] {
	return url.pathname.split("/").filter(Boolean);
}

/** Only a web URL is embeddable, whatever its host. */
function isWeb(url: URL): boolean {
	return url.protocol === "https:" || url.protocol === "http:";
}

/**
 * Matches YouTube watch, short, live and embed URLs, `youtu.be` links included, as
 * `{ id, start? }`. `start` is the `t` or `start` parameter in seconds, left out when the
 * URL has none or writes it in a form YouTube does not.
 *
 * @param options - The tag name, `youtube` unless renamed
 * @returns The provider to pass to `embeds`
 * @example embeds([youtube({ name: "video" })])
 */
export function youtube(options: EmbedProviderOptions = {}): EmbedProvider {
	return {
		name: options.name ?? "youtube",
		match(url): Markdown.Attributes | null {
			if (!isWeb(url)) return null;

			let id = youtubeId(url);
			if (id === null || !YOUTUBE_ID.test(id)) return null;

			let start = youtubeStart(url.searchParams.get("t") ?? url.searchParams.get("start"));
			return start === null ? { id } : { id, start };
		},
	};
}

/** The id wherever the URL's form puts it: the path on `youtu.be`, `v` on a watch page. */
function youtubeId(url: URL): string | null {
	let path = segments(url);
	if (url.hostname === "youtu.be") return path.length === 1 ? (path[0] ?? null) : null;
	if (!YOUTUBE_HOSTS.has(url.hostname)) return null;
	if (path.length === 1 && path[0] === "watch") return url.searchParams.get("v");
	if (path.length === 2 && YOUTUBE_ID_PATHS.has(path[0] ?? "")) return path[1] ?? null;
	return null;
}

/** @returns The start time in seconds, or `null` when absent, zero or unreadable */
function youtubeStart(value: string | null): number | null {
	if (value === null) return null;
	let parts = YOUTUBE_TIME.exec(value);
	if (parts === null) return null;

	let [, hours = "0", minutes = "0", seconds = "0"] = parts;
	let total = Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
	return total > 0 ? total : null;
}

/**
 * Matches a Vimeo video page or player URL as `{ id, hash? }`. `hash` is the key an
 * unlisted video's player needs, read from the page path or the player's `h` parameter.
 *
 * @param options - The tag name, `vimeo` unless renamed
 * @returns The provider to pass to `embeds`
 * @example embeds([vimeo()])
 */
export function vimeo(options: EmbedProviderOptions = {}): EmbedProvider {
	return {
		name: options.name ?? "vimeo",
		match(url): Markdown.Attributes | null {
			if (!isWeb(url)) return null;

			let path = segments(url);
			let id: string | undefined;
			let hash: string | null | undefined;

			if (url.hostname === "vimeo.com" || url.hostname === "www.vimeo.com") {
				if (path.length > 2) return null;
				[id, hash] = path;
			} else if (url.hostname === "player.vimeo.com") {
				if (path.length !== 2 || path[0] !== "video") return null;
				id = path[1];
				hash = url.searchParams.get("h");
			} else {
				return null;
			}

			if (id === undefined || !/^\d+$/.test(id)) return null;
			return hash ? { id, hash } : { id };
		},
	};
}

/**
 * Matches a GitHub Gist page as `{ user, id }`, which is everything the Gist's embed
 * script URL is built from.
 *
 * @param options - The tag name, `gist` unless renamed
 * @returns The provider to pass to `embeds`
 * @example embeds([gist()])
 */
export function gist(options: EmbedProviderOptions = {}): EmbedProvider {
	return {
		name: options.name ?? "gist",
		match(url) {
			if (!isWeb(url) || url.hostname !== "gist.github.com") return null;

			let [user, id, ...rest] = segments(url);
			if (user === undefined || id === undefined || rest.length > 0) return null;
			if (!/^[\da-f]+$/i.test(id)) return null;
			return { user, id };
		},
	};
}

/**
 * Matches a post on X, on `x.com` or `twitter.com`, as `{ user, id }`. Query parameters
 * such as `?s=20` are share tracking and are dropped.
 *
 * @param options - The tag name, `x` unless renamed
 * @returns The provider to pass to `embeds`
 * @example embeds([x({ name: "tweet" })])
 */
export function x(options: EmbedProviderOptions = {}): EmbedProvider {
	return {
		name: options.name ?? "x",
		match(url) {
			if (!isWeb(url) || !X_HOSTS.has(url.hostname)) return null;

			let [user, status, id, ...rest] = segments(url);
			if (user === undefined || status !== "status" || id === undefined) return null;
			if (rest.length > 0 || !/^\w{1,15}$/.test(user) || !/^\d+$/.test(id)) return null;
			return { user, id };
		},
	};
}
