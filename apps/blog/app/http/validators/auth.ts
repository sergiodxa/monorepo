/**
 * Validates where a sign-in returns the editor to: a page on this site, named by its path
 * and query, that travels from the page asking for a login through the provider round
 * trip, so a CMS link opened with an expired session lands where it pointed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Location } from "@sdxc/location";
import { object, optional, string } from "remix/data-schema";

/**
 * Whether `value` names a page on this origin by its path: it starts with a single `/`,
 * which also excludes a scheme (browsers read `//host` and `/\host` as another host), holds
 * no control character or whitespace, and stays a path here once its dot segments resolve.
 */
function isReturnPath(value: string): boolean {
	if (!value.startsWith("/")) return false;
	if (/^\/[/\\]/.test(value)) return false;
	if (/[\p{Cc}\s]/u.test(value)) return false;
	return Location.isSafe(value);
}

/**
 * A page on this site to land on after signing in, as its path with the query and fragment
 * it carries. It parses to the resolved form (`/cms/../cms` reads `/cms`), so the redirect
 * goes to exactly the path that was checked.
 */
export const ReturnPathSchema = string()
	.refine(isReturnPath, "Expected a path on this site")
	.transform((value) => Location.from(value).toString());

/**
 * The query the login page reads: `next` names the page a login returns to. A query
 * carrying an unusable `next`, or several, fails as a whole, which sends the login to its
 * default destination.
 */
export const LoginQuerySchema = object({ next: optional(ReturnPathSchema) });
