/**
 * An edge-docked panel that renders through {@link Dialog} — the same native
 * `<dialog>` host, Invoker Commands, backdrop dimming, and missing-`id` dev
 * warning — repositioned from a centered panel to a fixed inline-side column
 * entirely through CSS keyed off a `data-side` attribute. Compound parts
 * cover a header, title, description, footer, and a dismiss control shaped
 * for a column-docked panel's own layout rather than a centered dialog's.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { borderEdge, fg } from "@pkg/u/color";
import { rounded, transition } from "@pkg/u/effects";
import { raw, willChange } from "@pkg/u/general";
import { fixed, flex, gap, insBe, insBs, items, justify, vstack } from "@pkg/u/layout";
import { media, startingStyle } from "@pkg/u/responsive";
import { is, m, maxBs, maxIs, mbs, pbe, pbs } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";
import { translateX } from "@pkg/u/transform";
import { fontSize } from "@pkg/u/typography";

import { durations, easings } from "../animations/tokens";

import { Dialog } from "./dialog";

/**
 * Physical side of the viewport {@link Sheet} docks to when `side` is left
 * unset.
 */
const DEFAULT_SIDE: Sheet.Side = "right";

/**
 * Prop types for {@link Sheet} and its compound parts.
 */
export namespace Sheet {
	/**
	 * Physical side of the viewport the panel docks to and slides in from.
	 * Each value names a fixed physical side rather than a reading-direction-
	 * relative one, so the panel keeps docking to that same edge under any
	 * `dir` value instead of mirroring for reading direction — the same fixed
	 * edge a device's notch and home indicator sit at, which is what the
	 * panel's safe-area padding tracks.
	 */
	export type Side = "left" | "right";

	/** Every prop {@link Dialog.Props} accepts, plus which side the panel docks to. */
	export interface Props extends Dialog.Props {
		/** Physical side of the viewport to dock to. Defaults to {@link DEFAULT_SIDE}. */
		side?: Side;
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
 * Renders the panel through {@link Dialog}, overriding only its position and
 * size: fixed to the viewport instead of centered in it, stretched flush
 * against the block-start and block-end edges, and pinned to whichever
 * inline edge `side` names. The panel's native `margin: auto` centering is
 * cleared so the edge anchor is unambiguous, and the inline edge opposite the
 * dock is explicitly released to `auto` rather than left at the `inset: 0`
 * the platform's own modal-dialog default already sets on every side — left,
 * right, and an explicit `inlineSize` are otherwise over-constrained, and
 * clearing the far edge is what lets the near edge and the size resolve
 * cleanly instead.
 *
 * The inline measure itself is a fluid cap rather than a fixed breakpoint
 * jump: `90vw` of the viewport up to `--ui-sheet-size` (`24rem` by default),
 * so the panel fills most of the screen on the narrowest phones and settles
 * at a comfortable reading measure everywhere wider, with no viewport
 * breakpoint doing the switching. Every edge that meets the physical screen
 * boundary — the block-start and block-end edges always, plus whichever
 * inline edge `side` docks to — carries `env(safe-area-inset-*)` on top of
 * its base padding, so content never sits under a device's notch or home
 * indicator.
 *
 * The slide rides entirely on the native `open` attribute: the resting
 * (closed) rule sets the panel's `transform` off its docked edge, the
 * `[open]` rule transitions it to identity, and `@starting-style` paired
 * with `transition-behavior: allow-discrete` lets that same pair of rules
 * animate the close too — the platform holds the panel in place for the
 * transition's duration instead of unmounting it the instant `open` is
 * removed. Under `prefers-reduced-motion: reduce` the transition is dropped
 * entirely, so the panel snaps to its open or closed position instead of
 * sliding. Every other detail — the `::backdrop` treatment, the `ui-dialog`
 * named container, and the missing-`id` dev-mode check — rides along
 * unchanged from {@link Dialog}.
 *
 * A `mix` passed to {@link Sheet} itself layers alongside this placement
 * styling rather than replacing it.
 *
 * @param handle Runtime handle carrying the host `<dialog>`'s props, plus `side`.
 * @returns The render function producing the panel's markup.
 * @example
 * <Button commandfor="cart" command="show-modal">{t("cart.open")}</Button>
 * <Sheet id="cart" side="right" aria-labelledby="cart-title">
 * 	<Sheet.Header>
 * 		<Sheet.Title id="cart-title">{t("cart.title")}</Sheet.Title>
 * 		<Sheet.Description>{t("cart.description")}</Sheet.Description>
 * 	</Sheet.Header>
 * 	<Sheet.Footer>
 * 		<Button commandfor="cart" command="close">{t("actions.checkout")}</Button>
 * 	</Sheet.Footer>
 * 	<Sheet.Close commandfor="cart" aria-label={t("actions.close")} />
 * </Sheet>
 * @example
 * <Sheet id="filters" side="left" aria-labelledby="filters-title">
 * 	<Sheet.Header>
 * 		<Sheet.Title id="filters-title">{t("filters.title")}</Sheet.Title>
 * 	</Sheet.Header>
 * </Sheet>
 */
export function Sheet(handle: Handle<Sheet.Props>) {
	return () => {
		let { side, mix, ...rest } = handle.props;
		let resolvedSide = side ?? DEFAULT_SIDE;

		return (
			<Dialog
				{...rest}
				data-side={resolvedSide}
				mix={[
					fixed(),
					m(0),
					rounded("none"),
					maxBs("none"),
					maxIs("none"),
					is("min(90vw, var(--ui-sheet-size, 24rem))"),
					insBs("0"),
					insBe("0"),
					raw({ transitionBehavior: "allow-discrete" }),
					willChange("transform"),
					data("side", "right", [
						borderEdge("left", { width: 1, color: "neutral" }),
						translateX("100%"),
						raw({
							right: "0",
							left: "auto",
							paddingLeft: "1.5rem",
							paddingRight: "calc(1.5rem + env(safe-area-inset-right, 0px))",
						}),
					]),
					data("side", "right", when("&[open]", translateX("0"))),

					data("side", "left", [
						borderEdge("right", { width: 1, color: "neutral" }),
						translateX("-100%"),
						raw({
							left: "0",
							right: "auto",
							paddingRight: "1.5rem",
							paddingLeft: "calc(1.5rem + env(safe-area-inset-left, 0px))",
						}),
					]),
					data("side", "left", when("&[open]", translateX("0"))),

					startingStyle([
						when('&[data-side="right"][open]', translateX("100%")),
						when('&[data-side="left"][open]', translateX("-100%")),
					]),

					media("(prefers-reduced-motion: reduce)", raw({ transitionProperty: "none" })),
					gap("1rem"),
					pbs(`calc(1.5rem + env(safe-area-inset-top, 0px))`),
					pbe(`calc(1.5rem + env(safe-area-inset-bottom, 0px))`),
					transition("transform, display, overlay", {
						duration: durations.slow,
						easing: easings.decelerate,
					}),
					mix,
				]}
			/>
		);
	};
}

/**
 * Renders {@link Sheet.HeaderProps.children} as the panel's header slot: a
 * tightly-stacked column holding {@link Sheet.Title} and
 * {@link Sheet.Description}, always start-aligned rather than centering at
 * narrow widths the way {@link Dialog.Header} does for a centered panel.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the header slot's markup.
 * @example
 * <Sheet.Header>
 * 	<Sheet.Title>{t("cart.title")}</Sheet.Title>
 * 	<Sheet.Description>{t("cart.description")}</Sheet.Description>
 * </Sheet.Header>
 */
Sheet.Header = function SheetHeader(handle: Handle<Sheet.HeaderProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="header" mix={[vstack({ gap: "0.25rem" }), mix]} />;
	};
};

/**
 * Renders {@link Sheet.TitleProps.children} as the panel's heading: identical
 * to {@link Dialog.Title}, since both name a panel with the same size and
 * weight of heading text.
 *
 * @param handle Runtime handle carrying the host `<h2>`'s props.
 * @returns The render function producing the heading's markup.
 * @example
 * <Sheet.Title>{t("cart.title")}</Sheet.Title>
 */
Sheet.Title = Dialog.Title;

/**
 * Renders {@link Sheet.DescriptionProps.children} as the panel's supporting
 * copy, in a native `<p>` set to the panel's own foreground color rather
 * than {@link Dialog.Description}'s more muted one.
 *
 * @param handle Runtime handle carrying the host `<p>`'s props.
 * @returns The render function producing the description's markup.
 * @example
 * <Sheet.Description>{t("cart.description")}</Sheet.Description>
 */
Sheet.Description = function SheetDescription(handle: Handle<Sheet.DescriptionProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<p {...rest} data-slot="description" mix={[fontSize("sm"), fg("neutral"), mix]}>
				{rest.children}
			</p>
		);
	};
};

/**
 * Renders {@link Sheet.FooterProps.children} as the panel's action row: a
 * single end-aligned row pinned to the panel's block-end edge at every
 * width, rather than {@link Dialog.Footer}'s narrow-panel column that only
 * becomes a row once its container grows.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the action row's markup.
 * @example
 * <Sheet.Footer>
 * 	<Button commandfor="cart" command="close" variant="outline">{t("actions.cancel")}</Button>
 * 	<Button commandfor="cart" command="close">{t("actions.checkout")}</Button>
 * </Sheet.Footer>
 */
Sheet.Footer = function SheetFooter(handle: Handle<Sheet.FooterProps>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return (
			<div
				{...rest}
				data-slot="footer"
				mix={[mbs("auto"), flex(), items("center"), justify("end"), gap("0.5rem"), mix]}
			/>
		);
	};
};

/**
 * Renders a dismiss control for the ancestor {@link Sheet} named by
 * `commandfor`: identical to {@link Dialog.Close}.
 *
 * @param handle Runtime handle carrying the host button's props.
 * @returns The render function producing the dismiss control's markup.
 * @example
 * <Sheet.Close commandfor="cart" aria-label={t("actions.close")} />
 */
Sheet.Close = Dialog.Close;
