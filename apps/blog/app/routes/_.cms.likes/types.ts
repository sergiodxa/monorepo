/**
 * Shared form intent constant for the CMS likes route. Exports an INTENT map with
 * the delete action identifier used to tag delete submissions on the likes screen.
 * It exists to keep that string literal in one place so the route and its
 * components stay in sync.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const INTENT = { delete: "DELETE_LIKE" as const };
