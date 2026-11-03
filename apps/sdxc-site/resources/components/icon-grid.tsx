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

import type { IconEntry } from "~/app/services/icons";

import routes from "~/routes/web";

namespace IconGrid {
	export interface Props {
		icons: IconEntry[];
		/** The sprite's versioned address, which every tile's `<use>` points into. */
		sprite: string;
	}
}

/**
 * Renders the tiles. Each tile's `<svg>` carries the stroke every Lucide icon is drawn with,
 * which the sprite's symbols inherit, and its `data-search` holds the name and tags a filter
 * on the page matches against.
 */
export default function IconGrid(handle: Handle<IconGrid.Props>) {
	return () => {
		let { icons, sprite } = handle.props;
		return (
			<ul
				data-slot="icon-grid"
				mix={[
					grid(),
					raw({
						gap: "0.5rem",
						gridTemplateColumns: "repeat(auto-fill, minmax(min(100%, 7.5rem), 1fr))",
					}),
					m(0),
					p(0),
					listStyle("none"),
				]}
			>
				{icons.map((icon) => (
					<li key={icon.name} data-search={[icon.name, ...icon.tags].join(" ")}>
						<a
							href={routes.api.icon.href({ icon: icon.name })}
							title={icon.name}
							mix={[
								vstack({ gap: 3, align: "center" }),
								p(4, 2),
								rounded("lg"),
								border({ color: "neutral.border", width: 1, style: "solid" }),
								fg("neutral.emphasis"),
								raw({ textDecoration: "none", minInlineSize: "0" }),
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
				))}
			</ul>
		);
	};
}
