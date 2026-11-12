/**
 * A ring that fills as a limited field is typed in, the characters left once the limit is
 * near, and how far over once past it, for a post, a bio or a short reply. A client island
 * the server draws for the field's text, so a re-rendered form opens on the right count.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { clientEntry } from "remix/component";

import {
	characterCount,
	characterCountState,
	countCharacters,
	isRingHidden,
} from "../mixins/character-count.js";

export { countCharacters } from "../mixins/character-count.js";

/** How many characters left show the number when `warn` is omitted. */
const DEFAULT_WARN = 20;

/**
 * Props {@link CharacterCount} serializes into the page for hydration, which is why they are
 * a `type`: `SerializableProps` rejects an interface.
 */
export type CharacterCountProps = {
	/** The `id` of the `<textarea>` or `<input>` counted. */
	for: string;
	/** The most characters the field takes, counted by `countCharacters`. */
	max: number;
	/** The field's text as the server renders it, so the first paint shows its count. */
	value?: string;
	/** How many characters left show the number. @default 20 */
	warn?: number;
	/** Disables the form's submit buttons while the field is empty or over the limit. @default false */
	holdSubmit?: boolean;
	/** What a screen reader hears as the state changes; `{count}` is the number left or over. */
	labels: {
		/** Such as "{count} characters left". */
		remaining: string;
		/** Such as "{count} characters over the limit". */
		over: string;
	};
};

/**
 * Renders the ring and its number. The ring sits in a fixed box and scales up for the
 * warning, so the controls beside it never move; past ten over, only the number remains.
 * The island loads from `@sdxc/ui/character-count`, which the browser entry maps.
 *
 * @example
 * <Textarea id="draft" name="text" />
 * <CharacterCount for="draft" max={280} holdSubmit
 * 	labels={{ remaining: "{count} characters left", over: "{count} characters over" }} />
 */
export const CharacterCount: EntryComponent<CharacterCountProps> = clientEntry(
	"@sdxc/ui/character-count#CharacterCount",
	function CharacterCount(handle) {
		return () => {
			let {
				for: field,
				max,
				value = "",
				warn = DEFAULT_WARN,
				holdSubmit = false,
				labels,
			} = handle.props;
			let length = countCharacters(value);
			let state = characterCountState(length, max, warn);
			let left = max - length;
			let shown = state === "warn" || state === "over" ? String(left) : "";

			return (
				<span
					data-slot="character-count"
					data-state={state}
					data-ring-hidden={isRingHidden(left) ? "" : undefined}
					style={`--ui-character-count-progress: ${Math.min(1, length / max)}`}
					mix={[
						characterCount({ for: field, max, warn, holdSubmit, labels }),
						raw({
							"--ui-character-count-tone": "var(--ui-brand-fg)",
							position: "relative",
							display: "inline-grid",
							placeItems: "center",
							flexShrink: 0,
							inlineSize: "1.875rem",
							blockSize: "1.875rem",
							fontSize: "0.75rem",
							fontVariantNumeric: "tabular-nums",
							color: "var(--ui-neutral-fg-muted)",
						}),
						when(
							"&[data-state='warn']",
							raw({ "--ui-character-count-tone": "var(--ui-warning-fg)" }),
						),
						when(
							"&[data-state='over']",
							raw({
								"--ui-character-count-tone": "var(--ui-danger-fg)",
								color: "var(--ui-danger-fg)",
							}),
						),
					]}
				>
					<svg
						viewBox="0 0 20 20"
						aria-hidden="true"
						data-character-count-ring=""
						mix={[
							raw({
								gridArea: "1 / 1",
								inlineSize: "1.25rem",
								blockSize: "1.25rem",
								transform: "rotate(-90deg)",
								transition: "scale 150ms ease-out, opacity 150ms ease-out",
							}),
							when("[data-state='warn'] > &, [data-state='over'] > &", raw({ scale: "1.4" })),
							when("[data-ring-hidden] > &", raw({ opacity: "0" })),
							motionReduce(raw({ transition: "none" })),
						]}
					>
						<circle
							cx="10"
							cy="10"
							r="8"
							fill="none"
							stroke-width="2"
							mix={[raw({ stroke: "var(--ui-neutral-border)" })]}
						/>
						<circle
							cx="10"
							cy="10"
							r="8"
							fill="none"
							stroke-width="2"
							stroke-linecap="round"
							pathLength="100"
							stroke-dasharray="100"
							mix={[
								raw({
									stroke: "var(--ui-character-count-tone)",
									strokeDashoffset: "calc(100 - var(--ui-character-count-progress, 0) * 100)",
									transition: "stroke-dashoffset 120ms linear, stroke 150ms",
								}),
								when("[data-state='empty'] > svg > &", raw({ opacity: "0" })),
								motionReduce(raw({ transition: "none" })),
							]}
						/>
					</svg>
					<span
						aria-hidden="true"
						data-character-count-number=""
						mix={[raw({ gridArea: "1 / 1", lineHeight: "1" })]}
					>
						{shown}
					</span>
					<span role="status" data-character-count-status="" mix={[visuallyHidden()]} />
				</span>
			);
		};
	},
);
