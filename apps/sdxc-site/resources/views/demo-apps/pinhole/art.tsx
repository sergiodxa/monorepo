/**
 * Pinhole's pictures, all drawn: each photograph is a scene of a few flat shapes placed by a
 * seeded random walk, so the same post always looks the same, and avatars are a person's two
 * hues with their initials. A moving scene drifts while its reel or story plays.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionReduce } from "@sdxc/u/responsive";
import { when } from "@sdxc/u/state";

import type { Person, Photo } from "./data";

/** The keyframes a moving scene drifts by: a slow push in and a sideways pan. */
const DRIFT = "pinhole-drift";

/** The keyframes a moving scene's light sweeps by. */
const SWEEP = "pinhole-sweep";

/**
 * A small deterministic random source, so a seed always draws the same scene.
 *
 * @param seed Any integer.
 * @returns A function giving the next number in [0, 1).
 */
export function seeded(seed: number): () => number {
	let state = (seed * 2654435761) >>> 0;
	return () => {
		state = (state + 0x6d2b79f5) >>> 0;
		let t = state;
		t = Math.imul(t ^ (t >>> 15), t | 1);
		t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
		return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
	};
}

/** Rounds a coordinate to one decimal, which keeps the markup short. */
function r(value: number): number {
	return Math.round(value * 10) / 10;
}

/** The shapes of one scene, inside a 100×100 box the picture crops to its frame. */
function sceneShapes(photo: Photo): RemixNode {
	let random = seeded(photo.seed);
	let [, ground, subject, ink] = photo.palette;
	let pick = (min: number, max: number) => min + random() * (max - min);
	switch (photo.scene) {
		case "dunes": {
			let ridges = [0, 1, 2, 3].map((index) => {
				let y = 52 + index * 12 + pick(-3, 3);
				let lift = pick(6, 14);
				return (
					<path
						d={`M0 ${r(y)} Q${r(pick(20, 45))} ${r(y - lift)} ${r(pick(55, 70))} ${r(y - 2)} T100 ${r(y - pick(0, 6))} V100 H0Z`}
						fill={index % 2 === 0 ? ground : subject}
						opacity={String(0.55 + index * 0.15)}
					/>
				);
			});
			return (
				<>
					<circle cx={r(pick(20, 80))} cy={r(pick(18, 30))} r="9" fill={subject} opacity="0.85" />
					{ridges}
				</>
			);
		}
		case "harbor": {
			let boats = [0, 1, 2].map((index) => {
				let x = 18 + index * 26 + pick(-5, 5);
				let mast = pick(26, 38);
				return (
					<g>
						<path d={`M${r(x - 8)} 66 H${r(x + 8)} L${r(x + 5)} 71 H${r(x - 5)}Z`} fill={ink} />
						<path d={`M${r(x)} 65 V${r(65 - mast)}`} stroke={ink} stroke-width="0.8" />
						<path
							d={`M${r(x + 0.5)} ${r(66 - mast)} L${r(x + 9)} 63 H${r(x + 0.5)}Z`}
							fill={subject}
							opacity="0.9"
						/>
					</g>
				);
			});
			return (
				<>
					<rect y="66" width="100" height="34" fill={ground} />
					{[72, 79, 87, 95].map((y) => (
						<path
							d={`M${r(pick(0, 30))} ${y} H${r(pick(55, 100))}`}
							stroke={subject}
							stroke-width="0.6"
							opacity="0.45"
						/>
					))}
					{boats}
					<rect width="100" height="100" fill={subject} opacity="0.12" />
				</>
			);
		}
		case "peaks": {
			let peaks = [0, 1, 2].map((index) => {
				let x = 10 + index * 38 + pick(-8, 8);
				let top = 22 + pick(0, 18) + index * 4;
				let width = pick(38, 54);
				return (
					<g>
						<path
							d={`M${r(x - width / 2)} 100 L${r(x)} ${r(top)} L${r(x + width / 2)} 100Z`}
							fill={index === 1 ? ink : ground}
						/>
						<path
							d={`M${r(x - 7)} ${r(top + 12)} L${r(x)} ${r(top)} L${r(x + 7)} ${r(top + 12)} L${r(x + 2)} ${r(top + 9)} L${r(x - 2)} ${r(top + 13)}Z`}
							fill={subject}
						/>
					</g>
				);
			});
			return (
				<>
					{isNight(photo.palette[0])
						? Array.from({ length: 18 }, () => (
								<circle
									cx={r(pick(0, 100))}
									cy={r(pick(0, 45))}
									r={r(pick(0.3, 0.8))}
									fill={subject}
								/>
							))
						: null}
					{peaks}
				</>
			);
		}
		case "city": {
			let blocks = Array.from({ length: 7 }, (_, index) => {
				let x = index * 15 - pick(0, 4);
				let top = pick(28, 62);
				let width = pick(11, 17);
				let lit = Array.from({ length: 8 }, () => ({
					x: x + 2 + Math.floor(pick(0, (width - 4) / 3)) * 3,
					y: top + 3 + Math.floor(pick(0, (96 - top) / 5)) * 5,
				}));
				return (
					<g>
						<rect
							x={r(x)}
							y={r(top)}
							width={r(width)}
							height={r(100 - top)}
							fill={index % 2 ? ink : ground}
						/>
						{lit.map((window) => (
							<rect
								x={r(window.x)}
								y={r(window.y)}
								width="1.6"
								height="2.4"
								fill={subject}
								opacity="0.9"
							/>
						))}
					</g>
				);
			});
			return (
				<>
					<circle cx={r(pick(15, 85))} cy={r(pick(12, 22))} r="5" fill={subject} opacity="0.7" />
					{blocks}
				</>
			);
		}
		case "still-life": {
			let things = [0, 1, 2].map((index) => {
				let x = 25 + index * 24 + pick(-4, 4);
				let height = pick(18, 34);
				return index === 1 ? (
					<path
						d={`M${r(x - 6)} 70 C${r(x - 12)} ${r(70 - height / 2)} ${r(x - 4)} ${r(70 - height)} ${r(x - 3)} ${r(68 - height)} H${r(x + 3)} C${r(x + 4)} ${r(70 - height)} ${r(x + 12)} ${r(70 - height / 2)} ${r(x + 6)} 70Z`}
						fill={subject}
					/>
				) : (
					<ellipse
						cx={r(x)}
						cy={r(70 - height / 4)}
						rx={r(height / 3)}
						ry={r(height / 4)}
						fill={index ? ink : subject}
						opacity="0.85"
					/>
				);
			});
			return (
				<>
					<rect y="70" width="100" height="30" fill={ground} />
					<path d="M0 70 H100" stroke={ink} stroke-width="0.6" opacity="0.4" />
					{things}
					<rect x={r(pick(60, 80))} y="8" width="18" height="34" fill="white" opacity="0.18" />
				</>
			);
		}
		case "ferns": {
			let fronds = Array.from({ length: 6 }, (_, index) => {
				let x = pick(5, 95);
				let lean = pick(-25, 25);
				let length = pick(45, 80);
				let tip = { x: x + lean, y: 100 - length };
				let leaves = Array.from({ length: 9 }, (_, step) => {
					let t = (step + 1) / 10;
					let px = x + lean * t;
					let py = 100 - length * t;
					let size = (1 - t) * 9 + 2;
					return (
						<path
							d={`M${r(px)} ${r(py)} l${r(-size)} ${r(-size / 2)} M${r(px)} ${r(py)} l${r(size)} ${r(-size / 2)}`}
							stroke={index % 2 ? subject : ground}
							stroke-width="1.6"
							stroke-linecap="round"
						/>
					);
				});
				return (
					<g>
						<path
							d={`M${r(x)} 100 Q${r(x + lean / 3)} ${r(100 - length / 2)} ${r(tip.x)} ${r(tip.y)}`}
							stroke={ink}
							stroke-width="0.8"
							fill="none"
						/>
						{leaves}
					</g>
				);
			});
			return <>{fronds}</>;
		}
		case "tiles": {
			let size = 25;
			let motif = Math.floor(pick(0, 3));
			return (
				<>
					{Array.from({ length: 16 }, (_, index) => {
						let x = (index % 4) * size;
						let y = Math.floor(index / 4) * size;
						let turn = (index + motif) % 2 === 0;
						return (
							<g>
								<rect
									x={x + 0.6}
									y={y + 0.6}
									width={size - 1.2}
									height={size - 1.2}
									fill={photo.palette[0]}
									stroke={ink}
									stroke-width="0.4"
								/>
								<TileMotif motif={motif} x={x} y={y} size={size} color={ground} />
								<path
									d={
										turn
											? `M${x + 2} ${y + 2} l5 0 l-5 5Z`
											: `M${x + size - 2} ${y + size - 2} l-5 0 l5 -5Z`
									}
									fill={subject}
								/>
							</g>
						);
					})}
				</>
			);
		}
		case "bowls": {
			let bowls = Array.from({ length: 4 }, (_, index) => {
				let x = 14 + index * 24 + pick(-3, 3);
				let width = pick(9, 12);
				let y = 62 + (index % 2) * 4;
				return (
					<g>
						<path
							d={`M${r(x - width)} ${y} Q${r(x)} ${r(y + width * 1.4)} ${r(x + width)} ${y}Z`}
							fill={index % 2 ? subject : ink}
						/>
						<ellipse
							cx={r(x)}
							cy={y}
							rx={r(width)}
							ry="1.8"
							fill={photo.palette[0]}
							opacity="0.7"
						/>
						{Array.from({ length: 5 }, () => (
							<circle
								cx={r(x + pick(-width * 0.6, width * 0.6))}
								cy={r(y + pick(2, width * 0.7))}
								r="0.5"
								fill={photo.palette[0]}
								opacity="0.7"
							/>
						))}
					</g>
				);
			});
			return (
				<>
					<rect y="72" width="100" height="28" fill={ground} />
					{bowls}
				</>
			);
		}
		case "loaves": {
			let loaves = Array.from({ length: 3 }, (_, index) => {
				let x = 22 + index * 28 + pick(-3, 3);
				let y = 56 + (index % 2) * 10;
				let width = pick(11, 14);
				return (
					<g>
						<ellipse cx={r(x)} cy={r(y)} rx={r(width)} ry={r(width * 0.62)} fill={subject} />
						<path
							d={`M${r(x - width * 0.55)} ${r(y + 1)} Q${r(x)} ${r(y - width * 0.5)} ${r(x + width * 0.55)} ${r(y - 1)}`}
							stroke={photo.palette[0]}
							stroke-width="1.6"
							fill="none"
							stroke-linecap="round"
						/>
						<ellipse
							cx={r(x - 3)}
							cy={r(y - 3)}
							rx={r(width * 0.4)}
							ry="1.6"
							fill="white"
							opacity="0.25"
						/>
					</g>
				);
			});
			return (
				<>
					<rect y="40" width="100" height="60" fill={ground} />
					{Array.from({ length: 20 }, () => (
						<circle
							cx={r(pick(0, 100))}
							cy={r(pick(42, 100))}
							r={r(pick(0.3, 0.9))}
							fill="white"
							opacity="0.35"
						/>
					))}
					{loaves}
				</>
			);
		}
		case "road": {
			let bend = pick(30, 70);
			return (
				<>
					<path
						d={`M0 ${r(pick(48, 58))} Q30 ${r(pick(38, 48))} 60 ${r(pick(44, 52))} T100 ${r(pick(40, 50))} V100 H0Z`}
						fill={ink}
						opacity="0.55"
					/>
					<path d="M0 62 H100 V100 H0Z" fill={ground} />
					<path
						d={`M${r(bend)} 62 C${r(bend + 10)} 72 ${r(bend - 30)} 82 40 100 H66 C${r(bend)} 84 ${r(bend + 16)} 72 ${r(bend + 2)} 62Z`}
						fill={photo.palette[0]}
						opacity="0.9"
					/>
					<circle cx={r(pick(15, 85))} cy={r(pick(15, 28))} r="6" fill={subject} opacity="0.8" />
					{Array.from({ length: 6 }, (_, index) => (
						<path
							d={`M${r(index * 18 + pick(0, 6))} 62 v${r(-pick(5, 10))}`}
							stroke={ink}
							stroke-width="2"
							stroke-linecap="round"
						/>
					))}
				</>
			);
		}
		case "waves": {
			let crest = pick(35, 55);
			return (
				<>
					<path
						d={`M0 ${r(crest + 10)} C25 ${r(crest - 8)} 45 ${r(crest - 12)} 62 ${r(crest + 4)} S90 ${r(crest + 20)} 100 ${r(crest + 12)} V100 H0Z`}
						fill={ground}
					/>
					<path
						d={`M48 ${r(crest - 6)} C58 ${r(crest - 10)} 66 ${r(crest - 2)} 64 ${r(crest + 6)} C60 ${r(crest)} 54 ${r(crest - 2)} 48 ${r(crest - 6)}Z`}
						fill={subject}
					/>
					{[0, 1, 2, 3].map((index) => (
						<path
							d={`M0 ${r(crest + 22 + index * 9)} Q25 ${r(crest + 18 + index * 9)} 50 ${r(crest + 23 + index * 9)} T100 ${r(crest + 20 + index * 9)}`}
							stroke={subject}
							stroke-width="1.2"
							fill="none"
							opacity={String(0.7 - index * 0.12)}
						/>
					))}
					<path
						d={`M0 100 V${r(crest + 50)} Q50 ${r(crest + 40)} 100 ${r(crest + 48)} V100Z`}
						fill={ink}
						opacity="0.5"
					/>
				</>
			);
		}
		case "arch": {
			let x = pick(32, 50);
			return (
				<>
					<rect width="100" height="100" fill={ground} opacity="0.45" />
					<path d={`M${r(x)} 70 V36 A14 14 0 0 1 ${r(x + 28)} 36 V70Z`} fill={subject} />
					<path
						d={`M${r(x + 14)} 22 V70 M${r(x)} 46 H${r(x + 28)}`}
						stroke={ink}
						stroke-width="0.8"
						opacity="0.6"
					/>
					<path
						d={`M${r(x)} 70 L${r(x - 30)} 100 H${r(x + 50)} L${r(x + 28)} 70Z`}
						fill={subject}
						opacity="0.55"
					/>
					{Array.from({ length: 6 }, (_, index) => (
						<path
							d={`M0 ${78 + index * 4} H${r(36 - index * 6)} V${82 + index * 4}`}
							stroke={ink}
							stroke-width="0.7"
							fill="none"
							opacity="0.5"
						/>
					))}
				</>
			);
		}
	}
}

/**
 * One of the three motifs a tile study repeats across its grid: a diamond, a ring or a star,
 * centred in its tile.
 */
function TileMotif(
	handle: Handle<{ motif: number; x: number; y: number; size: number; color: string }>,
) {
	return () => {
		let { color, motif, size, x, y } = handle.props;
		let cx = x + size / 2;
		let cy = y + size / 2;
		if (motif === 1) {
			return <circle cx={cx} cy={cy} r="7.5" fill="none" stroke={color} stroke-width="3" />;
		}
		let d =
			motif === 0
				? `M${cx} ${y + 3} L${x + size - 3} ${cy} L${cx} ${y + size - 3} L${x + 3} ${cy}Z`
				: `M${cx} ${y + 4} L${cx + 3} ${cy - 3} L${x + size - 4} ${cy} L${cx + 3} ${cy + 3} L${cx} ${y + size - 4} L${cx - 3} ${cy + 3} L${x + 4} ${cy} L${cx - 3} ${cy - 3}Z`;
		return <path d={d} fill={color} />;
	};
}

/**
 * Whether a colour is a night sky, read from an `oklch()` lightness under one half, which
 * puts stars in a mountain scene.
 */
function isNight(color: string): boolean {
	let lightness = Number(/oklch\(([\d.]+)/.exec(color)?.[1] ?? "1");
	return lightness < 0.5;
}

namespace PhotoArt {
	export interface Props {
		photo: Photo;
		/** Hides the picture from assistive tech where the text beside it already says what it shows. */
		decorative?: boolean;
		/** Drifts slowly while an ancestor reel or story plays. */
		moving?: boolean;
	}
}

/**
 * One drawn photograph filling its box: the scene's sky as a gradient, the shapes over it
 * cropped to the frame, and a faint grain of light so flat colour reads as a print.
 */
export function PhotoArt(handle: Handle<PhotoArt.Props>) {
	return () => {
		let { decorative = false, moving = false, photo } = handle.props;
		let [sky, ground, subject] = photo.palette;
		return (
			<div
				role={decorative ? undefined : "img"}
				aria-label={decorative ? undefined : photo.alt}
				aria-hidden={decorative ? "true" : undefined}
				data-photo-art=""
				mix={[
					raw({
						position: "relative",
						display: "block",
						inlineSize: "100%",
						blockSize: "100%",
						overflow: "hidden",
						background: `linear-gradient(170deg, ${sky}, color-mix(in oklch, ${sky} 70%, ${ground}))`,
						"& > svg": { position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" },
					}),
					...(moving
						? [
								keyframes(DRIFT, {
									from: { transform: "scale(1.04) translateX(-2%)" },
									to: { transform: "scale(1.16) translateX(3%)" },
								}),
								keyframes(SWEEP, {
									from: { transform: "translateX(-120%) skewX(-12deg)" },
									to: { transform: "translateX(220%) skewX(-12deg)" },
								}),
								raw({
									"& > svg": {
										animation: `${DRIFT} 14s ease-in-out infinite alternate`,
										animationPlayState: "paused",
									},
									"&::after": {
										content: '""',
										position: "absolute",
										insetBlock: "0",
										inlineSize: "45%",
										background: `linear-gradient(90deg, transparent, color-mix(in oklch, ${subject} 30%, transparent), transparent)`,
										animation: `${SWEEP} 6s ease-in-out infinite`,
										animationPlayState: "paused",
									},
								}),
								when(
									"[data-reel-active]:not([data-reel-paused]) &, [data-story-active]:not([data-story-paused] *) [data-current] &",
									raw({
										"& > svg": { animationPlayState: "running" },
										"&::after": { animationPlayState: "running" },
									}),
								),
								motionReduce(
									raw({ "& > svg": { animation: "none" }, "&::after": { display: "none" } }),
								),
							]
						: []),
				]}
			>
				<svg viewBox="0 0 100 100" preserveAspectRatio="xMidYMid slice" aria-hidden="true">
					{sceneShapes(photo)}
				</svg>
			</div>
		);
	};
}

namespace PersonAvatar {
	export interface Props {
		person: Person;
		/** The side in rem, or a CSS length for a size that changes with the screen. Default: `2`. */
		size?: number | string;
	}
}

/**
 * A person's avatar: a disc in their two hues with their initials, so faces are told apart by
 * colour at a glance and by letters up close. Decorative, since a name always sits beside it.
 */
export function PersonAvatar(handle: Handle<PersonAvatar.Props>) {
	return () => {
		let { person, size = 2 } = handle.props;
		let side = typeof size === "number" ? `${size}rem` : size;
		let [from, to] = person.hues;
		let initials = person.name
			.split(" ")
			.map((part) => part[0])
			.slice(0, 2)
			.join("");
		return (
			<span
				aria-hidden="true"
				data-person-avatar=""
				mix={[
					raw({
						display: "inline-grid",
						placeItems: "center",
						flexShrink: "0",
						inlineSize: side,
						blockSize: side,
						borderRadius: "999px",
						background: `radial-gradient(circle at 30% 25%, oklch(0.86 0.1 ${from}), oklch(0.58 0.14 ${to}))`,
						color: "oklch(0.99 0.01 80)",
						fontSize: `calc(${side} * 0.38)`,
						fontWeight: "650",
						letterSpacing: "0.02em",
						textShadow: "0 1px 1px rgb(0 0 0 / 0.25)",
						userSelect: "none",
					}),
				]}
			>
				{initials}
			</span>
		);
	};
}

/**
 * Pinhole's mark: the plate of a pinhole camera, a square ring with one bright point of light
 * in it, set in the brand's safelight red.
 */
export function PinholeMark(handle: Handle<{ size?: number }>) {
	return () => {
		let size = handle.props.size ?? 28;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
				<rect
					x="3"
					y="3"
					width="26"
					height="26"
					rx="7"
					fill="none"
					stroke="currentColor"
					stroke-width="3"
				/>
				<circle
					cx="16"
					cy="16"
					r="6.5"
					fill="none"
					stroke="currentColor"
					stroke-width="2"
					opacity="0.45"
				/>
				<circle cx="16" cy="16" r="2.6" fill="var(--ui-color-brand-500)" />
			</svg>
		);
	};
}
