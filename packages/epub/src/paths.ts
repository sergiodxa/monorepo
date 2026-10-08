/**
 * The path rules of a publication: which names a resource may take inside `EPUB/`, which
 * media type its extension maps to, and how a reference written in one document resolves to
 * another, so every check compares container paths rather than the strings authors wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * One path segment: ASCII letters, digits, `.`, `_` and `-`. epubcheck warns on spaces and
 * non-ASCII names, and some reading systems mangle them, so the package keeps to the set
 * every one of them handles.
 */
const SEGMENT = /^[A-Za-z0-9_][A-Za-z0-9._-]*$/;

/**
 * An XML NCName, the form EPUB requires of a manifest id, restricted to the characters a
 * file name allows too, since a chapter id also names its file.
 */
const NCNAME = /^[A-Za-z_][A-Za-z0-9._-]*$/;

/** A URL scheme, which marks a reference as leaving the publication. */
const SCHEME = /^[A-Za-z][A-Za-z0-9+.-]*:/;

/** Core media types by extension, from EPUB 3.3's table plus the font aliases it accepts. */
const MEDIA_TYPES: Record<string, string> = {
	css: "text/css",
	gif: "image/gif",
	jpeg: "image/jpeg",
	jpg: "image/jpeg",
	mp3: "audio/mpeg",
	m4a: "audio/mp4",
	otf: "font/otf",
	png: "image/png",
	svg: "image/svg+xml",
	ttf: "font/ttf",
	webp: "image/webp",
	woff: "font/woff",
	woff2: "font/woff2",
};

/**
 * Names the first rule a resource path breaks, or nothing when the path is usable: relative,
 * `/`-separated, each segment from the portable set, ending in an extension.
 */
export function pathProblem(path: string): string | undefined {
	if (path.length === 0) return "A path is empty";
	let segments = path.split("/");
	for (let segment of segments) {
		if (!SEGMENT.test(segment)) {
			return `"${path}" must be relative, "/"-separated, and use only A–Z, a–z, 0–9, ".", "_" and "-"`;
		}
		if (segment === "." || segment === "..") return `"${path}" has a "." or ".." segment`;
	}
	return undefined;
}

/** Whether an id may name a manifest item and a chapter file. */
export function isNCName(id: string): boolean {
	return NCNAME.test(id);
}

/** The core media type a path's extension maps to, or nothing for one EPUB does not list. */
export function mediaTypeOf(path: string): string | undefined {
	let dot = path.lastIndexOf(".");
	if (dot === -1) return undefined;
	return MEDIA_TYPES[path.slice(dot + 1).toLowerCase()];
}

/** Whether a reference carries a scheme or a network host, and so points outside the container. */
export function isRemote(reference: string): boolean {
	return SCHEME.test(reference) || reference.startsWith("//");
}

/** A reference split into the container path it resolves to and the fragment after `#`. */
export interface ResolvedReference {
	/** `undefined` when the reference is a bare fragment into the same document. */
	path?: string;
	fragment?: string;
}

/**
 * Resolves a relative reference written in the document at `from` to a container path,
 * decoding percent-escapes and dropping any query, the way a reading system looks it up.
 *
 * @param from - The container path of the document holding the reference, e.g. `text/a.xhtml`
 * @param reference - The attribute value as written
 * @returns The target, or `undefined` when it is absolute, malformed, or climbs out of `EPUB/`
 */
export function resolveReference(from: string, reference: string): ResolvedReference | undefined {
	let hash = reference.indexOf("#");
	let target = hash === -1 ? reference : reference.slice(0, hash);
	let fragment = hash === -1 ? undefined : reference.slice(hash + 1);
	let query = target.indexOf("?");
	if (query !== -1) target = target.slice(0, query);

	let decoded: string;
	try {
		decoded = decodeURIComponent(target);
		fragment = fragment === undefined ? undefined : decodeURIComponent(fragment);
	} catch {
		return undefined;
	}

	if (decoded === "") return { fragment };
	if (decoded.startsWith("/")) return undefined;

	let segments = from.split("/").slice(0, -1);
	for (let segment of decoded.split("/")) {
		if (segment === "" || segment === ".") continue;
		if (segment === "..") {
			if (segments.length === 0) return undefined;
			segments.pop();
			continue;
		}
		segments.push(segment);
	}
	return { path: segments.join("/"), fragment };
}

/**
 * The relative reference from the document at `from` to the container path `to`, which is
 * how the package links a chapter to a stylesheet or the navigation document to a chapter.
 */
export function relativePath(from: string, to: string): string {
	let base = from.split("/").slice(0, -1);
	let target = to.split("/");
	let shared = 0;
	while (shared < base.length && shared < target.length - 1 && base[shared] === target[shared]) {
		shared++;
	}
	return [...base.slice(shared).map(() => ".."), ...target.slice(shared)].join("/");
}
