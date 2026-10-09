/**
 * Draws a `frame` tag as a Remix `<Frame>`, so prose can hold a region a server
 * route renders per request — live data, or an island that hydrates on its own —
 * while the rest of the document stays static markup.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/* @jsxImportSource remix/component */

import type { Handle, RemixNode } from "remix/component";

import { Frame } from "remix/component";

/**
 * The tag's children become the frame's fallback, so a tag written with some streams
 * them in the first chunk and a self-closing one holds the page until its content
 * resolves. The renderer resolving frames is the page's own, which `src` is a path on.
 *
 * @example toRemix(document, { components: { frame: FrameTag } })
 */
export function FrameTag(handle: Handle<{ src: string; name?: string; children: RemixNode }>) {
	return () => {
		let { src, name, children } = handle.props;
		let fallback = hasContent(children) ? <>{children}</> : undefined;
		return <Frame src={src} name={name} fallback={fallback} />;
	};
}

/** `toRemix` hands an empty tag an empty array, which must read as no fallback at all. */
function hasContent(children: RemixNode): boolean {
	if (Array.isArray(children)) return children.some(hasContent);
	return children !== null && children !== undefined && children !== false && children !== "";
}
