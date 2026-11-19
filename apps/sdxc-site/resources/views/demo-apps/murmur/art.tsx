/**
 * Murmur's drawn artwork: every album, playlist, genre and artist picture is composed here
 * from a motif, three inks and a seed, written once to an SVG file the pages load as an image.
 * Nothing imitates a real cover; the compositions are geometric and original.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { seededRandom } from "@sdxc/synth";

import type { Album, Artist, CoverPalette, Genre, Motif, Playlist } from "./data";

import { ALBUMS, ARTISTS, GENRES, PLAYLISTS } from "./data";

/** The drawing's side in user units; every motif draws inside it. */
const SIZE = 300;

/** Where the drawn art is served from. */
const ART_ROOT = "/demos/murmur/art";

/** A number from a string, so each picture's details are its own and the same every time. */
function hash(text: string): number {
	let value = 2166136261;
	for (let char of text) value = Math.imul(value ^ char.charCodeAt(0), 16777619);
	return value >>> 0;
}

/** What a motif draws with. */
interface Scene {
	palette: CoverPalette;
	random: () => number;
}

/** Concentric orbits with a small bright planet riding one of them. */
function Orbit(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let cx = 150 + (random() - 0.5) * 60;
		let cy = 160 + (random() - 0.5) * 40;
		let angle = random() * Math.PI * 2;
		return (
			<g>
				{[40, 72, 104, 136, 168].map((r, index) => (
					<ellipse
						cx={cx}
						cy={cy}
						rx={r}
						ry={r * 0.42}
						fill="none"
						stroke={palette.shape}
						stroke-opacity={String(0.85 - index * 0.14)}
						stroke-width="1.5"
						transform={`rotate(-18 ${cx} ${cy})`}
					/>
				))}
				<circle cx={cx} cy={cy} r="22" fill={palette.shape} />
				<circle
					cx={cx + Math.cos(angle) * 104}
					cy={cy + Math.sin(angle) * 44}
					r="8"
					fill={palette.spark}
				/>
			</g>
		);
	};
}

/** Horizontal bands stepping in tone, crossed by a sun. */
function Bands(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let sun = 90 + random() * 120;
		return (
			<g>
				{Array.from({ length: 7 }, (_, index) => (
					<rect
						y={150 + index * 22}
						width={SIZE}
						height="22"
						fill={palette.shape}
						fill-opacity={String(0.25 + index * 0.11)}
					/>
				))}
				<circle cx={sun} cy="150" r="58" fill={palette.spark} />
				<rect y="150" width={SIZE} height="2" fill={palette.ground} fill-opacity="0.6" />
			</g>
		);
	};
}

/** A grid of dots with one lit, over fine survey lines. */
function Grid(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let lit = Math.floor(random() * 49);
		return (
			<g>
				{Array.from({ length: 7 }, (_, row) => (
					<line
						x1="20"
						x2="280"
						y1={42 + row * 36}
						y2={42 + row * 36}
						stroke={palette.shape}
						stroke-opacity="0.18"
					/>
				))}
				{Array.from({ length: 49 }, (_, index) => (
					<circle
						cx={42 + (index % 7) * 36}
						cy={42 + Math.floor(index / 7) * 36}
						r={index === lit ? 11 : 3.5}
						fill={index === lit ? palette.spark : palette.shape}
					/>
				))}
			</g>
		);
	};
}

/** Stacked waves, thinning toward the top. */
function Waves(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let phase = random() * Math.PI * 2;
		return (
			<g fill="none">
				{Array.from({ length: 11 }, (_, index) => {
					let y = 60 + index * 22;
					let amp = 8 + index * 2.4;
					let points = Array.from({ length: 31 }, (_, step) => {
						let x = step * 10;
						return `${step === 0 ? "M" : "L"}${x} ${(y + Math.sin(step * 0.42 + phase + index * 0.5) * amp).toFixed(1)}`;
					}).join(" ");
					return (
						<path
							d={points}
							stroke={index === 6 ? palette.spark : palette.shape}
							stroke-width={String(1 + index * 0.35)}
							stroke-opacity={String(0.35 + index * 0.06)}
						/>
					);
				})}
			</g>
		);
	};
}

/** Quarter circles and slabs in a loose modernist stack. */
function Blocks(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let flip = random() > 0.5;
		return (
			<g transform={flip ? `translate(${SIZE} 0) scale(-1 1)` : undefined}>
				<rect x="30" y="30" width="120" height="120" fill={palette.shape} />
				<path d="M150 150 L150 30 A120 120 0 0 1 270 150 Z" fill={palette.spark} />
				<path
					d="M30 270 L30 150 A120 120 0 0 1 150 270 Z"
					fill={palette.spark}
					fill-opacity="0.85"
				/>
				<rect x="150" y="150" width="120" height="120" fill={palette.shape} fill-opacity="0.55" />
				<circle cx="210" cy="210" r="34" fill={palette.ground} />
			</g>
		);
	};
}

/** Rain streaks over a blurred window light. */
function Rain(handle: Handle<{ scene: Scene; uid: string }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let uid = handle.props.uid;
		return (
			<g>
				<defs>
					<filter id={`${uid}-blur`} x="-50%" y="-50%" width="200%" height="200%">
						<feGaussianBlur stdDeviation="18" />
					</filter>
				</defs>
				<circle
					cx={80 + random() * 140}
					cy={90 + random() * 80}
					r="64"
					fill={palette.spark}
					filter={`url(#${uid}-blur)`}
				/>
				<circle
					cx={60 + random() * 180}
					cy={170 + random() * 60}
					r="40"
					fill={palette.shape}
					fill-opacity="0.5"
					filter={`url(#${uid}-blur)`}
				/>
				{Array.from({ length: 46 }, () => {
					let x = random() * SIZE;
					let y = random() * SIZE;
					let length = 14 + random() * 30;
					return (
						<line
							x1={x}
							y1={y}
							x2={x - length * 0.18}
							y2={y + length}
							stroke={palette.shape}
							stroke-opacity={String(0.35 + random() * 0.5)}
							stroke-width="1.4"
							stroke-linecap="round"
						/>
					);
				})}
			</g>
		);
	};
}

/** A half sun on the horizon and its broken reflection. */
function Horizon(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let level = 170 + random() * 30;
		return (
			<g>
				<path d={`M60 ${level} A90 90 0 0 1 240 ${level} Z`} fill={palette.shape} />
				<rect
					y={level}
					width={SIZE}
					height={SIZE - level}
					fill={palette.ground}
					fill-opacity="0.6"
				/>
				{Array.from({ length: 7 }, (_, index) => {
					let width = 160 - index * 20;
					return (
						<rect
							x={150 - width / 2}
							y={level + 10 + index * 14}
							width={width}
							height="4"
							rx="2"
							fill={palette.shape}
							fill-opacity={String(0.8 - index * 0.1)}
						/>
					);
				})}
				<circle cx={60 + random() * 180} cy={50 + random() * 40} r="5" fill={palette.spark} />
			</g>
		);
	};
}

/** A flower of overlapping petals, each slightly translucent. */
function Petals(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let count = 6 + Math.floor(random() * 4);
		let turn = random() * 60;
		return (
			<g>
				{Array.from({ length: count }, (_, index) => (
					<ellipse
						cx="150"
						cy="92"
						rx="34"
						ry="70"
						fill={index % 2 === 0 ? palette.shape : palette.spark}
						fill-opacity="0.72"
						transform={`rotate(${turn + (360 / count) * index} 150 150)`}
						style={{ mixBlendMode: "screen" }}
					/>
				))}
				<circle cx="150" cy="150" r="20" fill={palette.ground} />
			</g>
		);
	};
}

/** Rings drifting off center, like ripples from two drops. */
function Rings(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let a = { x: 100 + random() * 40, y: 110 + random() * 40 };
		let b = { x: 180 + random() * 40, y: 170 + random() * 40 };
		return (
			<g fill="none">
				{[18, 40, 62, 84, 106, 128].map((r) => (
					<circle cx={a.x} cy={a.y} r={r} stroke={palette.shape} stroke-width="3" />
				))}
				{[14, 32, 50, 68].map((r) => (
					<circle cx={b.x} cy={b.y} r={r} stroke={palette.spark} stroke-width="2.5" />
				))}
			</g>
		);
	};
}

/** Diagonal stripes in two widths with one bright lane. */
function Stripes(handle: Handle<{ scene: Scene }>) {
	return () => {
		let { palette, random } = handle.props.scene;
		let lane = Math.floor(random() * 8);
		return (
			<g transform="rotate(-30 150 150)">
				{Array.from({ length: 12 }, (_, index) => (
					<rect
						x="-120"
						y={-120 + index * 46}
						width="540"
						height={index % 3 === 0 ? 26 : 12}
						fill={index === lane + 2 ? palette.spark : palette.shape}
						fill-opacity={index === lane + 2 ? "1" : "0.6"}
					/>
				))}
			</g>
		);
	};
}

/** Each motif's drawing. */
const MOTIFS: Record<Motif, (handle: Handle<{ scene: Scene; uid: string }>) => () => RemixNode> = {
	orbit: Orbit,
	bands: Bands,
	grid: Grid,
	waves: Waves,
	blocks: Blocks,
	rain: Rain,
	horizon: Horizon,
	petals: Petals,
	rings: Rings,
	stripes: Stripes,
};

namespace CoverSvg {
	export interface Props {
		/** Seeds the details. */
		id: string;
		motif: Motif;
		palette: CoverPalette;
		/** A name set over the art, for editorial playlists and genre tiles. */
		lettering?: { title: string; kicker?: string };
	}
}

/**
 * A cover as a standalone SVG document: the ground, the motif, a fine grain and an optional
 * name set in heavy type at the foot. Each id reseeds the details.
 */
export function CoverSvg(handle: Handle<CoverSvg.Props>) {
	return () => {
		let { id, lettering, motif, palette } = handle.props;
		let uid = "m";
		let scene: Scene = { palette, random: seededRandom(hash(id)) };
		let Motif = MOTIFS[motif];
		let words = lettering?.title.split(" ") ?? [];
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox={`0 0 ${SIZE} ${SIZE}`}
				width="600"
				height="600"
			>
				<defs>
					<filter id={`${uid}-grain`}>
						<feTurbulence
							type="fractalNoise"
							baseFrequency="0.9"
							numOctaves="2"
							stitchTiles="stitch"
						/>
						<feColorMatrix values="0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0 0.5 0 0 0 0.09 0" />
					</filter>
					<linearGradient id={`${uid}-shade`} x1="0" y1="0" x2="0" y2="1">
						<stop offset="0.45" stop-color="black" stop-opacity="0" />
						<stop offset="1" stop-color="black" stop-opacity="0.45" />
					</linearGradient>
				</defs>
				<rect width={SIZE} height={SIZE} fill={palette.ground} />
				<Motif scene={scene} uid={uid} />
				<rect width={SIZE} height={SIZE} filter={`url(#${uid}-grain)`} />
				{lettering === undefined ? null : (
					<g>
						<rect width={SIZE} height={SIZE} fill={`url(#${uid}-shade)`} />
						{lettering.kicker === undefined ? null : (
							<text
								x="22"
								y="34"
								fill="white"
								font-family="Helvetica Neue, Arial, sans-serif"
								font-size="14"
								font-weight="700"
								letter-spacing="2"
							>
								{lettering.kicker.toUpperCase()}
							</text>
						)}
						{words.map((word, index) => (
							<text
								x="20"
								y={SIZE - 24 - (words.length - 1 - index) * 40}
								fill="white"
								font-family="Helvetica Neue, Arial, sans-serif"
								font-size="42"
								font-weight="800"
								letter-spacing="-1.5"
							>
								{word}
							</text>
						))}
					</g>
				)}
			</svg>
		);
	};
}

namespace PortraitSvg {
	export interface Props {
		artist: Artist;
	}
}

/**
 * An artist's picture as an SVG document: soft stage light in their hue around a record-like
 * center and broken arcs, an emblem rather than a face.
 */
export function PortraitSvg(handle: Handle<PortraitSvg.Props>) {
	return () => {
		let { artist } = handle.props;
		let random = seededRandom(hash(artist.id));
		let hue = artist.hue;
		let shapes = Array.from({ length: 5 }, () => ({
			x: 60 + random() * 180,
			y: 60 + random() * 180,
			r: 30 + random() * 70,
			hue: hue + (random() - 0.5) * 70,
		}));
		return (
			<svg
				xmlns="http://www.w3.org/2000/svg"
				viewBox={`0 0 ${SIZE} ${SIZE}`}
				width="600"
				height="600"
			>
				<defs>
					<radialGradient id="p-glow" cx="0.5" cy="0.4" r="0.7">
						<stop offset="0" stop-color={`oklch(0.78 0.13 ${hue})`} />
						<stop offset="1" stop-color={`oklch(0.25 0.08 ${hue})`} />
					</radialGradient>
					<filter id="p-soft" x="-30%" y="-30%" width="160%" height="160%">
						<feGaussianBlur stdDeviation="14" />
					</filter>
				</defs>
				<rect width={SIZE} height={SIZE} fill="url(#p-glow)" />
				<g filter="url(#p-soft)">
					{shapes.map((shape) => (
						<circle
							cx={shape.x}
							cy={shape.y}
							r={shape.r}
							fill={`oklch(0.7 0.16 ${shape.hue.toFixed(0)})`}
							fill-opacity="0.7"
						/>
					))}
				</g>
				<g fill="none" stroke={`oklch(0.96 0.03 ${hue})`} stroke-linecap="round">
					{[0, 1, 2, 3].map((index) => {
						let r = 58 + index * 26;
						let start = random() * Math.PI * 2;
						let sweep = Math.PI * (0.6 + random() * 0.9);
						let x1 = 150 + Math.cos(start) * r;
						let y1 = 150 + Math.sin(start) * r;
						let x2 = 150 + Math.cos(start + sweep) * r;
						let y2 = 150 + Math.sin(start + sweep) * r;
						return (
							<path
								d={`M${x1.toFixed(1)} ${y1.toFixed(1)} A${r} ${r} 0 ${sweep > Math.PI ? 1 : 0} 1 ${x2.toFixed(1)} ${y2.toFixed(1)}`}
								stroke-width={String(5 - index)}
								stroke-opacity={String(0.9 - index * 0.15)}
							/>
						);
					})}
				</g>
				<circle cx="150" cy="150" r="30" fill={`oklch(0.96 0.03 ${hue})`} fill-opacity="0.92" />
				<circle cx="150" cy="150" r="9" fill={`oklch(0.3 0.08 ${hue})`} />
			</svg>
		);
	};
}

/** The address of an album's cover. */
export function albumArt(entry: Album): string {
	return `${ART_ROOT}/album-${entry.id}.svg`;
}

/** The address of a playlist's cover. */
export function playlistArt(playlist: Playlist): string {
	return `${ART_ROOT}/playlist-${playlist.id}.svg`;
}

/** The address of an artist's picture. */
export function artistArt(artist: Artist): string {
	return `${ART_ROOT}/artist-${artist.id}.svg`;
}

/** The address of a genre tile's art. */
export function genreArt(genre: Genre): string {
	return `${ART_ROOT}/genre-${genre.id}.svg`;
}

/** The art for the listener's Liked Songs, a fixed cover in the brand's ink. */
export const LIKED_ART = `${ART_ROOT}/liked-songs.svg`;

/** The Liked Songs cover's drawing. */
const LIKED_COVER: CoverSvg.Props = {
	id: "liked-songs",
	motif: "rings",
	palette: {
		ground: "oklch(0.45 0.2 262)",
		shape: "oklch(0.85 0.08 262)",
		spark: "oklch(0.92 0.12 95)",
	},
	lettering: { title: "Liked Songs" },
};

/**
 * Every art file the app serves, with the drawing each holds, keyed by the file name under
 * `public/demos/murmur/art/`.
 */
export function artFiles(): Array<{ file: string; node: RemixNode }> {
	return [
		...ALBUMS.map((entry) => ({
			file: `album-${entry.id}.svg`,
			node: <CoverSvg id={entry.id} motif={entry.motif} palette={entry.palette} />,
		})),
		...PLAYLISTS.map((playlist) => ({
			file: `playlist-${playlist.id}.svg`,
			node: (
				<CoverSvg
					id={playlist.id}
					motif={playlist.motif}
					palette={playlist.palette}
					lettering={playlist.mine ? undefined : { title: playlist.title, kicker: "Murmur" }}
				/>
			),
		})),
		...GENRES.map((genre) => ({
			file: `genre-${genre.id}.svg`,
			node: (
				<CoverSvg
					id={`genre-${genre.id}`}
					motif={genre.motif}
					palette={{
						ground: genre.color,
						shape: "oklch(0.97 0.02 90 / 0.85)",
						spark: "oklch(0.2 0.03 260)",
					}}
				/>
			),
		})),
		...ARTISTS.map((artist) => ({
			file: `artist-${artist.id}.svg`,
			node: <PortraitSvg artist={artist} />,
		})),
		{ file: "liked-songs.svg", node: <CoverSvg {...LIKED_COVER} /> },
	];
}
