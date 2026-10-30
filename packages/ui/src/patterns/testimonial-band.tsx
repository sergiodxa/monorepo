/**
 * Testimonial band: a {@link MarketingHeader} over a grid of quote cards whose rows
 * share one height and span the band's content width, the way feature grids do. Each
 * card is a `<figure>` pairing the quote with who said it.
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
import { marketingEmphasis, marketingSurface } from "../styles/marketing.js";

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
		/** One {@link TestimonialBand.Quote} per testimonial; they fill each column top to bottom. */
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
		let { children, columns, description, eyebrow, mix, parts, spacing, title, tone, ...rest } =
			handle.props;
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
					<div data-columns={String(resolvedColumns)} mix={[container(CONTAINER_NAME)]}>
						<div
							data-slot="testimonial-quotes"
							mix={[
								grid(),
								raw({ gap: CARD_GAP }),
								balancedGrid(CONTAINER_NAME, [
									{ query: "(width < 36rem)", columns: 1 },
									{ query: "(36rem <= width < 48rem)", columns: 2 },
									{ query: "(width >= 48rem)", columns: resolvedColumns },
								]),
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
		let { avatar, children, jobTitle, mix, name, ...rest } = handle.props;

		return (
			<figure
				{...rest}
				data-slot="testimonial-quote"
				mix={[
					vstack({ gap: 6, align: "stretch" }),
					marketingSurface(),
					raw({
						margin: "0",
						padding: "1.5rem",
					}),
					mix,
				]}
			>
				<blockquote
					mix={[
						fg("neutral.emphasis"),
						raw({ margin: "0", flexGrow: "1", fontSize: "1rem", lineHeight: "1.75rem" }),
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
			</figure>
		);
	};
};
