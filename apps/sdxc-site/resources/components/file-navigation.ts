/**
 * Hands a same-origin navigation to a file (an image, a PDF, a `.md` twin, a feed) back to the
 * browser, so it opens as the file itself. The client runtime renders every page it intercepts
 * as HTML, and a file's bytes would otherwise land in the page as text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Extensions that still name an HTML page, which the runtime renders as any other page. */
const PAGE_EXTENSIONS = new Set(["html", "htm"]);

/**
 * Whether an address names a file: its last path segment carries an extension. Every route
 * on the site that answers with something other than HTML ends in one, and no page does.
 *
 * @example isFileAddress("https://sdxc.dev/showcase/malfoid/moods.webp") // true
 * @example isFileAddress("https://sdxc.dev/showcase/malfoid") // false
 */
export function isFileAddress(url: string | URL): boolean {
	let segment = new URL(url).pathname.split("/").at(-1) ?? "";
	let dot = segment.lastIndexOf(".");
	if (dot <= 0 || dot === segment.length - 1) return false;
	return !PAGE_EXTENSIONS.has(segment.slice(dot + 1).toLowerCase());
}

/**
 * A `navigate` listener that keeps later listeners, the runtime's among them, from intercepting
 * a navigation to a file, and lets it go ahead as a full document load. Register it before
 * the runtime boots so it runs first.
 */
export function leaveFilesToTheBrowser(event: NavigateEvent): void {
	if (!isFileAddress(event.destination.url)) return;
	event.stopImmediatePropagation();
}
