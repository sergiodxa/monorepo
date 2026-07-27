/**
 * Server-rendered response-time sparkline: a plain inline `<svg>` polyline computed
 * from recent Analytics Engine points, with no client-side charting library involved.
 *
 * `@pkg/r3-ui` ships its own in-house `Chart`/`Chart.Line` primitive
 * (`packages/r3-ui/src/components/chart.tsx`) — not a third-party dependency, and
 * fully server-rendered like this file already is — so ADR-001 §4.4's "no chart
 * library" rule was re-examined here rather than assumed to still forbid it. Read in
 * full, §4.4's own concern is specifically the OLD APP's one `recharts` usage (a
 * third-party, React-coupled dependency) and the "Consequences" section frames the
 * payoff as "far less client JavaScript" — bundle size and framework coupling, not a
 * blanket ban on any in-house charting abstraction. Even so, this file keeps the
 * hand-rolled `<svg>` rather than switching to `Chart.Line`: that component is a
 * general-purpose Cartesian series — an `xDomain`/`yDomain`-driven coordinate space
 * plus a handful of separately focusable, `<title>`-labeled point markers (each
 * needing its own formatted, translatable label this call site has no copy for) and
 * a `Chart.Legend`-ready `data-color` contract — which is disproportionate ceremony
 * for a decorative 240×32 squiggle inline in a monitor table cell, and would add new
 * per-row tab stops competing with the table's own row-by-row navigation. The only
 * change from the original is the stroke color: it now reads `var(--ui-primary-fg)`
 * directly instead of depending on an ambient `color` a calling controller happens
 * to set from its own bespoke palette.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { Text } from "@pkg/r3-ui";
import { fg } from "@pkg/u/color";

import type { SparklinePoint } from "~/app/services/analytics";

const WIDTH = 240;
const HEIGHT = 32;

namespace Sparkline {
	export interface Props {
		points: SparklinePoint[];
	}
}

/** Renders the polyline scaled to fit `points`, or a "No recent data yet." message when empty. */
export default function Sparkline(handle: Handle<Sparkline.Props>) {
	return () => {
		let { points } = handle.props;
		if (points.length === 0) {
			return <Text>No recent data yet.</Text>;
		}

		let values = points.map((point) => point.responseTimeMs);
		let max = Math.max(...values, 1);
		let min = Math.min(...values, 0);
		let range = max - min || 1;
		let step = points.length > 1 ? WIDTH / (points.length - 1) : 0;

		let coordinates = values.map((value, index) => {
			let x = step * index;
			let y = HEIGHT - ((value - min) / range) * HEIGHT;
			return `${x.toFixed(1)},${y.toFixed(1)}`;
		});

		return (
			<svg
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				width={WIDTH}
				height={HEIGHT}
				role="img"
				mix={fg("primary")}
			>
				<title>Response time over the last {points.length} checks</title>
				<polyline
					points={coordinates.join(" ")}
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
				/>
			</svg>
		);
	};
}
