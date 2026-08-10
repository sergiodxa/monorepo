/**
 * The shared per-part styling shape behind a single-control field
 * convenience wrapper's `parts` prop: a caption, the control itself, an
 * optional supporting passage, and an optional validation message, each
 * keyed to the `mix` its wrapper forwards onto that part's own host element.
 * A wrapper composing more parts than these four — pairing its control with
 * a live preview, say — extends this shape with its own additional named
 * members instead of repeating the four it already covers.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Props as TagProps } from "remix/ui";

/**
 * Per-part styling for a field's caption, control, supporting description,
 * and validation message, layered after each part's own built-in styling.
 * Every member is optional: a field renders its description and error parts
 * only once the wrapper is given copy for them, and a consumer styling only
 * one or two parts leaves the rest at their built-in appearance.
 */
export interface FieldPartsProps {
	/** Styling for the field's caption, rendered through a label element. */
	label?: TagProps<"label">["mix"];
	/** Styling for the control itself, rendered through an input element. */
	input?: TagProps<"input">["mix"];
	/** Styling for the supporting description, rendered only once the field's description copy is set. */
	description?: TagProps<"p">["mix"];
	/** Styling for the validation message, rendered only once the field's error copy is set. */
	error?: TagProps<"span">["mix"];
}
