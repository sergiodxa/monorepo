/**
 * Wayfern's drawn pictures: every stay's photos (outside, rooms and the view) painted from its
 * landscape and palette as flat-colour SVG, written to files the pages load as images, plus
 * the brand mark and the region map the results draw their pins on.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import type { Motif, PhotoKind, Stay } from "./data";

import { PHOTO_KINDS, PLACES, hashOf, placeOf } from "./data";

/** Every photo's canvas, 3:2 like a camera's frame. */
const WIDTH = 600;
const HEIGHT = 400;

/** Where the drawn photos are served from, one file per stay and room. */
const PHOTO_ROOT = "/demos/wayfern/photos";

/**
 * The address of one of a stay's photos.
 *
 * @example photoSrc(stay, "outside") // "/demos/wayfern/photos/gullwing-cottage-outside.svg"
 */
export function photoSrc(stay: Stay, kind: PhotoKind): string {
	return `${PHOTO_ROOT}/${stay.id}-${kind}.svg`;
}

/**
 * Every photo file the app serves, with the name it is written to under
 * `public/demos/wayfern/photos/`.
 */
export function photoFiles(stays: Stay[]): Array<{ file: string; stay: Stay; kind: PhotoKind }> {
	return stays.flatMap((stay) =>
		PHOTO_KINDS.map((kind) => ({ file: `${stay.id}-${kind}.svg`, stay, kind })),
	);
}

/** Blends two `#rrggbb` colours, `t` of the way from `a` to `b`. */
function mix(a: string, b: string, t: number): string {
	let parse = (hex: string) => [1, 3, 5].map((at) => Number.parseInt(hex.slice(at, at + 2), 16));
	let [ar = 0, ag = 0, ab = 0] = parse(a);
	let [br = 0, bg = 0, bb = 0] = parse(b);
	let channel = (x: number, y: number) =>
		Math.round(x + (y - x) * t)
			.toString(16)
			.padStart(2, "0");
	return `#${channel(ar, br)}${channel(ag, bg)}${channel(ab, bb)}`;
}

/** A seeded generator of numbers in `[0, 1)`, so one stay's picture is the same every time. */
function seeded(seed: string): () => number {
	let state = hashOf(seed) || 1;
	return () => {
		state ^= state << 13;
		state ^= state >>> 17;
		state ^= state << 5;
		return ((state >>> 0) % 10_000) / 10_000;
	};
}

/** What every drawing part reads: the stay's colours and its seeded randomness. */
interface Paint {
	stay: Stay;
	motif: Motif;
	random: () => number;
}

/**
 * The land behind a stay, drawn across the whole canvas: sky, the place's landscape and its
 * ground. Rooms reuse it through their windows, so the view inside matches the one outside.
 */
function Landscape(handle: Handle<{ paint: Paint; horizon?: number }>) {
	return () => {
		let { paint } = handle.props;
		let { palette } = paint.stay;
		let horizon = handle.props.horizon ?? 250;
		let random = seeded(`${paint.stay.id}:land`);
		let sky = palette.sky;
		let far = mix(palette.land, sky, 0.55);
		let near = palette.land;
		let parts: RemixNode[] = [];
		if (paint.motif === "coast" || paint.motif === "dunes") {
			parts.push(
				<path
					d={`M0 ${horizon - 30} Q 150 ${horizon - 70} 260 ${horizon - 40} T 600 ${horizon - 45} V ${horizon} H0Z`}
					fill={far}
				/>,
				<rect y={horizon - 8} width={WIDTH} height={HEIGHT} fill={mix(near, "#ffffff", 0.08)} />,
				...[0, 1, 2, 3].map((index) => (
					<path
						d={`M${40 + index * 140 + random() * 40} ${horizon + 20 + index * 22} h ${50 + random() * 60}`}
						stroke={mix(near, "#ffffff", 0.45)}
						stroke-width="3"
						stroke-linecap="round"
					/>
				)),
			);
			if (paint.motif === "dunes") {
				parts.push(
					<path
						d={`M0 ${horizon + 60} Q 140 ${horizon - 10} 300 ${horizon + 50} T 600 ${horizon + 30} V400 H0Z`}
						fill="#e3cf9f"
					/>,
					<path
						d={`M0 ${horizon + 110} Q 200 ${horizon + 40} 420 ${horizon + 100} T 600 ${horizon + 90} V400 H0Z`}
						fill="#d4bb85"
					/>,
				);
			}
		} else if (paint.motif === "lake") {
			parts.push(
				<path
					d={`M0 ${horizon - 20} Q 120 ${horizon - 110} 250 ${horizon - 30} Q 380 ${horizon - 120} 600 ${horizon - 35} V ${horizon} H0Z`}
					fill={far}
				/>,
				<rect y={horizon} width={WIDTH} height={HEIGHT} fill={mix(near, sky, 0.3)} />,
				<path
					d={`M0 ${horizon} Q 120 ${horizon + 70} 250 ${horizon + 22} Q 380 ${horizon + 80} 600 ${horizon + 25} V ${horizon} Z`}
					fill={mix(far, sky, 0.35)}
					opacity="0.6"
				/>,
			);
		} else if (paint.motif === "peaks") {
			parts.push(
				<path
					d={`M0 ${horizon} L 110 ${horizon - 150} L 190 ${horizon - 80} L 300 ${horizon - 190} L 420 ${horizon - 70} L 500 ${horizon - 130} L 600 ${horizon - 40} V ${horizon} Z`}
					fill={far}
				/>,
				<path
					d={`M300 ${horizon - 190} L 330 ${horizon - 150} L 310 ${horizon - 145} L 285 ${horizon - 165} Z`}
					fill="#f4f4f2"
				/>,
				<rect y={horizon - 2} width={WIDTH} height={HEIGHT} fill={near} />,
			);
		} else if (paint.motif === "town") {
			let roofs: RemixNode[] = [];
			for (let x = -20; x < WIDTH; x += 50 + Math.floor(random() * 30)) {
				let height = 50 + random() * 70;
				let width = 46 + random() * 26;
				roofs.push(
					<path
						d={`M${x} ${horizon} V ${horizon - height} l ${width / 2} -24 l ${width / 2} 24 V ${horizon} Z`}
						fill={mix(far, palette.roof, random() * 0.4)}
					/>,
				);
			}
			parts.push(
				...roofs,
				<rect
					x="440"
					y={horizon - 170}
					width="26"
					height="170"
					fill={mix(far, palette.roof, 0.5)}
				/>,
				<rect y={horizon - 2} width={WIDTH} height={HEIGHT} fill={near} />,
			);
		} else {
			parts.push(<rect y={horizon - 2} width={WIDTH} height={HEIGHT} fill={near} />);
		}
		if (paint.motif === "pines" || paint.motif === "lake" || paint.motif === "peaks") {
			for (let index = 0; index < 18; index++) {
				let x = random() * WIDTH;
				let size = 26 + random() * 50;
				let base = horizon + random() * 14 - 4;
				let tone = mix(near, "#0e1a12", 0.35 + random() * 0.3);
				if (paint.motif === "lake" && x > 120 && x < 470) continue;
				parts.push(
					<path
						d={`M${x} ${base - size * 1.9} L ${x + size / 2} ${base} H ${x - size / 2} Z`}
						fill={tone}
					/>,
				);
			}
		}
		return (
			<g>
				<rect width={WIDTH} height={HEIGHT} fill={sky} />
				<circle
					cx={430 + random() * 80}
					cy={70 + random() * 30}
					r="30"
					fill={mix(sky, "#fff7e0", 0.75)}
				/>
				{parts}
			</g>
		);
	};
}

/** The stay's building, as its type is shaped, standing on the landscape's ground. */
function Building(handle: Handle<{ paint: Paint }>) {
	return () => {
		let { stay } = handle.props.paint;
		let { palette } = stay;
		let glass = mix(palette.sky, "#ffe7b3", 0.55);
		let ground = 330;
		if (stay.type === "cabin") {
			return (
				<g>
					<path d={`M190 ${ground} L 300 ${ground - 200} L 410 ${ground} Z`} fill={palette.roof} />
					<path d={`M220 ${ground} L 300 ${ground - 150} L 380 ${ground} Z`} fill={palette.wall} />
					<path d={`M262 ${ground} V ${ground - 70} H 338 V ${ground} Z`} fill={glass} />
					<path d={`M300 ${ground} V ${ground - 70}`} stroke={palette.roof} stroke-width="4" />
					<rect
						x="170"
						y={ground}
						width="260"
						height="10"
						fill={mix(palette.wall, "#000000", 0.4)}
					/>
				</g>
			);
		}
		if (stay.type === "treehouse") {
			return (
				<g>
					<rect x="288" y={ground - 210} width="24" height="230" fill="#6b4a32" />
					<rect
						x="200"
						y={ground - 120}
						width="200"
						height="12"
						fill={mix(palette.wall, "#000000", 0.3)}
					/>
					<rect x="230" y={ground - 200} width="140" height="80" rx="8" fill={palette.wall} />
					<path
						d={`M220 ${ground - 196} Q 300 ${ground - 260} 380 ${ground - 196} Z`}
						fill={palette.roof}
					/>
					<rect x="250" y={ground - 180} width="40" height="34" rx="4" fill={glass} />
					<rect x="310" y={ground - 180} width="40" height="34" rx="4" fill={glass} />
					<path
						d={`M210 ${ground - 108} V ${ground - 60} M390 ${ground - 108} V ${ground - 60}`}
						stroke="#6b4a32"
						stroke-width="5"
					/>
				</g>
			);
		}
		if (stay.type === "loft" || stay.type === "apartment") {
			let width = stay.type === "loft" ? 150 : 200;
			let left = 300 - width / 2;
			return (
				<g>
					<rect x={left} y={ground - 230} width={width} height="230" fill={palette.wall} />
					<path
						d={`M${left - 10} ${ground - 230} L 300 ${ground - 290} L ${left + width + 10} ${ground - 230} Z`}
						fill={palette.roof}
					/>
					{[0, 1, 2].flatMap((row) =>
						[0, 1, 2]
							.slice(0, stay.type === "loft" ? 2 : 3)
							.map((column) => (
								<rect
									x={left + 22 + column * (stay.type === "loft" ? 66 : 60)}
									y={ground - 210 + row * 66}
									width="40"
									height="46"
									rx="3"
									fill={row === 1 && column === 0 ? "#fff1c7" : glass}
								/>
							)),
					)}
					{stay.id === "clocktower-loft" ? (
						<g>
							<circle
								cx="300"
								cy={ground - 250}
								r="20"
								fill="#f6f1e6"
								stroke={palette.roof}
								stroke-width="4"
							/>
							<path
								d={`M300 ${ground - 250} V ${ground - 264} M300 ${ground - 250} H 311`}
								stroke={palette.roof}
								stroke-width="3"
							/>
						</g>
					) : null}
				</g>
			);
		}
		let wide = stay.type === "farmhouse";
		let width = wide ? 300 : 220;
		let left = 300 - width / 2;
		return (
			<g>
				<rect x={left} y={ground - 110} width={width} height="110" fill={palette.wall} />
				<path
					d={`M${left - 14} ${ground - 108} L ${left + 40} ${ground - 178} H ${left + width - 40} L ${left + width + 14} ${ground - 108} Z`}
					fill={palette.roof}
				/>
				<rect x={left + width - 70} y={ground - 200} width="22" height="40" fill={palette.roof} />
				<rect
					x="284"
					y={ground - 70}
					width="32"
					height="70"
					rx="3"
					fill={mix(palette.roof, "#000000", 0.2)}
				/>
				{[left + 26, left + width - 74, ...(wide ? [left + 90, left + width - 138] : [])].map(
					(x) => (
						<rect x={x} y={ground - 84} width="48" height="40" rx="3" fill={glass} />
					),
				)}
				{stay.id === "lantern-house" ? (
					<g>
						<rect x="500" y="80" width="30" height="200" fill="#f6f2ea" />
						<rect x="494" y="64" width="42" height="22" fill="#fff1c7" />
						<path d="M490 64 L 515 44 L 540 64 Z" fill={palette.roof} />
					</g>
				) : null}
			</g>
		);
	};
}

/** A window cut into a room's wall, showing the landscape behind the stay. */
function Window(
	handle: Handle<{ paint: Paint; x: number; y: number; width: number; height: number }>,
) {
	return () => {
		let { height, paint, width, x, y } = handle.props;
		let frame = mix(paint.stay.palette.room, "#000000", 0.35);
		return (
			<g>
				<svg
					x={x}
					y={y}
					width={width}
					height={height}
					viewBox="0 120 600 280"
					preserveAspectRatio="xMidYMid slice"
				>
					<Landscape paint={paint} />
				</svg>
				<rect
					x={x}
					y={y}
					width={width}
					height={height}
					fill="none"
					stroke={frame}
					stroke-width="8"
				/>
				<path d={`M${x + width / 2} ${y} V ${y + height}`} stroke={frame} stroke-width="5" />
			</g>
		);
	};
}

/** A room: wall, floor and a window, with the furniture its kind calls for in front. */
function Room(handle: Handle<{ paint: Paint; kind: Exclude<PhotoKind, "outside" | "view"> }>) {
	return () => {
		let { kind, paint } = handle.props;
		let { palette } = paint.stay;
		let floor = mix(palette.room, "#7a5638", 0.55);
		let wood = mix(palette.roof, "#a07a52", 0.5);
		let cloth = palette.cloth;
		let dark = mix(palette.room, "#000000", 0.55);
		let furniture: RemixNode;
		if (kind === "living") {
			furniture = (
				<g>
					<ellipse cx="300" cy="360" rx="220" ry="26" fill={mix(cloth, palette.room, 0.55)} />
					<rect x="140" y="250" width="250" height="70" rx="18" fill={cloth} />
					<rect
						x="140"
						y="215"
						width="250"
						height="50"
						rx="18"
						fill={mix(cloth, "#000000", 0.15)}
					/>
					<rect x="180" y="232" width="50" height="40" rx="10" fill={mix(cloth, "#ffffff", 0.35)} />
					<rect x="420" y="300" width="90" height="10" rx="5" fill={wood} />
					<rect x="436" y="310" width="8" height="40" fill={wood} />
					<rect x="486" y="310" width="8" height="40" fill={wood} />
					<path
						d="M60 340 V 200 M60 200 L 40 160 H 80 Z"
						stroke={dark}
						stroke-width="5"
						fill={mix("#ffe7b3", palette.room, 0.2)}
					/>
					<circle cx="540" cy="250" r="34" fill="#557a4c" />
					<rect x="526" y="270" width="28" height="44" rx="4" fill={wood} />
				</g>
			);
		} else if (kind === "bedroom") {
			furniture = (
				<g>
					<rect x="150" y="190" width="300" height="70" rx="10" fill={wood} />
					<rect x="140" y="250" width="320" height="90" rx="10" fill="#f7f4ee" />
					<rect x="140" y="280" width="320" height="64" rx="10" fill={cloth} />
					<rect x="175" y="232" width="100" height="36" rx="14" fill="#ffffff" />
					<rect x="325" y="232" width="100" height="36" rx="14" fill="#ffffff" />
					<rect x="480" y="260" width="60" height="70" rx="4" fill={wood} />
					<path
						d="M510 260 V 228 M492 228 h 36 l -6 -26 h -24 Z"
						stroke={dark}
						stroke-width="3"
						fill="#ffe7b3"
					/>
				</g>
			);
		} else if (kind === "kitchen") {
			furniture = (
				<g>
					<rect
						x="0"
						y="240"
						width="600"
						height="100"
						fill={mix(palette.cloth, palette.room, 0.35)}
					/>
					<rect x="0" y="232" width="600" height="12" fill={mix(palette.room, "#ffffff", 0.5)} />
					{[0, 1, 2, 3, 4, 5].map((index) => (
						<path
							d={`M${index * 100 + 50} 262 v 40`}
							stroke={mix(palette.cloth, "#000000", 0.3)}
							stroke-width="3"
						/>
					))}
					<rect
						x="60"
						y="40"
						width="120"
						height="70"
						rx="4"
						fill={mix(palette.cloth, palette.room, 0.3)}
					/>
					<rect
						x="420"
						y="40"
						width="120"
						height="70"
						rx="4"
						fill={mix(palette.cloth, palette.room, 0.3)}
					/>
					{[200, 300, 400].map((x) => (
						<g>
							<path d={`M${x} 0 V 60`} stroke={dark} stroke-width="2" />
							<path d={`M${x - 18} 80 Q ${x} 52 ${x + 18} 80 Z`} fill={dark} />
							<circle cx={x} cy="84" r="5" fill="#ffe7b3" />
						</g>
					))}
					<circle cx="110" cy="214" r="18" fill="#c75b3a" />
					<rect x="460" y="200" width="16" height="32" rx="3" fill="#557a4c" />
				</g>
			);
		} else {
			furniture = (
				<g>
					<rect x="0" y="0" width="600" height="400" fill={mix(palette.room, "#ffffff", 0.25)} />
					{Array.from({ length: 12 }, (_, column) => (
						<path
							d={`M${column * 50} 0 V 400`}
							stroke={mix(palette.room, "#000000", 0.08)}
							stroke-width="2"
						/>
					))}
					{Array.from({ length: 8 }, (_, row) => (
						<path
							d={`M0 ${row * 50} H 600`}
							stroke={mix(palette.room, "#000000", 0.08)}
							stroke-width="2"
						/>
					))}
					<Window paint={paint} x={360} y={70} width={170} height={130} />
					<path d="M90 250 H 430 Q 430 350 330 350 H 190 Q 90 350 90 250 Z" fill="#fbfaf7" />
					<rect x="80" y="240" width="360" height="16" rx="8" fill="#f1eee8" />
					<path d="M120 240 V 190 H 150" stroke={dark} stroke-width="6" fill="none" />
					<rect x="480" y="230" width="70" height="110" rx="6" fill={cloth} />
					<circle cx="560" cy="150" r="26" fill="#557a4c" />
				</g>
			);
		}
		return (
			<g>
				<rect width={WIDTH} height={HEIGHT} fill={palette.room} />
				<rect y="320" width={WIDTH} height="80" fill={floor} />
				{kind === "bath" ? null : (
					<Window
						paint={paint}
						x={kind === "kitchen" ? 210 : 215}
						y={kind === "kitchen" ? 92 : 40}
						width={170}
						height={kind === "kitchen" ? 130 : 140}
					/>
				)}
				{furniture}
			</g>
		);
	};
}

namespace PhotoSvg {
	export interface Props {
		stay: Stay;
		kind: PhotoKind;
	}
}

/**
 * One of a stay's photos as a standalone SVG document, the content of one file: the house in
 * its landscape, a room with the landscape through its window, or the view from the deck.
 */
export function PhotoSvg(handle: Handle<PhotoSvg.Props>) {
	return () => {
		let { kind, stay } = handle.props;
		let paint: Paint = { stay, motif: placeOf(stay).motif, random: seeded(`${stay.id}:${kind}`) };
		let picture: RemixNode;
		if (kind === "outside") {
			picture = (
				<g>
					<Landscape paint={paint} horizon={300} />
					{paint.motif === "coast" || paint.motif === "lake" || paint.motif === "dunes" ? (
						<path
							d="M-10 326 Q 160 300 300 318 T 610 322 V 400 H -10 Z"
							fill={paint.motif === "dunes" ? "#dcc796" : mix(stay.palette.land, "#8fa66a", 0.7)}
						/>
					) : null}
					<Building paint={paint} />
				</g>
			);
		} else if (kind === "view") {
			let rail = mix(stay.palette.roof, "#a07a52", 0.4);
			picture = (
				<g>
					<Landscape paint={paint} horizon={230} />
					<rect y="330" width={WIDTH} height="70" fill={mix(rail, "#000000", 0.2)} />
					<rect y="290" width={WIDTH} height="10" fill={rail} />
					{Array.from({ length: 13 }, (_, index) => (
						<rect x={index * 50 + 10} y="290" width="8" height="40" fill={rail} />
					))}
					<rect x="430" y="300" width="110" height="18" rx="4" fill={stay.palette.cloth} />
					<circle cx="470" cy="300" r="12" fill="#f4efe6" />
				</g>
			);
		} else {
			picture = <Room paint={paint} kind={kind} />;
		}
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
				width={WIDTH}
				height={HEIGHT}
				preserveAspectRatio="xMidYMid slice"
			>
				{picture}
			</svg>
		);
	};
}

/**
 * Wayfern's mark: a fern frond unfurling inside a rounded arch, a doorway and a path at once.
 *
 * @param handle Carries the mark's size in pixels.
 */
export function WayfernMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 28;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
				<path d="M4 30V14a12 12 0 0 1 24 0v16Z" fill="var(--ui-color-brand-600)" />
				<path
					d="M16 28V15c0-3 2.6-5 5-4.2-.3 2.5-2.2 3.6-4.2 3.4M16 20c-.4-2.4-2.6-3.6-4.8-3.1.5 2 2.4 3 4.4 2.8M16 24.5c.6-2.2 2.7-3.1 4.6-2.4-.6 1.9-2.6 2.7-4.4 2.2"
					fill="none"
					stroke="var(--ui-color-brand-50)"
					stroke-width="1.8"
					stroke-linecap="round"
				/>
			</svg>
		);
	};
}

/**
 * The Lowmere region as one drawing in a `0 0 400 300` box: the sea along the south and east,
 * the lakes, the highlands' contours, the pinewood and the town walls, with every place named.
 * The results crop into it per place, so a pin sits in the same spot on every map.
 */
export function RegionArt() {
	return () => (
		<g>
			<rect x="-400" y="-300" width="1200" height="900" fill="var(--wf-map-sea)" />
			<path
				d="M-400 -300 H 800 V 120 Q 380 110 370 160 Q 400 200 360 240 Q 330 262 270 252 Q 230 285 160 268 Q 90 290 30 270 Q -20 268 -400 290 Z"
				fill="var(--wf-map-land)"
			/>
			<path
				d="M370 160 Q 400 200 360 240 Q 330 262 270 252"
				fill="none"
				stroke="var(--wf-map-shore)"
				stroke-width="3"
			/>
			{[0, 1, 2, 3].map((ring) => (
				<path
					d={`M${40 - ring * 8} ${80 + ring * 6} Q ${90} ${20 - ring * 12} ${150 + ring * 10} ${70 + ring * 4}`}
					fill="none"
					stroke="var(--wf-map-contour)"
					stroke-width="1.2"
				/>
			))}
			{Array.from({ length: 34 }, (_, index) => {
				let x = 50 + ((index * 37) % 110);
				let y = 105 + ((index * 23) % 70);
				return <circle cx={x} cy={y} r={3 + (index % 3)} fill="var(--wf-map-wood)" />;
			})}
			<ellipse cx="192" cy="104" rx="20" ry="11" fill="var(--wf-map-water)" />
			<ellipse cx="222" cy="128" rx="26" ry="13" fill="var(--wf-map-water)" />
			<ellipse cx="208" cy="90" rx="11" ry="7" fill="var(--wf-map-water)" />
			<path
				d="M222 141 Q 214 190 200 230 Q 196 248 186 262"
				fill="none"
				stroke="var(--wf-map-water)"
				stroke-width="4"
				stroke-linecap="round"
			/>
			<path
				d="M150 268 Q 190 240 240 258"
				fill="none"
				stroke="var(--wf-map-sand)"
				stroke-width="10"
				stroke-linecap="round"
			/>
			<rect
				x="300"
				y="72"
				width="46"
				height="38"
				rx="6"
				fill="var(--wf-map-town)"
				stroke="var(--wf-map-road)"
				stroke-width="2"
			/>
			<path
				d="M20 40 Q 90 80 110 140 T 200 120 T 320 92 T 310 210 M200 120 Q 190 190 190 245 M110 140 Q 100 50 90 55"
				fill="none"
				stroke="var(--wf-map-road)"
				stroke-width="2.4"
				stroke-dasharray="1 0"
				stroke-linecap="round"
			/>
			{PLACES.map((place) => (
				<text
					x={place.x}
					y={place.y + 26}
					text-anchor="middle"
					font-size="7"
					font-weight="600"
					letter-spacing="0.06em"
					fill="var(--wf-map-label)"
					style="text-transform: uppercase"
				>
					{place.name}
				</text>
			))}
		</g>
	);
}

/**
 * The colours the region map is painted in, each mixed into the page background, so the map
 * follows the page into dark mode without a second drawing.
 */
export const MAP_COLORS: Record<`--${string}`, string> = {
	"--wf-map-sea": "color-mix(in oklch, oklch(0.7 0.08 225) 38%, var(--ui-bg))",
	"--wf-map-land": "color-mix(in oklch, var(--ui-color-brand-500) 7%, var(--ui-bg))",
	"--wf-map-shore": "color-mix(in oklch, oklch(0.7 0.08 225) 60%, var(--ui-bg))",
	"--wf-map-contour": "color-mix(in oklch, var(--ui-color-brand-500) 22%, var(--ui-bg))",
	"--wf-map-wood": "color-mix(in oklch, var(--ui-color-brand-500) 24%, var(--ui-bg))",
	"--wf-map-water": "color-mix(in oklch, oklch(0.7 0.08 225) 50%, var(--ui-bg))",
	"--wf-map-sand": "color-mix(in oklch, oklch(0.85 0.09 85) 45%, var(--ui-bg))",
	"--wf-map-town": "color-mix(in oklch, oklch(0.72 0.07 50) 24%, var(--ui-bg))",
	"--wf-map-road": "color-mix(in oklch, var(--ui-neutral-fg) 16%, var(--ui-bg))",
	"--wf-map-label": "var(--ui-neutral-fg-muted)",
};

/**
 * The part of the region map a search shows: the whole region, or a crop centred on its place.
 * A `tall` crop fits the portrait panel results sit beside, so the map fills it.
 *
 * @param place The searched place's id, if any.
 * @param shape `wide` for a 4:3 map, `tall` for a 4:5 one.
 * @returns A `viewBox` in the map's units.
 */
export function regionView(place: string | undefined, shape: "wide" | "tall" = "wide"): string {
	let found = PLACES.find((entry) => entry.id === place);
	if (found === undefined) return shape === "wide" ? "0 0 400 300" : "40 -50 320 400";
	let width = shape === "wide" ? 200 : 160;
	let height = shape === "wide" ? 150 : 200;
	let x = Math.max(0, Math.min(400 - width, found.x - width / 2));
	let y = Math.max(-40, Math.min(300 - height, found.y - height / 2));
	return `${x} ${y} ${width} ${height}`;
}
