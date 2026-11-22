/**
 * `GET /showcase/media/*file` — the demos' video clips, answered with byte ranges. A browser
 * only lets a video seek when its file answers `Range` requests with `206 Partial Content`,
 * which the site's static files do not, so the clips are served from the Worker itself.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";
import { createAction } from "remix/router";

import routes from "~/routes/web";

/** The `*file` the request names. */
const PARAMS = s.object({ file: s.string() });

/**
 * Every clip under `resources/media/`, each loaded only when asked for, as a base64 data URL
 * the build inlines into its own chunk.
 */
const CLIPS = import.meta.glob<string>("/resources/media/**/*.{webm,mp4}", {
	query: "?inline",
	import: "default",
});

/** The media type each clip's extension is served as. */
const TYPES: Record<string, string> = { webm: "video/webm", mp4: "video/mp4" };

/**
 * The clips are fixed for a deploy, so a browser and the edge keep them for a day and
 * revalidate after that.
 */
const CACHE_CONTROL = "public, max-age=86400";

/**
 * The byte range a `Range` header asks for within a file of `size` bytes, or `null` for a
 * header this route reads as a request for the whole file. A suffix range (`bytes=-500`)
 * counts back from the end, and an open range (`bytes=500-`) runs to it.
 *
 * @returns The first and last byte, inclusive; `"unsatisfiable"` when the range starts past the end.
 */
export function readRange(
	header: string | null,
	size: number,
): { start: number; end: number } | "unsatisfiable" | null {
	let match = /^bytes=(\d*)-(\d*)$/.exec(header?.trim() ?? "");
	if (match === null) return null;
	let [, from = "", to = ""] = match;
	if (from === "" && to === "") return null;
	if (from === "") {
		let length = Math.min(Number(to), size);
		return length === 0 ? "unsatisfiable" : { start: size - length, end: size - 1 };
	}
	let start = Number(from);
	if (start >= size) return "unsatisfiable";
	let end = to === "" ? size - 1 : Math.min(Number(to), size - 1);
	return end < start ? "unsatisfiable" : { start, end };
}

/** Decodes a base64 data URL into its bytes. */
function bytesOf(dataUrl: string): Uint8Array<ArrayBuffer> {
	let base64 = dataUrl.slice(dataUrl.indexOf(",") + 1);
	return Uint8Array.from(atob(base64), (char) => char.charCodeAt(0));
}

/**
 * Answers the whole clip with `Accept-Ranges`, or the part a `Range` header asks for as `206`
 * with its `Content-Range`; a range past the end answers `416`, and a file no clip has `404`.
 */
export default createAction(routes.showcase.media, async (ctx) => {
	let { file } = s.parse(PARAMS, ctx.params);
	let load = CLIPS[`/resources/media/${file}`];
	let type = TYPES[file.slice(file.lastIndexOf(".") + 1)];
	if (load === undefined || type === undefined || file.includes("..")) {
		return new Response("Not found", { status: 404, headers: { "Content-Type": "text/plain" } });
	}
	let bytes = bytesOf(await load());
	let headers = {
		"Content-Type": type,
		"Accept-Ranges": "bytes",
		"Cache-Control": CACHE_CONTROL,
	};
	let range = readRange(ctx.request.headers.get("Range"), bytes.length);
	if (range === "unsatisfiable") {
		return new Response(null, {
			status: 416,
			headers: { ...headers, "Content-Range": `bytes */${bytes.length}` },
		});
	}
	if (range === null) {
		return new Response(bytes, {
			headers: { ...headers, "Content-Length": String(bytes.length) },
		});
	}
	let part = bytes.slice(range.start, range.end + 1);
	return new Response(part, {
		status: 206,
		headers: {
			...headers,
			"Content-Length": String(part.length),
			"Content-Range": `bytes ${range.start}-${range.end}/${bytes.length}`,
		},
	});
});
