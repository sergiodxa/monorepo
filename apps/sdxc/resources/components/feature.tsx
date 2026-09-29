/**
 * The `feature` tag: one cell of a claim grid, carrying a title, an optional glyph, an
 * optional number that backs the claim up, and an optional link to where it is argued in
 * full. Only the icons the content actually names are imported, so the page ships those
 * and not the rest of the set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	ArrowRightIcon,
	BookOpenIcon,
	CompassIcon,
	GlobeIcon,
	PackageIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { center, hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { media } from "@sdxc/u/responsive";
import { bs, is, m, mbs, p } from "@sdxc/u/size";
import { leading, text, tracking, weight } from "@sdxc/u/typography";
import { Badge, LinkButton } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

/** The glyphs the content vocabulary allows, keyed by the name a cell writes. */
const ICONS: Record<string, typeof GlobeIcon> = {
	globe: GlobeIcon,
	shield: ShieldCheckIcon,
	package: PackageIcon,
	zap: ZapIcon,
	book: BookOpenIcon,
	compass: CompassIcon,
};

namespace Feature {
	export interface Props extends MarkdownProps {
		title: string;
		/** Names a glyph from the allowed set; a cell without one reads as a plain claim. */
		icon?: string;
		/** The number the claim rests on, drawn beside the title. */
		metric?: string;
		/** Where the claim is argued in full, drawn only when both halves are written. */
		href?: string;
		"link-label"?: string;
	}
}

/** Renders one claim cell; its title sits one level under the band's own heading. */
export default function Feature(handle: Handle<Feature.Props>) {
	return () => {
		let { children, href, icon, metric, title } = handle.props;
		let linkLabel = handle.props["link-label"];
		let Glyph = icon ? ICONS[icon] : undefined;

		return (
			<div
				mix={[
					vstack({ gap: 4, align: "stretch" }),
					bg(),
					p(8, 6),
					media("(min-width: 48rem)", p(10, 10)),
				]}
			>
				{Glyph ? (
					<span
						mix={[
							inlineFlex(),
							center(),
							is(10),
							bs(10),
							rounded("lg"),
							bg("brand.tint"),
							fg("brand"),
							border({ color: "brand.border", width: 1, style: "solid" }),
						]}
					>
						<Glyph size={18} aria-hidden="true" />
					</span>
				) : null}

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<h3 mix={[m(0), text("xl"), weight("medium"), tracking("tight"), fg("neutral.emphasis")]}>
						{title}
					</h3>
					{metric ? <Badge color="brand">{metric}</Badge> : null}
				</div>

				<div
					mix={[
						vstack({ gap: 2 }),
						blocksUseGap(),
						text("base"),
						leading("relaxed"),
						fg("neutral"),
					]}
				>
					{children}
				</div>

				{href && linkLabel ? (
					<span mix={[mbs(2)]}>
						<LinkButton href={href} size="sm" color="neutral" variant="outline">
							{linkLabel}
							<ArrowRightIcon size={14} aria-hidden="true" />
						</LinkButton>
					</span>
				) : null}
			</div>
		);
	};
}
