/**
 * A preset of {@link Dialog} docked flush against one physical edge of the
 * viewport instead of centered on it, sized to fill that edge and sliding
 * into place from it on open, back out on close. Every other detail —
 * the dimming, blurrable `::backdrop`, the `ui-dialog` named container its
 * compound parts query, and the missing-`id` dev-mode contract check —
 * rides along unchanged from {@link Dialog}, since this component composes
 * it directly instead of duplicating its markup or styling.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { css } from "remix/ui";

import { durations, easings } from "../animations/tokens";

import { Dialog } from "./dialog";

/**
 * Physical edge of the viewport {@link Drawer} docks against when
 * `placement` is left unset.
 */
const DEFAULT_PLACEMENT: Drawer.Placement = "bottom";

/**
 * Prop types for {@link Drawer} and its compound parts. Every compound part
 * is an alias of {@link Dialog}'s matching part, since {@link Drawer} renders
 * straight through to {@link Dialog} rather than declaring an independent
 * markup shape of its own.
 */
export namespace Drawer {
	/**
	 * Physical edge of the viewport the panel docks against and slides in
	 * from. `"left"` and `"right"` name that edge regardless of `dir`, the
	 * same fixed side a docked panel keeps attaching to under any reading
	 * direction; `"top"` and `"bottom"` name the block axis, which already
	 * stays put under `dir` in a horizontal writing mode.
	 */
	export type Placement = "top" | "right" | "bottom" | "left";

	/** Every prop {@link Dialog.Props} accepts, plus `placement`. */
	export interface Props extends Dialog.Props {
		/**
		 * Physical edge of the viewport to dock against and slide in from.
		 * Defaults to {@link DEFAULT_PLACEMENT}.
		 */
		placement?: Placement;
	}

	/** Every prop {@link Dialog.HeaderProps} accepts, unchanged. */
	export interface HeaderProps extends Dialog.HeaderProps {}

	/** Every prop {@link Dialog.TitleProps} accepts, unchanged. */
	export interface TitleProps extends Dialog.TitleProps {}

	/** Every prop {@link Dialog.DescriptionProps} accepts, unchanged. */
	export interface DescriptionProps extends Dialog.DescriptionProps {}

	/** Every prop {@link Dialog.FooterProps} accepts, unchanged. */
	export interface FooterProps extends Dialog.FooterProps {}

	/** Every prop {@link Dialog.CloseProps} accepts, unchanged. */
	export interface CloseProps extends Dialog.CloseProps {}
}

/**
 * Renders {@link Dialog} pinned to one edge of the viewport — full block-size
 * and a fixed inline-size for `"left"`/`"right"`, full inline-size and a
 * fixed block-size for `"top"`/`"bottom"` — with the panel's own `transform`
 * carrying it in from that edge and back out again. The same `::backdrop`
 * treatment {@link Dialog} already renders keeps dimming (and, where
 * supported, blurring) the page behind it, unchanged.
 *
 * The slide rides entirely on the native `open` attribute: the resting
 * (closed) rule sets the panel's transform off the docked edge, the
 * `[open]` rule transitions it to identity, and `@starting-style` paired
 * with `transition-behavior: allow-discrete` lets that same pair of rules
 * animate the close too — the platform holds the panel in place for the
 * transition's duration instead of unmounting it the instant `open` is
 * removed. Under `prefers-reduced-motion: reduce` the transition is dropped
 * entirely, so the panel snaps to its open or closed position instead of
 * sliding.
 *
 * A `mix` passed to {@link Drawer} itself layers alongside this placement
 * styling rather than replacing it.
 *
 * @param handle Runtime handle carrying the host `<dialog>`'s props, plus `placement`.
 * @returns The render function producing the docked panel's markup.
 * @example
 * <Button commandfor="cart" command="show-modal">{t("cart.open")}</Button>
 * <Drawer id="cart" placement="right" aria-labelledby="cart-title">
 * 	<Drawer.Header>
 * 		<Drawer.Title id="cart-title">{t("cart.title")}</Drawer.Title>
 * 	</Drawer.Header>
 * 	<Drawer.Close commandfor="cart" aria-label={t("actions.close")} />
 * </Drawer>
 * @example
 * <Drawer id="filters" placement="bottom" aria-labelledby="filters-title">
 * 	<Drawer.Header>
 * 		<Drawer.Title id="filters-title">{t("filters.title")}</Drawer.Title>
 * 	</Drawer.Header>
 * 	<Drawer.Footer>
 * 		<Button commandfor="filters" command="close">{t("actions.apply")}</Button>
 * 	</Drawer.Footer>
 * </Drawer>
 */
export function Drawer(handle: Handle<Drawer.Props>) {
	return () => {
		let { placement, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		return (
			<Dialog
				{...rest}
				data-placement={resolvedPlacement}
				mix={[
					css({
						position: "fixed",
						margin: "0",
						borderRadius: "0",
						willChange: "transform",
						transitionProperty: "transform, display, overlay",
						transitionDuration: `${durations.slow}ms`,
						transitionTimingFunction: easings.decelerate,
						transitionBehavior: "allow-discrete",

						'&[data-placement="top"]': {
							insetBlockStart: "0",
							insetInlineStart: "0",
							insetInlineEnd: "0",
							blockSize: "24rem",
							maxBlockSize: "90vh",
							inlineSize: "100%",
							maxInlineSize: "none",
							transform: "translateY(-100%)",
						},
						'&[data-placement="top"][open]': {
							transform: "translateY(0)",
						},

						'&[data-placement="bottom"]': {
							insetBlockEnd: "0",
							insetInlineStart: "0",
							insetInlineEnd: "0",
							blockSize: "24rem",
							maxBlockSize: "90vh",
							inlineSize: "100%",
							maxInlineSize: "none",
							transform: "translateY(100%)",
						},
						'&[data-placement="bottom"][open]': {
							transform: "translateY(0)",
						},

						'&[data-placement="left"]': {
							insetBlockStart: "0",
							insetBlockEnd: "0",
							left: "0",
							inlineSize: "22rem",
							maxInlineSize: "90vw",
							maxBlockSize: "none",
							transform: "translateX(-100%)",
						},
						'&[data-placement="left"][open]': {
							transform: "translateX(0)",
						},

						'&[data-placement="right"]': {
							insetBlockStart: "0",
							insetBlockEnd: "0",
							right: "0",
							inlineSize: "22rem",
							maxInlineSize: "90vw",
							maxBlockSize: "none",
							transform: "translateX(100%)",
						},
						'&[data-placement="right"][open]': {
							transform: "translateX(0)",
						},

						"@starting-style": {
							'&[data-placement="top"][open]': { transform: "translateY(-100%)" },
							'&[data-placement="bottom"][open]': { transform: "translateY(100%)" },
							'&[data-placement="left"][open]': { transform: "translateX(-100%)" },
							'&[data-placement="right"][open]': { transform: "translateX(100%)" },
						},

						"@media (prefers-reduced-motion: reduce)": {
							transitionProperty: "none",
						},
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders {@link Drawer.HeaderProps.children} as the panel's header slot:
 * identical to {@link Dialog.Header}, since {@link Drawer} shares its panel
 * markup with {@link Dialog} rather than declaring its own header.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <Drawer.Header>
 * 	<Drawer.Title>{t("cart.title")}</Drawer.Title>
 * </Drawer.Header>
 */
Drawer.Header = Dialog.Header;

/**
 * Renders {@link Drawer.TitleProps.children} as the panel's heading:
 * identical to {@link Dialog.Title}.
 *
 * @param handle Runtime handle carrying the host `<h2>`'s props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Drawer.Title>{t("cart.title")}</Drawer.Title>
 */
Drawer.Title = Dialog.Title;

/**
 * Renders {@link Drawer.DescriptionProps.children} as the panel's supporting
 * copy: identical to {@link Dialog.Description}.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Drawer.Description>{t("cart.description")}</Drawer.Description>
 */
Drawer.Description = Dialog.Description;

/**
 * Renders {@link Drawer.FooterProps.children} as the panel's action row:
 * identical to {@link Dialog.Footer}.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action row's markup.
 * @example
 * <Drawer.Footer>
 * 	<Button commandfor="cart" command="close" variant="outline">{t("actions.cancel")}</Button>
 * 	<Button commandfor="cart" command="close">{t("actions.checkout")}</Button>
 * </Drawer.Footer>
 */
Drawer.Footer = Dialog.Footer;

/**
 * Renders a dismiss control for the ancestor {@link Drawer} named by
 * `commandfor`: identical to {@link Dialog.Close}.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the dismiss control's markup.
 * @example
 * <Drawer.Close commandfor="cart" aria-label={t("actions.close")} />
 */
Drawer.Close = Dialog.Close;
