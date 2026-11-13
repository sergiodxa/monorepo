/**
 * The Oda Ceramics plate: the rebuilt checkout as one page — the bowl in the bag, three
 * fields and the payment methods a Belgian buyer reaches for — beside the glaze swatches the
 * shop's product pages are coloured from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { DIDONE, GROTESK, MONO } from "~/resources/views/demos/studio/type";

/** The three fields the checkout kept, out of the eleven it had. */
const FIELDS = ["Email", "Delivery address", "Postcode"];

/** The payment methods, in the order buyers chose them in the first month. */
const METHODS = ["Bancontact", "iDEAL", "Card"];

/** The glazes, as swatches with their names. */
const GLAZES = [
	{ name: "Ash", fill: "#d9d2c3" },
	{ name: "Tide", fill: "#6f8c8a" },
	{ name: "Iron", fill: "#5a3b2c" },
];

/** The checkout's ink. */
const INK = "#3a2219";

/**
 * Renders the plate as one SVG that crops from its centre: the checkout sheet stays on a
 * phone, and the bowl and the glazes join it on a wide screen.
 *
 * @returns The render function producing the scene.
 */
export default function CeramicsScene() {
	return () => (
		<svg viewBox="0 0 1600 700" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
			<rect width="1600" height="700" fill="#b65f43" />
			<g transform="translate(250 380)">
				<ellipse cx="0" cy="120" rx="170" ry="26" fill="#8e4630" />
				<path
					d="M-170 -20 C -160 100, -80 130, 0 130 C 80 130, 160 100, 170 -20 Z"
					fill="#6f8c8a"
				/>
				<ellipse cx="0" cy="-20" rx="170" ry="40" fill="#8aa5a2" />
				<ellipse cx="0" cy="-16" rx="146" ry="30" fill="#5d7775" />
			</g>
			{GLAZES.map((glaze, index) => (
				<g key={glaze.name} transform={`translate(1240 ${170 + index * 130})`}>
					<rect width="96" height="96" fill={glaze.fill} />
					<text x="120" y="58" font-family={MONO} font-size="18" fill="#f8efe6" letter-spacing="2">
						{glaze.name.toUpperCase()}
					</text>
				</g>
			))}
			<g transform="translate(500 70)">
				<rect width="600" height="580" fill="#fbf6f0" />
				<text x="36" y="64" font-family={DIDONE} font-size="34" fill={INK}>
					Tide bowl, large
				</text>
				<text x="564" y="64" text-anchor="end" font-family={MONO} font-size="22" fill={INK}>
					€48.00
				</text>
				<line x1="36" x2="564" y1="96" y2="96" stroke={INK} stroke-opacity="0.2" stroke-width="2" />
				{FIELDS.map((field, index) => (
					<g key={field} transform={`translate(36 ${136 + index * 92})`}>
						<text font-family={MONO} font-size="14" fill={INK} letter-spacing="1.5">
							{field.toUpperCase()}
						</text>
						<rect
							y="14"
							width="528"
							height="52"
							fill="none"
							stroke={INK}
							stroke-opacity="0.45"
							stroke-width="2"
						/>
					</g>
				))}
				{METHODS.map((method, index) => (
					<g key={method} transform={`translate(${36 + index * 180} 424)`}>
						<rect
							width="168"
							height="52"
							fill={index === 0 ? INK : "none"}
							stroke={INK}
							stroke-width="2"
						/>
						<text
							x="84"
							y="33"
							text-anchor="middle"
							font-family={GROTESK}
							font-size="19"
							fill={index === 0 ? "#fbf6f0" : INK}
						>
							{method}
						</text>
					</g>
				))}
				<rect x="36" y="500" width="528" height="56" fill="#b65f43" />
				<text
					x="300"
					y="535"
					text-anchor="middle"
					font-family={GROTESK}
					font-size="21"
					font-weight="700"
					fill="#fbf6f0"
				>
					Pay €52.50 with Bancontact
				</text>
			</g>
		</svg>
	);
}
