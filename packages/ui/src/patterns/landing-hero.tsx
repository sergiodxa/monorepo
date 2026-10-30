/**
 * Above-the-fold landing band: optional eyebrow, display title, lead, CTA
 * cluster, a note and proof row under the actions, and a media slot. Encodes
 * the hero rhythm so pages supply copy and media without re-deriving spacing.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { opacity } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { absolute, inset, relative, self, vstack } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { when } from "@sdxc/u/state";
import { pretty, text, textAlign } from "@sdxc/u/typography";

import type { Entrance } from "../animations/entrance.js";
import type { HeadingLevel } from "../components/heading-scope.js";
import type { MarketingEyebrowVariant } from "../styles/marketing.js";

import { entrance } from "../animations/entrance.js";
import { CtaGroup } from "../components/cta-group.js";
import { HeadingScope, readAmbientLevel } from "../components/heading-scope.js";
import { Heading } from "../components/heading.js";
import { MarketingSection } from "../components/marketing-section.js";
import { Split } from "../components/split.js";
import { marketingLead } from "../styles/marketing.js";
import { Eyebrow } from "../utils/eyebrow.js";

/** Content alignment {@link LandingHero} applies when `align` is omitted. */
const DEFAULT_ALIGN: LandingHero.Align = "start";

/** Where media sits relative to the copy when `mediaPlacement` is omitted. */
const DEFAULT_MEDIA_PLACEMENT: LandingHero.MediaPlacement = "below";

/** Band fill {@link LandingHero} applies when `tone` is omitted. */
const DEFAULT_TONE: LandingHero.Tone = "grid";

/** Eyebrow look {@link LandingHero} applies when `eyebrowVariant` is omitted. */
const DEFAULT_EYEBROW_VARIANT: LandingHero.EyebrowVariant = "quiet";

/**
 * Headline size beside media: one step below the full display, since the copy shares
 * the row, from 36px on a phone to 60px wide.
 */
const SPLIT_DISPLAY_SIZE = "clamp(2.25rem, 1.5rem + 3cqi, 3.75rem)";

/** Space between the copy and media placed below it: 3rem on a phone, 4rem wide. */
const MEDIA_GAP = "clamp(3rem, 2.55rem + 1.94cqi, 4rem)";

/**
 * Prop types for {@link LandingHero}.
 */
export namespace LandingHero {
	/** Whether the copy stack sits at the start edge or centers as one statement. */
	export type Align = MarketingSection.Align;

	/**
	 * Where the media slot sits: under the copy at the full measure (text-led), beside
	 * it (product-led, where the media is taller than the copy), or as a faded
	 * background behind the statement.
	 */
	export type MediaPlacement = "end" | "below" | "background";

	/** Band fill behind the hero. */
	export type Tone = MarketingSection.Tone;

	/** Eyebrow look; the hero default is the hairline `quiet` pill. */
	export type EyebrowVariant = MarketingEyebrowVariant;

	/**
	 * Per-part styling for the elements the hero renders besides its band.
	 */
	export interface PartsProps {
		/** Styling for the optional eyebrow. */
		eyebrow?: TagProps<"span">["mix"];
		/** Styling for the display {@link Heading}. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the lead paragraph. */
		description?: TagProps<"p">["mix"];
		/** Styling for the {@link CtaGroup}. */
		actions?: TagProps<"div">["mix"];
		/** Styling for the media slot host. */
		media?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link LandingHero}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "align" | "tone" | "title" | "parts" | "level"
	> {
		/**
		 * Heading level of the display title. Defaults to the ambient `HeadingScope`'s
		 * level, or `1` on a bare page, so the hero owns the page's only `<h1>`.
		 */
		level?: HeadingLevel;
		/** Copy alignment. Defaults to {@link DEFAULT_ALIGN}. */
		align?: Align;
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Media placement. Defaults to {@link DEFAULT_MEDIA_PLACEMENT}. */
		mediaPlacement?: MediaPlacement;
		/** Short announcement above the title. */
		eyebrow?: RemixNode;
		/** Eyebrow look. Defaults to {@link DEFAULT_EYEBROW_VARIANT}. */
		eyebrowVariant?: EyebrowVariant;
		/** Turns the eyebrow into a link with a trailing arrow that nudges on hover. */
		eyebrowHref?: string;
		/** Display headline; wrap a phrase in `AccentText` to mark it. */
		title: RemixNode;
		/** Lead under the headline; `<strong>` fragments draw in the heading ink. */
		description?: RemixNode;
		/** CTA controls, laid out in a {@link CtaGroup} that stacks on phones. */
		actions?: RemixNode;
		/**
		 * A release pin under the actions, such as "v8.1 — released Oct 28", set as mono
		 * text on a brand-tinted chip; pass a link to make the pin clickable.
		 */
		release?: RemixNode;
		/**
		 * Plays the load entrance: eyebrow, title, lead, actions and the rest rise in turn,
		 * and the media settles last. Visitors who ask for reduced motion see the hero at rest.
		 */
		entrance?: boolean;
		/** One line of microcopy 12px under the actions ("No card required"). */
		note?: RemixNode;
		/** Social proof under the actions and note, such as a row of marks. */
		proof?: RemixNode;
		/** Product media: a framed screenshot, a rendered component, a device. */
		media?: RemixNode;
		/**
		 * Decoration behind the media — rings or a glow — laid under it and hidden from
		 * assistive technology; pair it with `marketingSlowSpin()` for motion that stops
		 * under reduced motion.
		 */
		backdrop?: RemixNode;
		/** Optional below-fold hook rendered under the main hero stack. */
		below?: RemixNode;
		/** Per-part styling for eyebrow, title, lead, actions, and media. */
		parts?: PartsProps;
	}
}

/**
 * Renders the eyebrow, display title, lead, actions, note and proof in the hero
 * rhythm — 24px, 20px, 32px and 12px between them — and places the media below,
 * beside, or behind that copy. The title starts the outline at `level`, and
 * headings in `below` sit one level under it.
 *
 * @param handle Runtime handle carrying the hero band's props.
 * @returns The render function producing the hero's markup.
 * @example
 * <LandingHero
 * 	eyebrow={t("hero.news")}
 * 	title={t("hero.title")}
 * 	description={t("hero.lead")}
 * 	actions={<Button color="brand">{t("hero.cta")}</Button>}
 * 	note={t("hero.note")}
 * 	media={<ProductFrame stage="panel">{shot}</ProductFrame>}
 * />
 * @example
 * <LandingHero mediaPlacement="end" title={t("hero.title")} media={<Device />} />
 */
export function LandingHero(handle: Handle<LandingHero.Props>) {
	return () => {
		let {
			actions,
			align,
			backdrop,
			below,
			description,
			entrance: hasEntrance,
			eyebrow,
			eyebrowHref,
			eyebrowVariant,
			level,
			media,
			mediaPlacement,
			mix,
			note,
			parts,
			proof,
			release,
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
		let resolvedLevel = level ?? readAmbientLevel(handle) ?? 1;
		let belowSlot = below ? <HeadingScope>{below}</HeadingScope> : null;
		let hasMedia = media !== undefined;
		let isBackground = resolvedPlacement === "background" && hasMedia;
		let isSplit = resolvedPlacement === "end" && hasMedia;
		let isBelow = resolvedPlacement === "below" && hasMedia;
		let isCenter = resolvedAlign === "center" && !isSplit;
		let enter = (order: number, kind: Entrance.Kind = "copy") =>
			hasEntrance ? entrance({ order, kind }) : [];

		let copy = (
			<div
				data-slot="landing-hero-copy"
				mix={[
					vstack({ align: isCenter ? "center" : "stretch", gap: 0 }),
					isCenter ? textAlign("center") : [],
					isSplit
						? raw({ "--ui-marketing-display-size": SPLIT_DISPLAY_SIZE })
						: raw({ inlineSize: "100%", minInlineSize: "0" }),
				]}
			>
				{eyebrow ? (
					<Eyebrow
						href={eyebrowHref}
						variant={resolvedEyebrowVariant}
						mix={[
							self(isCenter ? "center" : "start"),
							raw({ marginBlockEnd: "1.5rem" }),
							enter(0),
							parts?.eyebrow,
						]}
					>
						{eyebrow}
					</Eyebrow>
				) : null}

				<Heading size="display" mix={[enter(1), parts?.title]}>
					{title}
				</Heading>

				{description ? (
					<p
						mix={[
							marketingLead("hero"),
							raw({
								marginBlockStart: "1.25rem",
								marginInline: isCenter ? "auto" : "0",
							}),
							enter(2),
							parts?.description,
						]}
					>
						{description}
					</p>
				) : null}

				{actions ? (
					<CtaGroup
						stack="phone"
						mix={[
							raw({ marginBlockStart: "2rem" }),
							isCenter ? self("center") : [],
							enter(3),
							parts?.actions,
						]}
					>
						{actions}
					</CtaGroup>
				) : null}

				{release ? (
					<p
						data-slot="landing-hero-release"
						mix={[releasePin(), isCenter ? self("center") : self("start"), enter(4)]}
					>
						{release}
					</p>
				) : null}

				{note ? (
					<p
						data-slot="landing-hero-note"
						mix={[
							raw({ marginBlockStart: "0.75rem" }),
							text("xs"),
							fg("neutral.muted"),
							pretty(),
							enter(4),
						]}
					>
						{note}
					</p>
				) : null}

				{proof ? (
					<div
						data-slot="landing-hero-proof"
						mix={[raw({ marginBlockStart: "2rem" }), isCenter ? self("center") : [], enter(5)]}
					>
						{proof}
					</div>
				) : null}
			</div>
		);

		let backdropSlot = backdrop ? (
			<div
				aria-hidden="true"
				data-slot="landing-hero-backdrop"
				mix={[
					absolute(),
					raw({
						inset: "-25%",
						zIndex: "-1",
						pointerEvents: "none",
						display: "grid",
						placeItems: "center",
					}),
				]}
			>
				{backdrop}
			</div>
		) : null;

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
						: [relative(), raw({ isolation: "isolate" })],
					isBelow
						? [
								self("stretch"),
								raw({ inlineSize: "100%", minInlineSize: "0", marginBlockStart: MEDIA_GAP }),
							]
						: [],
					isBackground ? [] : enter(4, "media"),
					parts?.media,
				]}
			>
				{isBackground ? null : backdropSlot}
				{media}
			</div>
		) : null;

		let body = (
			<div
				mix={[
					vstack({ align: isCenter ? "center" : "stretch", gap: 0 }),
					raw({ inlineSize: "100%", minInlineSize: "0" }),
				]}
			>
				{copy}
				{isBelow ? mediaSlot : null}
				{belowSlot}
			</div>
		);

		if (isBackground) {
			body = (
				<div mix={[relative(), vstack({ gap: 8, align: "stretch" })]}>
					{mediaSlot}
					<div mix={[relative(), raw({ zIndex: "1" })]}>{copy}</div>
					{belowSlot}
				</div>
			);
		} else if (isSplit) {
			body = (
				<div mix={[vstack({ gap: 8, align: "stretch" })]}>
					<Split lean="copy">
						<Split.Copy>{copy}</Split.Copy>
						<Split.Media>{mediaSlot}</Split.Media>
					</Split>
					{belowSlot}
				</div>
			);
		}

		return (
			<MarketingSection
				{...rest}
				tone={resolvedTone}
				spacing={resolvedSpacing}
				align={isCenter ? "center" : "start"}
				level={resolvedLevel}
				mix={[isBackground ? relative() : [], mix]}
			>
				{body}
			</MarketingSection>
		);
	};
}

/**
 * The release pin: mono text on a brand-tinted chip, set apart from the actions above it
 * so a dated version reads as news rather than a third button.
 */
function releasePin() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.5rem",
			marginBlockStart: "1.25rem",
			paddingBlock: "0.3125rem",
			paddingInline: "0.75rem",
			borderRadius: "9999px",
			fontFamily: "var(--ui-font-mono, ui-monospace, monospace)",
			fontSize: "0.75rem",
			lineHeight: "1rem",
			color: "var(--ui-brand-fg)",
			backgroundColor: "var(--ui-brand-bg-tint)",
			boxShadow: "inset 0 0 0 1px var(--ui-brand-border)",
		}),
		when("& a", raw({ color: "inherit", textDecoration: "none" })),
		when("& a:hover", raw({ textDecoration: "underline", textUnderlineOffset: "3px" })),
	];
}
