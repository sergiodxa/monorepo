/**
 * The `feature` tag: one card in a claim grid, carrying a title, an optional glyph,
 * and an optional number that backs the claim up. Only the icons the content actually
 * names are imported, so the page ships those and not the rest of the set.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import {
	BookOpenIcon,
	CompassIcon,
	GlobeIcon,
	PackageIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "@sdxc/icons";
import { fg } from "@sdxc/u/color";
import { hstack, inlineFlex, vstack } from "@sdxc/u/layout";
import { text } from "@sdxc/u/typography";
import { Badge, Card } from "@sdxc/ui";

import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

/** The glyphs the content vocabulary allows, keyed by the name a card writes. */
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
		/** Names a glyph from the allowed set; a card without one reads as a plain claim. */
		icon?: string;
		/** The number the claim rests on, drawn beside the title. */
		metric?: string;
	}
}

/** Renders one claim card. */
export default function Feature(handle: Handle<Feature.Props>) {
	return () => {
		let { children, icon, metric, title } = handle.props;
		let Glyph = icon ? ICONS[icon] : undefined;

		return (
			<Card mix={[vstack({ gap: 0 })]}>
				<Card.Header>
					<div mix={[hstack({ gap: 2, align: "center" })]}>
						{Glyph ? (
							<span mix={[inlineFlex(), fg("brand")]}>
								<Glyph size={18} />
							</span>
						) : null}
						<Card.Title mix={[text("lg")]}>{title}</Card.Title>
						{metric ? <Badge color="brand">{metric}</Badge> : null}
					</div>
				</Card.Header>
				<Card.Content mix={[vstack({ gap: 2 }), blocksUseGap(), text("sm"), fg("neutral")]}>
					{children}
				</Card.Content>
			</Card>
		);
	};
}
