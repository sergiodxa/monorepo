/**
 * A floating surface anchored to whatever element opened it, built entirely
 * on the native Popover API: the host carries the `popover` attribute and
 * opens through `popovertarget` or a Command Invoker (`commandfor`/
 * `command="toggle-popover"`) elsewhere on the page, with no positioning
 * logic running in script. Placement rides CSS anchor positioning, using
 * the invoker relationship as an implicit anchor and the `data-placement`
 * attribute to pick which `position-area` it resolves against.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/ui";

import { inset, positionArea, positionTryFallbacks } from "@pkg/u/layout";
import { m, marginLeft, marginRight, mbe, mbs } from "@pkg/u/size";
import { data, when } from "@pkg/u/state";

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
	 * Side of the anchor the host renders against, and, for the four corner
	 * variants, which anchor edge it aligns to along the perpendicular axis.
	 * Each name is a physical viewport side, fixed under any `dir` value.
	 */
	export type Placement = AnchorPlacement;

	/**
	 * Every native `<div>` attribute, plus the `mix` passthrough, with `id`
	 * narrowed to required, since `popovertarget`, `commandfor`, and the host's
	 * own implicit CSS anchor reference all target it by that id.
	 */
	export interface Props extends Omit<TagProps<"div">, "id" | "popover"> {
		/** Stable id an invoker elsewhere on the page targets to open this host. */
		id: string;
		/**
		 * `popover` attribute mode: `"auto"` dismisses on outside click or Escape
		 * and closes sibling `"auto"` popovers when shown; `"hint"` layers over an
		 * open one without closing it; `"manual"` closes only when hidden explicitly.
		 *
		 * @default {@link DEFAULT_MODE}
		 */
		popover?: "auto" | "hint" | "manual";
		/** Side of the anchor to render against. Defaults to {@link DEFAULT_PLACEMENT}. */
		placement?: Placement;
		/** The popover's content. */
		children: RemixNode;
	}
}

/**
 * Renders the floating surface itself: a `popover`-attributed `<div>`
 * positioned via CSS anchor positioning. The invoker that opens it becomes
 * the implicit anchor its `position-area` resolves against.
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
					positionTryFallbacks("flip-block", "flip-inline", "flip-block flip-inline"),
					data("placement", "top", positionArea("top")),
					data("placement", "top-start", positionArea("top left")),
					data("placement", "top-end", positionArea("top right")),
					data("placement", "bottom", positionArea("bottom")),
					data("placement", "bottom-start", positionArea("bottom left")),
					data("placement", "bottom-end", positionArea("bottom right")),
					data("placement", "left", positionArea("left")),
					data("placement", "left-start", positionArea("left top")),
					data("placement", "left-end", positionArea("left bottom")),
					data("placement", "right", positionArea("right")),
					data("placement", "right-start", positionArea("right top")),
					data("placement", "right-end", positionArea("right bottom")),
					mix,
				]}
			>
				{children}
			</div>
		);
	};
}
