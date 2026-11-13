/**
 * The Mercer Public Library plate: the new catalogue answering a plain-language search with
 * the shelf a book stands on, beside the wayfinding letterforms drawn for the same signs, so
 * the screen and the building speak in one voice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DIDONE, GROTESK, MONO } from "~/resources/views/demos/studio/type";

/** The results the search returns, each with the place it is shelved. */
const RESULTS = [
	{
		title: "The Estuary Year",
		author: "Ines Waterman",
		shelf: "551.46 WAT",
		where: "On shelf · Floor 2, bay 14",
	},
	{
		title: "Tides of the Scheldt",
		author: "P. de Rijcke",
		shelf: "551.46 RIJ",
		where: "On shelf · Floor 2, bay 14",
	},
	{
		title: "Rivers Run Backwards",
		author: "Mara Okafor",
		shelf: "577.6 OKA",
		where: "Due back 21 Nov",
	},
];

/** The library's green ink, used for every line and letter on the plate. */
const INK = "#1f3b2c";

/**
 * Renders the plate as one SVG that crops from its centre: the search sheet stays on a
 * phone, and the specimen and floor sign join it on a wide screen.
 *
 * @returns The render function producing the scene.
 */
export default function LibraryScene() {
	return () => (
		<svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
			<rect width="1600" height="700" fill="#cfdccd" />
			<g fill={INK}>
				<text x="80" y="420" font-family={DIDONE} font-size="300">
					Aa
				</text>
				<text x="86" y="480" font-family={MONO} font-size="16" letter-spacing="2">
					MERCER SIGN · REGULAR · 2024
				</text>
			</g>
			<g transform="translate(1210 150)">
				<rect width="300" height="400" fill={INK} />
				<text x="32" y="150" font-family={DIDONE} font-size="140" fill="#cfdccd">
					2
				</text>
				<text x="32" y="210" font-family={GROTESK} font-size="26" fill="#cfdccd">
					Rivers &amp; seas
				</text>
				<text x="32" y="246" font-family={GROTESK} font-size="26" fill="#cfdccd">
					Earth sciences
				</text>
				<path
					d="M32 330 h80 m-24 -22 l24 22 l-24 22"
					stroke="#cfdccd"
					stroke-width="5"
					fill="none"
				/>
				<text x="132" y="340" font-family={MONO} font-size="18" fill="#cfdccd" letter-spacing="1.5">
					BAYS 10–18
				</text>
			</g>
			<g transform="translate(480 90)">
				<rect width="660" height="560" fill="#f6f8f3" stroke={INK} stroke-width="2" />
				<rect x="32" y="32" width="596" height="60" fill="none" stroke={INK} stroke-width="2" />
				<text x="54" y="71" font-family={GROTESK} font-size="24" fill={INK}>
					books about tidal rivers
				</text>
				<text
					x="606"
					y="70"
					text-anchor="end"
					font-family={MONO}
					font-size="16"
					fill={INK}
					letter-spacing="1"
				>
					3 OF 41 · 0.2 S
				</text>
				{RESULTS.map((result, index) => (
					<g key={result.shelf} transform={`translate(32 ${150 + index * 136})`}>
						<line x2="596" y1="-32" y2="-32" stroke={INK} stroke-opacity="0.25" stroke-width="2" />
						<text font-family={DIDONE} font-size="34" fill={INK}>
							{result.title}
						</text>
						<text y="36" font-family={GROTESK} font-size="20" fill={INK} fill-opacity="0.75">
							{result.author}
						</text>
						<text y="76" font-family={MONO} font-size="18" fill={INK} letter-spacing="1">
							{result.shelf}
						</text>
						<text x="596" y="76" text-anchor="end" font-family={GROTESK} font-size="20" fill={INK}>
							{result.where}
						</text>
					</g>
				))}
			</g>
		</svg>
	);
}
