/**
 * Shared form-intent constants for the CMS tutorials route. INTENT enumerates the
 * action identifiers (currently deleting a tutorial) submitted via forms. Exists so
 * the route action and its list components agree on a single set of intent values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const INTENT = {
	delete: "DELETE_TUTORIAL" as const,
};
