/**
 * The venue map, drawn as a two-ink print: the river and harbours in a blue halftone, streets
 * and rails as blue rules, the walk from the metro to the foundry in pink, and the three hotels
 * pinned with the numbers the travel list uses. One image with a full description.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { css } from "remix/component";

import { HOTELS } from "~/resources/views/demos/conference/data";
import { BLUE, DISPLAY, MONO, PAPER, PINK } from "~/resources/views/demos/conference/ink";

/** Where each numbered hotel pin sits on the map, by pin number. */
const PINS: Record<number, { x: number; y: number }> = {
	1: { x: 186, y: 420 },
	2: { x: 402, y: 300 },
	3: { x: 342, y: 92 },
};

/** The walk from the Rijnhaven metro stop to the foundry's door. */
const WALK = "M 254 400 L 232 400 L 216 338";

/**
 * Renders the map at the width of its column; the drawing is 480 by 520 units, so labels stay
 * readable at a phone's width.
 *
 * @returns The render function producing the map.
 */
export default function VenueMap() {
	return () => (
		<svg
			viewBox="0 0 480 520"
			role="img"
			aria-label="Map of the venue: De Gieterij stands on the Katendrecht peninsula, south of the Nieuwe Maas. Metro lines D and E run from Rotterdam Centraal under the river to Rijnhaven, a six-minute walk from the door. Hotel Kade is on the peninsula, The Dock Rooms across the Rijnhaven on the Wilhelminapier, and Stadshotel Noord near Centraal."
			mix={css({
				display: "block",
				inlineSize: "100%",
				blockSize: "auto",
				backgroundColor: PAPER,
				boxShadow: `inset 0 0 0 3px ${BLUE}`,
				fontFamily: MONO,
			})}
		>
			<defs>
				<pattern id="overprint-water" width="7" height="7" patternUnits="userSpaceOnUse">
					<circle cx="3.5" cy="3.5" r="2.2" fill={BLUE} />
				</pattern>
			</defs>
			<g stroke={BLUE} stroke-width="1.25" opacity="0.55" aria-hidden="true">
				<path d="M 0 112 H 480 M 0 150 H 480 M 70 0 V 175 M 150 0 V 180 M 400 0 V 205 M 460 0 V 210" />
				<path d="M 20 300 H 60 M 20 340 H 60 M 345 340 H 480 M 345 380 H 480 M 345 420 H 480" />
			</g>
			<path
				d="M 0 178 C 120 186 300 196 480 212 L 480 282 C 300 268 120 256 0 248 Z"
				fill="url(#overprint-water)"
			/>
			<path d="M 60 250 L 60 470 L 168 470 L 168 256 Z" fill="url(#overprint-water)" />
			<path d="M 272 262 L 272 368 L 334 368 L 334 266 Z" fill="url(#overprint-water)" />
			<g fill={BLUE} font-weight="700" letter-spacing="2" font-size="14">
				<text x="20" y="222" paint-order="stroke" stroke={PAPER} stroke-width="5">
					NIEUWE MAAS
				</text>
				<text x="72" y="440" paint-order="stroke" stroke={PAPER} stroke-width="5" font-size="12">
					MAASHAVEN
				</text>
				<text x="276" y="356" paint-order="stroke" stroke={PAPER} stroke-width="5" font-size="11">
					RIJNHAVEN
				</text>
			</g>
			<g stroke={BLUE} stroke-width="5" stroke-linecap="square">
				<path d="M 0 36 L 480 24" />
				<path d="M 0 36 L 480 24" stroke={PAPER} stroke-width="2" stroke-dasharray="6 6" />
			</g>
			<rect x="196" y="46" width="112" height="26" fill={BLUE} />
			<text x="252" y="64" text-anchor="middle" fill={PAPER} font-size="12" font-weight="700">
				CENTRAAL
			</text>
			<path
				d="M 254 72 L 254 400"
				fill="none"
				stroke={BLUE}
				stroke-width="4"
				stroke-dasharray="10 5"
			/>
			<text x="262" y="150" fill={BLUE} font-size="12" font-weight="700">
				METRO D · E
			</text>
			<path d="M 336 150 L 352 300" stroke={BLUE} stroke-width="6" />
			<text x="358" y="176" fill={BLUE} font-size="11" font-weight="700">
				ERASMUSBRUG
			</text>
			<path
				d={WALK}
				fill="none"
				stroke={PINK}
				stroke-width="5"
				stroke-dasharray="2 8"
				stroke-linecap="round"
			/>
			<text x="266" y="432" fill={PINK} font-size="12" font-weight="700">
				6 MIN WALK
			</text>
			<circle cx="254" cy="400" r="11" fill={PAPER} stroke={BLUE} stroke-width="3" />
			<text x="254" y="404.5" text-anchor="middle" fill={BLUE} font-size="12" font-weight="700">
				M
			</text>
			<Burst x={210} y={318} />
			<text
				x="150"
				y="290"
				fill={PINK}
				font-family={DISPLAY}
				font-size="26"
				font-weight="900"
				paint-order="stroke"
				stroke={PAPER}
				stroke-width="6"
			>
				DE GIETERIJ
			</text>
			{HOTELS.map((hotel) => (
				<HotelPin key={hotel.pin} pin={hotel.pin} />
			))}
			<g transform="translate(440 466)" fill={BLUE}>
				<path d="M 0 -22 L 8 6 L 0 0 L -8 6 Z" />
				<text y="24" text-anchor="middle" font-size="12" font-weight="700">
					N
				</text>
			</g>
			<g transform="translate(24 496)" fill={BLUE} font-size="11" font-weight="700">
				<rect width="80" height="6" />
				<rect x="40" width="40" height="6" fill={PAPER} stroke={BLUE} stroke-width="1.5" />
				<text y="-6">0</text>
				<text x="80" y="-6" text-anchor="end">
					500 M
				</text>
			</g>
		</svg>
	);
}

/** The venue: a pink sunburst, the loudest mark on the map. */
function Burst(handle: Handle<{ x: number; y: number }>) {
	return () => {
		let { x, y } = handle.props;
		let points = Array.from({ length: 24 }, (_, index) => {
			let angle = (index / 24) * Math.PI * 2;
			let radius = index % 2 === 0 ? 24 : 13;
			return `${(x + Math.cos(angle) * radius).toFixed(1)},${(y + Math.sin(angle) * radius).toFixed(1)}`;
		}).join(" ");
		return <polygon points={points} fill={PINK} stroke={BLUE} stroke-width="2" />;
	};
}

/** One hotel pin: a blue disc with its number reversed out, matching the travel list. */
function HotelPin(handle: Handle<{ pin: number }>) {
	return () => {
		let { pin } = handle.props;
		let at = PINS[pin];
		if (!at) return null;
		return (
			<g>
				<circle cx={at.x} cy={at.y} r="13" fill={BLUE} stroke={PAPER} stroke-width="3" />
				<text
					x={at.x}
					y={at.y + 5}
					text-anchor="middle"
					fill={PAPER}
					font-size="14"
					font-weight="700"
				>
					{pin}
				</text>
			</g>
		);
	};
}
