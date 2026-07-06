/**
 * Shared form-intent constants for the CMS dashboard index. INTENT enumerates the
 * action identifiers submitted from the dashboard (creating a quick like and dumping
 * the database). Exists so the route action and its widget components share one set
 * of intent values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const INTENT = {
	createLike: "CREATE_LIKE" as const,
	dump: "DUMP_DB" as const,
};
