/**
 * A supplementary detail panel that appears beside a trigger on hover or
 * keyboard focus — a user card beneath an @mention, a definition beneath a
 * term. Its panel shares {@link Popover}'s rounded, bordered, shadowed
 * surface, sized narrower and padded for a compact block of text. Reveal
 * rides `:hover` and `:focus-within` on the compound root, since a
 * hover-revealed surface has no invoker to click — the hover path sits
 * behind `@media (hover: hover)` to avoid a stuck-open panel on coarse
 * pointers, while focus stays unconditional for keyboard and touch users.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { opacity, transition, transitionDuration, visibility } from "@sdxc/u/effects";
import { pointerEvents, raw } from "@sdxc/u/general";
import {
	absolute,
	contents,
	inlineBlock,
	insBe,
	insBs,
	insIe,
	insIs,
	relative,
} from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { is, mb, mbe, mbs, marginLeft, marginRight, mi, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { text } from "@sdxc/u/typography";

import type { AnchorPlacement } from "../utils/placement";

import { floatingSurface } from "../styles/floating-surface";

/**
 * Side of the trigger {@link HoverCard.Content} renders against when
 * `placement` is left unset.
 */
const DEFAULT_PLACEMENT: HoverCard.Placement = "bottom";

/**
 * Prop types for {@link HoverCard} and its compound parts.
 */
export namespace HoverCard {
	/**
	 * Side of the trigger the panel renders against, and — for corner variants
	 * — which trigger edge it aligns to on the perpendicular axis. Names a
	 * physical viewport side, so it keeps attaching under any `dir` value.
	 */
	export type Placement = AnchorPlacement;

	/**
	 * Every native `<span>` attribute, plus the `mix` passthrough. This is
	 * the compound root every part below nests inside — its own hover and
	 * focus-within state is what reveals {@link HoverCard.Content}.
	 */
	export interface Props extends TagProps<"span"> {
		/** The compound root's parts: {@link HoverCard.Trigger} followed by {@link HoverCard.Content}. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link HoverCard.Trigger}.
	 */
	export interface TriggerProps extends TagProps<"span"> {
		/**
		 * The visible trigger — a link, button, or other element. The root
		 * reveals {@link HoverCard.Content} whenever focus or a hover-capable
		 * pointer rests inside it, so pointer users reach the panel even without a focusable child.
		 */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link HoverCard.Content}.
	 */
	export interface ContentProps extends TagProps<"div"> {
		/** Side of the trigger to render against. Defaults to {@link DEFAULT_PLACEMENT}. */
		placement?: Placement;
		/** The panel's content. */
		children: RemixNode;
	}
}

/**
 * Renders the compound root: a `<span>` providing {@link HoverCard.Content}'s
 * anchor and the hover/focus-within scope that reveals it, so hovering or
 * focusing the trigger or panel keeps it open with no script-tracked state.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the compound root's markup.
 * @example
 * <HoverCard>
 * 	<HoverCard.Trigger>
 * 		<Link href={`/users/${user.handle}`}>@{user.handle}</Link>
 * 	</HoverCard.Trigger>
 * 	<HoverCard.Content aria-label={t("userCard.label", { name: user.name })}>
 * 		<p>{user.bio}</p>
 * 	</HoverCard.Content>
 * </HoverCard>
 */
export function HoverCard(handle: Handle<HoverCard.Props>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<span
				data-slot="hover-card"
				{...rest}
				mix={[
					relative(),
					inlineBlock(),
					media(
						"(hover: hover)",
						when('&:hover [data-slot="hover-card-content"]', [
							opacity(100),
							visibility(),
							pointerEvents("auto"),
							raw({
								transitionDelay: "var(--ui-hover-card-open-delay, 0.4s)",
							}),
						]),
					),
					when('&:focus-within [data-slot="hover-card-content"]', [
						opacity(100),
						visibility(),
						pointerEvents("auto"),
						raw({
							transitionDelay: "0s",
						}),
					]),
					mix,
				]}
			>
				{children}
			</span>
		);
	};
}

/**
 * Renders {@link HoverCard.TriggerProps.children} inside a `<span>` styled
 * `display: contents`, so the trigger keeps the child's own layout and
 * hover/focus-within participation, visible straight through to the root above.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the trigger's markup.
 * @example
 * <HoverCard.Trigger>
 * 	<Link href={`/users/${user.handle}`}>@{user.handle}</Link>
 * </HoverCard.Trigger>
 */
HoverCard.Trigger = function HoverCardTrigger(handle: Handle<HoverCard.TriggerProps>) {
	return () => {
		let { children, mix, ...rest } = handle.props;

		return (
			<span data-slot="hover-card-trigger" {...rest} mix={[contents(), mix]}>
				{children}
			</span>
		);
	};
};

/**
 * Renders the panel: a `<div>` sharing {@link Popover}'s surface and placement
 * contract, kept in normal stacking order for its CSS-driven hover/focus
 * reveal, with delays tuned for pointer and keyboard users.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <HoverCard.Content placement="bottom-start">
 * 	<OverlayArrow placement="bottom-start">
 * 		<svg width={12} height={12} viewBox="0 0 12 12">
 * 			<path d="M0 0 L6 6 L12 0" />
 * 		</svg>
 * 	</OverlayArrow>
 * 	<p>{user.bio}</p>
 * </HoverCard.Content>
 */
HoverCard.Content = function HoverCardContent(handle: Handle<HoverCard.ContentProps>) {
	return () => {
		let { placement, children, mix, ...rest } = handle.props;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		return (
			<div
				data-slot="hover-card-content"
				data-placement={resolvedPlacement}
				{...rest}
				mix={[
					floatingSurface(),
					absolute(),
					p(4),
					fg("neutral.emphasis"),
					is("18rem"),
					text("sm"),
					opacity(0),
					transition("opacity, visibility, pointer-events"),
					visibility("hidden"),
					pointerEvents(),
					raw({
						zIndex: "var(--ui-hover-card-z, 50)",
						transitionBehavior: "allow-discrete",
						transitionDelay: "var(--ui-hover-card-close-delay, 0.2s)",
					}),

					when('&[data-placement^="bottom"]', [
						mbs("var(--ui-popover-offset, 0.5rem)"),
						insBs("100%"),
					]),
					when('&[data-placement^="top"]', [
						mbe("var(--ui-popover-offset, 0.5rem)"),
						insBe("100%"),
					]),
					when('&[data-placement^="left"]', [
						marginRight("var(--ui-popover-offset, 0.5rem)"),
						raw({ right: "100%" }),
					]),
					when('&[data-placement^="right"]', [
						marginLeft("var(--ui-popover-offset, 0.5rem)"),
						raw({ left: "100%" }),
					]),

					when('&[data-placement="bottom"], &[data-placement="top"]', [
						mi("auto"),
						insIs("0"),
						insIe("0"),
					]),
					when('&[data-placement="bottom-start"], &[data-placement="top-start"]', insIs("0")),
					when('&[data-placement="bottom-end"], &[data-placement="top-end"]', insIe("0")),
					when('&[data-placement="left"], &[data-placement="right"]', [
						mb("auto"),
						insBs("0"),
						insBe("0"),
					]),
					when('&[data-placement="left-start"], &[data-placement="right-start"]', insBs("0")),
					when('&[data-placement="left-end"], &[data-placement="right-end"]', insBe("0")),

					media("(prefers-reduced-motion: reduce)", [
						transitionDuration("0s"),
						raw({ transitionDelay: "0s" }),
					]),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
};
