/**
 * The Harbour Line plate: the departures board on pier 3 at 08:14, set over the river map it
 * belongs to, with the one row the project was about — a ferry that tells a rider the tram
 * it meets will wait.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { GROTESK, MONO } from "~/resources/views/demos/studio/type";

/** The board's rows: departure, destination, and the status column the riders read. */
const DEPARTURES = [
	{ time: "08:16", to: "Linkeroever", via: "Kaai 3", status: "Boarding", tone: "#f2c14e" },
	{
		time: "08:22",
		to: "Hoboken Veer",
		via: "Kaai 3",
		status: "Tram 4 waits 3 min",
		tone: "#7fd1a8",
	},
	{ time: "08:31", to: "Kallo", via: "Kaai 5", status: "On time", tone: "#e8edf4" },
	{ time: "08:40", to: "Lillo", via: "Kaai 5", status: "On time", tone: "#e8edf4" },
	{ time: "08:52", to: "Linkeroever", via: "Kaai 3", status: "On time", tone: "#e8edf4" },
];

/** The stops along the river, as points on the plate. */
const STOPS = [
	{ x: 120, y: 560, name: "Kallo" },
	{ x: 330, y: 470, name: "Hoboken Veer", end: true },
	{ x: 1290, y: 250, name: "Linkeroever" },
	{ x: 1500, y: 150, name: "Lillo" },
];

/**
 * Renders the plate as one SVG that crops from its centre, so a phone keeps the board and a
 * wide screen adds the river on both sides.
 *
 * @returns The render function producing the scene.
 */
export default function HarbourScene() {
	return () => (
		<svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
			<rect width="1600" height="700" fill="#0d1b2e" />
			<path
				d="M-20 640 C 260 520, 420 520, 620 420 S 1080 300, 1240 260 S 1500 120, 1640 90 L 1640 200 C 1500 230, 1380 330, 1240 370 S 760 470, 640 540 S 260 690, -20 760 Z"
				fill="#15304f"
			/>
			<g
				stroke="#2f557f"
				stroke-width="2"
				fill="none"
				stroke-dasharray="2 10"
				stroke-linecap="round"
			>
				<path d="M120 560 C 220 520, 260 490, 330 470" />
				<path d="M1290 250 C 1380 220, 1440 180, 1500 150" />
			</g>
			{STOPS.map((stop) => (
				<g key={stop.name}>
					<circle cx={stop.x} cy={stop.y} r="9" fill="#0d1b2e" stroke="#e8edf4" stroke-width="3" />
					<text
						x={stop.end ? stop.x - 18 : stop.x + 18}
						text-anchor={stop.end ? "end" : "start"}
						y={stop.y - 14}
						font-family={MONO}
						font-size="16"
						fill="#9fb3cc"
						letter-spacing="1.5"
					>
						{stop.name.toUpperCase()}
					</text>
				</g>
			))}
			<g transform="translate(470 120)">
				<rect width="660" height="460" fill="#08121f" stroke="#2a4466" stroke-width="2" />
				<text x="32" y="56" font-family={GROTESK} font-size="26" font-weight="700" fill="#e8edf4">
					Pier 3 · Departures
				</text>
				<text x="628" y="56" text-anchor="end" font-family={MONO} font-size="26" fill="#f2c14e">
					08:14
				</text>
				<line x1="32" x2="628" y1="80" y2="80" stroke="#2a4466" stroke-width="2" />
				{DEPARTURES.map((row, index) => (
					<g key={row.time} transform={`translate(32 ${128 + index * 66})`}>
						{index === 1 ? <rect x="-16" y="-38" width="628" height="56" fill="#123a2c" /> : null}
						<text font-family={MONO} font-size="24" fill="#e8edf4">
							{row.time}
						</text>
						<text x="110" font-family={GROTESK} font-size="24" fill="#e8edf4">
							{row.to}
						</text>
						<text x="300" font-family={MONO} font-size="16" fill="#7b8fa8" letter-spacing="1">
							{row.via.toUpperCase()}
						</text>
						<text x="596" text-anchor="end" font-family={MONO} font-size="20" fill={row.tone}>
							{row.status}
						</text>
					</g>
				))}
			</g>
		</svg>
	);
}
