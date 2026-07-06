/**
 * Shared intent constants for the glossary term editor route, distinguishing the
 * create and update form actions. Both the loader (choosing edit mode) and the
 * action (dispatching the right mutation) reference these values to stay
 * consistent.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

export const INTENT = {
	create: "CREATE_GLOSSARY_TERM" as const,
	update: "UPDATE_GLOSSARY_TERM" as const,
};
