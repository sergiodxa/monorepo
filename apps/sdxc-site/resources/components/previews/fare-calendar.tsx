/**
 * Live preview for `FareCalendar`: the "shift by a day" strip above a month of departures from
 * Marrow Bay to Vellis, each day linking to its fare with the cheapest days tinted and marked.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FareCalendar as FareCalendarTypes } from "@sdxc/ui/travel/fare-calendar";

import { raw } from "@sdxc/u/general";
import { FareCalendar } from "@sdxc/ui/travel/fare-calendar";

/** Lowest fares for March 2026, in dollars; a zero is a day without flights. */
const PRICES = [
	164, 142, 158, 0, 131, 189, 212, 149, 118, 89, 97, 138, 176, 204, 151, 129, 89, 143, 167, 238,
	251, 146, 112, 99, 134, 0, 198, 226, 157, 121, 108,
];

/** Each March day's fare, levelled by price: under $100 is cheapest, over $200 is dear. */
const FARES: Record<string, FareCalendarTypes.Fare | undefined> = Object.fromEntries(
	PRICES.map((price, index) => {
		let date = `2026-03-${String(index + 1).padStart(2, "0")}`;
		if (price === 0) return [date, undefined];
		let level: FareCalendarTypes.Level = "mid";
		if (price < 100) level = "low";
		if (price > 200) level = "high";
		return [date, { amount: `$${price}`, level }];
	}),
);

/** The week either side of the chosen day the strip shows. */
const STRIP_DAYS = Array.from(
	{ length: 9 },
	(_, index) => `2026-03-${String(index + 6).padStart(2, "0")}`,
);

/** The words both calendars read. */
const LABELS: FareCalendarTypes.Labels = {
	previous: "Earlier",
	next: "Later",
	cheapest: "cheapest",
	noFlights: "no flights",
};

/** The source the page shows, matching the markup below. */
const CODE = `<FareCalendar
	variant="strip"
	days={["2026-03-06", "2026-03-07", …, "2026-03-14"]}
	fares={fares}
	selected="2026-03-10"
	href={(day) => \`?depart=\${day}\`}
	prevHref="?depart=2026-03-03"
	nextHref="?depart=2026-03-17"
	locale="en-US"
	label="Nearby dates"
	labels={labels}
/>
<FareCalendar
	month="2026-03"
	fares={fares}
	selected="2026-03-10"
	today="2026-03-02"
	href={(day) => \`?depart=\${day}\`}
	prevHref="?month=2026-02"
	nextHref="?month=2026-04"
	locale="en-US"
	label="Departure dates"
	labels={labels}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					display: "grid",
					gap: "1.5rem",
					inlineSize: "100%",
					maxInlineSize: "24rem",
					marginBlock: "1.5rem",
				}),
			]}
		>
			<FareCalendar
				variant="strip"
				days={STRIP_DAYS}
				fares={FARES}
				selected="2026-03-10"
				href={(day) => `#depart-${day}`}
				prevHref="#earlier"
				nextHref="#later"
				locale="en-US"
				label="Nearby dates"
				labels={LABELS}
			/>
			<FareCalendar
				month="2026-03"
				fares={FARES}
				selected="2026-03-10"
				today="2026-03-02"
				href={(day) => `#depart-${day}`}
				prevHref="#february"
				nextHref="#april"
				locale="en-US"
				label="Departure dates"
				labels={{ ...LABELS, previous: "Previous month", next: "Next month" }}
			/>
		</div>
	),
};
