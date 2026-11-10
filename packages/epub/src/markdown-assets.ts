/**
 * Where a Markdown book's files land inside the container and how they are read: source paths
 * relative to the book's folder become valid, case-unique container paths, stylesheet `url()`s
 * are rewritten to match, and reads run with a concurrency cap that stops on the first failure.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Result } from "@sdxc/result";

import { failure, success } from "@sdxc/result";

import type { EpubError } from "./errors.js";

import { EpubMediaTypeError } from "./errors.js";
import { isRemote, mediaTypeOf } from "./paths.js";

/** The container files a book's own files may never take. */
const RESERVED = ["nav.xhtml", "toc.ncx", "cover.xhtml", "package.opf"];

/** The extension a remote file takes for each media type a server may answer with. */
const EXTENSIONS: Record<string, string> = {
	"image/gif": "gif",
	"image/jpeg": "jpg",
	"image/png": "png",
	"image/svg+xml": "svg",
	"image/webp": "webp",
	"font/otf": "otf",
	"font/ttf": "ttf",
	"font/woff": "woff",
	"font/woff2": "woff2",
	"audio/mpeg": "mp3",
	"audio/mp4": "m4a",
	"text/css": "css",
};

/**
 * Whether a reference names a file of the book: anything but an in-page fragment, a `data:`
 * URL and an empty value.
 */
export function isFileReference(reference: string): boolean {
	let value = reference.trim();
	return value !== "" && !value.startsWith("#") && !value.startsWith("data:");
}

/** Whether `char` is whitespace as CSS `\s` defines it. */
function isCssSpace(char: string | undefined): boolean {
	return char !== undefined && /\s/u.test(char);
}

/**
 * One closed `url()` in a stylesheet: the span to rewrite and the value as written, found with
 * forward scans so a long run of unfinished `url(` openers still costs linear time.
 */
interface CssUrlMatch {
	/** Index of the `u` in `url(`. */
	start: number;
	/** Index just past the closing `)`. */
	end: number;
	/** The quoted or bare value, without surrounding whitespace. */
	value: string;
}

/**
 * Every closed `url()` in `css`, in order. A quote may not span a newline; a bare value runs
 * until the next whitespace or `)`. An opener that runs to the end of the string without a
 * closer ends the search, so a long run of unfinished `url(` still costs linear time.
 */
function cssUrlMatches(css: string): CssUrlMatch[] {
	let matches: CssUrlMatch[] = [];
	let position = 0;
	while (position < css.length) {
		let open = css.indexOf("url(", position);
		if (open === -1) break;

		let index = open + 4;
		while (isCssSpace(css[index])) index++;

		let value: string | undefined;
		let quote = css[index];
		if (quote === '"' || quote === "'") {
			let close = -1;
			let brokenByNewline = false;
			for (let cursor = index + 1; cursor < css.length; cursor++) {
				let char = css[cursor];
				if (char === "\n") {
					brokenByNewline = true;
					break;
				}
				if (char === quote) {
					close = cursor;
					break;
				}
			}
			if (close === -1) {
				if (!brokenByNewline) break;
				position = open + 4;
				continue;
			}
			value = css.slice(index + 1, close);
			index = close + 1;
		} else if (index < css.length && !isCssSpace(css[index]) && css[index] !== ")") {
			let start = index;
			index++;
			while (index < css.length && css[index] !== ")" && !isCssSpace(css[index])) index++;
			if (index === css.length) break;
			value = css.slice(start, index);
		} else {
			position = open + 4;
			continue;
		}

		while (isCssSpace(css[index])) index++;
		if (index === css.length) break;
		if (css[index] !== ")") {
			position = open + 4;
			continue;
		}

		matches.push({ start: open, end: index + 1, value });
		position = index + 1;
	}
	return matches;
}

/**
 * The folder part of a source path, which the references inside that file resolve from.
 *
 * @param path - A source path such as `chapters/one.md` or `../shared/print.css`
 * @returns The folder, `""` for the book's own folder
 */
export function folderOf(path: string): string {
	let slash = path.lastIndexOf("/");
	return slash === -1 ? "" : path.slice(0, slash);
}

/**
 * A reference resolved against the folder of the file that holds it, relative to the book's
 * folder. A path that climbs out keeps its leading `..` segments, so the reader finds it next
 * to the book; the query and fragment are dropped, since they never name a different file.
 *
 * @param folder - The folder of the referencing file, relative to the book's folder
 * @param reference - The `src`, `href` or `url()` value as written
 * @returns The source path, or `undefined` for an absolute path or a malformed escape
 */
export function resolveSource(folder: string, reference: string): string | undefined {
	let value = reference.trim();
	let end = value.search(/[?#]/u);
	if (end !== -1) value = value.slice(0, end);
	let decoded: string;
	try {
		decoded = decodeURIComponent(value);
	} catch {
		return undefined;
	}
	if (decoded === "" || decoded.startsWith("/")) return undefined;

	let segments = folder === "" ? [] : folder.split("/");
	for (let segment of decoded.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === ".." && segments.length > 0 && segments.at(-1) !== "..") segments.pop();
		else segments.push(segment);
	}
	return segments.join("/");
}

/** A reference with its fragment kept apart, so a rewrite can put it back. */
export function splitFragment(reference: string): { target: string; fragment: string } {
	let hash = reference.indexOf("#");
	if (hash === -1) return { target: reference, fragment: "" };
	return { target: reference.slice(0, hash), fragment: reference.slice(hash) };
}

/**
 * Hands out container paths: each source path keeps its shape with every segment cut to the
 * characters EPUB allows, `..` becomes `_parent`, and a path that collides with another once
 * case is folded takes a `-2`, `-3` suffix, since archives extract onto case-insensitive disks.
 */
export class ContainerPaths {
	#taken = new Set<string>(RESERVED);
	#bySource = new Map<string, string>();

	/**
	 * The container path of a source file, the same one every time it is asked for.
	 *
	 * @param source - The source path relative to the book's folder
	 * @param prefix - A folder to place it under, such as `_book/fonts`
	 * @returns A path relative to the container's `EPUB/` folder
	 */
	claim(source: string, prefix = ""): string {
		let key = `${prefix}\u0000${source}`;
		let known = this.#bySource.get(key);
		if (known) return known;

		let segments = source.split("/").map((segment) => cleanSegment(segment));
		if (prefix !== "") segments.unshift(...prefix.split("/"));
		let path = this.#unique(segments.join("/"));
		this.#bySource.set(key, path);
		return path;
	}

	/** Takes a path exactly as given, numbering it past any path already taken. */
	#unique(path: string): string {
		let dot = path.lastIndexOf(".");
		let slash = path.lastIndexOf("/");
		let stem = dot > slash + 1 ? path.slice(0, dot) : path;
		let extension = dot > slash + 1 ? path.slice(dot) : "";
		let candidate = path;
		for (let suffix = 2; this.#taken.has(candidate.toLowerCase()); suffix++) {
			candidate = `${stem}-${suffix}${extension}`;
		}
		this.#taken.add(candidate.toLowerCase());
		return candidate;
	}
}

/** One path segment cut to `A–Z a–z 0–9 . _ -`, starting with a letter, digit or `_`. */
function cleanSegment(segment: string): string {
	if (segment === "..") return "_parent";
	let cleaned = segment
		.normalize("NFKD")
		.replace(/\p{M}/gu, "")
		.replace(/[^A-Za-z0-9._-]+/gu, "-");
	if (!/^[A-Za-z0-9_]/u.test(cleaned)) cleaned = `_${cleaned}`;
	return cleaned;
}

/**
 * The container path of a remote file: `remote/` and a digest of the URL, so the same URL is
 * one file however often it is referenced, with the extension taken from the URL or, when it
 * names none EPUB knows, from the media type the server answered with.
 *
 * @param url - The URL as referenced
 * @param type - The `content-type` the server answered with, parameters included
 * @returns The path, or the media-type failure for a file EPUB cannot hold
 */
export async function remotePath(
	url: string,
	type: string | undefined,
): Promise<Result<string, EpubError>> {
	let digest = new Uint8Array(await crypto.subtle.digest("SHA-256", new TextEncoder().encode(url)));
	let name = Array.from(digest.slice(0, 8), (byte) => byte.toString(16).padStart(2, "0")).join("");
	let pathname = URL.canParse(url) ? new URL(url).pathname : "";
	let fromUrl = pathname.includes(".") ? pathname.slice(pathname.lastIndexOf(".") + 1) : "";
	if (mediaTypeOf(`x.${fromUrl}`)) return success(`remote/${name}.${fromUrl.toLowerCase()}`);

	let fromType = EXTENSIONS[(type ?? "").split(";")[0]?.trim().toLowerCase() ?? ""];
	if (fromType) return success(`remote/${name}.${fromType}`);
	return failure(
		new EpubMediaTypeError(
			`"${url}" answered ${type ? `"${type}"` : "no media type"}, which EPUB cannot hold`,
			url,
		),
	);
}

/**
 * The file references in a stylesheet's `url()`s, in the order written, skipping fragments
 * and `data:` URLs.
 */
export function cssReferences(css: string): string[] {
	let references: string[] = [];
	for (let match of cssUrlMatches(css)) {
		if (isFileReference(match.value)) references.push(match.value);
	}
	return references;
}

/**
 * A stylesheet with every file `url()` replaced by what `rewrite` answers, always written
 * double-quoted; a `url()` `rewrite` leaves `undefined` stays as written.
 */
export function rewriteCss(
	css: string,
	rewrite: (reference: string) => string | undefined,
): string {
	let matches = cssUrlMatches(css);
	if (matches.length === 0) return css;

	let parts: string[] = [];
	let cursor = 0;
	for (let match of matches) {
		parts.push(css.slice(cursor, match.start));
		if (!isFileReference(match.value)) {
			parts.push(css.slice(match.start, match.end));
		} else {
			let next = rewrite(match.value);
			parts.push(
				next === undefined
					? css.slice(match.start, match.end)
					: `url("${next.replaceAll('"', "%22")}")`,
			);
		}
		cursor = match.end;
	}
	parts.push(css.slice(cursor));
	return parts.join("");
}

/** Whether a reference loads from the web rather than from the book's folder. */
export function isWebReference(reference: string): boolean {
	return isRemote(reference.trim()) && !reference.trim().startsWith("data:");
}

/**
 * Runs `work` over every item, at most `limit` at a time, and answers the first failure; once
 * one fails no new item starts, and the caller aborts the ones already running.
 *
 * @param items - What to work through
 * @param limit - How many may run at once
 * @param work - Answers a `Result` per item
 * @returns The successes in item order, or the first failure
 */
export async function mapLimit<Item, Output>(
	items: readonly Item[],
	limit: number,
	work: (item: Item) => Promise<Result<Output, EpubError>>,
): Promise<Result<Output[], EpubError>> {
	let outputs: Output[] = Array.from({ length: items.length });
	let next = 0;
	let failed: EpubError | undefined;

	/** Takes the next item until none is left or one has failed. */
	async function lane(): Promise<void> {
		while (failed === undefined && next < items.length) {
			let index = next++;
			let result = await work(items[index] as Item);
			if (result.status === "failure") failed ??= result.error;
			else outputs[index] = result.data;
		}
	}

	await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => lane()));
	return failed === undefined ? success(outputs) : failure(failed);
}
