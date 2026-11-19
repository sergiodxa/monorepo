/**
 * A star picker for a review form: a fieldset of native radios drawn as stars, where the
 * picked star and every one before it fill, and hovering previews a score. It posts a plain
 * number, the arrow keys move between stars, and it works with no script at all.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { mergeMix, raw } from "@sdxc/u/general";

import { STAR_PATH } from "./rating.js";

/** Painted on a filled star. */
const FILLED = "var(--ui-rating-color, var(--ui-warning-bg-solid))";

/** Painted on a star past the score. */
const EMPTY = "var(--ui-neutral-border-strong, var(--ui-neutral-border))";

/** Prop types for {@link RatingInput}. */
export namespace RatingInput {
	/** Props accepted by {@link RatingInput}; the host is a `<fieldset>`. */
	export interface Props extends Omit<TagProps<"fieldset">, "children" | "name"> {
		/** The field the score posts as. */
		name: string;
		/** The score picked now, from 1 to the number of labels. */
		value?: number;
		required?: boolean;
		/** The question the stars answer, such as "Your rating". */
		legend: RemixNode;
		/** One name per star, lowest first, such as "1 star — Poor"; their count sets the scale. */
		labels: string[];
	}
}

/**
 * Renders one radio and its star label per entry of `labels`, in score order so the native
 * arrow keys step up and down the scale. A star fills when its own radio or any later one is
 * checked, and hovering a star fills it and every earlier one in place of the checked score.
 *
 * @example
 * <RatingInput name="rating" legend="Your rating" required labels={["1 star — Poor", "2 stars — Fair", "3 stars — Good", "4 stars — Great", "5 stars — Excellent"]} />
 */
export function RatingInput(handle: Handle<RatingInput.Props>) {
	return () => {
		let { id, labels, legend, mix, name, required, value, ...rest } = handle.props;
		let base = id ?? handle.id;
		return (
			<fieldset
				{...rest}
				id={id}
				data-slot="rating-input"
				mix={mergeMix([raw({ margin: "0", padding: "0", border: "0", minInlineSize: "0" })], mix)}
			>
				<legend
					mix={[
						raw({
							padding: "0",
							marginBlockEnd: "0.5rem",
							fontSize: "0.875rem",
							fontWeight: "600",
							color: "var(--ui-neutral-fg-emphasis)",
						}),
					]}
				>
					{legend}
				</legend>
				<div
					data-slot="rating-input-stars"
					mix={[
						raw({
							position: "relative",
							display: "inline-flex",
							gap: "0.125rem",
							"& label": {
								display: "grid",
								placeItems: "center",
								inlineSize: "2.75rem",
								blockSize: "2.75rem",
								borderRadius: "0.5rem",
								color: EMPTY,
								cursor: "pointer",
								transition: "color 120ms ease, transform 120ms ease",
							},
							"& svg": { inlineSize: "1.75rem", blockSize: "1.75rem" },
							"& input:checked + label, & label:has(~ input:checked)": { color: FILLED },
							"&:has(label:hover) label": { color: EMPTY },
							"&:has(label:hover) label:hover, &:has(label:hover) label:has(~ label:hover)": {
								color: FILLED,
							},
							"& input:focus-visible + label": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "-2px",
							},
							"& input:disabled + label": { cursor: "not-allowed", opacity: "0.5" },
							"@media (prefers-reduced-motion: reduce)": { "& label": { transition: "none" } },
						}),
					]}
				>
					{labels.map((label, index) => {
						let score = index + 1;
						let inputId = `${base}-${score}`;
						return (
							<>
								<input
									type="radio"
									id={inputId}
									name={name}
									value={String(score)}
									defaultChecked={value === score}
									required={required}
									mix={[visuallyHidden()]}
								/>
								<label htmlFor={inputId} title={label} data-score={String(score)}>
									<svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
										<path d={STAR_PATH} fill="currentColor" />
									</svg>
									<span mix={[visuallyHidden()]}>{label}</span>
								</label>
							</>
						);
					})}
				</div>
			</fieldset>
		);
	};
}
