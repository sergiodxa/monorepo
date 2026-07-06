/**
 * Shared form intent constants for the CMS redirects route. Exports an INTENT map
 * with clear and deleteSelected action identifiers used to disambiguate form
 * submissions on the redirects screen. It exists to keep those string literals in
 * one place so the route and its components stay in sync.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const INTENT = {
	clear: "CLEAR_CACHE" as const,
	deleteSelected: "DELETE_SELECTED" as const,
};
