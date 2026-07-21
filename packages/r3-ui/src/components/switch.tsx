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

import { attrs, css } from "remix/ui";

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
					css({
						WebkitAppearance: "none",
						appearance: "none",
						position: "relative",
						display: "inline-block",
						verticalAlign: "middle",
						flexShrink: 0,
						margin: "0",
						inlineSize: "var(--ui-switch-track-inline-size, 2.75rem)",
						blockSize: "var(--ui-switch-track-block-size, 1.5rem)",
						borderRadius: "var(--ui-radius-full, 9999px)",
						backgroundColor: "var(--ui-neutral-border)",
						cursor: "pointer",
						transitionProperty: "background-color",
						transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
						transitionDuration: "150ms",

						"&::before": {
							content: '""',
							position: "absolute",
							insetBlockStart: "var(--ui-switch-thumb-inset, 0.125rem)",
							insetInlineStart: "var(--ui-switch-thumb-inset, 0.125rem)",
							inlineSize: "var(--ui-switch-thumb-size, 1.25rem)",
							blockSize: "var(--ui-switch-thumb-size, 1.25rem)",
							borderRadius: "var(--ui-radius-full, 9999px)",
							backgroundColor: "var(--ui-primary-fg-on-solid)",
							boxShadow: "0 1px 3px 0 rgb(0 0 0 / 0.1), 0 1px 2px -1px rgb(0 0 0 / 0.1)",
							transitionProperty: "inset-inline-start, scale",
							transitionTimingFunction: "cubic-bezier(0.4, 0, 0.2, 1)",
							transitionDuration: "150ms",
						},

						"&:checked": {
							backgroundColor: "var(--ui-primary-bg-solid)",

							"&::before": {
								insetInlineStart:
									"calc(var(--ui-switch-track-inline-size, 2.75rem) - var(--ui-switch-thumb-size, 1.25rem) - var(--ui-switch-thumb-inset, 0.125rem))",
							},
						},

						"&:active": {
							backgroundColor: "var(--ui-neutral-border-strong)",

							"&::before": {
								scale: "0.95",
							},
						},

						"&:checked:active": {
							backgroundColor: "var(--ui-primary-bg-solid-hover)",
						},

						"&:focus-visible": {
							outlineWidth: "2px",
							outlineStyle: "solid",
							outlineOffset: "2px",
							outlineColor: "var(--ui-primary-ring)",
						},

						"&:disabled": {
							cursor: "not-allowed",
							opacity: 0.5,
						},

						"@media (prefers-reduced-motion: reduce)": {
							"&::before": {
								transitionDuration: "0s",
							},
						},
					}),
					mix,
				]}
			/>
		);
	};
}
