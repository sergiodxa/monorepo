/**
 * The `feature` tag: one cell of a claim grid, carrying a title, an optional glyph, an
 * optional number that backs the claim up, and an optional link to where it is argued in
 * full that makes the whole cell clickable. Thin adapter over {@link Feature}.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import {
	ArchiveIcon,
	BookOpenIcon,
	CalendarIcon,
	CalendarOffIcon,
	ClockIcon,
	CoinsIcon,
	CompassIcon,
	GitBranchIcon,
	GlobeIcon,
	HistoryIcon,
	LockIcon,
	MailIcon,
	MessageCircleIcon,
	PackageIcon,
	ShieldCheckIcon,
	ZapIcon,
} from "@sdxc/icons";
import { hstack } from "@sdxc/u/layout";
import { Badge, Feature as UiFeature } from "@sdxc/ui";

import type { FeatureIconName } from "~/app/services/content";
import type { MarkdownProps } from "~/resources/components/markdown-props";

import { blocksUseGap } from "~/resources/components/block-flow";

/** The glyphs the content vocabulary allows, keyed by the name a cell writes. */
const ICONS: Record<FeatureIconName, typeof GlobeIcon> = {
	globe: GlobeIcon,
	shield: ShieldCheckIcon,
	package: PackageIcon,
	zap: ZapIcon,
	book: BookOpenIcon,
	compass: CompassIcon,
	mail: MailIcon,
	message: MessageCircleIcon,
	lock: LockIcon,
	clock: ClockIcon,
	coins: CoinsIcon,
	archive: ArchiveIcon,
	calendar: CalendarIcon,
	"calendar-off": CalendarOffIcon,
	"git-branch": GitBranchIcon,
	history: HistoryIcon,
};

namespace Feature {
	export interface Props extends MarkdownProps {
		title: string;
		/** Names a glyph from the allowed set; a cell without one reads as a plain claim. */
		icon?: FeatureIconName;
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
						<UiFeature.Link href={href}>{linkLabel}</UiFeature.Link>
					</UiFeature.Action>
				) : null}
			</UiFeature>
		);
	};
}
