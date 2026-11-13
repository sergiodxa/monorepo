/**
 * A case study as one full-bleed scene: a running head, a plate that crosses the whole band
 * edge to edge, and under it the title with the problem, what was built and the measured
 * result set on a twelve-column grid, the way a printed portfolio lays out a project spread.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { combine, raw } from "@sdxc/u/general";
import { at } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";
import { font } from "@sdxc/u/typography";

import { Heading } from "../components/heading.js";
import { landingEmphasis } from "../styles/landing.js";

import { LandingSection } from "./landing-section.js";

/** The container every case study's grid queries, published by its {@link LandingSection}. */
const CONTAINER = "ui-landing-section";

/** The rule between the parts of a spread, in the band's hairline. */
const RULE = "1px solid var(--ui-landing-hairline, var(--ui-neutral-border))";

/** The small label face shared by the running head and the column labels. */
const LABEL_FONT = "var(--ui-landing-eyebrow-font, var(--ui-font-mono))";

/**
 * Prop types for {@link CaseStudy}.
 */
export namespace CaseStudy {
	/** The measured outcome, set as the spread's largest figure. */
	export interface Result {
		/** The figure itself, such as "−31%" or "48 s → 19 s". */
		value: RemixNode;
		/** What the figure measures and over which period. */
		label: RemixNode;
	}

	/** The column labels, for a page in another language. */
	export interface Labels {
		/** @default "Problem" */
		problem?: RemixNode;
		/** @default "What we built" */
		built?: RemixNode;
		/** @default "Result" */
		result?: RemixNode;
	}

	/**
	 * Props accepted by {@link CaseStudy}.
	 */
	export interface Props extends Omit<LandingSection.Props, "children" | "title" | "align"> {
		/** The project's place in the sequence, such as "01", set first in the running head. */
		index?: RemixNode;
		/** Who the work was for. */
		client: RemixNode;
		/** Sector, year or discipline, set after the client in the running head. */
		meta?: RemixNode;
		/** The spread's headline, at chapter display size through the ambient heading depth. */
		title: RemixNode;
		/** The scene: inline SVG or drawn UI, stretched to fill the plate. */
		scene: RemixNode;
		/** What the scene shows, read as the plate's accessible name. */
		sceneLabel: string;
		/** The plate's fill behind the scene. Defaults to the tinted neutral. */
		plate?: string;
		/** What stood in the client's way. */
		problem: RemixNode;
		/** The work, as delivered. */
		built: RemixNode;
		/** The measured outcome. */
		result: Result;
		/** Column labels; English by default. */
		labels?: Labels;
	}
}

/**
 * Renders the running head, the edge-to-edge plate and the spread under it: one column on
 * a phone, then from the `lg` container a twelve-column grid whose first three columns stay
 * empty, a margin beside the title and the problem, the work and the result.
 *
 * @param handle Runtime handle carrying the spread's props.
 * @returns The render function producing the band.
 * @example
 * <CaseStudy
 * 	index="01"
 * 	client="Harbour Line"
 * 	meta="Transit · 2025"
 * 	title="A ferry timetable you read from the pier"
 * 	scene={<DeparturesBoard />}
 * 	sceneLabel="The departures board on pier 3"
 * 	problem="Riders missed connections they could not see coming."
 * 	built="A live board and a rider app sharing one timetable service."
 * 	result={{ value: "−31%", label: "missed connections, first winter" }}
 * />
 */
export function CaseStudy(handle: Handle<CaseStudy.Props>) {
	return () => {
		let {
			built,
			client,
			index,
			labels,
			meta,
			plate,
			problem,
			result,
			scene,
			sceneLabel,
			title,
			...rest
		} = handle.props;

		return (
			<LandingSection {...rest}>
				<article data-slot="case-study" mix={[spread()]}>
					<p data-slot="case-study-head" mix={[runningHead()]}>
						{index ? <span data-slot="case-study-index">{index}</span> : null}
						<span
							data-slot="case-study-client"
							mix={[raw({ color: "var(--ui-neutral-fg-emphasis)" })]}
						>
							{client}
						</span>
						{meta ? <span data-slot="case-study-meta">{meta}</span> : null}
					</p>
					<figure
						data-slot="case-study-plate"
						role="img"
						aria-label={sceneLabel}
						mix={[plateFrame(plate)]}
					>
						{scene}
					</figure>
					<Heading size="chapter" mix={[titleCell()]}>
						{title}
					</Heading>
					<dl data-slot="case-study-facts" mix={[facts()]}>
						<div data-slot="case-study-problem" mix={[fact()]}>
							<dt mix={[factLabel()]}>{labels?.problem ?? "Problem"}</dt>
							<dd mix={[factBody()]}>{problem}</dd>
						</div>
						<div data-slot="case-study-built" mix={[fact()]}>
							<dt mix={[factLabel()]}>{labels?.built ?? "What we built"}</dt>
							<dd mix={[factBody()]}>{built}</dd>
						</div>
						<div data-slot="case-study-result" mix={[fact()]}>
							<dt mix={[factLabel()]}>{labels?.result ?? "Result"}</dt>
							<dd mix={[factBody(), raw({ display: "grid", gap: "0.5rem" })]}>
								<span data-slot="case-study-figure" mix={[figure()]}>
									{result.value}
								</span>
								<span>{result.label}</span>
							</dd>
						</div>
					</dl>
				</article>
			</LandingSection>
		);
	};
}

/**
 * The spread's grid: one column on a phone, twelve from the `lg` container, so every part
 * of every case study on a page lands on the same columns.
 */
function spread() {
	return combine([
		raw({
			display: "grid",
			gridTemplateColumns: "minmax(0, 1fr)",
			rowGap: "2rem",
			inlineSize: "100%",
		}),
		at(
			"lg",
			CONTAINER,
			raw({ gridTemplateColumns: "repeat(12, minmax(0, 1fr))", columnGap: "2rem", rowGap: "3rem" }),
		),
	]);
}

/** The running head: index, client and meta on one ruled line in the small label face. */
function runningHead() {
	return combine([
		raw({
			gridColumn: "1 / -1",
			margin: "0",
			display: "flex",
			flexWrap: "wrap",
			columnGap: "1.5rem",
			rowGap: "0.25rem",
			paddingBlockEnd: "0.75rem",
			borderBlockEnd: RULE,
			fontFamily: LABEL_FONT,
			fontSize: "0.75rem",
			letterSpacing: "0.12em",
			textTransform: "uppercase",
			color: "var(--ui-neutral-fg-muted)",
			fontVariantNumeric: "tabular-nums",
		}),
	]);
}

/**
 * The plate: the whole band's width, edge to edge past the measured column, at a
 * landscape height that grows with the viewport. The scene inside fills it.
 *
 * @param fill The plate colour, or the tinted neutral.
 */
function plateFrame(fill: string | undefined) {
	return combine([
		raw({
			gridColumn: "1 / -1",
			margin: "0",
			marginInline: "calc(50% - 50cqi)",
			inlineSize: "100cqi",
			blockSize: "clamp(20rem, 52cqi, 40rem)",
			display: "grid",
			overflow: "hidden",
			backgroundColor: fill ?? "var(--ui-neutral-bg-tint)",
		}),
		when("& > *", raw({ inlineSize: "100%", blockSize: "100%", minInlineSize: "0" })),
	]);
}

/** The headline cell: full width on a phone, columns 4 to 12 beside an empty margin from `lg`. */
function titleCell() {
	return combine([
		raw({ margin: "0", maxInlineSize: "22ch" }),
		at("lg", CONTAINER, raw({ gridColumn: "4 / -1" })),
	]);
}

/** The facts list: stacked on a phone, three columns of three from `lg` under the headline, on the page grid. */
function facts() {
	return combine([
		raw({ margin: "0", display: "grid", gridTemplateColumns: "minmax(0, 1fr)", rowGap: "1.5rem" }),
		at(
			"lg",
			CONTAINER,
			raw({
				gridColumn: "4 / -1",
				gridTemplateColumns: "subgrid",
			}),
		),
	]);
}

/** One fact: its label over its body, under a rule; three columns each from `lg`. */
function fact() {
	return combine([
		raw({
			display: "grid",
			alignContent: "start",
			gap: "0.75rem",
			paddingBlockStart: "1rem",
			borderBlockStart: RULE,
		}),
		at("lg", CONTAINER, raw({ gridColumn: "span 3" })),
	]);
}

/** A fact's label, in the running head's face. */
function factLabel() {
	return raw({
		fontFamily: LABEL_FONT,
		fontSize: "0.75rem",
		letterSpacing: "0.12em",
		textTransform: "uppercase",
		color: "var(--ui-neutral-fg-muted)",
	});
}

/** A fact's copy, in the body ink with emphasis in the heading ink. */
function factBody() {
	return combine([
		raw({ margin: "0", color: "var(--ui-neutral-fg)", lineHeight: "1.6", textWrap: "pretty" }),
		landingEmphasis(),
	]);
}

/**
 * The result's figure in the display face, sized for a column a quarter of the page wide
 * so a before-and-after pair fits on one line at 1440; `--ui-landing-case-figure-size` resizes it.
 */
function figure() {
	return combine([
		font("display"),
		raw({
			fontSize: "var(--ui-landing-case-figure-size, clamp(2rem, 1rem + 2cqi, 3rem))",
			fontWeight: "var(--ui-landing-display-weight, 500)",
			letterSpacing: "var(--ui-landing-display-tracking, -0.035em)",
			lineHeight: "1.05",
			color: "var(--ui-neutral-fg-emphasis)",
			fontVariantNumeric: "lining-nums tabular-nums",
			textWrap: "balance",
		}),
	]);
}
