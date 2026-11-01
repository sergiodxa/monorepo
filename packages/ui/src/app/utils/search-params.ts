/**
 * Builds the links and hidden fields a list's URL-held view needs: a link that drops one
 * filter, one that clears them all, one that sets a single parameter, and the parameters a
 * GET form must carry so submitting one control keeps the state every other control wrote.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/**
 * Parameters that point at a position in a result set, dropped by every link here because a
 * position in the old results means nothing once the query changes.
 */
export const PAGINATION_PARAMS: readonly string[] = ["page", "cursor"];

/**
 * Origin a relative URL resolves against; only the path and query of the result are read.
 */
const RELATIVE_BASE = "http://localhost";

/**
 * Parses `url` whether it arrives absolute (a request URL) or as a path with a query.
 *
 * @param url The page's current URL.
 * @returns A copy that is safe to change.
 */
function toURL(url: URL | string): URL {
	return new URL(url.toString(), RELATIVE_BASE);
}

/**
 * Writes `url` back as a same-origin path, so a link reads the same on any host and a hash
 * pointing into the old results is dropped.
 *
 * @param url The changed URL.
 * @returns The path, plus the query when one remains.
 */
function toHref(url: URL): string {
	let search = url.searchParams.toString();
	return search ? `${url.pathname}?${search}` : url.pathname;
}

/**
 * Deletes the position parameters in `reset` from `url` in place.
 *
 * @param url The URL being changed.
 * @param reset Parameter names to drop.
 */
function dropAll(url: URL, reset: readonly string[]): void {
	for (let name of reset) url.searchParams.delete(name);
}

/**
 * The link a filter chip's remove control points at: `url` without the `name` parameter, or
 * without only its `value` when one is given, and back on the first page of results.
 *
 * @param url The page's current URL.
 * @param name The filter's parameter.
 * @param value The one value to drop; omitted drops every value of the parameter.
 * @param reset Position parameters to drop. Defaults to {@link PAGINATION_PARAMS}.
 * @returns A same-origin path with the remaining query.
 * @example removeFilterHref("/monitors?status=down&status=paused&page=3", "status", "down") // "/monitors?status=paused"
 * @example removeFilterHref(request.url, "region") // every region value dropped
 */
export function removeFilterHref(
	url: URL | string,
	name: string,
	value?: string,
	reset: readonly string[] = PAGINATION_PARAMS,
): string {
	let next = toURL(url);
	if (value === undefined) next.searchParams.delete(name);
	else next.searchParams.delete(name, value);
	dropAll(next, reset);
	return toHref(next);
}

/**
 * The link "Clear filters" points at: `url` without any of the `names` parameters, keeping
 * the tab, sort and view parameters so clearing filters changes nothing else on the page.
 *
 * @param url The page's current URL.
 * @param names Every filter parameter the page offers.
 * @param reset Position parameters to drop. Defaults to {@link PAGINATION_PARAMS}.
 * @returns A same-origin path with the remaining query.
 * @example clearFiltersHref("/issues?state=open&label=bug&q=crash", ["label", "q"]) // "/issues?state=open"
 */
export function clearFiltersHref(
	url: URL | string,
	names: readonly string[],
	reset: readonly string[] = PAGINATION_PARAMS,
): string {
	let next = toURL(url);
	for (let name of names) next.searchParams.delete(name);
	dropAll(next, reset);
	return toHref(next);
}

/**
 * The link a single-choice control (a sort order, a refresh interval) points at: `url` with
 * `name` set to `value` alone, or removed when `value` is `null` so the default applies.
 *
 * @param url The page's current URL.
 * @param name The parameter to set.
 * @param value Its new value; `null` removes it.
 * @param reset Position parameters to drop. Defaults to {@link PAGINATION_PARAMS}.
 * @returns A same-origin path with the updated query.
 * @example setParamHref("/monitors?status=down", "sort", "name") // "/monitors?status=down&sort=name"
 */
export function setParamHref(
	url: URL | string,
	name: string,
	value: string | null,
	reset: readonly string[] = PAGINATION_PARAMS,
): string {
	let next = toURL(url);
	if (value === null) next.searchParams.delete(name);
	else next.searchParams.set(name, value);
	dropAll(next, reset);
	return toHref(next);
}

/**
 * The parameters a GET form re-submits as hidden fields: every pair in `url` except the ones
 * its own controls write and the position parameters, in their original order, so one form
 * never erases what a sibling form or link put in the URL.
 *
 * @param url The page's current URL.
 * @param owned Parameters the form's own controls write.
 * @param reset Position parameters to drop. Defaults to {@link PAGINATION_PARAMS}.
 * @returns Name/value pairs, repeated names kept.
 * @example carriedParams("/issues?state=open&label=bug&page=2", ["label"]) // [["state", "open"]]
 */
export function carriedParams(
	url: URL | string,
	owned: readonly string[],
	reset: readonly string[] = PAGINATION_PARAMS,
): [name: string, value: string][] {
	let skip = new Set([...owned, ...reset]);
	return [...toURL(url).searchParams].filter(([name]) => !skip.has(name));
}

/**
 * Every value `url` holds for `name`, the way a repeated GET parameter arrives.
 *
 * @param url The page's current URL.
 * @param name The parameter to read.
 * @returns Its values in order; empty when absent.
 */
export function paramValues(url: URL | string, name: string): string[] {
	return toURL(url)
		.searchParams.getAll(name)
		.filter((value) => value !== "");
}
