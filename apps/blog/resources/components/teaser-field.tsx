/**
 * Client island: the CMS teaser field with how much of X's limit it has left, recounted on
 * every keystroke in the teaser or the title. Without script the count is the one the page
 * rendered with, and the save-time check refuses a teaser that does not fit either way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { gap, grid } from "@sdxc/u/layout";
import { Description, FieldError, Input } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import { teaserBudget, xLength } from "~/app/services/share";

/** Props must be a `type` rather than an `interface` to satisfy `SerializableProps`. */
type TeaserFieldProps = {
	/** The teaser input's id; the count and the error take it as their prefix. */
	id: string;
	/** The title input whose length sets the budget. */
	titleId: string;
	kind: "article" | "tutorial";
	/** The title the page rendered with. */
	title: string;
	/** The teaser the page rendered with. */
	teaser: string;
	/** Why the last save was refused; empty after a save that went through. */
	error: string;
};

/**
 * What the count says for a teaser weighing `used` against `budget`: the room left, how much
 * it runs over, or how much to cut from a title that leaves no room at all.
 */
export function teaserCount(budget: number, used: number): string {
	if (budget <= 0) {
		return `The title leaves no room for a teaser on X; shorten it by ${String(1 - budget)}.`;
	}
	if (used === 0) {
		return `Up to ${String(budget)} characters on X; left blank, the excerpt stands in.`;
	}
	if (used > budget) return `${String(used - budget)} characters over what X allows.`;
	return `${String(budget - used)} of ${String(budget)} characters left on X.`;
}

/**
 * The teaser input and its count. The title input lives elsewhere in the form, so the island
 * listens to it by id; the count is announced politely as it changes.
 */
export const TeaserField = clientEntry(
	import.meta.url,
	function TeaserField(handle: Handle<TeaserFieldProps>) {
		let title = handle.props.title;
		let teaser = handle.props.teaser;

		handle.queueTask(() => {
			let input = document.getElementById(handle.props.titleId);
			input?.addEventListener(
				"input",
				() => {
					if (!(input instanceof HTMLInputElement)) return;
					title = input.value;
					void handle.update();
				},
				{ signal: handle.signal },
			);
		});

		return () => {
			let { error, id, kind } = handle.props;
			let budget = teaserBudget({ kind, title });
			let used = xLength(teaser.replace(/\s+/gu, " ").trim());
			let over = used > budget || (budget <= 0 && used > 0);
			let describedBy = error ? `${id}-count ${id}-error` : `${id}-count`;

			return (
				<div mix={[grid(), gap(1)]}>
					<Input
						id={id}
						name="teaser"
						defaultValue={handle.props.teaser}
						aria-describedby={describedBy}
						aria-invalid={over || error ? "true" : undefined}
						mix={[
							on<HTMLInputElement, "input">("input", (event) => {
								teaser = event.currentTarget.value;
								void handle.update();
							}),
						]}
					/>
					<Description id={`${id}-count`} aria-live="polite">
						{teaserCount(budget, used)}
					</Description>
					{error ? <FieldError id={`${id}-error`}>{error}</FieldError> : null}
				</div>
			);
		};
	},
);
