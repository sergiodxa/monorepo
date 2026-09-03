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

import { borderEdge, fg } from "@sdxc/u/color";
import { rounded, transition, transitionBehavior, transitionProperty } from "@sdxc/u/effects";
import { willChange } from "@sdxc/u/general";
import {
	fixed,
	flex,
	gap,
	insBe,
	insBs,
	insLeft,
	insRight,
	items,
	justify,
	vstack,
} from "@sdxc/u/layout";
import { media, startingStyle } from "@sdxc/u/responsive";
import { is, m, maxBs, maxIs, mbs, paddingLeft, paddingRight, pbe, pbs } from "@sdxc/u/size";
import { data, when } from "@sdxc/u/state";
import { translateX } from "@sdxc/u/transform";
import { fontSize } from "@sdxc/u/typography";

import { durations, easings } from "../animations/tokens.js";

import { Dialog } from "./dialog.js";

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
	 * Physical side of the viewport the panel docks to and slides in from,
	 * fixed rather than reading-direction-relative so it keeps docking to the
	 * same edge under any `dir` value, matching the safe-area padding's edge.
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
 * Renders the panel through {@link Dialog}: fixed, pinned to whichever
 * inline edge `side` names with the far edge released to `auto`, and slid
 * via `@starting-style`/`allow-discrete` so the close animates too.
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
					transitionBehavior("allow-discrete"),
					willChange("transform"),
					data("side", "right", [
						borderEdge("left", { width: 1, color: "neutral" }),
						translateX("100%"),
						insRight("0"),
						insLeft("auto"),
						paddingLeft("1.5rem"),
						paddingRight("calc(1.5rem + env(safe-area-inset-right, 0px))"),
					]),
					data("side", "right", when("&[open]", translateX("0"))),

					data("side", "left", [
						borderEdge("right", { width: 1, color: "neutral" }),
						translateX("-100%"),
						insLeft("0"),
						insRight("auto"),
						paddingRight("1.5rem"),
						paddingLeft("calc(1.5rem + env(safe-area-inset-left, 0px))"),
					]),
					data("side", "left", when("&[open]", translateX("0"))),

					startingStyle([
						when('&[data-side="right"][open]', translateX("100%")),
						when('&[data-side="left"][open]', translateX("-100%")),
					]),

					media("(prefers-reduced-motion: reduce)", transitionProperty("none")),
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
 * tightly-stacked column of {@link Sheet.Title} and {@link Sheet.Description},
 * start-aligned at every width rather than centering like {@link Dialog.Header}.
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
 * single end-aligned row pinned to the block-end edge at every width, unlike
 * {@link Dialog.Footer}'s column that only becomes a row as its container grows.
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
