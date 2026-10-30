/**
 * The pause control every looping marketing animation carries: a checkbox drawn as a
 * small round button, so a loop longer than five seconds can be stopped with no script.
 * Its host pauses descendants from `:has(:checked)`, read through {@link pausedWhenChecked}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/component";

import { PauseIcon, PlayIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { combine, raw } from "@sdxc/u/general";
import { media } from "@sdxc/u/responsive";
import { hover, when } from "@sdxc/u/state";

/**
 * Prop types for {@link PauseToggle}.
 */
export namespace PauseToggle {
	/**
	 * Props accepted by {@link PauseToggle}.
	 */
	export interface Props extends TagProps<"label"> {
		/** Accessible name of the checkbox; checked means paused. */
		label: string;
	}
}

/**
 * Renders a 2rem round toggle showing a pause glyph while the loop runs and a play glyph
 * once paused. Under reduced motion nothing loops, so the toggle hides itself.
 *
 * @param handle Runtime handle carrying the host `<label>`'s props.
 * @returns The render function producing the toggle's markup.
 */
export function PauseToggle(handle: Handle<PauseToggle.Props>) {
	return () => {
		let { label, mix, ...rest } = handle.props;

		return (
			<label {...rest} data-slot="pause-toggle" mix={[toggle(), mix]}>
				<input type="checkbox" aria-label={label} mix={[visuallyHidden()]} />
				<PauseIcon aria-hidden="true" data-glyph="pause" />
				<PlayIcon aria-hidden="true" data-glyph="play" />
			</label>
		);
	};
}

/**
 * Pauses every animation inside a host while its {@link PauseToggle} is checked, and
 * while the pointer or focus is inside `target` when one is given.
 *
 * @param target A descendant selector that also pauses on hover and focus.
 * @returns A `css()` mixin for the element that holds both the toggle and the loop.
 */
export function pausedWhenChecked(target?: string) {
	let paused = raw({ animationPlayState: "paused" });

	let checked = '&:has([data-slot="pause-toggle"] :checked)';
	let scopes = [checked];
	if (target) scopes.push(`& ${target}:hover`, `& ${target}:focus-within`);

	return combine([
		when(
			scopes
				.flatMap((scope) => [`${scope} *`, `${scope} *::before`, `${scope} *::after`])
				.join(", "),
			paused,
		),
	]);
}

/** The toggle's chrome: a framed circle on the page color, glyph swapped by state. */
function toggle() {
	return combine([
		raw({
			position: "relative",
			display: "inline-grid",
			placeItems: "center",
			flexShrink: "0",
			inlineSize: "2rem",
			blockSize: "2rem",
			borderRadius: "9999px",
			backgroundColor: "var(--ui-bg)",
			boxShadow: "inset 0 0 0 1px var(--ui-marketing-hairline)",
			color: "var(--ui-neutral-fg)",
			cursor: "pointer",
		}),
		when(
			"&::after",
			raw({
				content: '""',
				position: "absolute",
				inset: "min(0px, calc((2rem - var(--ui-target-size, 1.5rem)) / 2))",
			}),
		),
		when("& > svg", raw({ gridArea: "1 / 1", inlineSize: "0.875rem", blockSize: "0.875rem" })),
		when('& > [data-glyph="play"]', raw({ visibility: "hidden" })),
		when('&:has(:checked) > [data-glyph="play"]', raw({ visibility: "visible" })),
		when('&:has(:checked) > [data-glyph="pause"]', raw({ visibility: "hidden" })),
		hover(raw({ color: "var(--ui-neutral-fg-emphasis)" })),
		when(
			"&:has(:focus-visible)",
			raw({
				outline: "2px solid var(--ui-focus-ring, var(--ui-brand-border-strong))",
				outlineOffset: "2px",
			}),
		),
		media("(prefers-reduced-motion: reduce)", raw({ display: "none" })),
	]);
}
