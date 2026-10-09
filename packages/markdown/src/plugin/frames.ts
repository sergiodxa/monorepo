/**
 * The `frame` tag's definition: a region of a document whose content a server route
 * renders per request, written `<frame src="/path">fallback</frame>`. Registering it
 * at parse time is what makes a `src` off the page's own origin a positioned error.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import * as s from "remix/data-schema";

import type { Markdown } from "../index.js";

/**
 * A path on the page's own origin. Frame HTML is merged into the page as it arrives,
 * so a document may only point a frame at routes the site itself serves.
 */
function isSameOriginPath(value: string): boolean {
	return value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\");
}

/**
 * Register under `tags` to let a document load server-rendered regions. The tag's
 * children are its fallback: with some, the page streams them first and the frame's
 * content replaces them; with none, the page waits for the frame. `name` lets a
 * client entry reach the frame through `handle.frames.get(name)`.
 *
 * @example Markdown.parse(source, { tags: { frame: FRAME_TAG } })
 */
export const FRAME_TAG = {
	content: "blocks",
	attributes: s.object({
		src: s
			.string()
			.refine(isSameOriginPath, "Expected a path on the page's own origin, such as /frames/demo"),
		name: s.optional(s.string()),
	}),
} satisfies Markdown.TagDefinition;
