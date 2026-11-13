/**
 * Live preview for `CaseStudy`: one project as a printed spread, a navy plate with a ferry
 * departures board drawn across the full width, and under it the title with the problem,
 * what was built and the measured result, side by side on a wide container.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { CaseStudy } from "@sdxc/ui/landing";

/** The source the page shows, matching the markup below. */
const CODE = `<CaseStudy
	index="01 / 03"
	client="Harbour Line"
	meta="River ferries · 2025 · 14 weeks"
	title="A ferry that tells you the tram will wait"
	scene={<DeparturesBoard />}
	sceneLabel="The pier 3 board: the 08:22 to Hoboken reads “Tram 4 waits 3 min”"
	plate="#0d1b2e"
	problem="Riders changing from ferry to tram missed one connection in five."
	built="One timetable service behind the pier boards, the rider app and tram dispatch."
	result={{ value: "−31%", label: "missed connections over the first winter" }}
/>`;

/** The board's rows: departure, destination and the status riders read. */
const ROWS = [
	{ time: "08:16", to: "Linkeroever", status: "Boarding", tone: "#f2c14e" },
	{ time: "08:22", to: "Hoboken", status: "Tram 4 waits 3 min", tone: "#7fd1a8" },
	{ time: "08:31", to: "Kallo", status: "On time", tone: "#e8edf4" },
];

/**
 * A departures board on the river, drawn to crop from its centre so a narrow container
 * keeps the board and a wide one adds the water on both sides.
 *
 * @returns The render function producing the scene.
 */
function DeparturesBoard() {
	return () => (
		<svg viewBox="0 0 1600 600" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
			<rect width="1600" height="600" fill="#0d1b2e" />
			<path
				d="M-20 520 C 400 420, 700 380, 1000 300 S 1450 160, 1640 120 L 1640 240 C 1400 300, 1100 420, 800 470 S 300 600, -20 640 Z"
				fill="#15304f"
			/>
			<g transform="translate(500 110)">
				<rect width="600" height="340" fill="#08121f" stroke="#2a4466" stroke-width="2" />
				<text
					x="32"
					y="58"
					font-family="sans-serif"
					font-size="26"
					font-weight="700"
					fill="#e8edf4"
				>
					Pier 3 · Departures
				</text>
				<text
					x="568"
					y="58"
					text-anchor="end"
					font-family="monospace"
					font-size="26"
					fill="#f2c14e"
				>
					08:14
				</text>
				{ROWS.map((row, index) => (
					<g key={row.time} transform={`translate(32 ${140 + index * 70})`}>
						{index === 1 ? <rect x="-16" y="-40" width="568" height="58" fill="#123a2c" /> : null}
						<text font-family="monospace" font-size="24" fill="#e8edf4">
							{row.time}
						</text>
						<text x="110" font-family="sans-serif" font-size="24" fill="#e8edf4">
							{row.to}
						</text>
						<text x="536" text-anchor="end" font-family="monospace" font-size="20" fill={row.tone}>
							{row.status}
						</text>
					</g>
				))}
			</g>
		</svg>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<CaseStudy
				index="01 / 03"
				client="Harbour Line"
				meta="River ferries · 2025 · 14 weeks"
				title="A ferry that tells you the tram will wait"
				scene={<DeparturesBoard />}
				sceneLabel="The pier 3 board: the 08:22 to Hoboken reads “Tram 4 waits 3 min”"
				plate="#0d1b2e"
				problem="Riders changing from ferry to tram missed one connection in five."
				built="One timetable service behind the pier boards, the rider app and tram dispatch."
				result={{ value: "−31%", label: "missed connections over the first winter" }}
			/>
		</div>
	),
};
