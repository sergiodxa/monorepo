/**
 * The book's cover, drawn as SVG and shown flat and square-on, as a catalogue plate shows
 * a book: matte cloth, a hinge crease and the title, edged by a single rule, so the hero
 * carries the same print register as the page around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { grid, relative } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import { SERIF } from "~/resources/views/demos/book/type";

/** The cover's printed colours; fixed, since a printed cover keeps its ink in a dark room. */
const INK = {
	cloth: "#a23d1f",
	clothDeep: "#7a2a14",
	paper: "#f5ecdc",
	accent: "#f08a5d",
} as const;

/** Widths of the ragged lines in the cover's paragraph glyph, as a share of its measure. */
const RAG = [1, 0.92, 0.97, 0.84, 0.95, 0.62] as const;

/** Vertical offsets of the faint baseline grid printed across the cover. */
const BASELINES = Array.from({ length: 25 }, (_, index) => 48 + index * 16);

/**
 * Renders the cover at up to 20rem wide, centred in its column. The edge rule is drawn
 * inside the box, so the plate never reaches past the column it sits in.
 *
 * @returns The render function producing the cover plate.
 */
export default function BookCover() {
	return () => (
		<div data-slot="book-stage" mix={[grid(), raw({ placeItems: "center" })]}>
			<div
				data-slot="book"
				mix={[relative(), is("min(82%, 20rem)"), raw({ aspectRatio: "2 / 3" })]}
			>
				<svg
					viewBox="0 0 320 480"
					role="img"
					aria-label="The cover of The Measure, second edition, by Odile Varga"
					mix={[
						relative(),
						raw({
							display: "block",
							inlineSize: "100%",
							blockSize: "auto",
							outline: "1px solid rgb(40 18 8 / 0.35)",
							outlineOffset: "-1px",
						}),
					]}
				>
					<defs>
						<linearGradient id="book-cover-cloth" x1="0" y1="0" x2="1" y2="1">
							<stop offset="0" stop-color={INK.cloth} />
							<stop offset="1" stop-color={INK.clothDeep} />
						</linearGradient>
						<linearGradient id="book-cover-hinge" x1="0" y1="0" x2="1" y2="0">
							<stop offset="0" stop-color="#000" stop-opacity="0.35" />
							<stop offset="0.45" stop-color="#fff" stop-opacity="0.18" />
							<stop offset="1" stop-color="#000" stop-opacity="0" />
						</linearGradient>
					</defs>

					<rect width="320" height="480" fill="url(#book-cover-cloth)" />
					{BASELINES.map((y) => (
						<line
							key={y}
							x1="32"
							x2="288"
							y1={y}
							y2={y}
							stroke={INK.paper}
							stroke-opacity="0.07"
							stroke-width="1"
						/>
					))}

					<text
						x="36"
						y="60"
						fill={INK.paper}
						font-family={SERIF}
						font-size="9"
						font-weight="600"
						letter-spacing="2.4"
						opacity="0.8"
					>
						SECOND EDITION
					</text>

					<g stroke={INK.paper} stroke-width="1.5" stroke-linecap="round">
						<line x1="36" x2="36" y1="104" y2="118" />
						<line x1="252" x2="252" y1="104" y2="118" />
						<line x1="36" x2="252" y1="111" y2="111" stroke-opacity="0.7" />
					</g>
					<rect x="128" y="101" width="32" height="20" fill={INK.cloth} />
					<text
						x="144"
						y="116"
						text-anchor="middle"
						fill={INK.accent}
						font-family={SERIF}
						font-style="italic"
						font-size="16"
					>
						66
					</text>

					{RAG.map((width, index) => (
						<rect
							key={index}
							x="36"
							y={138 + index * 13}
							width={216 * width}
							height="5"
							rx="1"
							fill={INK.paper}
							fill-opacity={index === 0 ? 0.55 : 0.28}
						/>
					))}

					<text
						x="34"
						y="316"
						fill={INK.paper}
						font-family={SERIF}
						font-style="italic"
						font-size="38"
					>
						The
					</text>
					<text
						x="32"
						y="378"
						fill={INK.paper}
						font-family={SERIF}
						font-size="68"
						letter-spacing="-1.5"
					>
						Measure
					</text>
					<line x1="36" x2="288" y1="398" y2="398" stroke={INK.accent} stroke-width="2" />
					<text
						x="36"
						y="422"
						fill={INK.paper}
						font-family={SERIF}
						font-style="italic"
						font-size="15"
						opacity="0.9"
					>
						Web typography, set by hand
					</text>
					<text
						x="36"
						y="452"
						fill={INK.paper}
						font-family={SERIF}
						font-size="10"
						font-weight="600"
						letter-spacing="2.6"
					>
						ODILE VARGA
					</text>

					<rect width="22" height="480" fill="url(#book-cover-hinge)" />
				</svg>
			</div>
		</div>
	);
}
