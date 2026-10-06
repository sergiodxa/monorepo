/**
 * The calls a utility's page derives from its first documented example: the same call
 * with a raw CSS value, scoped to a state, and scoped to a container width. The HTML page
 * and its markdown twin both print them, so the two show a reader the same code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityReference } from "~/app/services/utilities";

/** The family whose utilities already are the state variants, so a page skips that call. */
export const STATE_FAMILY = "state";

/** The family whose utilities already are the responsive variants, likewise. */
export const RESPONSIVE_FAMILY = "responsive";

/** The same call with a raw CSS length in place of a scale step. */
export function customValue(reference: UtilityReference): string {
	let call = firstCall(reference);
	let custom = call.replace(/\((\d+(\.\d+)?)\)/, '("2.75rem")');
	return custom === call ? call : custom;
}

/** The same call, scoped to the pointer being over the element. */
export function onState(reference: UtilityReference): string {
	return `u.hover(${firstCall(reference)})`;
}

/** The same call, scoped to a container at least `md` wide. */
export function atWidth(reference: UtilityReference): string {
	return `u.at("md", ${firstCall(reference)})`;
}

/** The first documented call, which every derived example is written around. */
function firstCall(reference: UtilityReference): string {
	return reference.examples[0]?.call ?? `u.${reference.name}()`;
}
