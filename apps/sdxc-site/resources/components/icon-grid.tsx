/**
 * The gallery's tiles: one link per icon to its page, the icon drawn from the sprite
 * through `<use>`, so the grid is plain markup and each drawing reaches the browser once,
 * in the cached sprite, however many tiles the page holds.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { border, fg, outline } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { grid, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { m, p } from "@sdxc/u/size";
import { hover, when } from "@sdxc/u/state";
import { font, text, truncate } from "@sdxc/u/typography";

import type { IconStyle } from "~/app/services/icon-style";
import type { IconEntry } from "~/app/services/icons";

import { iconSearchText, matchesWords, queryWords } from "~/app/services/icon-search";
import {
	DEFAULT_ICON_STYLE,
	ICON_STYLE_VARS,
	iconStyleParams,
	iconStyleVars,
} from "~/app/services/icon-style";
import routes from "~/routes/web";

namespace IconGrid {
	export interface Props {
		/** The grid's id, which the controls and the dialog find it by. */
		id: string;
		/** Every icon the package ships; the ones `query` leaves out render `hidden`. */
		icons: IconEntry[];
		/** The sprite's versioned address, which every tile's `<use>` points into. */
		sprite: string;
		query: string;
		/** The customization the tiles draw and their links carry to each icon's page. */
		style: IconStyle;
	}
}

/** The attribute naming the fragment a tile's detail loads from, for the dialog to open. */
export const ICON_FRAME_ATTRIBUTE = "data-icon-frame";

/**
 * Renders every tile, hiding the ones the query leaves out, so typing a new query on the page
 * only toggles `hidden`. A tile's `<svg>` reads its size, stroke and colour from the grid's
 * custom properties, and the sprite's symbols inherit that stroke.
 */
export default function IconGrid(handle: Handle<IconGrid.Props>) {
	return () => {
		let { icons, id, query, sprite, style } = handle.props;
		let words = queryWords(query);
		let search = iconStyleParams(style).toString();

		return (
			<ul
				id={id}
				data-slot="icon-grid"
				style={iconStyleVars(style)}
				mix={[
					grid(),
					raw({
						gap: "0.5rem",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 7.5rem), 1fr))",
					}),
					m(0),
					p(0),
					listStyle("none"),
					when(
						"& svg",
						raw({
							inlineSize: `var(${ICON_STYLE_VARS.size}, ${DEFAULT_ICON_STYLE.size}px)`,
							blockSize: `var(${ICON_STYLE_VARS.size}, ${DEFAULT_ICON_STYLE.size}px)`,
							stroke: `var(${ICON_STYLE_VARS.color}, currentColor)`,
							strokeWidth: `var(${ICON_STYLE_VARS.strokeWidth}, ${DEFAULT_ICON_STYLE.strokeWidth})`,
						}),
					),
				]}
			>
				{icons.map((icon) => {
					let searchText = iconSearchText(icon.name, icon.tags);
					let page = routes.api.icon.href({ icon: icon.name });
					return (
						<li key={icon.name} data-search={searchText} hidden={!matchesWords(searchText, words)}>
							<a
								href={search === "" ? page : `${page}?${search}`}
								{...{ [ICON_FRAME_ATTRIBUTE]: routes.frames.icon.href({ icon: icon.name }) }}
								data-icon-name={icon.name}
								title={icon.name}
								mix={[
									vstack({ gap: 3, align: "center", justify: "center" }),
									raw({ minBlockSize: "6.5rem", textDecoration: "none", minInlineSize: "0" }),
									p(4, 2),
									rounded("lg"),
									border({ color: "neutral.border", width: 1, style: "solid" }),
									fg("neutral.emphasis"),
									hover(border("brand.border")),
									when("&:focus-visible", outline({ color: "brand.ring", offset: 2 })),
									motionSafe(raw({ transition: "border-color 150ms ease-out" })),
								]}
							>
								<svg
									width={24}
									height={24}
									viewBox="0 0 24 24"
									fill="none"
									stroke="currentColor"
									strokeWidth={2}
									strokeLinecap="round"
									strokeLinejoin="round"
									aria-hidden="true"
								>
									<use href={`${sprite}#${icon.name}`} />
								</svg>
								<span
									mix={[
										raw({ maxInlineSize: "100%" }),
										truncate(),
										font("mono"),
										text("xs"),
										fg("neutral"),
									]}
								>
									{icon.name}
								</span>
							</a>
						</li>
					);
				})}
			</ul>
		);
	};
}
