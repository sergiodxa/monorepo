/**
 * Client island: the CMS content field of a note or TIL with how much of X's limit it has
 * left, recounted on every keystroke over the plain text X would receive. Without script the
 * count is the one the page rendered with, and the save-time check refuses overflow either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { gap, grid } from "@sdxc/u/layout";
import { minBs } from "@sdxc/u/size";
import { font } from "@sdxc/u/typography";
import { Description, FieldError, TextArea } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { shortBudget, shortContent, xLength } from "~/app/services/share";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type ShortFieldProps = {
	/** The textarea's id; the count and the error take it as their prefix. */
	id: string;
	kind: "note" | "til";
	/** The content the page rendered with. */
	content: string;
	/** Why the last save was refused; empty after a save that went through. */
	error: string;
};

/**
 * What the count says for content weighing `used` against `budget`: the room left, or how
 * much it runs over, which is how much to cut.
 */
export function shortCount(budget: number, used: number): string {
	if (used > budget) return `${String(used - budget)} characters over what X allows.`;
	return `${String(budget - used)} of ${String(budget)} characters left on X; links count 23.`;
}

/** The content textarea and its count, announced politely as it changes. */
export const ShortField = clientEntry(
	import.meta.url,
	function ShortField(handle: Handle<ShortFieldProps>) {
		let content = handle.props.content;

		return () => {
			let { error, id, kind } = handle.props;
			let budget = shortBudget(kind);
			let used = xLength(shortContent(content));
			let describedBy = error ? `${id}-count ${id}-error` : `${id}-count`;

			return (
				<div mix={[grid(), gap(1)]}>
					<TextArea
						id={id}
						name="content"
						rows={8}
						required
						defaultValue={handle.props.content}
						aria-describedby={describedBy}
						aria-invalid={used > budget || error ? "true" : undefined}
						mix={[
							font("mono"),
							minBs("12rem"),
							on<HTMLTextAreaElement, "input">("input", (event) => {
								content = event.currentTarget.value;
								void handle.update();
							}),
						]}
					/>
					<Description id={`${id}-count`} aria-live="polite">
						{shortCount(budget, used)}
					</Description>
					{error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
				</div>
			);
		};
	},
);
