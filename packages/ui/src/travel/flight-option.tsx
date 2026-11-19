/**
 * One row of flight search results: badges such as "Cheapest", a line per journey with its
 * airline and route, and the price with a select action. Under 36rem the price sits under the
 * journeys; wider, it takes a column of its own beside them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, Props as TagProps, RemixNode } from "remix/component";

import { bg, border, fg } from "@sdxc/u/color";
import { rounded, shadow } from "@sdxc/u/effects";
import { listStyle, raw, mergeMix } from "@sdxc/u/general";
import { container, flex, gap, grid, inlineFlex, items, justify, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { bs, is, m, minIs, p } from "@sdxc/u/size";
import { when } from "@sdxc/u/state";
import { leading, tabularNums, text, truncate, weight } from "@sdxc/u/typography";

import { FlightRoute } from "./flight-segment.js";

/** Container the row names, so it lays out by the width of the results column. */
const CONTAINER_NAME = "ui-flight-option";

/** Row width from which the price moves into a column beside the journeys. */
const PRICE_COLUMN_WIDTH = "36rem";

/**
 * Prop types for {@link FlightOption} and its compound parts.
 */
export namespace FlightOption {
	/** Every native `<article>` attribute, plus the price, its action and the journeys. */
	export interface Props extends TagProps<"article"> {
		/** The fare, formatted by the caller, such as "$412". */
		price: RemixNode;
		/** What the fare covers, such as "Round trip per person", under the price. */
		priceDetail?: RemixNode;
		/** Labels over the journeys, such as `<Badge>` elements reading "Cheapest" or "Fastest". */
		badges?: RemixNode;
		/** The select link or submit button, at the price's end. */
		action?: RemixNode;
		/** Rings the row in the brand colour, for the option a page recommends. */
		featured?: boolean;
		/** Full detail under the row, such as a `FlightItinerary` per journey. */
		details?: RemixNode;
		/** The {@link FlightOption.Journey} lines, one per direction. */
		children: RemixNode;
	}

	/** The route's ends and what lies between them; see {@link FlightRoute}. */
	export type RouteProps = Pick<
		FlightRoute.Props,
		| "departure"
		| "arrival"
		| "duration"
		| "stops"
		| "stopsLabel"
		| "dayOffset"
		| "dayOffsetLabel"
		| "labels"
	>;

	/** Every native `<li>` attribute and every route prop, plus who flies the journey. */
	export interface JourneyProps extends Omit<TagProps<"li">, "children">, RouteProps {
		/** The airline or airlines, such as "Larkwing Air". */
		airline: RemixNode;
		/** The airline's mark, drawn in a 1.75rem square before the route. */
		mark?: RemixNode;
	}
}

/**
 * Renders the row as an `<article>`: badges, then each {@link FlightOption.Journey}, then the
 * price, its detail and the action. A list of these, each in an `<li>`, makes a results page;
 * name each one with `aria-label` (such as "Larkwing Air, $412") so a list reads at a glance.
 *
 * @param handle Runtime handle carrying the row's props.
 * @returns The render function producing the row's markup.
 * @example
 * <FlightOption price="$412" priceDetail="Round trip" badges={<Badge>Cheapest</Badge>} action={<Button>Select</Button>}>
 * 	<FlightOption.Journey airline="Larkwing Air" departure={{ time: "08:40", code: "MRW" }}
 * 		arrival={{ time: "10:55", code: "VLS" }} duration="2h 15m" stopsLabel="Nonstop" />
 * </FlightOption>
 */
export function FlightOption(handle: Handle<FlightOption.Props>) {
	return () => {
		let { price, priceDetail, badges, action, featured, details, children, mix, ...rest } =
			handle.props;

		return (
			<article
				data-slot="flight-option"
				data-featured={featured ? "" : undefined}
				{...rest}
				mix={mergeMix(
					[
						container(CONTAINER_NAME, "inline-size"),
						minIs(0),
						rounded("lg"),
						bg("var(--ui-surface-raised, var(--ui-bg, Canvas))"),
						border({ color: "neutral.border", width: 1 }),
						shadow("xs"),
						text("sm"),
						when("&[data-featured]", [
							border({ color: "brand.strong", width: 1 }),
							raw({ boxShadow: "0 0 0 1px var(--ui-brand-border-strong)" }),
						]),
					],
					mix,
				)}
			>
				<div
					data-slot="flight-option-body"
					mix={[
						grid(),
						raw({ gridTemplateAreas: '"badges" "journeys" "price"' }),
						at(
							PRICE_COLUMN_WIDTH,
							CONTAINER_NAME,
							raw({
								gridTemplateColumns: "minmax(0, 1fr) minmax(9rem, auto)",
								gridTemplateAreas: '"badges price" "journeys price"',
							}),
						),
					]}
				>
					{badges === undefined ? null : (
						<div
							data-slot="flight-option-badges"
							mix={[
								flex(),
								raw({ flexWrap: "wrap", gridArea: "badges" }),
								gap(1.5),
								raw({ paddingInline: "1rem", paddingBlockStart: "1rem" }),
							]}
						>
							{badges}
						</div>
					)}
					<ul
						data-slot="flight-option-journeys"
						mix={[m(0), p(4), listStyle("none"), vstack({ gap: 4 }), raw({ gridArea: "journeys" })]}
					>
						{children}
					</ul>
					<div
						data-slot="flight-option-price"
						mix={[
							raw({ gridArea: "price" }),
							flex(),
							items("center"),
							justify("between"),
							gap(3),
							p(4),
							raw({ flexWrap: "wrap" }),
							border({ color: "neutral.border", width: 0 }),
							raw({ borderBlockStartWidth: "1px", borderBlockStartStyle: "solid" }),
							at(
								PRICE_COLUMN_WIDTH,
								CONTAINER_NAME,
								raw({
									flexDirection: "column",
									alignItems: "stretch",
									justifyContent: "center",
									textAlign: "end",
									borderBlockStartWidth: "0",
									borderInlineStartWidth: "1px",
									borderInlineStartStyle: "solid",
								}),
							),
						]}
					>
						<p mix={[m(0), vstack({ gap: 0.5 })]}>
							<span
								data-slot="flight-option-amount"
								mix={[
									text("xl"),
									weight("semibold"),
									leading(1.1),
									tabularNums(),
									fg("neutral.emphasis"),
								]}
							>
								{price}
							</span>
							{priceDetail === undefined ? null : (
								<span
									data-slot="flight-option-price-detail"
									mix={[text("xs"), fg("neutral.muted")]}
								>
									{priceDetail}
								</span>
							)}
						</p>
						{action === undefined ? null : (
							<div data-slot="flight-option-action" mix={[flex(), raw({ justifyContent: "end" })]}>
								{action}
							</div>
						)}
					</div>
				</div>
				{details === undefined ? null : (
					<div
						data-slot="flight-option-details"
						mix={[
							p(4),
							vstack({ gap: 4 }),
							border({ color: "neutral.border", width: 0 }),
							raw({ borderBlockStartWidth: "1px", borderBlockStartStyle: "solid" }),
						]}
					>
						{details}
					</div>
				)}
			</article>
		);
	};
}

/**
 * Renders one direction of the trip as a list item: the airline's mark and name over the
 * {@link FlightRoute}, so outbound and return lines stack with their routes aligned.
 *
 * @param handle Runtime handle carrying the journey's props.
 * @returns The render function producing the journey's list item.
 * @example
 * <FlightOption.Journey airline="Larkwing Air" mark={<LarkwingMark />}
 * 	departure={{ time: "22:40", code: "MRW" }} arrival={{ time: "06:05", code: "OSK" }}
 * 	duration="7h 25m" stops={1} stopsLabel="1 stop · VLS" dayOffset="+1" dayOffsetLabel="next day" />
 */
FlightOption.Journey = function FlightOptionJourney(handle: Handle<FlightOption.JourneyProps>) {
	return () => {
		let {
			airline,
			mark,
			departure,
			arrival,
			duration,
			stops,
			stopsLabel,
			dayOffset,
			dayOffsetLabel,
			labels,
			mix,
			...rest
		} = handle.props;

		return (
			<li
				data-slot="flight-option-journey"
				{...rest}
				mix={mergeMix([vstack({ gap: 2 }), minIs(0)], mix)}
			>
				<span mix={[flex(), items("center"), gap(2), minIs(0), text("xs"), fg("neutral.muted")]}>
					{mark === undefined ? null : (
						<span
							data-slot="flight-option-mark"
							aria-hidden="true"
							mix={[
								inlineFlex(),
								is("1.75rem"),
								bs("1.75rem"),
								rounded("md"),
								raw({ flexShrink: 0, overflow: "hidden" }),
								when("& > :is(svg, img)", raw({ inlineSize: "100%", blockSize: "100%" })),
							]}
						>
							{mark}
						</span>
					)}
					<span data-slot="flight-option-airline" mix={[truncate()]}>
						{airline}
					</span>
				</span>
				<FlightRoute
					departure={departure}
					arrival={arrival}
					duration={duration}
					stops={stops}
					stopsLabel={stopsLabel}
					dayOffset={dayOffset}
					dayOffsetLabel={dayOffsetLabel}
					labels={labels}
				/>
			</li>
		);
	};
};
