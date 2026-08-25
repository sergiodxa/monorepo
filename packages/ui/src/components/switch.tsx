/**
 * A native checkbox styled and wired as an on/off switch: a pill-shaped
 * track whose thumb slides from the inline-start edge to the inline-end
 * edge when checked, tinting with the semantic primary color along the way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import {
	absolute,
	appearance,
	before,
	bg,
	bs,
	cursor,
	focusVisible,
	hstack,
	inlineBlock,
	insBs,
	insIs,
	is,
	m,
	media,
	opacity,
	outline,
	pseudoContent,
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
 * boolean `switch` attribute, letting recognizing browsers render native
 * switch semantics while others fall back to the host's own CSS and `role="switch"`.
 */
const DEFAULT_SWITCH_ATTRIBUTE = true;

/**
 * Prop types for {@link Switch}.
 */
export namespace Switch {
	/**
	 * Every native `<input>` attribute except `type`, `role`, and
	 * `aria-checked` — the host fixes the first two and withholds the third
	 * so the control's own live checkedness stays the switch's only state.
	 */
	export interface Props extends Omit<TagProps<"input">, "type" | "role" | "aria-checked"> {
		/**
		 * Visible label text rendered after the track, inside the same native
		 * `<label>` wrapping both, so clicking either half toggles the switch
		 * with no separate `htmlFor`/`id` pairing required.
		 */
		children?: RemixNode;
	}
}

/**
 * Renders a single `<input type="checkbox" role="switch">`. It carries no
 * `aria-checked` because an authored value would go stale the instant the
 * switch is flipped; the live control's own checkedness is what persists.
 *
 * @param handle Runtime handle carrying the host `<input>`'s props.
 * @returns The render function producing the switch's markup.
 * @example
 * <Switch name="notifications" defaultChecked>{t("settings.notifications.label")}</Switch>
 * @example
 * <Label>
 * 	{t("settings.notifications.label")}
 * 	<Switch name="notifications" defaultChecked />
 * </Label>
 * @example
 * <Switch aria-label={t("settings.darkMode")} checked={isDark} disabled={isLocked} />
 * @example
 * <Switch aria-label={t("settings.notifications")} mix={[ariaChecked()]} />
 */
export function Switch(handle: Handle<Switch.Props>) {
	return () => {
		let { mix, children, ...rest } = handle.props;

		let track = (
			<input
				{...rest}
				type="checkbox"
				// oxlint-disable-next-line jsx-a11y/role-has-required-aria-props -- The host is a native checkbox, so its own checkedness supplies the switch's checked state; see the note above for why authoring one would be worse than omitting it.
				role="switch"
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
						bg("brand.onSolid"),
						transition("inset-inline-start, scale", { duration: 150 }),
					]),
					when("&:checked", bg("brand.solid")),
					when("&:active", bg("neutral.strong")),
					when("&:checked:active", bg("brand.bg-solid-hover")),
					focusVisible(outline({ color: "brand.ring", offset: 2 })),
					when("&:disabled", opacity(50)),
					cursor("pointer"),
					shrink(0),
					transition("background-color", { duration: durations.fast, easing: easings.standard }),
					when("&:disabled", cursor("not-allowed")),
					raw({ verticalAlign: "middle" }),
					before([
						pseudoContent('""'),
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

		if (children === undefined) return track;

		return (
			<label
				mix={[
					hstack({ gap: 2, align: "center" }),
					cursor("pointer"),
					when("&:has(input:disabled)", cursor("not-allowed")),
				]}
			>
				{track}
				{children}
			</label>
		);
	};
}
