/**
 * A short announcement above a hero — "new release", "we raised" — drawn with the
 * same eyebrow looks a band header uses, so a page's labels share one vocabulary.
 * Given an `href` it becomes a link whose trailing arrow nudges on hover.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { MarketingEyebrowVariant } from "../styles/marketing.js";

import { Eyebrow } from "../utils/eyebrow.js";

/** Look {@link AnnouncementChip} applies when `variant` is omitted. */
const DEFAULT_VARIANT: AnnouncementChip.Variant = "quiet";

/** Dual-tone brand edge the `special` chip draws, louder than every eyebrow look. */
const SPECIAL_STYLES = {
	border: "1px solid transparent",
	color: "var(--ui-brand-fg)",
	backgroundImage:
		"linear-gradient(var(--ui-brand-bg-tint), var(--ui-brand-bg-tint)), linear-gradient(120deg, var(--ui-brand-bg-solid), color-mix(in oklab, var(--ui-brand-bg-solid) 40%, Canvas))",
	backgroundOrigin: "border-box",
	backgroundClip: "padding-box, border-box",
	borderRadius: "1rem",
	paddingBlock: "0.375rem",
	paddingInline: "0.875rem",
	lineHeight: "1rem",
	fontWeight: "600",
} as const;

/**
 * Prop types for {@link AnnouncementChip}.
 */
export namespace AnnouncementChip {
	/**
	 * How the chip reads: one of the eyebrow looks (the hairline `quiet` pill by
	 * default), or `special`, a dual-tone brand edge for the loudest callout.
	 */
	export type Variant = MarketingEyebrowVariant | "special";

	/**
	 * Props accepted by {@link AnnouncementChip}.
	 */
	export interface Props {
		/** Extra styling, applied after the chip look. */
		mix?: TagProps<"span">["mix"];
		/** Look. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** Turns the chip into a link with a trailing arrow. */
		href?: string;
		/** Announcement label — always supplied by the page. */
		children: RemixNode;
	}
}

/**
 * Renders the announcement as a `span`, or an `a` with a trailing arrow when `href` is
 * set, styled by the shared eyebrow looks.
 *
 * @param handle Runtime handle carrying the host's props.
 * @returns The render function producing the chip's markup.
 * @example
 * <AnnouncementChip href="/blog/v2">{t("hero.announcement")}</AnnouncementChip>
 * @example
 * <AnnouncementChip variant="special">{t("hero.launch")}</AnnouncementChip>
 */
export function AnnouncementChip(handle: Handle<AnnouncementChip.Props>) {
	return () => {
		let { children, href, mix, variant } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		return (
			<Eyebrow
				href={href}
				slot="announcement-chip"
				variant={resolvedVariant}
				mix={[resolvedVariant === "special" ? raw(SPECIAL_STYLES) : [], mix]}
			>
				{children}
			</Eyebrow>
		);
	};
}
