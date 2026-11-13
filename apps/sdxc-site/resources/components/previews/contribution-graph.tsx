/**
 * Live preview for `ContributionGraph`: a developer's year of commits, busy on weekdays and
 * quiet on weekends with a holiday lull, where each day links to that day's activity and the
 * shared tooltip names its count once the page hydrates.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { ContributionGraph } from "@sdxc/ui/app/contribution-graph";

/** The source the page shows, matching the markup below apart from the preview's width. */
const CODE = `<ContributionGraph
	days={days}
	start="2025-11-14"
	end="2026-11-13"
	locale="en-US"
	href={(date) => \`/sergiodxa?tab=overview&from=\${date}&to=\${date}\`}
	labels={{
		caption: \`\${total.toLocaleString("en-US")} contributions in the last year\`,
		day: (count, date) => \`\${count === 0 ? "No" : count} contribution\${count === 1 ? "" : "s"} on \${date}\`,
		less: "Less",
		more: "More",
	}}
/>`;

/** One day in milliseconds. */
const DAY_MS = 86_400_000;

/** The first and last day the graph draws: the year up to today. */
const START = "2025-11-14";
const END = "2026-11-13";

/**
 * A stable pseudo-random number in [0, 1) for a day, so the server and every reload draw the
 * same year.
 */
function noise(day: number): number {
	let value = Math.sin(day * 12.9898) * 43_758.5453;
	return value - Math.floor(value);
}

/**
 * A day's count in a believable year: weekdays carry most of the work, weekends a little, the
 * last two weeks of December almost none, and a release push in March runs hot.
 */
function countFor(day: number): number {
	let date = new Date(day * DAY_MS).toISOString().slice(0, 10);
	let weekday = new Date(day * DAY_MS).getUTCDay();
	let roll = noise(day);
	if (date >= "2025-12-20" && date <= "2026-01-04") return roll < 0.85 ? 0 : 1;
	if (weekday === 0 || weekday === 6) return roll < 0.7 ? 0 : 2;
	let base = Math.floor(roll * 9);
	if (date >= "2026-03-02" && date <= "2026-03-27") return base + 6;
	return base;
}

/** Every day of the year with at least one contribution. */
function buildDays(): ContributionGraph.Day[] {
	let first = Date.parse(`${START}T00:00:00Z`) / DAY_MS;
	let last = Date.parse(`${END}T00:00:00Z`) / DAY_MS;
	let days: ContributionGraph.Day[] = [];
	for (let day = first; day <= last; day++) {
		let count = countFor(day);
		if (count > 0) days.push({ date: new Date(day * DAY_MS).toISOString().slice(0, 10), count });
	}
	return days;
}

/** The graph's strings for a year of `total` contributions, plural on each count. */
function graphLabels(total: number): ContributionGraph.Labels {
	return {
		caption: `${total.toLocaleString("en-US")} contributions in the last year`,
		day: (count, date) =>
			`${count === 0 ? "No" : count} contribution${count === 1 ? "" : "s"} on ${date}`,
		less: "Less",
		more: "More",
	};
}

/** Builds the year when the preview draws, so loading the module computes nothing. */
function Graph() {
	return () => {
		let days = buildDays();
		let total = days.reduce((sum, day) => sum + day.count, 0);
		return (
			<ContributionGraph
				days={days}
				start={START}
				end={END}
				locale="en-US"
				href={(date) => `/examples/sergiodxa?tab=overview&from=${date}&to=${date}`}
				labels={graphLabels(total)}
			/>
		);
	};
}

/** What the preview registry reads: the source to show, and the graph to draw. */
export default {
	code: CODE,
	viewports: true,
	render: () => (
		<div mix={[is("full")]}>
			<Graph />
		</div>
	),
};
