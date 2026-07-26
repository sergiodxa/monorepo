/**
 * A native checkbox styled and wired as an on/off switch: a pill-shaped
 * track whose thumb rests at the inline-start edge unchecked and slides to
 * the inline-end edge once checked, tinting the track with the semantic
 * primary color along the way. It renders no label text of its own — pair
 * it with {@link Label} or an explicit `aria-label`/`aria-labelledby`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import {
	absolute,
	appearance,
	before,
	bg,
	bs,
	cursor,
	focusVisible,
	inlineBlock,
	insBs,
	insIs,
	is,
	m,
	media,
	opacity,
	outline,
	raw,
	relative,
	rounded,
	scaleProperty,
	shadow,
	shrink,
	transition,
	transitionDuration,
	when,
} from "@pkg/u";
import { attrs } from "remix/ui";

import { durations, easings } from "../animations/tokens";

/**
 * Applied through {@link attrs} so the host always carries the platform's
 * boolean `switch` content attribute. Where a browser recognizes it, the
 * checkbox picks up native switch rendering and its implicit switch
 * accessibility semantics for free; where it doesn't, the attribute sits
 * inert and the host's own CSS plus its explicit `role="switch"` already
 * carry the same appearance and semantics as a baseline.
 */
const DEFAULT_SWITCH_ATTRIBUTE = true;

/**
 * Prop types for {@link Switch}.
 */
export namespace Switch {
	/**
	 * Every native `<input>` attribute except `type`, `role`, and
	 * `aria-checked`, which the host fixes to `"checkbox"`, `"switch"`, and
	 * a value mirroring `checked`/`defaultChecked` respectively, and never
	 * exposes for override, plus the `mix` passthrough. Use
	 * `checked`/`defaultChecked` for the on/off state, `disabled` to disable
	 * it, `name`/`value` for form submission, and
	 * `aria-label`/`aria-labelledby` for its accessible name whenever it
	 * isn't nested inside a {@link Label}.
	 */
	export type Props = Omit<TagProps<"input">, "type" | "role" | "aria-checked">;
}

/**
 * Renders a single `<input type="checkbox" role="switch">` whose own CSS
 * draws the pill track and circular thumb directly on the control, entirely
 * through native pseudo-classes — no tracked state, no `data-*` attributes.
 * Unchecked, the track reads in the subtle neutral border color and the
 * thumb sits inset from the track's inline-start edge; checked, the track
 * fills with the semantic primary color and the thumb slides to the
 * opposite edge. Pressing shrinks the thumb slightly for tactile feedback,
 * a focus-visible ring reads in the primary color, and the disabled state
 * dims the whole control and swaps the cursor to "not-allowed".
 *
 * The host also carries the platform's `switch` content attribute
 * unconditionally, so browsers that implement it render and announce
 * native switch behavior directly, while the `role="switch"` fallback keeps
 * the same accessibility semantics everywhere else.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the switch's markup.
 * @example
 * <Label>
 * 	{t("settings.notifications.label")}
 * 	<Switch name="notifications" defaultChecked />
 * </Label>
 * @example
 * <Switch aria-label={t("settings.darkMode")} checked={isDark} disabled={isLocked} />
 */
export function Switch(handle: Handle<Switch.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;
		let resolvedChecked = handle.props.checked ?? handle.props.defaultChecked ?? false;

		return (
			<input
				{...rest}
				type="checkbox"
				role="switch"
				aria-checked={resolvedChecked}
				mix={[
					attrs({ switch: DEFAULT_SWITCH_ATTRIBUTE }),
					appearance(),
					relative(),
					inlineBlock(),
					m("0"),
					is("var(--ui-switch-track-inline-size, 2.75rem)"),
					bs("var(--ui-switch-track-block-size, 1.5rem)"),
					rounded("full"),
					bg("neutral.border"),
					before([
						absolute(),
						is("var(--ui-switch-thumb-size, 1.25rem)"),
						bs("var(--ui-switch-thumb-size, 1.25rem)"),
						rounded("full"),
						bg("primary.onSolid"),
						transition("inset-inline-start, scale", { duration: 150 }),
					]),
					when("&:checked", bg("primary.solid")),
					when("&:active", bg("neutral.strong")),
					when("&:checked:active", bg("primary.bg-solid-hover")),
					focusVisible(outline({ color: "primary.ring", offset: 2 })),
					when("&:disabled", opacity(50)),
					cursor("pointer"),
					shrink(0),
					transition("background-color", { duration: durations.fast, easing: easings.standard }),
					when("&:disabled", cursor("not-allowed")),
					raw({ verticalAlign: "middle" }),
					before([
						raw({ content: '""' }),
						insBs("var(--ui-switch-thumb-inset, 0.125rem)"),
						insIs("var(--ui-switch-thumb-inset, 0.125rem)"),
						shadow("base"),
					]),
					when(
						"&:checked",
						before(
							insIs(
								"calc(var(--ui-switch-track-inline-size, 2.75rem) - var(--ui-switch-thumb-size, 1.25rem) - var(--ui-switch-thumb-inset, 0.125rem))",
							),
						),
					),
					when("&:active", before(scaleProperty("0.95"))),
					media("(prefers-reduced-motion: reduce)", before(transitionDuration("0s"))),
					mix,
				]}
			/>
		);
	};
}
