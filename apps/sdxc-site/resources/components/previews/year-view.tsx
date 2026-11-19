/**
 * Live preview for `YearView`: 2026 as twelve small months, the autumn's working days dotted by
 * how busy they are, today ringed and a chosen day filled. Narrow the frame and the months stack.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { YearView } from "@sdxc/ui/schedule/year-view";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<YearView
	year={2026}
	today="2026-11-18"
	selected="2026-11-20"
	weekStartsOn={1}
	counts={{ "2026-11-18": 5, "2026-11-19": 1, "2026-11-20": 2 }}
	dayHref={(date) => \`/day/\${date}\`}
	monthHref={(month) => \`/month/\${month}\`}
	labels={{ count: "{count} events" }}
/>`;

/** Weekday counts from September on, heavier mid-week, so the dots read as a working rhythm. */
function counts(): Record<string, number> {
	let result: Record<string, number> = {};
	for (let at = Date.UTC(2026, 8, 1); at < Date.UTC(2027, 0, 1); at += 86_400_000) {
		let weekday = new Date(at).getUTCDay();
		if (weekday === 0 || weekday === 6) continue;
		result[new Date(at).toISOString().slice(0, 10)] = [0, 2, 3, 5, 3, 1][weekday] ?? 1;
	}
	return result;
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({ inlineSize: "100%", maxBlockSize: "26rem", overflowY: "auto", padding: "0.5rem" }),
			]}
		>
			<YearView
				year={2026}
				today="2026-11-18"
				selected="2026-11-20"
				weekStartsOn={1}
				locale="en-US"
				counts={counts()}
				dayHref={(date) => `#${date}`}
				monthHref={(month) => `#${month}`}
				labels={{ count: "{count} events" }}
			/>
		</div>
	),
};
