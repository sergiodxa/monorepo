/**
 * The `feature` tag: one cell of a claim grid, carrying a title, an optional glyph, an
 * optional number that backs the claim up, and an optional link to where it is argued in
 * full. Thin adapter over {@link Feature} that keeps the markdown attribute vocabulary.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	ArrowRightIcon,
	BookOpenIcon,
	CompassIcon,
	GlobeIcon,
	PackageIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "sdxc/icons";
import { hstack } from "sdxc/u/layout";
import { Badge, Feature as UiFeature, LinkButton } from "sdxc/ui";

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
			<UiFeature href={href}>
				{Glyph ? (
					<UiFeature.Icon>
						<Glyph size={18} aria-hidden="true" />
					</UiFeature.Icon>
				) : null}

				<div mix={[hstack({ gap: 2, align: "center" })]}>
					<UiFeature.Title>{title}</UiFeature.Title>
					{metric ? <Badge color="brand">{metric}</Badge> : null}
				</div>

				<UiFeature.Description mix={[blocksUseGap()]}>{children}</UiFeature.Description>

				{href && linkLabel ? (
					<UiFeature.Action>
						<LinkButton href={href} size="sm" color="neutral" variant="outline">
							{linkLabel}
							<ArrowRightIcon size={14} aria-hidden="true" />
						</LinkButton>
					</UiFeature.Action>
				) : null}
			</UiFeature>
		);
	};
}
