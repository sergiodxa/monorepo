/**
 * One icon drawn large on Lucide's 24-unit grid, beside its name, its tags and the code
 * that renders it. The icon's page and the gallery's dialog both draw this, so the two
 * always show the same thing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { Icon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { listStyle, raw } from "@sdxc/u/general";
import { flexWrap, hstack, vstack } from "@sdxc/u/layout";
import { aspect, is, m, p } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { CodeBlock } from "@sdxc/ui/docs";

import type { IconStyle } from "~/app/services/icon-style";
import type { IconEntry } from "~/app/services/icons";

import { drawnStrokeWidth, iconStyleProps } from "~/app/services/icon-style";
import { lucideIconHref } from "~/app/services/icons";
import { CODE_LABELS } from "~/resources/components/docs-labels";

namespace IconDetail {
	export interface Props {
		icon: IconEntry;
		/** The icon's SVG source, as `renderIconSvg` lays it out. */
		svg: string;
		/** The customization the preview draws and the snippets pass as props. */
		style: IconStyle;
	}
}

/**
 * Lucide's drawing grid, one cell per viewBox unit, behind an icon drawn edge to edge so
 * every line lands on the units it was drawn to.
 */
function unitGrid() {
	let line = "color-mix(in srgb, currentColor 12%, transparent)";
	return raw({
		backgroundImage: `linear-gradient(to right, ${line} 1px, transparent 1px), linear-gradient(to bottom, ${line} 1px, transparent 1px)`,
		backgroundSize: "calc(100% / 24) calc(100% / 24)",
	});
}

/**
 * Renders the preview with the tags beside it, then both ways to render the icon and its SVG.
 * The tags wrap under the preview where the column is too narrow for both.
 */
export default function IconDetail(handle: Handle<IconDetail.Props>) {
	return () => {
		let { icon, svg, style } = handle.props;
		let props = iconStyleProps(style);
		let attributes = props === "" ? 'aria-hidden="true"' : `${props} aria-hidden="true"`;
		return (
			<div mix={[vstack({ gap: 6, align: "stretch" })]}>
				<div
					data-slot="icon-detail-summary"
					mix={[hstack({ gap: 6, align: "start" }), flexWrap("wrap")]}
				>
					<div
						data-slot="icon-detail-preview"
						mix={[
							raw({ flex: "0 0 auto" }),
							is("min(100%, 18rem)"),
							aspect("square"),
							rounded("lg"),
							bg("neutral.tint"),
							fg("neutral.emphasis"),
							border({ color: "neutral.border", width: 1, style: "solid" }),
							unitGrid(),
						]}
					>
						<Icon
							name={icon.name}
							size="100%"
							strokeWidth={drawnStrokeWidth(style)}
							color={style.color ?? undefined}
						/>
					</div>

					{icon.tags.length > 0 ? (
						<ul
							aria-label="Tags"
							data-slot="icon-detail-tags"
							mix={[
								hstack({ gap: 2 }),
								flexWrap("wrap"),
								raw({ flex: "1 1 12rem", minInlineSize: 0, alignContent: "flex-start" }),
								m(0),
								p(0),
								listStyle("none"),
							]}
						>
							{icon.tags.map((tag) => (
								<li
									key={tag}
									mix={[
										p(1, 2),
										rounded("md"),
										bg("neutral.tint"),
										border({ color: "neutral.border", width: 1, style: "solid" }),
										text("sm"),
										fg("neutral"),
									]}
								>
									{tag}
								</li>
							))}
						</ul>
					) : null}
				</div>

				<CodeBlock
					title="By component"
					language="tsx"
					labels={CODE_LABELS}
					code={`import { ${icon.component} } from "@sdxc/icons";\n\n<${icon.component} ${attributes} />`}
				/>
				<CodeBlock
					title="By name"
					language="tsx"
					labels={CODE_LABELS}
					code={`import { Icon } from "@sdxc/icons";\n\n<Icon name="${icon.name}" ${attributes} />`}
				/>
				<CodeBlock title="SVG" language="html" labels={CODE_LABELS} code={svg} />

				<p mix={[m(0), text("sm"), fg("neutral.muted")]}>
					Drawn by the Lucide contributors.{" "}
					<a href={lucideIconHref(icon.name)} mix={[fg("brand")]}>
						See {icon.name} on lucide.dev
					</a>
				</p>
			</div>
		);
	};
}
