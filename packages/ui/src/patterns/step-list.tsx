/**
 * Marketing steps for a “how it works” band: numbered columns, or a timeline that walks
 * one story down a rule with a timestamp and product media per step. Counters are
 * CSS-driven so the list stays pure markup; titles and copy stay on the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { combine, counterIncrement, counterReset, pseudoContent, raw } from "@sdxc/u/general";
import {
	absolute,
	container,
	gap,
	grid,
	gridTemplate,
	inlineFlex,
	items,
	justify,
	relative,
	repeat,
	vstack,
} from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, mbe } from "@sdxc/u/size";
import { after, before, not } from "@sdxc/u/state";
import { font, leading, pretty, text, textAlign, weight } from "@sdxc/u/typography";

import { HeadingScope, resolveHeadingLevel, TAG_BY_LEVEL } from "../components/heading-scope.js";
import { marketingEmphasis } from "../styles/marketing.js";

/** Look {@link StepList} draws when `variant` is omitted. */
const DEFAULT_VARIANT: StepList.Variant = "numbered";

/** Container the list's tracks and each timeline step's media column query. */
const LIST_CONTAINER = "ui-marketing-step-list";

/** Translucent line connectors and the timeline rule draw with. */
const HAIRLINE = "var(--ui-marketing-hairline, color-mix(in oklch, CanvasText 8%, transparent))";

/** Space between the timeline rule and a step's copy. */
const TIMELINE_INSET = "2rem";

/**
 * Prop types for {@link StepList} and its compound parts.
 */
export namespace StepList {
	/**
	 * `numbered` lays steps in counted columns; `timeline` runs them down a rule with a
	 * square marker each, an optional timestamp line and optional media.
	 */
	export type Variant = "numbered" | "timeline";

	/**
	 * Value {@link StepList} provides so each item draws for the list's look.
	 */
	export interface Context {
		/** Look every item in this list draws. */
		variant: Variant;
	}

	/**
	 * Props accepted by {@link StepList}.
	 */
	export interface Props extends TagProps<"ol"> {
		/** List look. Defaults to {@link DEFAULT_VARIANT}. */
		variant?: Variant;
		/** {@link StepList.Item} children, numbered by CSS counters. */
		children: RemixNode;
	}

	/**
	 * Props accepted by {@link StepList.Item}.
	 */
	export interface ItemProps extends Omit<TagProps<"li">, "title"> {
		/** Step title — rendered at the ambient heading depth. */
		title: RemixNode;
		/** Line above the title in a timeline, such as a timestamp. A numbered list leaves it out. */
		meta?: RemixNode;
		/**
		 * Rendered UI beside the copy from the `lg` container up and under it below, in a
		 * timeline. A numbered list leaves it out.
		 */
		media?: RemixNode;
		/** Supporting copy under the title; `<strong>` fragments draw in the heading ink. */
		children: RemixNode;
	}
}

/**
 * Lays steps in a responsive track. A sizing wrapper is the named container; the `<ol>`
 * holds the grid so the query can restyle a descendant. A numbered list moves to three
 * columns from `xl` (64rem) with connectors between items; a timeline stays one column.
 *
 * @param handle Runtime handle carrying the host `<ol>`'s props and providing {@link StepList.Context}.
 * @returns The render function producing the list's markup.
 * @example
 * <StepList>
 * 	<StepList.Item title={t("step.one")}>{t("step.one.body")}</StepList.Item>
 * </StepList>
 * @example
 * <StepList variant="timeline">
 * 	<StepList.Item meta="14:02 UTC" title={t("incident.detect")} media={probeCard}>
 * 		{t("incident.detect.body")}
 * 	</StepList.Item>
 * </StepList>
 */
export function StepList(handle: Handle<StepList.Props, StepList.Context>) {
	return () => {
		let { children, mix, variant, ...rest } = handle.props;
		let resolvedVariant = variant ?? DEFAULT_VARIANT;

		handle.context.set({ variant: resolvedVariant });

		return (
			<div mix={[container(LIST_CONTAINER)]}>
				<HeadingScope>
					<ol
						{...rest}
						data-slot="step-list"
						data-variant={resolvedVariant}
						mix={[
							counterReset("ui-marketing-step"),
							raw({ listStyle: "none", padding: "0", margin: "0" }),
							grid(),
							resolvedVariant === "timeline"
								? [gap(0), gridTemplate({ columns: "minmax(0, 1fr)" })]
								: [
										gap(8),
										combine([
											gridTemplate({ columns: "minmax(0, 1fr)" }),
											at(
												"xl",
												LIST_CONTAINER,
												gridTemplate({ columns: repeat(3, "minmax(0, 1fr)") }),
											),
										]),
									],
							mix,
						]}
					>
						{children}
					</ol>
				</HeadingScope>
			</div>
		);
	};
}

/**
 * Numbered step: a quiet ringed disc with the step number, then the title and copy. The
 * connector to the next step runs between the two discs once the list lays out in columns.
 */
function numberedStep() {
	return [
		relative(),
		vstack({ align: "center", gap: 4 }),
		textAlign("center"),
		counterIncrement("ui-marketing-step"),
		before([
			pseudoContent("counter(ui-marketing-step)"),
			inlineFlex(),
			items("center"),
			justify("center"),
			is(10),
			bs(10),
			mbe(2),
			rounded("full"),
			raw({
				backgroundColor: "transparent",
				boxShadow: `inset 0 0 0 1px ${HAIRLINE}`,
				color: "var(--ui-neutral-fg-emphasis)",
			}),
			text("base"),
			weight("semibold"),
		]),
		not(
			":last-child",
			after(
				combine([
					pseudoContent('""'),
					absolute(),
					raw({
						insetBlockStart: "1.25rem",
						insetInlineStart: "calc(50% + 1.75rem)",
						inlineSize: "calc(100% - 1.5rem)",
						blockSize: "1px",
						backgroundColor: HAIRLINE,
						display: "none",
					}),
					at("xl", LIST_CONTAINER, raw({ display: "block" })),
				]),
			),
		),
	];
}

/**
 * Timeline step: a hairline rule down the inline-start edge with a square brand marker
 * centred on the step's first line — the timestamp when there is one, else the title.
 *
 * @param hasMeta Whether the step opens with a timestamp line.
 */
function timelineStep(hasMeta: boolean) {
	return [
		relative(),
		raw({ paddingInlineStart: TIMELINE_INSET, paddingBlockEnd: "2.5rem" }),
		textAlign("start"),
		counterIncrement("ui-marketing-step"),
		before([
			pseudoContent('""'),
			absolute(),
			raw({
				insetBlock: "0",
				insetInlineStart: "calc(0.25rem - 0.5px)",
				inlineSize: "1px",
				backgroundColor: HAIRLINE,
			}),
		]),
		after([
			pseudoContent('""'),
			absolute(),
			raw({
				insetInlineStart: "0",
				insetBlockStart: hasMeta ? "0.25rem" : "0.5rem",
				inlineSize: "0.5rem",
				blockSize: "0.5rem",
				backgroundColor: "var(--ui-brand-bg-solid)",
			}),
		]),
	];
}

/**
 * One step. In a numbered list: a ringed number disc, a title, and supporting copy. In a
 * timeline: an optional timestamp, a title and copy, with optional media beside the copy
 * from the `lg` container up (copy 5fr, media 7fr) and under it below.
 *
 * @param handle Runtime handle carrying the host `<li>`'s props.
 * @returns The render function producing the step's markup.
 */
StepList.Item = function StepListItem(handle: Handle<StepList.ItemProps>) {
	return () => {
		let { children, media, meta, mix, title, ...rest } = handle.props;
		let context = handle.context.get(StepList) as StepList.Context | undefined;
		let resolved = resolveHeadingLevel(handle);
		let Tag = TAG_BY_LEVEL[resolved];

		if (context?.variant !== "timeline") {
			return (
				<li {...rest} data-slot="step-list-item" mix={[numberedStep(), mix]}>
					<Tag
						data-slot="step-list-title"
						data-heading-level={resolved}
						mix={[m(0), text("xl"), weight("medium"), fg("neutral.emphasis")]}
					>
						{title}
					</Tag>
					<div mix={[text("base"), leading("relaxed"), pretty(), fg("neutral")]}>{children}</div>
				</li>
			);
		}

		let hasMeta = meta !== undefined && meta !== null;
		let copy = (
			<div data-slot="step-list-copy" mix={[vstack({ gap: 2, align: "stretch" })]}>
				{hasMeta ? (
					<p
						data-slot="step-list-meta"
						mix={[m(0), font("mono"), text("xs"), raw({ lineHeight: "1rem" }), fg("neutral.muted")]}
					>
						{meta}
					</p>
				) : null}
				<Tag
					data-slot="step-list-title"
					data-heading-level={resolved}
					mix={[
						m(0),
						raw({ fontSize: "1rem", lineHeight: "1.5rem" }),
						weight("semibold"),
						fg("neutral.emphasis"),
					]}
				>
					{title}
				</Tag>
				<div
					mix={[
						raw({ fontSize: "1rem", lineHeight: "1.5rem" }),
						pretty(),
						fg("neutral"),
						marketingEmphasis(),
					]}
				>
					{children}
				</div>
			</div>
		);

		return (
			<li
				{...rest}
				data-slot="step-list-item"
				data-has-media={media ? "true" : undefined}
				mix={[timelineStep(hasMeta), mix]}
			>
				{media ? (
					<div
						mix={[
							combine([
								grid(),
								raw({ gap: "1rem", gridTemplateColumns: "minmax(0, 1fr)" }),
								at(
									"lg",
									LIST_CONTAINER,
									raw({ gridTemplateColumns: "minmax(0, 5fr) minmax(0, 7fr)", columnGap: "3rem" }),
								),
							]),
						]}
					>
						{copy}
						<div data-slot="step-list-media">{media}</div>
					</div>
				) : (
					copy
				)}
			</li>
		);
	};
};
