/**
 * Above-the-fold landing band: optional eyebrow, display title, lead, CTA
 * cluster, and a media slot. Encodes the catalog hero pattern so pages supply
 * copy and media without re-deriving spacing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { opacity, rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { absolute, inlineFlex, inset, items, relative, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { pb, pi } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { font, text, textAlign, textTransform, tracking, weight } from "@sdxc/u/typography";

import { CtaGroup } from "../components/cta-group.js";
import { HeadingScope } from "../components/heading-scope.js";
import { Heading } from "../components/heading.js";
import { MarketingSection } from "../components/marketing-section.js";
import { Split } from "../components/split.js";
import { marketingLead } from "../styles/marketing.js";

/** Content alignment {@link LandingHero} applies when `align` is omitted. */
const DEFAULT_ALIGN: LandingHero.Align = "start";

/** Where media sits relative to the copy when `mediaPlacement` is omitted. */
const DEFAULT_MEDIA_PLACEMENT: LandingHero.MediaPlacement = "end";

/** Band fill {@link LandingHero} applies when `tone` is omitted. */
const DEFAULT_TONE: LandingHero.Tone = "grid";

/** Eyebrow chrome {@link LandingHero} applies when `eyebrowVariant` is omitted. */
const DEFAULT_EYEBROW_VARIANT: LandingHero.EyebrowVariant = "pill";

/**
 * Prop types for {@link LandingHero}.
 */
export namespace LandingHero {
	/**
	 * Whether the copy stack stretches start-aligned or centers as one statement.
	 */
	export type Align = MarketingSection.Align;

	/**
	 * Where the media slot sits: beside the copy, under it, or as a faded
	 * background behind the statement.
	 */
	export type MediaPlacement = "end" | "below" | "background";

	/**
	 * Band fill forwarded to {@link MarketingSection}.
	 */
	export type Tone = MarketingSection.Tone;

	/**
	 * How the optional eyebrow reads — same contract as {@link MarketingHeader}.
	 */
	export type EyebrowVariant = "pill" | "mono" | "chip";

	/**
	 * Per-part styling for slots the hero composes.
	 */
	export interface PartsProps {
		/** Styling for the optional eyebrow. */
		eyebrow?: TagProps<"span">["mix"];
		/** Styling for the title {@link Heading}. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the lead paragraph. */
		description?: TagProps<"p">["mix"];
		/** Styling for the {@link CtaGroup} around `actions`. */
		actions?: TagProps<"div">["mix"];
		/** Styling for the media slot host. */
		media?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link LandingHero}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "align" | "tone" | "title" | "parts"
	> {
		/** Content alignment. Defaults to {@link DEFAULT_ALIGN}. */
		align?: Align;
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Media placement. Defaults to {@link DEFAULT_MEDIA_PLACEMENT}. */
		mediaPlacement?: MediaPlacement;
		/** Optional eyebrow above the title. */
		eyebrow?: RemixNode;
		/**
		 * Eyebrow chrome. Defaults to {@link DEFAULT_EYEBROW_VARIANT} when an
		 * eyebrow is present.
		 */
		eyebrowVariant?: EyebrowVariant;
		/** Display title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/** Primary/secondary actions rendered inside a {@link CtaGroup}. */
		actions?: RemixNode;
		/** Product visual, screenshot, or staged UI. */
		media?: RemixNode;
		/** Optional below-fold hook rendered under the main hero stack. */
		below?: RemixNode;
		/** Per-part styling for eyebrow, title, lead, actions, and media. */
		parts?: PartsProps;
	}
}

/**
 * Renders a hero band: display title, optional lead and CTAs, and an optional
 * media slot. Opens a {@link HeadingScope} so the title starts the outline.
 *
 * @param handle Runtime handle carrying the hero's props.
 * @returns The render function producing the hero's markup.
 * @example
 * <LandingHero
 * 	tone="grid"
 * 	title={t("hero.title")}
 * 	description={t("hero.lead")}
 * 	actions={<Button size="lg">{t("hero.cta")}</Button>}
 * 	media={<img src={shot} alt={t("hero.alt")} />}
 * />
 */
export function LandingHero(handle: Handle<LandingHero.Props>) {
	return () => {
		let {
			actions,
			align,
			below,
			description,
			eyebrow,
			eyebrowVariant,
			media,
			mediaPlacement,
			mix,
			parts,
			spacing,
			title,
			tone,
			...rest
		} = handle.props;
		let resolvedAlign = align ?? DEFAULT_ALIGN;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedPlacement = mediaPlacement ?? DEFAULT_MEDIA_PLACEMENT;
		let resolvedSpacing = spacing ?? "hero";
		let resolvedEyebrowVariant = eyebrowVariant ?? DEFAULT_EYEBROW_VARIANT;
		let isCenter = resolvedAlign === "center";
		let hasMedia = media !== undefined;
		let isBackground = resolvedPlacement === "background" && hasMedia;
		let isSplit = resolvedPlacement === "end" && hasMedia;
		let isBelow = resolvedPlacement === "below" && hasMedia;

		let copy = (
			<div
				mix={[
					vstack({
						align: isCenter ? "center" : "stretch",
						gap: 6,
					}),
					isCenter ? textAlign("center") : [],
				]}
			>
				{eyebrow ? (
					<span
						data-variant={resolvedEyebrowVariant}
						mix={[
							inlineFlex(),
							items("center"),
							text("xs"),
							weight("semibold"),
							when('&[data-variant="pill"]', [
								pb(0.5),
								pi(2.5),
								rounded("full"),
								border({ color: "brand", width: 1, style: "solid" }),
								bg("brand.tint"),
								fg("brand"),
							]),
							when('&[data-variant="mono"]', [
								font("mono"),
								tracking("wide"),
								textTransform("uppercase"),
								fg("neutral.muted"),
							]),
							when('&[data-variant="chip"]', [
								pb(0.5),
								pi(2.5),
								rounded("full"),
								border({ color: "brand", width: 1, style: "solid" }),
								bg("brand.solid"),
								fg("brand.onSolid"),
								tracking("wider"),
								textTransform("uppercase"),
							]),
							parts?.eyebrow,
						]}
					>
						{eyebrow}
					</span>
				) : null}

				<Heading size="display" mix={[parts?.title]}>
					{title}
				</Heading>

				{description ? (
					<p
						mix={[
							marketingLead(),
							isCenter ? raw({ marginInline: "auto" }) : [],
							parts?.description,
						]}
					>
						{description}
					</p>
				) : null}

				{actions ? <CtaGroup mix={[parts?.actions]}>{actions}</CtaGroup> : null}
			</div>
		);

		let mediaSlot = hasMedia ? (
			<div
				data-slot="landing-hero-media"
				mix={[
					isBackground
						? [
								absolute(),
								inset(0),
								overflow("hidden"),
								opacity(30),
								raw({ pointerEvents: "none", zIndex: "0" }),
								when("& img, & video", [
									raw({
										inlineSize: "100%",
										blockSize: "100%",
										objectFit: "cover",
									}),
								]),
							]
						: [],
					parts?.media,
				]}
			>
				{media}
			</div>
		) : null;

		let body = (
			<div
				mix={[
					vstack({
						align: isCenter ? "center" : "stretch",
						gap: 8,
					}),
				]}
			>
				{copy}
				{isBelow ? mediaSlot : null}
				{below}
			</div>
		);

		if (isBackground) {
			body = (
				<div mix={[relative(), vstack({ gap: 8, align: "stretch" })]}>
					{mediaSlot}
					<div mix={[relative(), raw({ zIndex: "1" })]}>{copy}</div>
					{below}
				</div>
			);
		} else if (isSplit) {
			body = (
				<div mix={[vstack({ gap: 8, align: "stretch" })]}>
					<Split lean="media">
						<Split.Copy>{copy}</Split.Copy>
						<Split.Media>{mediaSlot}</Split.Media>
					</Split>
					{below}
				</div>
			);
		}

		return (
			<MarketingSection
				{...rest}
				tone={resolvedTone}
				spacing={resolvedSpacing}
				align={isSplit ? "start" : resolvedAlign}
				mix={[isBackground ? relative() : [], mix]}
			>
				<HeadingScope>{body}</HeadingScope>
			</MarketingSection>
		);
	};
}
