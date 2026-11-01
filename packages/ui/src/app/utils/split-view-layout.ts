/**
 * The split view's remembered layout: each resizable pane's share of the screen and
 * which panes are collapsed, written to one cookie so the next server render draws the
 * screen the way the reader left it, ahead of any script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Cookie a split view stores its layout in unless it names its own. */
export const SPLIT_VIEW_COOKIE = "ui-split-view";

/** A split view's panes, in screen order. */
export type SplitViewPane = "sidebar" | "list" | "detail";

/** A split view's remembered layout. */
export interface SplitViewLayout {
	/** The sidebar's share of the view's width, as a percentage. */
	sidebar?: number;
	/** The list's share of the view's width, as a percentage. */
	list?: number;
	/** Panes the reader collapsed: the sidebar to its rail, the list or detail out of view. */
	collapsed: SplitViewPane[];
}

/** Every pane name, which a cookie value is checked against. */
const PANES: readonly SplitViewPane[] = ["sidebar", "list", "detail"];

/**
 * Reads a size field: a percentage between 0 and 100, or nothing.
 *
 * @param raw The field as stored.
 * @returns The percentage, or `undefined` for an empty or out-of-range field.
 */
function parseSize(raw: string | undefined): number | undefined {
	if (raw === undefined || raw === "") return undefined;
	let value = Number(raw);
	return Number.isFinite(value) && value > 0 && value < 100 ? value : undefined;
}

/**
 * Writes a layout as the cookie's value: `sidebar:list:collapsed,panes`, sizes rounded to
 * two decimals.
 *
 * @param layout The layout to store.
 * @returns The cookie value.
 * @example serializeSplitViewLayout({ sidebar: 18, list: 30, collapsed: ["sidebar"] }) // "18:30:sidebar"
 */
export function serializeSplitViewLayout(layout: SplitViewLayout): string {
	let size = (value: number | undefined) =>
		value === undefined ? "" : String(Math.round(value * 100) / 100);
	return `${size(layout.sidebar)}:${size(layout.list)}:${layout.collapsed.join(",")}`;
}

/**
 * Reads a cookie value back into a layout, dropping any field that does not parse, so a
 * tampered or stale cookie falls back to the default layout field by field.
 *
 * @param value The cookie's value.
 * @returns The layout it stores.
 */
export function parseSplitViewLayout(value: string): SplitViewLayout {
	let [sidebar, list, collapsed = ""] = decodeURIComponent(value).split(":");
	return {
		sidebar: parseSize(sidebar),
		list: parseSize(list),
		collapsed: PANES.filter((pane) => collapsed.split(",").includes(pane)),
	};
}

/**
 * Reads a split view's layout from a request's `Cookie` header, for the server render
 * that passes it to `SplitView` as `layout`.
 *
 * @param cookieHeader The request's `Cookie` header.
 * @param name The cookie the view stores its layout in.
 * @returns The stored layout, or `undefined` when the reader has none yet.
 * @example <SplitView layout={readSplitViewLayout(request.headers.get("Cookie"))} … />
 */
export function readSplitViewLayout(
	cookieHeader: string | null | undefined,
	name: string = SPLIT_VIEW_COOKIE,
): SplitViewLayout | undefined {
	if (!cookieHeader) return undefined;
	for (let pair of cookieHeader.split(";")) {
		let separator = pair.indexOf("=");
		if (separator === -1 || pair.slice(0, separator).trim() !== name) continue;
		return parseSplitViewLayout(pair.slice(separator + 1).trim());
	}
	return undefined;
}
