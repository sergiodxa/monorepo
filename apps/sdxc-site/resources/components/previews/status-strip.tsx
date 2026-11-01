/**
 * Live preview for `StatusStrip`: ninety days of a monitor's uptime, one bar a day, with
 * the week before monitoring began hatched as unknown. Hover a bar, or tab to it, for the
 * day and its uptime.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is, maxIs } from "@sdxc/u/size";
import { StatusStrip } from "@sdxc/ui/app/status-strip";

/** How a day is named in its tooltip. */
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

/** Ninety days ending Oct 31, 2026, oldest first, with two incidents and a slow day. */
const DAYS: StatusStrip.Period[] = Array.from({ length: 90 }, (_, index) => {
	let date = DAY.format(Date.UTC(2026, 7, 3 + index));
	if (index < 6) return { status: "no-data", label: date, value: "No data" };
	if (index === 38) return { status: "down", label: date, value: "97.2% · 40 min down" };
	if (index === 71) return { status: "down", label: date, value: "99.1% · 13 min down" };
	if (index === 55) return { status: "degraded", label: date, value: "100% · slow responses" };
	return { status: "up", label: date, value: "100%" };
});

/** The source the page shows, matching the markup below. */
const CODE = `<StatusStrip
	label="api.acme.dev uptime, last 90 days"
	summary="99.95% uptime"
	start="90 days ago"
	end="Today"
	periods={days.map((day) => ({ status: day.status, label: formatDay(day.date), value: day.uptime }))}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<StatusStrip
			label="api.acme.dev uptime, last 90 days"
			summary="99.95% uptime"
			start="90 days ago"
			end="Today"
			periods={DAYS}
			mix={[is("100%"), maxIs("40rem")]}
		/>
	),
};
