/**
 * Testimonial band: a {@link MarketingHeader} over an optional featured quote and a grid
 * or snapping carousel of quote cards whose rows share one height. Each card is a
 * `<figure>` pairing the quote with who said it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { container, grid, hstack, items, vstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { text, weight } from "@sdxc/u/typography";

import { MarketingHeader } from "../components/marketing-header.js";
import { MarketingSection } from "../components/marketing-section.js";
import { balancedGrid } from "../styles/card-grid.js";
import { marketingBandTone, marketingEmphasis, marketingSurface } from "../styles/marketing.js";

/** How many quotes share a row from the `lg` container when `columns` is omitted. */
const DEFAULT_COLUMNS: TestimonialBand.Columns = 3;

/** Band fill {@link TestimonialBand} applies when `tone` is omitted. */
const DEFAULT_TONE: TestimonialBand.Tone = "plain";

/** Container the quote grid queries. */
const CONTAINER_NAME = "ui-marketing-testimonials";

/** Space between quote cards, across a row and between rows. */
const CARD_GAP = "1.5rem";

/**
 * Prop types for {@link TestimonialBand} and {@link TestimonialBand.Quote}.
 */
export namespace TestimonialBand {
	/**
	 * How many quotes share a row from the `lg` container; a phone reads one
	 * column and the `md` container two.
	 */
	export type Columns = 2 | 3;

	/**
	 * Band fill forwarded to {@link MarketingSection}.
	 */
	export type Tone = MarketingSection.Tone;

	/**
	 * `grid` sets every quote in even rows; `carousel` sets them in one row that scrolls
	 * and snaps sideways, showing the next card's edge.
	 */
	export type Layout = "grid" | "carousel";

	/**
	 * `card` is the regular quote; `featured` inverts the card, sets the quote large
	 * and leads with an optional `logo`.
	 */
	export type QuoteVariant = "card" | "featured";

	/**
	 * Per-part styling for slots the band composes.
	 */
	export interface PartsProps {
		/** Styling for the header title. */
		title?: TagProps<"h1">["mix"];
		/** Styling for the header lead. */
		description?: TagProps<"p">["mix"];
		/** Styling for the quote grid. */
		quotes?: TagProps<"div">["mix"];
	}

	/**
	 * Props accepted by {@link TestimonialBand}.
	 */
	export interface Props extends Omit<
		MarketingSection.Props,
		"children" | "tone" | "title" | "parts"
	> {
		/** Columns from the `lg` container. Defaults to {@link DEFAULT_COLUMNS}. */
		columns?: Columns;
		/** Band fill. Defaults to {@link DEFAULT_TONE}. */
		tone?: Tone;
		/** Optional eyebrow above the title. */
		eyebrow?: RemixNode;
		/** Section title — required, always supplied by the page. */
		title: RemixNode;
		/** Supporting lead under the title. */
		description?: RemixNode;
		/** Arrangement of `children`. Defaults to `"grid"`. */
		layout?: Layout;
		/** Accessible name of the carousel's scroll region. Defaults to "Testimonials". */
		carouselLabel?: string;
		/**
		 * One quote set full width above the rest, usually a
		 * `<TestimonialBand.Quote variant="featured">` with a hard number in it.
		 */
		featured?: RemixNode;
		/** One {@link TestimonialBand.Quote} per testimonial. */
		children: RemixNode;
		/** Per-part styling for title, lead, and quote grid. */
		parts?: PartsProps;
	}

	/**
	 * Props accepted by {@link TestimonialBand.Quote}.
	 */
	export interface QuoteProps extends Omit<TagProps<"figure">, "children"> {
		/** The quote; `strong` fragments render in the emphasis ink at the copy's weight. */
		children: RemixNode;
		/** Who said it. */
		name: RemixNode;
		/** Their job title and company, drawn muted under the name. */
		jobTitle?: RemixNode;
		/** An `<img>` or initials, cropped to a round 2.5rem frame. */
		avatar?: RemixNode;
		/** Card look. Defaults to `"card"`. */
		variant?: QuoteVariant;
		/** The customer's mark, above the quote; a featured card draws it in its own ink. */
		logo?: RemixNode;
		/** Links the customer story with a trailing line under the caption. */
		href?: string;
		/** Text of the story link. Defaults to "Read the story". */
		linkLabel?: RemixNode;
	}
}

/**
 * Renders a testimonial band with a chapter header and a quote grid of one column on a
 * phone, two from the `md` container and `columns` from `lg`, evened per quote count with a
 * short last row centred. Cards in a row stretch to one height, captions on one line.
 *
 * @param handle Runtime handle carrying the band's props.
 * @returns The render function producing the band's markup.
 * @example
 * <TestimonialBand title={t("quotes.title")}>
 * 	<TestimonialBand.Quote name="Ana Ruiz" jobTitle="SRE, Lumen" avatar="AR">{t("quotes.ana")}</TestimonialBand.Quote>
 * </TestimonialBand>
 */
export function TestimonialBand(handle: Handle<TestimonialBand.Props>) {
	return () => {
		let {
			carouselLabel,
			children,
			columns,
			description,
			eyebrow,
			featured,
			layout,
			mix,
			parts,
			spacing,
			title,
			tone,
			...rest
		} = handle.props;
		let isCarousel = layout === "carousel";
		let resolvedColumns = columns ?? DEFAULT_COLUMNS;
		let resolvedTone = tone ?? DEFAULT_TONE;
		let resolvedSpacing = spacing ?? "normal";

		return (
			<MarketingSection {...rest} tone={resolvedTone} spacing={resolvedSpacing} mix={mix}>
				<div mix={[vstack({ gap: 0, align: "stretch" })]}>
					<MarketingHeader
						eyebrow={eyebrow}
						description={description}
						parts={{ title: parts?.title, description: parts?.description }}
					>
						{title}
					</MarketingHeader>
					{featured ? (
						<div data-slot="testimonial-featured" mix={[raw({ marginBlockEnd: CARD_GAP })]}>
							{featured}
						</div>
					) : null}
					<div data-columns={String(resolvedColumns)} mix={[container(CONTAINER_NAME)]}>
						<div
							data-slot="testimonial-quotes"
							data-layout={isCarousel ? "carousel" : "grid"}
							role={isCarousel ? "region" : undefined}
							aria-label={isCarousel ? (carouselLabel ?? "Testimonials") : undefined}
							tabIndex={isCarousel ? 0 : undefined}
							mix={[
								isCarousel
									? carouselTrack()
									: [
											grid(),
											raw({ gap: CARD_GAP }),
											balancedGrid(CONTAINER_NAME, [
												{ query: "(width < 36rem)", columns: 1 },
												{ query: "(36rem <= width < 48rem)", columns: 2 },
												{ query: "(width >= 48rem)", columns: resolvedColumns },
											]),
										],
								parts?.quotes,
							]}
						>
							{children}
						</div>
					</div>
				</div>
			</MarketingSection>
		);
	};
}

/**
 * One testimonial card: the quote in a `<blockquote>` that grows to the row's height and
 * the speaker in a `<figcaption>` at its foot, with an optional round avatar.
 *
 * @param handle Runtime handle carrying the card's props.
 * @returns The render function producing the card's markup.
 * @example
 * <TestimonialBand.Quote name="Ana Ruiz" jobTitle="SRE, Lumen" avatar="AR">
 * 	We caught the outage <strong>before our customers did</strong>.
 * </TestimonialBand.Quote>
 */
TestimonialBand.Quote = function TestimonialBandQuote(handle: Handle<TestimonialBand.QuoteProps>) {
	return () => {
		let { avatar, children, href, jobTitle, linkLabel, logo, mix, name, variant, ...rest } =
			handle.props;
		let isFeatured = variant === "featured";

		return (
			<figure
				{...rest}
				data-slot="testimonial-quote"
				data-variant={isFeatured ? "featured" : "card"}
				mix={[
					vstack({ gap: 6, align: "stretch" }),
					isFeatured
						? [
								marketingBandTone("inverse"),
								raw({
									margin: "0",
									padding: "clamp(1.5rem, 1rem + 2cqi, 3rem)",
									borderRadius: "var(--ui-marketing-radius-surface, 1rem)",
								}),
							]
						: [marketingSurface(), raw({ margin: "0", padding: "1.5rem" })],
					mix,
				]}
			>
				{logo ? (
					<div
						data-slot="testimonial-logo"
						mix={[
							fg("neutral.emphasis"),
							when("& > :is(img, svg)", raw({ blockSize: "1.75rem", inlineSize: "auto" })),
						]}
					>
						{logo}
					</div>
				) : null}
				<blockquote
					mix={[
						fg("neutral.emphasis"),
						raw(
							isFeatured
								? {
										margin: "0",
										flexGrow: "1",
										fontSize: "clamp(1.375rem, 1rem + 1.4cqi, 2rem)",
										lineHeight: "1.3",
										fontWeight: "500",
										letterSpacing: "-0.015em",
										textWrap: "pretty",
									}
								: { margin: "0", flexGrow: "1", fontSize: "1rem", lineHeight: "1.75rem" },
						),
						marketingEmphasis(),
					]}
				>
					{children}
				</blockquote>
				<figcaption mix={[hstack({ gap: 3 }), items("center")]}>
					{avatar ? (
						<span
							data-slot="testimonial-avatar"
							aria-hidden="true"
							mix={[
								fg("neutral"),
								text("sm"),
								weight("medium"),
								raw({
									display: "inline-grid",
									placeItems: "center",
									flexShrink: "0",
									inlineSize: "2.5rem",
									blockSize: "2.5rem",
									borderRadius: "9999px",
									overflow: "hidden",
									backgroundColor: "var(--ui-neutral-bg-tint)",
									outline: "1px solid var(--ui-image-outline, rgb(0 0 0 / 0.1))",
									outlineOffset: "-1px",
									textTransform: "uppercase",
								}),
								when("& > img", raw({ inlineSize: "100%", blockSize: "100%", objectFit: "cover" })),
							]}
						>
							{avatar}
						</span>
					) : null}
					<span mix={[vstack({ gap: 0, align: "start" }), text("sm")]}>
						<span mix={[weight("semibold"), fg("neutral.emphasis")]}>{name}</span>
						{jobTitle ? <span mix={[fg("neutral.muted")]}>{jobTitle}</span> : null}
					</span>
				</figcaption>
				{href ? (
					<a href={href} data-slot="testimonial-link" mix={[storyLink()]}>
						{linkLabel ?? "Read the story"}
						<span aria-hidden="true">→</span>
					</a>
				) : null}
			</figure>
		);
	};
};

/**
 * The carousel track: one row of cards at `min(22rem, 85%)`, so a phone shows the next
 * card's edge, scrolling and snapping sideways inside the band with the inline end faded.
 */
function carouselTrack() {
	let mask = "linear-gradient(to right, #000 calc(100% - 3rem), transparent)";

	return [
		raw({
			display: "grid",
			gridAutoFlow: "column",
			gridAutoColumns: "min(22rem, 85%)",
			gap: CARD_GAP,
			overflowX: "auto",
			overscrollBehaviorX: "contain",
			scrollSnapType: "x mandatory",
			scrollbarWidth: "none",
			paddingBlock: "2px",
			paddingInlineEnd: "3rem",
			maskImage: mask,
			WebkitMaskImage: mask,
		}),
		when("& > *", raw({ scrollSnapAlign: "start" })),
		when("&::-webkit-scrollbar", raw({ display: "none" })),
		when(
			"&:focus-visible",
			raw({
				outline: "2px solid var(--ui-focus-ring, var(--ui-brand-border-strong))",
				outlineOffset: "4px",
			}),
		),
	];
}

/** The story link: eyebrow-sized, in the brand ink, its arrow nudging on hover. */
function storyLink() {
	return [
		raw({
			display: "inline-flex",
			alignItems: "center",
			gap: "0.375rem",
			alignSelf: "start",
			fontSize: "0.875rem",
			fontWeight: "500",
			color: "var(--ui-brand-fg)",
			textDecoration: "none",
		}),
		when("&:hover", raw({ textDecoration: "underline", textUnderlineOffset: "4px" })),
		when('[data-variant="featured"] > &', raw({ color: "var(--ui-neutral-fg-emphasis)" })),
	];
}
