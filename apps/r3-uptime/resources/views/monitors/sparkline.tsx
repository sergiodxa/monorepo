/**
 * Server-rendered response-time sparkline: a plain inline `<svg>` polyline computed
 * from recent Analytics Engine points. Replaces the OLD APP's recharts `LineChart`,
 * which this app doesn't ship (see ADR-001 §4.4 — no client-side chart library).
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import type { SparklinePoint } from "~/app/services/analytics";

const WIDTH = 240;
const HEIGHT = 32;

namespace Sparkline {
	export interface Props {
		points: SparklinePoint[];
	}
}

export default function Sparkline(handle: Handle<Sparkline.Props>) {
	return () => {
		let { points } = handle.props;
		if (points.length === 0) {
			return <p>No recent data yet.</p>;
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
			<svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} role="img">
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
