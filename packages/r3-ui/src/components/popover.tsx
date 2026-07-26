/**
 * A floating surface anchored to whatever element opened it, built entirely
 * on the native Popover API: the host carries the `popover` attribute and
 * opens through `popovertarget` or a Command Invoker (`commandfor`/
 * `command="toggle-popover"`) elsewhere on the page, with no positioning
 * logic running in script. Placement rides CSS anchor positioning — the
 * invoker relationship gives the host an implicit anchor, and the
 * `data-placement` attribute contract picks which `position-area` and
 * fallback list it resolves against. Foundational surface other floating
 * components layer their own content and motion on top of.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { raw } from "@pkg/u/general";
import { inset } from "@pkg/u/layout";
import { m, marginLeft, marginRight, mbe, mbs } from "@pkg/u/size";
import { when } from "@pkg/u/state";

import type { AnchorPlacement } from "../utils/placement";

import { floatingSurface } from "../styles/floating-surface";

/**
 * Side of the anchor {@link Popover} renders against when `placement` is
 * left unset.
 */
const DEFAULT_PLACEMENT: Popover.Placement = "bottom";

/**
 * `popover` attribute mode applied when a consumer leaves it unset, giving
 * the host light-dismiss behavior: it closes on outside click or Escape, and
 * showing it closes any other `"auto"` popover already open.
 */
const DEFAULT_MODE: NonNullable<Popover.Props["popover"]> = "auto";

/**
 * Prop types for {@link Popover}.
 */
export namespace Popover {
	/**
	 * Side of the anchor the host renders against, and — for the four corner
	 * variants — which of the anchor's edges it aligns to along the
	 * perpendicular axis. Each names a physical side of the viewport, the same
	 * one a positioning engine would choose when flipping the host to stay in
	 * view, so a placement keeps attaching to that same physical side under
	 * any `dir` value rather than mirroring for reading direction.
	 */
	export type Placement = AnchorPlacement;

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough, with `id`
	 * narrowed to required — `popovertarget`, `commandfor`, and this host's own
	 * implicit CSS anchor reference all target it by that id — and `popover`
	 * narrowed away from its raw boolean shorthand to the three named modes.
	 */
	export interface Props extends Omit<TagProps<"div">, "id" | "popover"> {
		/** Stable id an invoker elsewhere on the page targets to open this host. */
		id: string;
		/**
		 * `popover` attribute mode. `"auto"` closes on outside click or Escape
		 * and dismisses sibling `"auto"` popovers when shown; `"hint"` layers on
		 * top of an open `"auto"` popover without closing it, for tooltip-style
		 * content; `"manual"` closes only when explicitly hidden. Defaults to
		 * {@link DEFAULT_MODE}.
		 */
		popover?: "auto" | "hint" | "manual";
		/** Side of the anchor to render against. Defaults to {@link DEFAULT_PLACEMENT}. */
		placement?: Placement;
		/** The popover's content. */
		children: RemixNode;
	}
}

/**
 * Renders the floating surface itself: a `popover`-attributed `<div>` with a
 * rounded, bordered, shadowed panel look, positioned through CSS anchor
 * positioning rather than any script-computed coordinates. An invoker
 * elsewhere on the page — a `<button popovertarget={id}>` or a
 * `<button commandfor={id} command="toggle-popover">` — both opens the host
 * and, per the CSS Anchor Positioning implicit-anchor behavior, becomes the
 * reference its `position-area` resolves against, so no explicit
 * `anchor-name`/`position-anchor` wiring is needed for the common case. A
 * consumer anchoring against something other than its own invoker can still
 * set `position-anchor` through the inherited `style` prop.
 *
 * `position-try-fallbacks` lets the host flip across either axis when its
 * preferred `placement` would overflow the viewport, the CSS-native
 * replacement for a script-driven collision pass. The host carries no
 * transition of its own — compose an `enterExit()`-based factory from the
 * animation layer through `mix` for an entrance/exit fade, since different
 * surfaces built on this one favor different motion.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the surface's markup.
 * @example
 * <button commandfor="account-menu" command="toggle-popover">{t("nav.account")}</button>
 * <Popover id="account-menu" placement="bottom-start">
 * 	<p>{t("nav.accountMenu.body")}</p>
 * </Popover>
 * @example
 * <Popover id="filters" placement="top" mix={[fade({ duration: durations.normal })]}>
 * 	<OverlayArrow placement="top">
 * 		<svg width={12} height={12} viewBox="0 0 12 12">
 * 			<path d="M0 0 L6 6 L12 0" />
 * 		</svg>
 * 	</OverlayArrow>
 * 	{content}
 * </Popover>
 */
export function Popover(handle: Handle<Popover.Props>) {
	return () => {
		let { id, popover, placement, children, mix, ...rest } = handle.props;
		let resolvedMode = popover ?? DEFAULT_MODE;
		let resolvedPlacement = placement ?? DEFAULT_PLACEMENT;

		return (
			<div
				id={id}
				popover={resolvedMode}
				data-placement={resolvedPlacement}
				{...rest}
				mix={[
					floatingSurface(),
					m("0"),
					inset("auto"),
					when('&[data-placement^="top"]', mbe("var(--ui-popover-offset, 0.5rem)")),
					when('&[data-placement^="bottom"]', mbs("var(--ui-popover-offset, 0.5rem)")),
					when('&[data-placement^="left"]', marginRight("var(--ui-popover-offset, 0.5rem)")),
					when('&[data-placement^="right"]', marginLeft("var(--ui-popover-offset, 0.5rem)")),
					raw({
						positionTryFallbacks: "flip-block, flip-inline, flip-block flip-inline",

						'&[data-placement="top"]': { positionArea: "top" },
						'&[data-placement="top-start"]': { positionArea: "top left" },
						'&[data-placement="top-end"]': { positionArea: "top right" },
						'&[data-placement="bottom"]': { positionArea: "bottom" },
						'&[data-placement="bottom-start"]': { positionArea: "bottom left" },
						'&[data-placement="bottom-end"]': { positionArea: "bottom right" },
						'&[data-placement="left"]': { positionArea: "left" },
						'&[data-placement="left-start"]': { positionArea: "left top" },
						'&[data-placement="left-end"]': { positionArea: "left bottom" },
						'&[data-placement="right"]': { positionArea: "right" },
						'&[data-placement="right-start"]': { positionArea: "right top" },
						'&[data-placement="right-end"]': { positionArea: "right bottom" },
					}),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}
