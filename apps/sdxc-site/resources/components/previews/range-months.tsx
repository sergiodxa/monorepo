/**
 * Live preview for `RangeMonths`: September and October side by side with a four-night stay
 * chosen, a few nights already booked, and each night's price under its date. Every day is a
 * plain link, so the preview picks dates without script.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { RangeMonths } from "@sdxc/ui/range-months";

/** The source the page shows, matching the markup below apart from the fixed sample data. */
const CODE = `<RangeMonths
	label="Stay dates"
	labels={{ previous: "Previous month", next: "Next month", start: "check-in", end: "check-out" }}
	locale="en-US"
	month={query.month ?? "2026-09"}
	start={query.checkIn}
	end={query.checkOut}
	today={today}
	min={today}
	isUnavailable={(date) => booked.has(date)}
	dayNote={(date) => \`$\${nightlyPrice(date)}\`}
	href={({ start, end, month }) =>
		\`?\${new URLSearchParams({ month, ...(start && { checkIn: start }), ...(end && { checkOut: end }) })}\`
	}
/>`;

/** Nights another guest already holds. */
const BOOKED = new Set(["2026-09-08", "2026-09-09", "2026-09-24", "2026-09-25", "2026-10-03"]);

/** A nightly rate that rises on Friday and Saturday nights. */
function nightlyPrice(date: string): number {
	let weekday = new Date(`${date}T00:00:00Z`).getUTCDay();
	return weekday === 5 || weekday === 6 ? 168 : 132;
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[raw({ inlineSize: "100%", paddingBlock: "1rem" })]}>
			<RangeMonths
				label="Stay dates"
				labels={{
					previous: "Previous month",
					next: "Next month",
					start: "check-in",
					end: "check-out",
				}}
				locale="en-US"
				month="2026-09"
				start="2026-09-14"
				end="2026-09-18"
				today="2026-09-02"
				min="2026-09-02"
				isUnavailable={(date) => BOOKED.has(date)}
				dayNote={(date) => `$${nightlyPrice(date)}`}
				href={() => "#range-months"}
			/>
		</div>
	),
};
