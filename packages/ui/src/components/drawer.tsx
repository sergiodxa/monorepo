/**
 * A preset of {@link Dialog} docked flush against one physical edge of the
 * viewport, sized to fill that edge and sliding into place from it on open,
 * back out on close. Every other detail — the dimming, blurrable
 * `::backdrop`, the `ui-dialog` named container its compound parts query,
 * and the missing-`id` dev-mode contract check — carries over from
 * {@link Dialog}, since this component composes it directly.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { rounded, transition, transitionBehavior, transitionProperty } from "@pkg/u/effects";
import { willChange } from "@pkg/u/general";
import { fixed, insBe, insBs, insIe, insIs, insLeft, insRight } from "@pkg/u/layout";
import { media, startingStyle } from "@pkg/u/responsive";
import { bs, is, m, maxBs, maxIs } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";
import { translateX, translateY } from "@pkg/u/transform";

import { durations, easings } from "../animations/tokens";

import { Dialog } from "./dialog";

/**
 * Physical edge of the viewport {@link Drawer} docks against when
 * `placement` is left unset.
 */
const DEFAULT_PLACEMENT: Drawer.Placement = "bottom";

/**
 * Prop types for {@link Drawer} and its compound parts. Each compound part
 * aliases {@link Dialog}'s matching part, since {@link Drawer} renders
 * straight through to {@link Dialog}'s markup.
 */
export namespace Drawer {
	/**
	 * Physical edge of the viewport the panel docks against and slides in from.
	 * `"left"`/`"right"` name that fixed edge regardless of `dir`;
	 * `"top"`/`"bottom"` name the block axis, which already tracks `dir` on its own.
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
 * Renders {@link Dialog} pinned to one edge of the viewport, animating a
 * `transform` off the native `open` attribute so `@starting-style` can
 * animate the close; a `mix` prop composes alongside this placement styling.
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
					fixed(),
					m(0),
					rounded("none"),
					transition("transform, display, overlay", {
						duration: `${durations.slow}ms`,
						easing: easings.decelerate,
					}),
					willChange("transform"),
					transitionBehavior("allow-discrete"),

					data("placement", "top", [
						insBs("0"),
						insIs("0"),
						insIe("0"),
						bs("24rem"),
						maxBs("90vh"),
						is("full"),
						maxIs("none"),
						translateY("-100%"),
						when("&[open]", translateY(0)),
					]),

					data("placement", "bottom", [
						insBe("0"),
						insIs("0"),
						insIe("0"),
						bs("24rem"),
						maxBs("90vh"),
						is("full"),
						maxIs("none"),
						translateY("100%"),
						when("&[open]", translateY(0)),
					]),

					data("placement", "left", [
						insBs("0"),
						insBe("0"),
						insLeft("0"),
						is("22rem"),
						maxIs("90vw"),
						maxBs("none"),
						translateX("-100%"),
						when("&[open]", translateX(0)),
					]),

					data("placement", "right", [
						insBs("0"),
						insBe("0"),
						insRight("0"),
						is("22rem"),
						maxIs("90vw"),
						maxBs("none"),
						translateX("100%"),
						when("&[open]", translateX(0)),
					]),

					startingStyle([
						when('&[data-placement="top"][open]', translateY("-100%")),
						when('&[data-placement="bottom"][open]', translateY("100%")),
						when('&[data-placement="left"][open]', translateX("-100%")),
						when('&[data-placement="right"][open]', translateX("100%")),
					]),

					media("(prefers-reduced-motion: reduce)", transitionProperty("none")),

					mix,
				]}
			/>
		);
	};
}

/**
 * Renders {@link Drawer.HeaderProps.children} as the panel's header slot,
 * routed straight through to {@link Dialog.Header}'s markup.
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
