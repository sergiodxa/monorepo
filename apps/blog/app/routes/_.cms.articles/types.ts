/**
 * Shared intent constants for the CMS articles route, enumerating the form
 * actions its component and action handler support: deleting an article and
 * moving one to the tutorials section. Centralizing them keeps the UI and action
 * dispatch in sync on the same string values.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const INTENT = {
	delete: "DELETE_ARTICLE" as const,
	moveToTutorial: "MOVE_TO_TUTORIAL" as const,
};
