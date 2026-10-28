/**
 * A short announcement with a stronger rim than the default eyebrow pill —
 * reserved for “new” / forward callouts that should read louder than a band
 * eyebrow.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { inlineFlex, items } from "@sdxc/u/layout";
import { pb, pi } from "@sdxc/u/size";
import { text, textTransform, tracking, weight } from "@sdxc/u/typography";

/** Rim treatment {@link AnnouncementChip} applies when `variant` is omitted. */
const DEFAULT_VARIANT: AnnouncementChip.Variant = "rim";

/**
 * Prop types for {@link AnnouncementChip}.
 */
export namespace AnnouncementChip {
	/**
	 * How the chip draws its edge: a solid brand rim, or a soft dual-tone
	 * border for a louder announcement.
	 */
	export type Variant = "rim" | "special";

	/**
	 * Props accepted by {@link AnnouncementChip}.
	 */
	export interface Props extends TagProps<"span"> {
		/** Rim treatment. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Announcement label — always supplied by the page. */
		children: RemixNode;
	}
}

/**
 * Renders a compact announcement label. Prefer {@link MarketingHeader}'s
 * eyebrow for ordinary section labels; reach for this when the callout itself
 * is the news.
 *
 * @param handle Runtime handle carrying the host `<span>`'s props.
 * @returns The render function producing the chip's markup.
 * @example
 * <AnnouncementChip>{t("announce.forward")}</AnnouncementChip>
 * @example
 * <AnnouncementChip variant="special">{t("announce.launch")}</AnnouncementChip>
 */
export function AnnouncementChip(handle: Handle<AnnouncementChip.Props>) {
	return () => {
		let { mix, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		return (
			<span
				{...rest}
				data-slot="announcement-chip"
				data-variant={resolvedVariant}
				mix={[
					inlineFlex(),
					items("center"),
					pb(0.5),
					pi(2.5),
					rounded("full"),
					text("xs"),
					weight("semibold"),
					tracking("wider"),
					textTransform("uppercase"),
					bg("brand.tint"),
					fg("brand"),
					resolvedVariant === "special"
						? raw({
								border: "1px solid transparent",
								backgroundImage:
									"linear-gradient(var(--ui-brand-bg-tint), var(--ui-brand-bg-tint)), linear-gradient(120deg, var(--ui-brand-bg-solid), color-mix(in oklab, var(--ui-brand-bg-solid) 40%, Canvas))",
								backgroundOrigin: "border-box",
								backgroundClip: "padding-box, border-box",
							})
						: border({ color: "brand", width: 1, style: "solid" }),
					mix,
				]}
			/>
		);
	};
}
