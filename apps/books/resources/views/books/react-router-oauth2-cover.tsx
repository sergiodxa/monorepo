/**
 * The React Router OAuth2 Handbook's cover, drawn as SVG and shown flat, as a catalogue
 * plate shows a book: React Router's ink with its five brand colours, the title, and the
 * redirect-and-return loop of the flow the book teaches, edged by a single rule.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { grid, relative } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

/**
 * The cover's printed colours, React Router's own: they stay fixed in dark mode, since a
 * printed cover keeps its ink in a dark room.
 */
const INK = {
	cloth: "#121212",
	paper: "#f7f7f7",
	muted: "#a4a4a4",
	red: "#f44250",
	yellow: "#fecc1b",
	blue: "#3992ff",
	green: "#6bd968",
	pink: "#d83bd2",
} as const;

/** The flow's three parties, drawn left to right across the cover's middle. */
const PARTIES = [
	{ x: 36, label: "CLIENT", colour: INK.blue },
	{ x: 136, label: "AUTH", colour: INK.yellow },
	{ x: 236, label: "API", colour: INK.green },
] as const;

/** The colour bands along the foot, in the order React Router's site uses its palette. */
const BANDS = [INK.red, INK.yellow, INK.blue, INK.green, INK.pink] as const;

/** Vertical offsets of the faint baseline grid printed across the cover. */
const BASELINES = Array.from({ length: 25 }, (_, index) => 40 + index * 16);

/**
 * Renders the cover at up to 20rem wide, centred in its column. The edge rule is drawn
 * inside the box, so the plate never reaches past the column it sits in.
 *
 * @returns The render function producing the cover plate.
 */
export default function ReactRouterOAuth2Cover() {
	return () => (
		<div data-slot="book-stage" mix={[grid(), raw({ placeItems: "center" })]}>
			<div
				data-slot="book"
				mix={[relative(), is("min(82%, 20rem)"), raw({ aspectRatio: "2 / 3" })]}
			>
				<svg
					viewBox="0 0 320 480"
					role="img"
					aria-label="The cover of the React Router OAuth2 Handbook, by Sergio Xalambrí"
					mix={[
						relative(),
						raw({
							display: "block",
							fontFamily: "var(--ui-font-serif)",
							inlineSize: "100%",
							blockSize: "auto",
							outline: "1px solid rgb(255 255 255 / 0.12)",
							outlineOffset: "-1px",
						}),
					]}
				>
					<rect width="320" height="480" fill={INK.cloth} />
					{BASELINES.map((y) => (
						<line
							x1="28"
							x2="292"
							y1={y}
							y2={y}
							stroke={INK.paper}
							stroke-opacity="0.05"
							stroke-width="1"
						/>
					))}

					<text x="32" y="52" fill={INK.muted} font-size="10" font-weight="600" letter-spacing="3">
						REACT ROUTER · HANDBOOK
					</text>

					<path
						d="M60 150 C 60 112, 160 112, 160 146 M160 150 C 160 112, 260 112, 260 146"
						fill="none"
						stroke={INK.paper}
						stroke-opacity="0.55"
						stroke-width="1.5"
						stroke-dasharray="3 4"
					/>
					<path
						d="M260 186 C 260 226, 60 226, 60 190"
						fill="none"
						stroke={INK.red}
						stroke-width="2"
					/>
					<path d="M54 196 L60 186 L66 196" fill="none" stroke={INK.red} stroke-width="2" />
					{PARTIES.map((party) => (
						<g>
							<rect x={party.x} y="148" width="48" height="36" fill={party.colour} />
							<text
								x={party.x + 24}
								y="170"
								text-anchor="middle"
								fill={INK.cloth}
								font-size="8"
								font-weight="700"
								letter-spacing="1.2"
							>
								{party.label}
							</text>
						</g>
					))}

					<text x="30" y="320" fill={INK.paper} font-size="76" letter-spacing="-2">
						OAuth2
					</text>
					<text x="34" y="362" fill={INK.red} font-style="italic" font-size="30">
						in React Router
					</text>
					<line x1="34" x2="286" y1="384" y2="384" stroke={INK.paper} stroke-opacity="0.35" />
					<text
						x="34"
						y="410"
						fill={INK.paper}
						font-size="10"
						font-weight="600"
						letter-spacing="2.6"
					>
						SERGIO XALAMBRÍ
					</text>

					{BANDS.map((colour, index) => (
						<rect x={index * 64} y="452" width="64" height="28" fill={colour} />
					))}
				</svg>
			</div>
		</div>
	);
}
