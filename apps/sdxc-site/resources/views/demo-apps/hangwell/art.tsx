/**
 * Hangwell's poster art, drawn in SVG from each poster's style, inks and seed, so a card, the
 * gallery, the room preview, the zoomed detail and the downloadable print file are all the same
 * drawing. Nothing here copies a real artist; every shape comes from the seeded generator.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { createRandom } from "@sdxc/random";

import type { Poster, Size } from "./data";

import { findFrame, findPaint } from "./data";

/** The drawing's width and height in viewBox units, portrait. */
const SHORT = 100;
const LONG = 140;

/** A poster's viewBox size, turned for a landscape poster. */
export function artBox(poster: Poster): { width: number; height: number } {
	return poster.orientation === "portrait"
		? { width: SHORT, height: LONG }
		: { width: LONG, height: SHORT };
}

/** A poster's inks as colours, the ground first. */
function colors(poster: Poster): string[] {
	return poster.paints.map((id) => findPaint(id)?.color ?? "oklch(0.9 0.02 80)");
}

/** Whether an ink is dark enough that light ink reads on it. */
function isDark(id: string | undefined): boolean {
	return id === "ink" || id === "cobalt" || id === "teal";
}

/** The shapes of one poster, inside an SVG the caller sizes. */
function shapes(poster: Poster): RemixNode {
	let { width, height } = artBox(poster);
	let random = createRandom(poster.seed);
	let [ground = "", ...inks] = colors(poster);
	let line = isDark(poster.paints[0]) ? "oklch(0.95 0.02 85)" : "oklch(0.24 0.02 260)";
	let pick = () => random.pick(inks.length > 0 ? inks : [line]);
	let body: RemixNode[] = [];
	if (poster.style === "geometric") body = geometric(random, width, height, pick, poster.id);
	if (poster.style === "botanical") body = botanical(random, width, height, pick, line);
	if (poster.style === "travel") body = travel(random, width, height, inks, poster.title, line);
	if (poster.style === "type") body = lettering(width, height, poster.title, inks, line);
	if (poster.style === "maps") body = contours(random, width, height, inks, line);
	if (poster.style === "night") body = sky(random, width, height, inks, line);
	return (
		<>
			<rect width={width} height={height} fill={ground} />
			{body}
		</>
	);
}

/** Circles, half circles and blocks laid on a loose grid; "Ninefold Sun" stacks its arcs. */
function geometric(
	random: ReturnType<typeof createRandom>,
	width: number,
	height: number,
	pick: () => string,
	id: string,
): RemixNode[] {
	let out: RemixNode[] = [];
	if (id === "ninefold-sun" || id === "tidal-rings") {
		let cx = width / 2;
		let cy = id === "ninefold-sun" ? height * 0.62 : height / 2;
		for (let ring = 9; ring >= 1; ring -= 1) {
			out.push(
				<circle
					cx={cx}
					cy={cy}
					r={ring * 5.2}
					fill={ring % 2 === 0 ? pick() : "none"}
					stroke={pick()}
					stroke-width="1.6"
					opacity="0.92"
				/>,
			);
		}
		if (id === "ninefold-sun")
			out.push(<rect x="0" y={cy} width={width} height={height - cy} fill={pick()} />);
		return out;
	}
	let columns = 3;
	let rows = Math.round((height / width) * columns);
	let cell = width / columns;
	for (let row = 0; row < rows; row += 1) {
		for (let column = 0; column < columns; column += 1) {
			let x = column * cell;
			let y = row * cell + (height - rows * cell) / 2;
			let kind = random.int(0, 4);
			let color = pick();
			let opacity = random.pick(["0.9", "0.8", "1"]);
			if (kind === 0)
				out.push(
					<circle
						cx={x + cell / 2}
						cy={y + cell / 2}
						r={cell * 0.42}
						fill={color}
						opacity={opacity}
					/>,
				);
			if (kind === 1) {
				let turn = random.int(0, 3) * 90;
				out.push(
					<path
						d={`M${x + cell * 0.08} ${y + cell / 2} a${cell * 0.42} ${cell * 0.42} 0 0 1 ${cell * 0.84} 0 z`}
						fill={color}
						opacity={opacity}
						transform={`rotate(${turn} ${x + cell / 2} ${y + cell / 2})`}
					/>,
				);
			}
			if (kind === 2)
				out.push(
					<rect
						x={x + cell * 0.12}
						y={y + cell * 0.12}
						width={cell * 0.76}
						height={cell * 0.76}
						fill={color}
						opacity={opacity}
					/>,
				);
			if (kind === 3)
				out.push(
					<path
						d={`M${x + cell * 0.1} ${y + cell * 0.9} L${x + cell * 0.9} ${y + cell * 0.9} L${x + cell * 0.1} ${y + cell * 0.1} z`}
						fill={color}
						opacity={opacity}
					/>,
				);
		}
	}
	return out;
}

/** One stem drawn in a single line, with leaves in pairs and a few seed heads. */
function botanical(
	random: ReturnType<typeof createRandom>,
	width: number,
	height: number,
	pick: () => string,
	line: string,
): RemixNode[] {
	let out: RemixNode[] = [];
	let stems = width > height ? 3 : 1;
	for (let stem = 0; stem < stems; stem += 1) {
		let baseX = stems === 1 ? width / 2 : width * (0.25 + stem * 0.25);
		let topY = height * random.float(0.12, 0.22);
		let bend = random.float(-12, 12);
		let path = `M${baseX} ${height * 0.92} C${baseX + bend} ${height * 0.6} ${baseX - bend} ${height * 0.35} ${baseX + bend / 2} ${topY}`;
		out.push(<path d={path} fill="none" stroke={line} stroke-width="0.9" stroke-linecap="round" />);
		let leaves = random.int(5, 9);
		for (let leaf = 0; leaf < leaves; leaf += 1) {
			let t = 0.15 + (leaf / leaves) * 0.75;
			let y = height * 0.92 - t * (height * 0.92 - topY);
			let x = baseX + bend * Math.sin(t * Math.PI) * 0.5;
			let side = leaf % 2 === 0 ? 1 : -1;
			let size = (1 - t) * 14 + 5;
			out.push(
				<ellipse
					cx={x + side * size * 0.6}
					cy={y}
					rx={size * 0.65}
					ry={size * 0.24}
					fill={pick()}
					stroke={line}
					stroke-width="0.5"
					transform={`rotate(${side * -35} ${x} ${y})`}
				/>,
			);
		}
		out.push(
			<circle
				cx={baseX + bend / 2}
				cy={topY}
				r={random.float(3, 5)}
				fill={pick()}
				stroke={line}
				stroke-width="0.5"
			/>,
		);
	}
	return out;
}

/** An invented place drawn like a railway poster: sky, sun, hills, a town and its name. */
function travel(
	random: ReturnType<typeof createRandom>,
	width: number,
	height: number,
	inks: string[],
	title: string,
	line: string,
): RemixNode[] {
	let [sky = line, hill = line, accent = line] = inks;
	let deep = inks[3] ?? "oklch(0.24 0.02 260)";
	let horizon = height * 0.6;
	let out: RemixNode[] = [
		<rect width={width} height={horizon} fill={sky} />,
		<circle
			cx={width * random.float(0.25, 0.75)}
			cy={horizon * 0.42}
			r={width * 0.14}
			fill={accent}
		/>,
	];
	for (let layer = 0; layer < 3; layer += 1) {
		let y = horizon - 14 + layer * 9;
		let points = [`0 ${height}`, `0 ${y}`];
		for (let x = 0; x <= width; x += width / 6)
			points.push(`${x} ${y - random.float(2, 16 - layer * 4)}`);
		points.push(`${width} ${height}`);
		out.push(
			<polygon
				points={points.join(" ")}
				fill={[accent, hill, deep][layer]}
				opacity={layer === 0 ? "0.55" : "1"}
			/>,
		);
	}
	for (let house = 0; house < 5; house += 1) {
		let x = width * 0.15 + house * width * 0.13;
		let y = horizon + 6 + random.float(-2, 3);
		out.push(<rect x={x} y={y} width={width * 0.09} height={7} fill="oklch(0.97 0.01 85)" />);
		out.push(
			<polygon
				points={`${x - 1} ${y} ${x + width * 0.045} ${y - 5} ${x + width * 0.09 + 1} ${y}`}
				fill={accent}
			/>,
		);
	}
	out.push(<rect x="0" y={height - 22} width={width} height="22" fill="oklch(0.97 0.01 85)" />);
	out.push(
		<text
			x={width / 2}
			y={height - 8.5}
			text-anchor="middle"
			font-family="'Futura', 'Avenir Next', system-ui, sans-serif"
			font-weight="700"
			font-size={Math.min(9, (width * 1.5) / title.length)}
			letter-spacing="1.2"
			fill={deep}
		>
			{title.toUpperCase()}
		</text>,
	);
	return out;
}

/** The title set in tall stacked letters, a word per line. */
function lettering(
	width: number,
	height: number,
	title: string,
	inks: string[],
	line: string,
): RemixNode[] {
	let words = title.toUpperCase().split(" ");
	let lineHeight = (height * 0.72) / words.length;
	let size = Math.min(
		lineHeight * 0.92,
		(width * 1.2) / Math.max(...words.map((word) => word.length)),
	);
	let out: RemixNode[] = [
		<rect
			x={width * 0.06}
			y={height * 0.06}
			width={width * 0.88}
			height={height * 0.88}
			fill="none"
			stroke={inks[0] ?? line}
			stroke-width="0.8"
		/>,
	];
	words.forEach((word, index) => {
		out.push(
			<text
				x={width / 2}
				y={height * 0.16 + lineHeight * (index + 0.78)}
				text-anchor="middle"
				font-family="'Cooper Black', 'Rockwell', 'Georgia', serif"
				font-weight="800"
				font-size={size}
				fill={index % 2 === 0 ? (inks[0] ?? line) : line}
			>
				{word}
			</text>,
		);
	});
	return out;
}

/** Contour rings around two or three peaks, one line per height. */
function contours(
	random: ReturnType<typeof createRandom>,
	width: number,
	height: number,
	inks: string[],
	line: string,
): RemixNode[] {
	let out: RemixNode[] = [];
	let peaks = random.int(2, 3);
	for (let peak = 0; peak < peaks; peak += 1) {
		let cx = width * random.float(0.25, 0.75);
		let cy = height * random.float(0.25, 0.75);
		let wobble = Array.from({ length: 12 }, () => random.float(0.8, 1.2));
		for (let ring = 1; ring <= 9; ring += 1) {
			let radius = ring * random.float(4.2, 5.4);
			let points = wobble.map((amount, index) => {
				let angle = (index / wobble.length) * Math.PI * 2;
				let r = radius * (amount + Math.sin(ring + index) * 0.05);
				return `${(cx + Math.cos(angle) * r).toFixed(2)} ${(cy + Math.sin(angle) * r * 1.2).toFixed(2)}`;
			});
			out.push(
				<polygon
					points={points.join(" ")}
					fill="none"
					stroke={ring % 4 === 0 ? (inks[0] ?? line) : line}
					stroke-width={ring % 4 === 0 ? "0.9" : "0.45"}
					stroke-linejoin="round"
				/>,
			);
		}
		out.push(<circle cx={cx} cy={cy} r="1.1" fill={inks[1] ?? line} />);
	}
	return out;
}

/** Stars, an invented constellation and the moon. */
function sky(
	random: ReturnType<typeof createRandom>,
	width: number,
	height: number,
	inks: string[],
	line: string,
): RemixNode[] {
	let out: RemixNode[] = [];
	for (let star = 0; star < 90; star += 1) {
		out.push(
			<circle
				cx={random.float(0, width)}
				cy={random.float(0, height)}
				r={random.float(0.15, 0.7)}
				fill={line}
				opacity={random.float(0.4, 1).toFixed(2)}
			/>,
		);
	}
	let points = Array.from(
		{ length: 7 },
		() =>
			[random.float(width * 0.15, width * 0.85), random.float(height * 0.2, height * 0.7)] as const,
	);
	out.push(
		<polyline
			points={points.map(([x, y]) => `${x} ${y}`).join(" ")}
			fill="none"
			stroke={inks[0] ?? line}
			stroke-width="0.4"
		/>,
	);
	for (let [x, y] of points) out.push(<circle cx={x} cy={y} r="1.3" fill={inks[0] ?? line} />);
	let moonX = width * 0.78;
	let moonY = height * 0.14;
	out.push(<circle cx={moonX} cy={moonY} r="7" fill={inks[1] ?? line} />);
	out.push(<circle cx={moonX + 3} cy={moonY - 1.5} r="6.2" fill={colorOfGround()} />);
	out.push(
		<circle
			cx={width / 2}
			cy={height * 0.88}
			r={width * 0.3}
			fill="none"
			stroke={line}
			stroke-width="0.3"
			stroke-dasharray="1 2"
		/>,
	);
	return out;
}

/** The night ground, which the moon's shadow takes. */
function colorOfGround(): string {
	return "var(--hw-ground, oklch(0.35 0.12 262))";
}

namespace PosterArt {
	export interface Props {
		poster: Poster;
		/** The accessible name; decorative when left out. */
		label?: string;
	}
}

/** The poster's drawing, filling its box at the poster's own proportions. */
export function PosterArt(handle: Handle<PosterArt.Props>) {
	return () => {
		let { label, poster } = handle.props;
		let { width, height } = artBox(poster);
		return (
			<svg
				viewBox={`0 0 ${width} ${height}`}
				role={label === undefined ? undefined : "img"}
				aria-label={label}
				aria-hidden={label === undefined ? "true" : undefined}
				style={`display:block;inline-size:100%;block-size:auto;--hw-ground:${colors(poster)[0]}`}
			>
				{shapes(poster)}
			</svg>
		);
	};
}

namespace DetailArt {
	export interface Props {
		poster: Poster;
	}
}

/** A close crop of the drawing's middle, for the gallery's "detail" image. */
export function DetailArt(handle: Handle<DetailArt.Props>) {
	return () => {
		let { poster } = handle.props;
		let { width, height } = artBox(poster);
		return (
			<svg
				viewBox={`${width * 0.3} ${height * 0.3} ${width * 0.4} ${width * 0.4 * 1.25}`}
				aria-hidden="true"
				style={`display:block;inline-size:100%;--hw-ground:${colors(poster)[0]}`}
			>
				{shapes(poster)}
				<rect x="0" y="0" width={width} height={height} fill="url(#hw-paper)" opacity="0.4" />
				<defs>
					<pattern id="hw-paper" width="1.2" height="1.2" patternUnits="userSpaceOnUse">
						<circle cx="0.3" cy="0.3" r="0.12" fill="oklch(0.5 0 0 / 0.25)" />
					</pattern>
				</defs>
			</svg>
		);
	};
}

namespace FramedArt {
	export interface Props {
		poster: Poster;
		/** A frame id, or `null` for an unframed print. */
		frame: string | null;
		mount?: boolean;
		label?: string;
	}
}

/**
 * The poster in its frame: a moulding in the frame's colour, an optional white mount, and the
 * soft shadow a frame casts on a wall.
 */
export function FramedArt(handle: Handle<FramedArt.Props>) {
	return () => {
		let { frame, label, mount = false, poster } = handle.props;
		let { width, height } = artBox(poster);
		let moulding = frame === null ? 0 : 5;
		let card = mount ? 9 : 0;
		let outerW = width + (moulding + card) * 2;
		let outerH = height + (moulding + card) * 2;
		let wood = findFrame(frame ?? "")?.color ?? "transparent";
		return (
			<svg
				viewBox={`-4 -4 ${outerW + 8} ${outerH + 10}`}
				role={label === undefined ? undefined : "img"}
				aria-label={label}
				aria-hidden={label === undefined ? "true" : undefined}
				style={`display:block;inline-size:100%;--hw-ground:${colors(poster)[0]}`}
			>
				<rect
					x="1"
					y="3"
					width={outerW}
					height={outerH}
					rx="0.5"
					fill="oklch(0.2 0.01 60 / 0.18)"
					style="filter:blur(2px)"
				/>
				{frame === null ? null : <rect width={outerW} height={outerH} fill={wood} />}
				{frame === null ? null : (
					<rect
						x={moulding - 0.6}
						y={moulding - 0.6}
						width={outerW - moulding * 2 + 1.2}
						height={outerH - moulding * 2 + 1.2}
						fill="oklch(0 0 0 / 0.18)"
					/>
				)}
				{mount ? (
					<rect
						x={moulding}
						y={moulding}
						width={outerW - moulding * 2}
						height={outerH - moulding * 2}
						fill="oklch(0.985 0.004 90)"
					/>
				) : null}
				<svg
					x={moulding + card}
					y={moulding + card}
					width={width}
					height={height}
					viewBox={`0 0 ${width} ${height}`}
				>
					{shapes(poster)}
				</svg>
				{frame === null ? null : (
					<rect width={outerW} height={outerH} fill="url(#hw-glare)" opacity="0.5" />
				)}
				<defs>
					<linearGradient id="hw-glare" x1="0" y1="0" x2="1" y2="1">
						<stop offset="0" stop-color="white" stop-opacity="0.18" />
						<stop offset="0.45" stop-color="white" stop-opacity="0" />
					</linearGradient>
				</defs>
			</svg>
		);
	};
}

namespace RoomArt {
	export interface Props {
		poster: Poster;
		size: Size;
		frame: string | null;
		mount?: boolean;
		/** The accessible description of the scene. */
		label: string;
	}
}

/** The room's width in centimetres; the scene is drawn one viewBox unit per centimetre. */
const ROOM_WIDTH = 340;
const ROOM_HEIGHT = 250;
const SOFA_WIDTH = 210;

/**
 * The poster on a wall above a 210 cm sofa, drawn to scale in centimetres, so choosing a
 * bigger size visibly grows the print against the furniture.
 */
export function RoomArt(handle: Handle<RoomArt.Props>) {
	return () => {
		let { frame, label, mount = false, poster, size } = handle.props;
		let portrait = poster.orientation === "portrait";
		let printW = portrait ? size.width : size.height;
		let printH = portrait ? size.height : size.width;
		let border = (frame === null ? 0 : 3) + (mount ? 6 : 0);
		let w = printW + border * 2;
		let h = printH + border * 2;
		let floor = 205;
		let sofaTop = floor - 85;
		let x = (ROOM_WIDTH - w) / 2;
		let y = Math.max(12, sofaTop - 25 - h);
		let wood = findFrame(frame ?? "")?.color ?? "transparent";
		return (
			<svg
				viewBox={`0 0 ${ROOM_WIDTH} ${ROOM_HEIGHT}`}
				role="img"
				aria-label={label}
				style={`display:block;inline-size:100%;--hw-ground:${colors(poster)[0]}`}
			>
				<rect width={ROOM_WIDTH} height={floor} fill="var(--hw-wall, oklch(0.93 0.012 80))" />
				<rect
					y={floor}
					width={ROOM_WIDTH}
					height={ROOM_HEIGHT - floor}
					fill="var(--hw-floor, oklch(0.8 0.03 70))"
				/>
				<rect
					x={x + 1.5}
					y={y + 3}
					width={w}
					height={h}
					fill="oklch(0.2 0.01 60 / 0.16)"
					style="filter:blur(2px)"
				/>
				{frame === null ? null : <rect x={x} y={y} width={w} height={h} fill={wood} />}
				{mount ? (
					<rect x={x + 3} y={y + 3} width={w - 6} height={h - 6} fill="oklch(0.985 0.004 90)" />
				) : null}
				<svg
					x={x + border}
					y={y + border}
					width={printW}
					height={printH}
					viewBox={`0 0 ${artBox(poster).width} ${artBox(poster).height}`}
					preserveAspectRatio="none"
				>
					{shapes(poster)}
				</svg>
				<g fill="var(--hw-sofa, oklch(0.55 0.05 160))">
					<rect
						x={(ROOM_WIDTH - SOFA_WIDTH) / 2}
						y={sofaTop}
						width={SOFA_WIDTH}
						height="45"
						rx="10"
					/>
					<rect
						x={(ROOM_WIDTH - SOFA_WIDTH) / 2 - 12}
						y={sofaTop + 25}
						width="26"
						height="45"
						rx="9"
					/>
					<rect
						x={(ROOM_WIDTH + SOFA_WIDTH) / 2 - 14}
						y={sofaTop + 25}
						width="26"
						height="45"
						rx="9"
					/>
					<rect
						x={(ROOM_WIDTH - SOFA_WIDTH) / 2 + 6}
						y={sofaTop + 38}
						width={SOFA_WIDTH - 12}
						height="30"
						rx="6"
						opacity="0.85"
					/>
				</g>
				<rect
					x={(ROOM_WIDTH - SOFA_WIDTH) / 2 + 10}
					y={floor - 17}
					width="6"
					height="17"
					fill="oklch(0.35 0.02 60)"
				/>
				<rect
					x={(ROOM_WIDTH + SOFA_WIDTH) / 2 - 16}
					y={floor - 17}
					width="6"
					height="17"
					fill="oklch(0.35 0.02 60)"
				/>
				<g transform={`translate(${ROOM_WIDTH - 46} ${floor - 70})`}>
					<rect x="8" y="44" width="20" height="26" rx="3" fill="oklch(0.7 0.06 50)" />
					<ellipse cx="18" cy="30" rx="16" ry="22" fill="oklch(0.55 0.09 150)" />
				</g>
			</svg>
		);
	};
}

/**
 * The print file a buyer downloads: the drawing at print proportions with a "Demo" mark, as a
 * standalone SVG document, so a download is a real file without any real artwork behind it.
 *
 * @param poster The poster to draw.
 * @param render Renders the drawing's node tree to markup.
 */
export async function printFile(
	poster: Poster,
	render: (node: RemixNode) => Promise<string>,
): Promise<string> {
	let { width, height } = artBox(poster);
	let markup = await render(
		<svg
			xmlns="http://www.w3.org/2000/svg"
			viewBox={`0 0 ${width} ${height}`}
			width={`${width * 5}mm`}
			height={`${height * 5}mm`}
		>
			{shapes(poster)}
			<text
				x={width - 3}
				y={height - 3}
				text-anchor="end"
				font-family="system-ui, sans-serif"
				font-size="3"
				fill="oklch(0.5 0 0)"
				opacity="0.7"
			>
				Hangwell demo · {poster.title}
			</text>
		</svg>,
	);
	return `<?xml version="1.0" encoding="UTF-8"?>\n${markup}`;
}
