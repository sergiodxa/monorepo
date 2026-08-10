/**
 * A supplementary detail panel that appears beside a trigger on hover or
 * keyboard focus — a user card beneath an @mention, a definition beneath a
 * term. Its panel shares {@link Popover}'s treatment: the same rounded,
 * bordered, shadowed surface tinted with the neutral tint background, sized
 * narrower and padded for a compact block of text. Reveal rides `:hover` and
 * `:focus-within` on the compound root rather than the Popover API, since
 * showing a surface on hover has no invoker to click — the hover path sits
 * behind `@media (hover: hover)` so a coarse pointer never gets a stuck-open
 * panel, and the focus path stays unconditional, so a keyboard user (and a
 * touch user tapping into a focusable trigger) reaches the same content.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { fg } from "@pkg/u/color";
import { opacity, transition, transitionDuration, visibility } from "@pkg/u/effects";
import { pointerEvents, raw } from "@pkg/u/general";
import {
	absolute,
	contents,
	inlineBlock,
	insBe,
	insBs,
	insIe,
	insIs,
	relative,
} from "@pkg/u/layout";
import { media } from "@pkg/u/responsive";
import { is, mb, mbe, mbs, marginLeft, marginRight, mi, p } from "@pkg/u/size";
import { when } from "@pkg/u/state";
import { text } from "@pkg/u/typography";

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
	 * Side of the trigger the panel renders against, and — for the four
	 * corner variants — which of the trigger's edges it aligns to along the
	 * perpendicular axis. Each names a physical side of the viewport, so a
	 * placement keeps attaching to that same physical side under any `dir`
	 * value rather than mirroring for reading direction.
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
		 * The visible trigger, typically a link, button, or another element
		 * that already accepts keyboard focus on its own — the root only
		 * reveals {@link HoverCard.Content} while focus or a hover-capable
		 * pointer rests somewhere inside it, so a non-focusable child leaves
		 * the panel reachable by pointer alone.
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
 * Renders the compound root: a `<span>` establishing the positioning context
 * {@link HoverCard.Content} anchors against and the hover/focus-within scope
 * that reveals it. Because `:hover` and `:focus-within` both bubble up from
 * any descendant, wrapping {@link HoverCard.Trigger} and
 * {@link HoverCard.Content} in the same root reproduces "stay open while the
 * pointer or focus is on the trigger or the panel" without tracking either
 * state in script — moving the pointer from the trigger across the gap into
 * the panel keeps the root hovered the whole way, and moving focus from the
 * trigger onto a link inside the panel keeps it focus-within the whole way.
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
 * Renders {@link HoverCard.TriggerProps.children} inside a `<span>` that
 * generates no box of its own (`display: contents`), so it neither adds an
 * extra inline wrapper to the trigger's layout nor changes its own hover or
 * focus-within participation — the root above still sees straight through to
 * whatever focusable or hoverable element the trigger renders.
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
 * Renders the panel itself: a rounded, bordered, softly shadowed `<div>`
 * sharing {@link Popover}'s surface treatment, absolutely positioned against
 * the {@link HoverCard} root through the same `data-placement` attribute
 * contract Popover and {@link OverlayArrow} use, offset from the trigger by
 * `--ui-popover-offset`. It renders in the document's normal stacking order
 * (layered above nearby content through `--ui-hover-card-z`) rather than the
 * top layer, since it never carries the `popover` attribute — nothing calls
 * `showPopover()`, and revealing it is entirely `:hover`/`:focus-within`
 * driven.
 *
 * Hidden by default (`visibility: hidden`, transparent, inert to pointer
 * events), it fades to its resting opacity only once the ancestor root's
 * `&:hover`/`&:focus-within` rule matches, over `durations.fast` — the
 * catalog's timing for small anchored surfaces. `visibility` and
 * `pointer-events` ride along in the same transition (via
 * `transition-behavior: allow-discrete`) rather than snapping instantly, so
 * the panel stays visible and interactive for the whole
 * `--ui-hover-card-close-delay` grace window after the pointer leaves the
 * trigger — long enough to cross the gap into the panel itself before it
 * actually disappears. Opening is delayed by `--ui-hover-card-open-delay` on
 * hover and unset (immediate) on focus-within, matching a keyboard user
 * moving focus straight onto the trigger. `prefers-reduced-motion: reduce`
 * collapses every delay and duration to zero, so no preference for reduced
 * motion is read as an invitation to linger either.
 *
 * Compose {@link OverlayArrow} as a direct child for a pointer glyph back to
 * the trigger, exactly as {@link Popover} does.
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
