/**
 * A scrollable region wrapping long or overflowing content — a chat log, a
 * table, a tall list — so it scrolls its own axis inside a bordered panel
 * instead of pushing the surrounding page. {@link ScrollArea.Viewport} is the
 * element that actually scrolls; the root only supplies the panel's border
 * and rounding.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps } from "remix/ui";

import { bg, border, outline } from "@pkg/u/color";
import { rounded } from "@pkg/u/effects";
import { raw } from "@pkg/u/general";
import { relative } from "@pkg/u/layout";
import { overflow } from "@pkg/u/overflow";
import { media } from "@pkg/u/responsive";
import { bs, is } from "@pkg/u/size";
import { data, hover, when } from "@pkg/u/state";
import { attrs } from "remix/ui";

import { panelChrome } from "../styles/panel-chrome";

/**
 * Native tab-stop order applied to {@link ScrollArea.Viewport} through
 * {@link attrs} unless a consumer supplies its own `tabIndex`, so the
 * scrollable region is reachable with the keyboard (arrow keys and
 * Page Up/Down scroll it once it holds focus) even when none of its content
 * is itself focusable.
 */
const DEFAULT_TAB_INDEX = 0;

/**
 * Default {@link ScrollArea.Viewport} axis, applied whenever a consumer
 * omits `orientation`.
 */
const DEFAULT_ORIENTATION: ScrollArea.Orientation = "vertical";

/**
 * Prop types for {@link ScrollArea} and its compound parts.
 */
export namespace ScrollArea {
	/**
	 * Axis {@link ScrollArea.Viewport} scrolls along: only the block axis
	 * (`"vertical"`), only the inline axis (`"horizontal"`), or both at once
	 * (`"both"`).
	 */
	export type Orientation = "vertical" | "horizontal" | "both";

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 */
	export interface Props extends TagProps<"div"> {}

	/**
	 * Every native `<div>` attribute, unchanged, plus the `mix` passthrough.
	 * `orientation` selects which axis scrolls and defaults to
	 * {@link DEFAULT_ORIENTATION}; `tabIndex` defaults to
	 * {@link DEFAULT_TAB_INDEX} but stays overridable (set it to `-1` when the
	 * viewport's own content is already reachable in Tab order and the
	 * viewport itself shouldn't be a separate stop).
	 */
	export interface ViewportProps extends TagProps<"div"> {
		/** Axis the viewport scrolls along. Defaults to {@link DEFAULT_ORIENTATION}. */
		orientation?: Orientation;
	}
}

/**
 * Renders the scroll area's outer panel: a relatively positioned, rounded,
 * bordered `<div>` that visually frames whatever {@link ScrollArea.Viewport}
 * scrolls inside it. The panel itself never scrolls or clips — it is a pure
 * frame, so it composes cleanly with a consumer's own layout around it.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the panel's markup.
 * @example
 * <ScrollArea>
 * 	<ScrollArea.Viewport>
 * 		<p>{t("changelog.body")}</p>
 * 	</ScrollArea.Viewport>
 * </ScrollArea>
 */
export function ScrollArea(handle: Handle<ScrollArea.Props>) {
	return () => {
		let { mix, ...rest } = handle.props;

		return <div {...rest} data-slot="scroll-area" mix={[panelChrome(), relative(), mix]} />;
	};
}

/**
 * Renders the scroll area's scrolling surface: a `<div>` filling its parent
 * panel on both axes, clipping and scrolling along the axis named by
 * `data-orientation`, with a thin, inset native scrollbar (`scrollbar-width:
 * thin`, `scrollbar-gutter: stable` so its reserved gutter never shifts
 * content as it appears or disappears) styled to match the panel's border in
 * WebKit browsers. Smooth-scrolls to in-page anchors and programmatic
 * `scrollIntoView` calls, falling back to an instant jump under
 * `prefers-reduced-motion: reduce`. Gains a focus ring in the semantic
 * primary color when it becomes focus-visible, which happens on its own
 * `tabIndex` stop or on any focusable descendant scrolling it into view. The
 * WebKit scrollbar's own thickness is set with physical `width`/`height`
 * rather than a logical sizing property — WebKit's scrollbar pseudo-elements
 * sit outside the regular box model and don't recognize logical sizing.
 *
 * @param handle Runtime handle carrying the host `<div>`'s props.
 * @returns The render function producing the viewport's markup.
 * @example
 * <ScrollArea.Viewport>
 * 	<Table>...</Table>
 * </ScrollArea.Viewport>
 * @example
 * <ScrollArea.Viewport orientation="horizontal">
 * 	<Toolbar aria-label={t("gallery.filmstrip")}>...</Toolbar>
 * </ScrollArea.Viewport>
 */
ScrollArea.Viewport = function ScrollAreaViewport(handle: Handle<ScrollArea.ViewportProps>) {
	return () => {
		let { orientation, mix, ...rest } = handle.props;
		let resolvedOrientation = orientation ?? DEFAULT_ORIENTATION;

		return (
			<div
				{...rest}
				data-orientation={resolvedOrientation}
				data-slot="viewport"
				mix={[
					attrs({ tabIndex: DEFAULT_TAB_INDEX }),
					when("&:focus-visible", outline({ color: "primary.ring", offset: 2 })),
					is("full"),
					bs("full"),
					raw({
						scrollBehavior: "smooth",
						scrollbarWidth: "thin",
						scrollbarGutter: "stable",
					}),
					// `overflowBlock`/`overflowInline` are logical axis-scoped overflow
					// properties with no `@pkg/u` equivalent (`u.overflow()` only covers
					// the physical `overflowX`/`overflowY` pair).
					data("orientation", "vertical", raw({ overflowBlock: "auto", overflowInline: "hidden" })),
					data(
						"orientation",
						"horizontal",
						raw({ overflowInline: "auto", overflowBlock: "hidden" }),
					),
					data("orientation", "both", overflow("auto")),
					when("&::-webkit-scrollbar", raw({ width: "0.75rem", height: "0.75rem" })),
					when("&::-webkit-scrollbar-track", bg("transparent")),
					when("&::-webkit-scrollbar-thumb", [
						rounded("full"),
						bg("neutral.border"),
						border({ color: "transparent", width: "3px" }),
						raw({ backgroundClip: "content-box" }),
						hover(bg("neutral.strong")),
					]),
					media("(prefers-reduced-motion: reduce)", raw({ scrollBehavior: "auto" })),
					mix,
				]}
			/>
		);
	};
};
