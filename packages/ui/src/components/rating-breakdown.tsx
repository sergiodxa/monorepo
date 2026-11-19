/**
 * A reviews summary: the average score set large beside a star and the review count, then
 * groups of bars, one per star level or per category. Each bar is an ARIA meter named by its
 * label, and a category group runs two to a row once its own container is wide enough.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { StarIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { bg, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, items, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, tabularNums, text, tracking, weight } from "@sdxc/u/typography";

/** Container the summary names, so a category group measures the summary, not the page. */
const CONTAINER_NAME = "ui-rating-breakdown";

/** Summary width from which a category group sets its bars two to a row. */
const TWO_COLUMN_WIDTH = "30rem";

/** Top of the scale when `max` is left out: a five-star rating. */
const DEFAULT_MAX = 5;

/**
 * Prop types for {@link RatingBreakdown} and its compound parts.
 */
export namespace RatingBreakdown {
	/**
	 * `"stars"` sets each bar on one line, label and figure either side of it, for the share
	 * of reviews at each star level; `"categories"` sets the label over its bar, two to a row
	 * when there is room, for per-category scores.
	 */
	export type Kind = "stars" | "categories";

	/** What a {@link RatingBreakdown.Group} shares with its bars. */
	export interface GroupContext {
		kind: Kind;
	}

	/** Every native `<section>` attribute, plus the headline score. */
	export interface Props extends TagProps<"section"> {
		/** The average rating, such as `4.86`. */
		score: number;
		/** @default 5 */
		max?: number;
		/**
		 * The score as shown, already formatted for the reader's locale.
		 *
		 * @default score.toFixed(2)
		 */
		display?: string;
		/** The review count as shown, such as "128 reviews". */
		count?: RemixNode;
		/**
		 * What follows the score for a screen reader, completing "4.86 out of 5".
		 *
		 * @default "out of {max}"
		 */
		outOf?: string;
	}

	/** Every native `<ul>` attribute, plus how its bars lay out. */
	export interface GroupProps extends TagProps<"ul"> {
		kind: Kind;
	}

	/** Every native `<li>` attribute, plus what the bar measures. */
	export interface BarProps extends Omit<TagProps<"li">, "children"> {
		/** What the bar measures, such as "5 stars" or "Cleanliness"; it names the meter. */
		label: string;
		/** Drawn before the label, such as a star or a category's icon. */
		icon?: RemixNode;
		/** The measured amount: a share from 0 to `max`, or a category's score. */
		value: number;
		/** @default 1 for a "stars" group, 5 for a "categories" group */
		max?: number;
		/** The figure shown at the bar's end and read as its value, such as "92%" or "4.9". */
		display: string;
	}
}

/**
 * Renders the summary: a `<section>` opening with the score, its star and the review count,
 * followed by its {@link RatingBreakdown.Group} children. A screen reader hears the score as
 * "4.86 out of 5".
 *
 * @param handle Runtime handle carrying the section's props.
 * @returns The render function producing the summary's markup.
 * @example
 * <RatingBreakdown score={4.86} count="128 reviews">
 * 	<RatingBreakdown.Group kind="stars" aria-label="Ratings by star">
 * 		<RatingBreakdown.Bar label="5 stars" value={0.92} display="92%" />
 * 	</RatingBreakdown.Group>
 * </RatingBreakdown>
 */
export function RatingBreakdown(handle: Handle<RatingBreakdown.Props>) {
	return () => {
		let { score, max, display, count, outOf, children, mix, ...rest } = handle.props;
		let top = max ?? DEFAULT_MAX;

		return (
			<section
				data-slot="rating-breakdown"
				{...rest}
				mix={mergeMix([container(CONTAINER_NAME, "inline-size"), vstack({ gap: 5 })], mix)}
			>
				<p
					data-slot="rating-breakdown-score"
					mix={[m(0), flex(), items("center"), gap(2), raw({ flexWrap: "wrap" })]}
				>
					<span aria-hidden="true" mix={[flex(), raw({ color: "var(--ui-warning-fg)" })]}>
						<StarIcon size={28} fill="currentColor" stroke-width={0} />
					</span>
					<span
						mix={[
							text("3xl"),
							weight("semibold"),
							tracking("tight"),
							leading(1),
							tabularNums(),
							fg("neutral.emphasis"),
						]}
					>
						{display ?? score.toFixed(2)}
						<span mix={[visuallyHidden()]}>{` ${outOf ?? `out of ${top}`}`}</span>
					</span>
					{count === undefined ? null : (
						<span data-slot="rating-breakdown-count" mix={[text("sm"), fg("neutral.muted")]}>
							{count}
						</span>
					)}
				</p>
				{children}
			</section>
		);
	};
}

/**
 * Renders a list of bars of one kind: star levels one under another, or categories in a
 * grid that runs two to a row once the summary is 30rem wide. Name each group with
 * `aria-label` when a summary holds more than one.
 *
 * @param handle Runtime handle carrying the list's props and providing its kind to the bars.
 * @returns The render function producing the list's markup.
 * @example
 * <RatingBreakdown.Group kind="categories" aria-label="Ratings by category">
 * 	<RatingBreakdown.Bar label="Cleanliness" icon={<SparklesIcon />} value={4.9} display="4.9" />
 * </RatingBreakdown.Group>
 */
RatingBreakdown.Group = function RatingBreakdownGroup(
	handle: Handle<RatingBreakdown.GroupProps, RatingBreakdown.GroupContext>,
) {
	return () => {
		let { kind, mix, ...rest } = handle.props;
		handle.context.set({ kind });

		return (
			<ul
				data-slot="rating-breakdown-group"
				data-kind={kind}
				{...rest}
				mix={mergeMix(
					[
						m(0),
						p(0),
						raw({ listStyle: "none" }),
						grid(),
						kind === "stars"
							? gap(2)
							: [
									raw({ columnGap: "2rem", rowGap: "1rem" }),
									at(
										TWO_COLUMN_WIDTH,
										CONTAINER_NAME,
										raw({ gridTemplateColumns: "repeat(2, minmax(0, 1fr))" }),
									),
								],
					],
					mix,
				)}
			/>
		);
	};
};

/**
 * Renders one bar as an ARIA meter named by `label` and valued by `display`, filled to
 * `value / max` of its track; the figure at its end is hidden from assistive technology,
 * which reads it as the meter's value. Values outside `0..max` are clamped.
 *
 * @param handle Runtime handle carrying the item's props.
 * @returns The render function producing the bar's markup.
 * @example
 * <RatingBreakdown.Bar label="4 stars" value={0.06} display="6%" />
 * @example
 * <RatingBreakdown.Bar label="Location" icon={<MapPinIcon />} value={4.7} display="4.7" />
 */
RatingBreakdown.Bar = function RatingBreakdownBar(handle: Handle<RatingBreakdown.BarProps>) {
	return () => {
		let { label, icon, value, max, display, mix, ...rest } = handle.props;
		let { kind } = handle.context.get(RatingBreakdown.Group);
		let top = max ?? (kind === "stars" ? 1 : DEFAULT_MAX);
		let share = top > 0 ? Math.max(0, Math.min(1, value / top)) : 0;
		let labelId = `${handle.id}-label`;
		let stars = kind === "stars";

		return (
			<li
				data-slot="rating-breakdown-bar"
				{...rest}
				mix={mergeMix(
					[
						grid(),
						items("center"),
						text("sm"),
						stars
							? raw({
									gridTemplateColumns: "minmax(3.5rem, auto) minmax(0, 1fr) 2.75rem",
									columnGap: "0.75rem",
								})
							: raw({
									gridTemplateColumns: "minmax(0, 1fr) auto",
									gridTemplateAreas: '"label value" "track track"',
									columnGap: "0.75rem",
									rowGap: "0.375rem",
								}),
					],
					mix,
				)}
			>
				<span
					id={labelId}
					data-slot="rating-breakdown-label"
					mix={[
						flex(),
						items("center"),
						gap(1.5),
						minIs(0),
						fg(stars ? "neutral.muted" : "neutral.emphasis"),
						stars ? null : raw({ gridArea: "label" }),
						when("& > svg", raw({ inlineSize: "1rem", blockSize: "1rem", flexShrink: 0 })),
					]}
				>
					{icon}
					{label}
				</span>
				<div
					role="meter"
					aria-labelledby={labelId}
					aria-valuemin={0}
					aria-valuemax={top}
					aria-valuenow={value}
					aria-valuetext={display}
					data-slot="rating-breakdown-track"
					mix={[
						bs("0.375rem"),
						rounded("full"),
						bg("neutral.border"),
						raw({ overflow: "hidden" }),
						stars ? null : raw({ gridArea: "track" }),
					]}
				>
					<div
						data-slot="rating-breakdown-fill"
						style={{ inlineSize: `${share * 100}%` }}
						mix={[bs("100%"), rounded("full"), bg("neutral.solid")]}
					/>
				</div>
				<span
					aria-hidden="true"
					data-slot="rating-breakdown-value"
					mix={[
						tabularNums(),
						raw({ textAlign: "end" }),
						fg(stars ? "neutral.muted" : "neutral.emphasis"),
						stars ? null : [weight("semibold"), raw({ gridArea: "value" })],
					]}
				>
					{display}
				</span>
			</li>
		);
	};
};
