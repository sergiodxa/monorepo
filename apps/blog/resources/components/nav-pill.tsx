/**
 * The header's pill: a navigation link drawn as a fully rounded, fixed-height capsule with
 * a one-pixel border. Every item in the header row, the search link included, is one, so
 * their heights, radii and borders cannot drift apart.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg, border } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { gap, inlineFlex, items, justify, shrink } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, pi } from "@sdxc/u/size";
import { text, textDecoration } from "@sdxc/u/typography";
import { NavLink } from "@sdxc/ui";

/**
 * Screens wide enough for the header's full layout: the search link as a labelled pill at
 * the end of the navigation, and a click on it opening the search dialog. Narrower screens
 * get a round search link beside the site name, which goes to the `/search` page.
 */
export const WIDE_SCREEN = "(min-width: 40rem)";

/** Prop types for {@link NavPill}. */
export namespace NavPill {
	export type Props = NavLink.Props & {
		/** Marks the pill as the current page: brand-tinted, with `aria-current="page"`. */
		active?: boolean;
		/**
		 * `"round"` draws an icon-only circle as tall as the pills, widening into a pill on
		 * a {@link WIDE_SCREEN} for the label it then shows.
		 */
		shape?: "pill" | "round";
	};
}

/**
 * Renders the pill. Its height is fixed and its padding horizontal only, so a label, an
 * icon or a keyboard hint inside sits centered without stretching it.
 */
export function NavPill(handle: Handle<NavPill.Props>) {
	return () => {
		let { active, children, mix, shape, ...rest } = handle.props;

		return (
			<NavLink
				{...rest}
				color={active ? "brand" : "neutral"}
				hasBackground
				aria-current={active ? "page" : undefined}
				mix={[
					inlineFlex(),
					items("center"),
					justify("center"),
					gap(1.5),
					shrink(0),
					bs(7),
					shape === "round" ? [is(7), media(WIDE_SCREEN, [is("auto"), pi(3)])] : pi(3),
					text("sm"),
					textDecoration("none"),
					rounded("full"),
					border({ width: 1, color: active ? "brand" : "neutral" }),
					bg(active ? "brand.tint" : "neutral.bg-tint-hover"),
					mix,
				]}
			>
				{children}
			</NavLink>
		);
	};
}
