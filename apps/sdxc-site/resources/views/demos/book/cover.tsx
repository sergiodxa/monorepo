/**
 * The book's cover, drawn as SVG and staged as an object: turned a few degrees in
 * perspective, with a hinge crease, a block of page edges behind it and a soft contact
 * shadow, so the hero shows a book on a table rather than a flat image.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";
import { absolute, grid, relative } from "@sdxc/u/layout";
import { is, mi } from "@sdxc/u/size";

/** The cover's printed colours; fixed, since a printed cover keeps its ink in a dark room. */
const INK = {
	cloth: "#a23d1f",
	clothDeep: "#7a2a14",
	paper: "#f5ecdc",
	accent: "#f08a5d",
} as const;

/** The serif stack the cover's lettering is set in, matching the page's display face. */
const SERIF = '"Iowan Old Style", "Palatino Linotype", Palatino, "Book Antiqua", Georgia, serif';

/** Widths of the ragged lines in the cover's paragraph glyph, as a share of its measure. */
const RAG = [1, 0.92, 0.97, 0.84, 0.95, 0.62] as const;

/** Vertical offsets of the faint baseline grid printed across the cover. */
const BASELINES = Array.from({ length: 25 }, (_, index) => 48 + index * 16);

/**
 * Renders the staged cover at up to 21rem wide. The object turns through a 3D transform,
 * so its layers share one `preserve-3d` context and the page block sits behind the board.
 *
 * @returns The render function producing the staged cover.
 */
export default function BookCover() {
	return () => (
		<div
			data-slot="book-stage"
			mix={[
				relative(),
				grid(),
				raw({ placeItems: "center", perspective: "1600px", paddingBlock: "1.5rem 3rem" }),
			]}
		>
			<div
				aria-hidden="true"
				mix={[
					absolute(),
					raw({
						insetInline: "18%",
						insetBlockEnd: "1.25rem",
						blockSize: "2.5rem",
						borderRadius: "50%",
						background: "radial-gradient(closest-side, rgb(40 18 8 / 0.45), transparent)",
						filter: "blur(10px)",
					}),
				]}
			/>
			<div
				data-slot="book"
				mix={[
					relative(),
					is("min(78%, 21rem)"),
					mi("auto"),
					raw({
						aspectRatio: "2 / 3",
						transformStyle: "preserve-3d",
						transform: "rotateY(-18deg) rotateX(4deg) rotateZ(-0.5deg)",
					}),
				]}
			>
				<div
					aria-hidden="true"
					mix={[
						absolute(),
						raw({
							insetBlock: "1.2% 0.8%",
							insetInlineStart: "4%",
							insetInlineEnd: "-3.2%",
							borderRadius: "0 4px 4px 0",
							background: `repeating-linear-gradient(90deg, ${INK.paper} 0 2px, #d8cbb3 2px 3px)`,
							boxShadow:
								"0 30px 50px -18px rgb(40 18 8 / 0.55), 0 12px 20px -10px rgb(40 18 8 / 0.35)",
							transform: "translateZ(-14px)",
						}),
					]}
				/>
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
							borderRadius: "3px 7px 7px 3px",
							boxShadow:
								"0 1px 0 rgb(255 255 255 / 0.12) inset, 0 40px 60px -24px rgb(40 18 8 / 0.5), 0 0 0 1px rgb(40 18 8 / 0.25)",
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
						<linearGradient id="book-cover-gloss" x1="0" y1="0" x2="1" y2="0.6">
							<stop offset="0" stop-color="#fff" stop-opacity="0.16" />
							<stop offset="0.5" stop-color="#fff" stop-opacity="0" />
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
						font-family="ui-sans-serif, system-ui, sans-serif"
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
						font-family="ui-sans-serif, system-ui, sans-serif"
						font-size="10"
						font-weight="600"
						letter-spacing="2.6"
					>
						ODILE VARGA
					</text>

					<rect width="22" height="480" fill="url(#book-cover-hinge)" />
					<rect width="320" height="480" fill="url(#book-cover-gloss)" />
				</svg>
			</div>
		</div>
	);
}
