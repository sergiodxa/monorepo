/**
 * Vesper's key art, drawn rather than licensed: each title gets a scene from its motif and
 * palette, written once to an SVG file the pages load as an image, with its name set over it
 * in its own lettering. One square scene crops to a still, a poster or a full-bleed hero.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { Lettering, Motif, Title } from "./data";

/** The scene's square canvas; the horizon sits a little under its middle. */
const SIZE = 300;

/** Where land or sea meets the sky. */
const HORIZON = 190;

/** The type each lettering sets a title's name in. */
const LETTERING: Record<Lettering, Record<string, string>> = {
	serif: {
		fontFamily: "Didot, 'Bodoni 72', 'Bodoni MT', 'Playfair Display', Georgia, serif",
		fontWeight: "400",
		textTransform: "uppercase",
		letterSpacing: "0.14em",
	},
	wide: {
		fontFamily: "'Avenir Next', Avenir, 'Segoe UI', system-ui, sans-serif",
		fontWeight: "600",
		textTransform: "uppercase",
		letterSpacing: "0.32em",
	},
	condensed: {
		fontFamily: "'Avenir Next Condensed', 'Arial Narrow', 'Roboto Condensed', sans-serif",
		fontWeight: "800",
		textTransform: "uppercase",
		letterSpacing: "0.01em",
		fontStretch: "condensed",
	},
	script: {
		fontFamily: "Georgia, 'Iowan Old Style', 'Palatino Linotype', serif",
		fontWeight: "700",
		fontStyle: "italic",
		letterSpacing: "-0.01em",
	},
	mono: {
		fontFamily: "'SF Mono', ui-monospace, Menlo, Consolas, monospace",
		fontWeight: "500",
		textTransform: "uppercase",
		letterSpacing: "0.22em",
	},
};

/** How large each lettering sets, as a share of the art's width, since some run wider. */
const LETTER_SCALE: Record<Lettering, number> = {
	serif: 9,
	wide: 7,
	condensed: 12,
	script: 11,
	mono: 7,
};

/**
 * A small deterministic random source seeded from a title's id, so a scene draws the same
 * stars, windows and waves on every render and on the server and client alike.
 */
function seeded(seed: string): () => number {
	let state = 2166136261;
	for (let char of seed) state = Math.imul(state ^ char.charCodeAt(0), 16777619);
	return () => {
		state = Math.imul(state ^ (state >>> 15), 2246822507);
		state = Math.imul(state ^ (state >>> 13), 3266489909);
		state ^= state >>> 16;
		return (state >>> 0) / 4294967296;
	};
}

/** What every motif reads: the title's palette, its random source and the ids it may define. */
interface Scene {
	sky: string;
	horizon: string;
	light: string;
	random: () => number;
	/** A prefix unique to this drawing, for gradient ids. */
	uid: string;
}

/** What a motif component draws from. */
interface MotifProps {
	scene: Scene;
}

/** A darker or lighter step of a colour, mixed in OKLCH. */
function shade(colour: string, toward: "black" | "white", amount: number): string {
	return `color-mix(in oklch, ${colour}, ${toward} ${Math.round(amount * 100)}%)`;
}

/** A smooth band across the canvas whose top edge undulates, for waves, dunes and hills. */
function band(top: number, amplitude: number, waves: number, phase: number): string {
	let points: string[] = [];
	for (let x = 0; x <= SIZE; x += 10) {
		let y = top + Math.sin((x / SIZE) * Math.PI * 2 * waves + phase) * amplitude;
		points.push(`${x},${y.toFixed(1)}`);
	}
	return `M0,${SIZE} L${points.join(" L")} L${SIZE},${SIZE} Z`;
}

/** Scattered stars in the upper sky. */
function Stars(handle: Handle<{ scene: Scene; count: number }>) {
	return () => {
		let { count, scene } = handle.props;
		return Array.from({ length: count }, () => (
			<circle
				cx={(scene.random() * SIZE).toFixed(1)}
				cy={(scene.random() * HORIZON * 0.7).toFixed(1)}
				r={(0.3 + scene.random() * 0.8).toFixed(2)}
				fill="white"
				opacity={(0.3 + scene.random() * 0.6).toFixed(2)}
			/>
		));
	};
}

/** The body of light in a scene: a sun, a moon or a lamp, haloed. */
function Glow(handle: Handle<{ scene: Scene; cx: number; cy: number; r: number }>) {
	return () => {
		let { cx, cy, r, scene } = handle.props;
		return (
			<>
				<circle cx={cx} cy={cy} r={r * 3.2} fill={`url(#${scene.uid}-halo)`} />
				<circle cx={cx} cy={cy} r={r} fill={scene.light} />
			</>
		);
	};
}

/** Sea under a low sun, its swell in bands that darken toward the viewer. */
function Waves(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Stars scene={scene} count={24} />
				<Glow scene={scene} cx={210} cy={HORIZON - 6} r={18} />
				<rect x="196" y={HORIZON} width="28" height="70" fill={scene.light} opacity="0.18" />
				{[0, 1, 2, 3, 4].map((index) => (
					<path
						d={band(HORIZON + index * 22, 3 + index * 1.6, 3 + index, scene.random() * 6)}
						fill={shade(scene.horizon, "black", 0.35 + index * 0.12)}
					/>
				))}
			</>
		);
	};
}

/** Paper lanterns rising into a dark sky, each lit from within. */
function Lanterns(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Stars scene={scene} count={12} />
				{Array.from({ length: 14 }, () => {
					let x = scene.random() * SIZE;
					let y = 30 + scene.random() * 200;
					let s = 6 + scene.random() * 12;
					return (
						<g opacity={(0.55 + scene.random() * 0.45).toFixed(2)}>
							<circle cx={x} cy={y} r={s * 1.8} fill={`url(#${scene.uid}-halo)`} />
							<rect
								x={x - s / 2}
								y={y - s * 0.7}
								width={s}
								height={s * 1.4}
								rx={s * 0.35}
								fill={scene.light}
							/>
						</g>
					);
				})}
				<path d={band(250, 4, 1.5, 1)} fill={shade(scene.sky, "black", 0.55)} />
			</>
		);
	};
}

/** Rails running to a vanishing point, with a lit sleeper train crossing the horizon. */
function Rails(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		let vanish = 150;
		return (
			<>
				<Stars scene={scene} count={20} />
				<Glow scene={scene} cx={80} cy={HORIZON - 30} r={10} />
				<rect
					x="0"
					y={HORIZON}
					width={SIZE}
					height={SIZE - HORIZON}
					fill={shade(scene.sky, "black", 0.5)}
				/>
				{[-160, -40, 40, 160].map((spread) => (
					<line
						x1={vanish}
						y1={HORIZON}
						x2={vanish + spread * 1.6}
						y2={SIZE}
						stroke={scene.light}
						stroke-width="1.2"
						opacity="0.5"
					/>
				))}
				<rect
					x="30"
					y={HORIZON - 16}
					width="240"
					height="16"
					rx="3"
					fill={shade(scene.sky, "black", 0.6)}
				/>
				{Array.from({ length: 16 }, (_, index) => (
					<rect
						x={36 + index * 14.6}
						y={HORIZON - 12}
						width="8"
						height="6"
						rx="1"
						fill={scene.light}
						opacity={scene.random() > 0.25 ? "0.9" : "0.15"}
					/>
				))}
			</>
		);
	};
}

/** A huge moon low over rooftops, a kite climbing toward it. */
function Moon(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Stars scene={scene} count={30} />
				<Glow scene={scene} cx={150} cy={120} r={62} />
				{[0, 1, 2].map(() => (
					<circle
						cx={110 + scene.random() * 80}
						cy={90 + scene.random() * 60}
						r={4 + scene.random() * 8}
						fill={shade(scene.light, "black", 0.1)}
					/>
				))}
				<path d="M70 150 l10 -14 l10 14 l-10 14 z" fill={shade(scene.horizon, "white", 0.3)} />
				<path
					d="M80 164 q 20 60 -10 120"
					fill="none"
					stroke="white"
					stroke-width="0.8"
					opacity="0.6"
				/>
				<path d={band(240, 6, 4, 0)} fill={shade(scene.sky, "black", 0.55)} />
			</>
		);
	};
}

/** A ringed moon's limb along the foot of the frame, a station on its orbit. */
function Orbit(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Stars scene={scene} count={60} />
				<circle cx="150" cy="430" r="230" fill={shade(scene.horizon, "black", 0.2)} />
				<circle
					cx="150"
					cy="430"
					r="230"
					fill="none"
					stroke={scene.light}
					stroke-width="1.5"
					opacity="0.7"
				/>
				<ellipse
					cx="150"
					cy="150"
					rx="140"
					ry="28"
					fill="none"
					stroke={scene.light}
					stroke-width="0.8"
					opacity="0.5"
					transform="rotate(-12 150 150)"
				/>
				<g transform="translate(222 122) rotate(-12)">
					<rect x="-14" y="-2" width="28" height="4" fill={scene.light} />
					<rect x="-3" y="-7" width="6" height="14" rx="2" fill="white" />
				</g>
			</>
		);
	};
}

/** A glass house at night, a grid of panes with a few lit and one figure-shaped dark. */
function Glass(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Stars scene={scene} count={10} />
				<rect
					x="0"
					y={HORIZON + 20}
					width={SIZE}
					height={SIZE}
					fill={shade(scene.sky, "black", 0.5)}
				/>
				<rect
					x="60"
					y="100"
					width="180"
					height="110"
					fill={shade(scene.sky, "black", 0.3)}
					stroke={scene.light}
					stroke-width="1"
					opacity="0.95"
				/>
				{Array.from({ length: 6 }, (_, column) =>
					Array.from({ length: 4 }, (_, row) => (
						<rect
							x={63 + column * 29.5}
							y={103 + row * 26.5}
							width="27"
							height="24"
							fill={scene.light}
							opacity={scene.random() > 0.6 ? "0.75" : "0.08"}
						/>
					)),
				)}
				<path d="M60 100 L150 70 L240 100" fill="none" stroke={scene.light} stroke-width="1" />
			</>
		);
	};
}

/** Layered ranges fading into the distance, snow on the nearest. */
function Peaks(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		let ranges = [0.15, 0.35, 0.55];
		return (
			<>
				<Glow scene={scene} cx={220} cy={80} r={14} />
				{ranges.map((depth, index) => {
					let base = 150 + index * 38;
					let points = [`0,${SIZE}`, `0,${base + 20}`];
					for (let x = 0; x <= SIZE; x += 30) {
						points.push(`${x},${(base - scene.random() * (70 - index * 18)).toFixed(1)}`);
					}
					points.push(`${SIZE},${SIZE}`);
					return (
						<polygon points={points.join(" ")} fill={shade(scene.horizon, "black", depth + 0.2)} />
					);
				})}
			</>
		);
	};
}

/** Wind-shaped dunes or marsh under a wide sky. */
function Dunes(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Glow scene={scene} cx={90} cy={HORIZON - 20} r={22} />
				{[0, 1, 2, 3].map((index) => (
					<path
						d={band(HORIZON - 10 + index * 26, 10 - index * 1.5, 0.8 + index * 0.4, index * 1.3)}
						fill={shade(scene.horizon, "black", 0.15 + index * 0.15)}
					/>
				))}
			</>
		);
	};
}

/** A skyline of towers with a scatter of lit windows. */
function City(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		let towers = Array.from({ length: 12 }, (_, index) => ({
			x: index * 26 - 6,
			w: 18 + scene.random() * 14,
			h: 50 + scene.random() * 110,
		}));
		return (
			<>
				<Stars scene={scene} count={18} />
				<Glow scene={scene} cx={240} cy={70} r={12} />
				{towers.map((tower) => (
					<g>
						<rect
							x={tower.x}
							y={HORIZON + 40 - tower.h}
							width={tower.w}
							height={tower.h + 80}
							fill={shade(scene.sky, "black", 0.45)}
						/>
						{Array.from({ length: Math.floor(tower.h / 12) }, (_, row) => (
							<rect
								x={tower.x + 4}
								y={HORIZON + 46 - tower.h + row * 12}
								width={tower.w - 8}
								height="4"
								fill={scene.light}
								opacity={scene.random() > 0.7 ? "0.85" : "0.05"}
							/>
						))}
					</g>
				))}
			</>
		);
	};
}

/** A pendant lamp pooling light over a table, mugs scattered on it. */
function Table(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<line
					x1="150"
					y1="0"
					x2="150"
					y2="80"
					stroke={shade(scene.light, "black", 0.5)}
					stroke-width="1.5"
				/>
				<path d="M120 100 L150 78 L180 100 Z" fill={shade(scene.horizon, "black", 0.3)} />
				<ellipse cx="150" cy="200" rx="150" ry="70" fill={`url(#${scene.uid}-halo)`} />
				<rect
					x="20"
					y="200"
					width="260"
					height="14"
					rx="4"
					fill={shade(scene.horizon, "black", 0.45)}
				/>
				{[60, 110, 180, 230].map((x) => (
					<rect
						x={x}
						y={182}
						width="16"
						height="18"
						rx="3"
						fill={shade(scene.light, "black", scene.random() * 0.3)}
					/>
				))}
				<rect x="0" y="214" width={SIZE} height="90" fill={shade(scene.sky, "black", 0.5)} />
			</>
		);
	};
}

/** A flock wheeling over a park, two birds near the front. */
function Birds(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Glow scene={scene} cx={230} cy={70} r={20} />
				{Array.from({ length: 22 }, () => {
					let x = 30 + scene.random() * 240;
					let y = 40 + scene.random() * 110;
					let s = 2 + scene.random() * 4;
					return (
						<path
							d={`M${x - s} ${y} q ${s / 2} ${-s / 2} ${s} 0 q ${s / 2} ${-s / 2} ${s} 0`}
							fill="none"
							stroke="white"
							stroke-width="0.8"
							opacity="0.7"
						/>
					);
				})}
				<path d={band(HORIZON + 10, 8, 1.2, 0.5)} fill={shade(scene.horizon, "black", 0.25)} />
				<ellipse cx="100" cy="225" rx="14" ry="9" fill={shade(scene.sky, "black", 0.6)} />
				<ellipse cx="190" cy="228" rx="11" ry="8" fill={shade(scene.light, "black", 0.35)} />
			</>
		);
	};
}

/** Rows of conifers, nearer rows taller and darker. */
function Forest(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Glow scene={scene} cx={150} cy={90} r={16} />
				{[0, 1, 2].map((row) =>
					Array.from({ length: 14 }, (_, index) => {
						let x = index * 24 - 10 + scene.random() * 10;
						let base = 200 + row * 40;
						let h = 60 + row * 25 + scene.random() * 30;
						return (
							<polygon
								points={`${x},${base} ${x + 12},${base - h} ${x + 24},${base}`}
								fill={shade(scene.horizon, "black", 0.3 + row * 0.18)}
							/>
						);
					}),
				)}
				<rect x="0" y="270" width={SIZE} height="40" fill={shade(scene.horizon, "black", 0.75)} />
			</>
		);
	};
}

/** One summit against the stars with a beacon burning on it, rays spreading. */
function Signal(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Stars scene={scene} count={40} />
				{Array.from({ length: 9 }, (_, index) => {
					let angle = -Math.PI / 2 + (index - 4) * 0.22;
					return (
						<line
							x1="150"
							y1="128"
							x2={150 + Math.cos(angle) * 220}
							y2={128 + Math.sin(angle) * 220}
							stroke={scene.light}
							stroke-width="0.6"
							opacity="0.35"
						/>
					);
				})}
				<Glow scene={scene} cx={150} cy={128} r={6} />
				<polygon
					points={`0,${SIZE} 150,132 ${SIZE},${SIZE}`}
					fill={shade(scene.sky, "black", 0.55)}
				/>
				<path d={band(250, 5, 2, 0.3)} fill={shade(scene.horizon, "black", 0.55)} />
			</>
		);
	};
}

/** One large flower opening against a warm dusk. */
function Bloom(handle: Handle<MotifProps>) {
	return () => {
		let { scene } = handle.props;
		return (
			<>
				<Glow scene={scene} cx={150} cy={150} r={24} />
				{Array.from({ length: 10 }, (_, index) => (
					<ellipse
						cx="150"
						cy="104"
						rx="16"
						ry="46"
						fill={shade(scene.horizon, "white", 0.1 + (index % 2) * 0.15)}
						opacity="0.75"
						transform={`rotate(${index * 36} 150 150)`}
					/>
				))}
				<circle cx="150" cy="150" r="14" fill={scene.light} />
				<path d={band(250, 4, 2, 2)} fill={shade(scene.sky, "black", 0.5)} />
			</>
		);
	};
}

/** Each motif's drawing. */
const MOTIFS: Record<Motif, (handle: Handle<MotifProps>) => () => RemixNode> = {
	waves: Waves,
	lanterns: Lanterns,
	rails: Rails,
	moon: Moon,
	orbit: Orbit,
	glass: Glass,
	peaks: Peaks,
	dunes: Dunes,
	city: City,
	table: Table,
	birds: Birds,
	forest: Forest,
	signal: Signal,
	bloom: Bloom,
};

/**
 * The part of the scene a still shows: the whole canvas for key art, or for frame `n` a closer
 * crop that wanders across the scene, so consecutive episodes never share a picture.
 */
function stillBox(frame: number | undefined): string {
	if (frame === undefined) return `0 0 ${SIZE} ${SIZE}`;
	let size = SIZE * (0.5 + ((frame * 7) % 6) * 0.05);
	let x = (((frame * 53) % 100) / 100) * (SIZE - size);
	let y = Math.min(SIZE - size, Math.max(0, HORIZON - size / 2 + (((frame * 31) % 50) - 25)));
	return `${x.toFixed(1)} ${y.toFixed(1)} ${size.toFixed(1)} ${size.toFixed(1)}`;
}

/** Where the drawn art is served from, one file per title and per episode still. */
const ART_ROOT = "/demos/vesper/art";

/**
 * The address of a title's key art, or of one episode's still when `frame` is given.
 *
 * @example artSrc(tidewater) // "/demos/vesper/art/tidewater.svg"
 * @example artSrc(tidewater, 23) // "/demos/vesper/art/tidewater-23.svg"
 */
export function artSrc(title: Title, frame?: number): string {
	return `${ART_ROOT}/${title.id}${frame === undefined ? "" : `-${frame}`}.svg`;
}

/**
 * The frame number a series episode's still is drawn from.
 *
 * @example stillFrame(2, 3) // 23
 */
export function stillFrame(season: number, episode: number): number {
	return season * 10 + episode;
}

/**
 * Every art file the app serves: each title's key art and a still for every episode, with the
 * file name each is written to under `public/demos/vesper/art/`.
 */
export function artFiles(titles: Title[]): Array<{ file: string; title: Title; frame?: number }> {
	return titles.flatMap((title) => [
		{ file: `${title.id}.svg`, title },
		...(title.seasons ?? []).flatMap((season) =>
			season.episodes.map((episode) => {
				let frame = stillFrame(season.number, episode.number);
				return { file: `${title.id}-${frame}.svg`, title, frame };
			}),
		),
	]);
}

namespace SceneSvg {
	export interface Props {
		title: Title;
		/** The still to draw; the whole key art when omitted. */
		frame?: number;
	}
}

/**
 * The scene as a standalone SVG document, the content of one art file: the sky, the title's
 * motif and a vignette. Each frame number reseeds the details and crops a different part, so a
 * season's episodes differ.
 */
export function SceneSvg(handle: Handle<SceneSvg.Props>) {
	return () => {
		let { frame, title } = handle.props;
		let uid = "v";
		let scene: Scene = {
			...title.palette,
			random: seeded(frame === undefined ? title.id : `${title.id}:${frame}`),
			uid,
		};
		let Motif = MOTIFS[title.motif];
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox={stillBox(frame)}
				width="600"
				height="600"
				preserveAspectRatio="xMidYMid slice"
			>
				<defs>
					<linearGradient id={`${uid}-sky`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0" stop-color={shade(title.palette.sky, "black", 0.35)} />
						<stop offset="0.62" stop-color={title.palette.horizon} />
						<stop offset="1" stop-color={shade(title.palette.horizon, "black", 0.3)} />
					</linearGradient>
					<radialGradient id={`${uid}-halo`}>
						<stop offset="0" stop-color={title.palette.light} stop-opacity="0.55" />
						<stop offset="1" stop-color={title.palette.light} stop-opacity="0" />
					</radialGradient>
					<radialGradient id={`${uid}-vignette`} cx="0.5" cy="0.45" r="0.75">
						<stop offset="0.55" stop-color="black" stop-opacity="0" />
						<stop offset="1" stop-color="black" stop-opacity="0.55" />
					</radialGradient>
				</defs>
				<rect width={SIZE} height={SIZE} fill={`url(#${uid}-sky)`} />
				<Motif scene={scene} />
				<rect width={SIZE} height={SIZE} fill={`url(#${uid}-vignette)`} />
			</svg>
		);
	};
}

namespace KeyArt {
	export interface Props {
		title: Title;
		/** Sets the title's name over the scene, as its artwork would. Default: `true`. */
		named?: boolean;
		/** Shows one episode's still rather than the key art; see {@link stillFrame}. */
		frame?: number;
		/**
		 * Loads the picture first and at once, for the art a screen opens on (its hero); every
		 * other picture loads lazily as it nears the viewport.
		 */
		priority?: boolean;
	}
}

/**
 * A title's key art or still as an image file, filling the positioned frame that holds it, on
 * the title's own sky colour until it loads. It is decorative, since the card or heading around
 * it already names the title.
 */
export function KeyArt(handle: Handle<KeyArt.Props>) {
	return () => {
		let { frame, named = true, priority = false, title } = handle.props;
		return (
			<span
				aria-hidden="true"
				data-key-art={title.id}
				mix={[
					raw({
						containerType: "inline-size",
						display: "block",
						position: "absolute",
						inset: "0",
						overflow: "clip",
						backgroundColor: title.palette.sky,
						"& > img": {
							position: "absolute",
							inset: "0",
							inlineSize: "100%",
							blockSize: "100%",
							objectFit: "cover",
							objectPosition: "50% 62%",
						},
					}),
				]}
			>
				<img
					src={artSrc(title, frame)}
					alt=""
					width="600"
					height="600"
					decoding="async"
					loading={priority ? "eager" : "lazy"}
					fetchpriority={priority ? "high" : undefined}
				/>
				{named ? <TitleMark title={title} /> : null}
			</span>
		);
	};
}

namespace TitleMark {
	export interface Props {
		title: Title;
	}
}

/**
 * A title's name in its own lettering, sized from the art's width so it sits the same in a
 * 200px card and a 300px poster, with Vesper's mark above an original.
 */
function TitleMark(handle: Handle<TitleMark.Props>) {
	return () => {
		let { title } = handle.props;
		return (
			<span
				mix={[
					raw({
						position: "absolute",
						insetInline: "6%",
						insetBlockEnd: "9%",
						display: "grid",
						justifyItems: "center",
						gap: "0.35em",
						textAlign: "center",
						color: "oklch(0.98 0.01 85)",
						textShadow: "0 1px 12px rgb(0 0 0 / 0.55)",
						lineHeight: "0.95",
					}),
				]}
			>
				{title.original ? (
					<span
						mix={[
							raw({
								fontFamily: "'Avenir Next', Avenir, system-ui, sans-serif",
								fontSize: "3.2cqi",
								fontWeight: "700",
								letterSpacing: "0.4em",
								color: "var(--ui-color-brand-300)",
							}),
						]}
					>
						VESPER
					</span>
				) : null}
				<span
					mix={[
						raw({
							...LETTERING[title.lettering],
							fontSize: `${LETTER_SCALE[title.lettering]}cqi`,
							textWrap: "balance",
						}),
					]}
				>
					{title.name}
				</span>
			</span>
		);
	};
}
