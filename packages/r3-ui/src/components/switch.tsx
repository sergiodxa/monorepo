/**
 * A native checkbox styled and wired as an on/off switch: a pill-shaped
 * track whose thumb rests at the inline-start edge unchecked and slides to
 * the inline-end edge once checked, tinting the track with the semantic
 * primary color along the way. Passing `children` wraps the track in a
 * native `<label>` alongside that visible label text, the same
 * self-labeling composition {@link Checkbox} and {@link RadioGroup.Radio}
 * already render; leave `children` unset to render the bare track alone,
 * for pairing with an external {@link Label} or an explicit
 * `aria-label`/`aria-labelledby` instead.
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
	 * Every native `<input>` attribute except `type` and `role`, which the
	 * host fixes to `"checkbox"` and `"switch"` and never exposes for
	 * override, plus the `mix` passthrough. Use `checked`/`defaultChecked`
	 * for the on/off state, `disabled` to disable it, `name`/`value` for form
	 * submission, and `aria-label`/`aria-labelledby` for its accessible name
	 * whenever it isn't nested inside a {@link Label} or given `children`.
	 *
	 * `aria-checked` is also withheld, and for a different reason: the host
	 * deliberately renders none, so nothing may pin one. See the render
	 * function's own note on why an authored value is the wrong way to state
	 * a switch's state.
	 */
	export interface Props extends Omit<TagProps<"input">, "type" | "role" | "aria-checked"> {
		/**
		 * Visible label text rendered after the track, inside the same
		 * native `<label>` wrapping both — clicking or tapping the track or
		 * the label text alike toggles the switch natively, with no
		 * separate `htmlFor`/`id` pair required. Omit to render the bare
		 * track alone, for pairing with an external {@link Label} or an
		 * explicit `aria-label`/`aria-labelledby` instead.
		 */
		children?: RemixNode;
	}
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
 * A hydrated island that needs the switch to carry an explicit
 * `aria-checked` anyway composes the `ariaChecked()` mixin through `mix`,
 * which renders the token from this render's own state and then keeps
 * rewriting it from the live control.
 *
 * Passing `children` wraps the track in a native `<label>` laid out as a
 * row with a small gap, the label text following the track and toggling it
 * when clicked or tapped the same way the track itself does, with the
 * pointer cursor swapping to "not-allowed" once the track is disabled — the
 * same self-labeling composition {@link Checkbox} and
 * {@link RadioGroup.Radio} already render for their own controls. Leaving
 * `children` unset renders the bare track with no wrapping `<label>` at
 * all, unchanged from before, for a consumer pairing it with an external
 * {@link Label} or an explicit `aria-label`/`aria-labelledby` instead.
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
 */
export function Switch(handle: Handle<Switch.Props>) {
	return () => {
		let { mix, children, ...rest } = handle.props;

		/*
		 * No `aria-checked`, on purpose. It is the checkedness of the native
		 * control that assistive technology reports for `role="switch"` — the
		 * same live `checked` state this component's own `&:checked` rules
		 * draw the thumb from — and that state follows the user's clicks.
		 * An authored `aria-checked` could only hold the value this render
		 * produced, so it would take precedence over the live state and go
		 * wrong the moment somebody flipped the switch, which is the one
		 * thing a switch exists to let them do. Withholding it keeps the
		 * announced state and the drawn state the same fact. A hydrated
		 * island that needs the attribute anyway composes the
		 * `ariaChecked()` mixin through `mix`, which keeps rewriting the
		 * token from the live control instead of pinning this render's.
		 */
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
