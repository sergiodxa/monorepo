/**
 * Hollyhock's hand-drawn texture: the bakes, the shop front and the mark as SVG with a
 * cocoa outline, plus gingham, scallop and flour-dust fills drawn with CSS gradients, so
 * every picture on the page is made in code and keeps its colours in both themes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

/** The outline every drawing is inked with: dark cocoa, so stickers read on cream and on cocoa. */
export const INK = "oklch(0.3 0.04 45)";

/** Crust, from pale top to deep bottom. */
export const CRUST = "oklch(0.72 0.12 62)";
export const CRUST_DEEP = "oklch(0.58 0.12 50)";

/** Butter yellow, for crumb, custard and the awning's light stripe. */
export const BUTTER = "oklch(0.92 0.09 92)";

/** Sage, for leaves, the door and the park on the map. */
export const SAGE = "oklch(0.74 0.07 145)";

/** Berry, for jam, hollyhock petals and the pin on the map. */
export const BERRY = "oklch(0.58 0.16 8)";

/** Cream, for plates, cups and window light. */
export const CREAM = "oklch(0.97 0.02 85)";

/**
 * A gingham cloth: two crossing bands of `colour` whose overlap darkens, the pattern of a
 * bakery's tea towel.
 *
 * @param colour Any CSS colour; it is laid at low strength so text over it stays legible.
 * @param size The width of one check.
 * @param strength How much of `colour` each band carries, in percent.
 */
export function gingham(colour: string, size = "1.25rem", strength = 16) {
	let band = `color-mix(in oklch, ${colour} ${strength}%, transparent)`;
	return raw({
		backgroundImage: [
			`repeating-linear-gradient(90deg, ${band} 0 ${size}, transparent ${size} calc(${size} * 2))`,
			`repeating-linear-gradient(0deg, ${band} 0 ${size}, transparent ${size} calc(${size} * 2))`,
		].join(", "),
	});
}

/**
 * Cuts a scalloped hem into an element's bottom edge, like an awning's or a doily's.
 *
 * @param radius The radius of one scallop.
 */
export function scallopHem(radius = "0.75rem") {
	let mask = [
		`radial-gradient(circle at 50% 0, #000 calc(${radius} - 0.5px), transparent ${radius}) 50% 100% / calc(${radius} * 2) ${radius} repeat-x`,
		`linear-gradient(#000, #000) 0 0 / 100% calc(100% - ${radius}) no-repeat`,
	].join(", ");
	return raw({ mask, WebkitMask: mask, paddingBlockEnd: radius });
}

/** Sizes an SVG to its slot's width, keeping its own aspect ratio. */
function drawingSize(size: string | undefined) {
	return raw({
		display: "block",
		inlineSize: size ?? "100%",
		blockSize: "auto",
		overflow: "visible",
	});
}

/** The bakes the page draws, each a 120 by 90 scene with its own shadow. */
export type Bake = "loaf" | "croissant" | "bun" | "pie" | "cup" | "braid" | "focaccia";

/** Each bake's shape, drawn on the shared 120 by 90 grid. */
const SHAPES = {
	loaf: LoafShape,
	croissant: CroissantShape,
	bun: BunShape,
	pie: PieSliceShape,
	cup: CupShape,
	braid: BraidShape,
	focaccia: FocacciaShape,
} as const;

namespace Drawing {
	/** Which bake to draw, how wide, and its name when the copy beside it does not say it. */
	export interface Props {
		bake: Bake;
		label?: string;
		size?: string;
	}
}

/**
 * One bake as a standalone picture. With a `label` it is an image with that name; without
 * one it is decoration, because the text beside it already names the bake.
 */
export function Drawing(handle: Handle<Drawing.Props>) {
	return () => {
		let { bake, label, size } = handle.props;
		let Shape = SHAPES[bake];
		return (
			<svg
				viewBox="0 0 120 90"
				role={label ? "img" : undefined}
				aria-label={label}
				aria-hidden={label ? undefined : "true"}
				focusable="false"
				mix={[drawingSize(size)]}
			>
				<Shape />
			</svg>
		);
	};
}

/** A round country loaf with a scored cross and flour on top. */
function LoafShape() {
	return () => (
		<g>
			<ellipse cx="60" cy="80" rx="44" ry="6" fill={INK} opacity="0.12" />
			<path
				d="M14 62c0-24 20-42 46-42s46 18 46 42c0 10-8 16-20 16H34c-12 0-20-6-20-16Z"
				fill={CRUST}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M20 64c4 8 12 10 20 10h40c8 0 16-2 20-10"
				fill="none"
				stroke={CRUST_DEEP}
				stroke-width="5"
				opacity="0.6"
			/>
			<path
				d="M42 34c8 6 14 14 16 26M78 34c-8 6-14 14-16 26"
				fill="none"
				stroke={INK}
				stroke-width="3"
				stroke-linecap="round"
			/>
			<path
				d="M44 33c8 5 13 11 15 20M76 33c-7 5-12 11-14 20"
				fill="none"
				stroke={BUTTER}
				stroke-width="3"
				stroke-linecap="round"
				opacity="0.9"
			/>
			<circle cx="34" cy="44" r="1.6" fill={CREAM} />
			<circle cx="88" cy="46" r="1.6" fill={CREAM} />
			<circle cx="60" cy="28" r="1.4" fill={CREAM} />
		</g>
	);
}

/** A croissant, five ribs from tip to tip. */
function CroissantShape() {
	return () => (
		<g>
			<ellipse cx="60" cy="78" rx="46" ry="6" fill={INK} opacity="0.12" />
			<path
				d="M10 58c6-20 24-36 50-36s44 16 50 36c-6 6-14 8-20 4l-10 8H40l-10-8c-6 4-14 2-20-4Z"
				fill={CRUST}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M34 32c4 10 6 22 6 38M50 24c2 12 2 30 0 46M70 24c-2 12-2 30 0 46M86 32c-4 10-6 22-6 38"
				fill="none"
				stroke={INK}
				stroke-width="2.5"
				stroke-linecap="round"
			/>
			<path
				d="M54 30c1 8 1 16 0 24M66 30c-1 8-1 16 0 24"
				fill="none"
				stroke={BUTTER}
				stroke-width="3"
				stroke-linecap="round"
				opacity="0.8"
			/>
		</g>
	);
}

/** A cardamom bun: a knot spiralled from the middle, sugar on top. */
function BunShape() {
	return () => (
		<g>
			<ellipse cx="60" cy="80" rx="38" ry="6" fill={INK} opacity="0.12" />
			<path
				d="M22 54c0-20 17-36 38-36s38 16 38 36c0 14-14 22-38 22S22 68 22 54Z"
				fill={CRUST}
				stroke={INK}
				stroke-width="3"
			/>
			<path
				d="M60 48c-4 0-6-4-3-7 4-4 12-1 12 6 0 9-11 13-19 8-10-6-8-22 6-25 14-3 26 8 22 22"
				fill="none"
				stroke={INK}
				stroke-width="3"
				stroke-linecap="round"
			/>
			{[
				[40, 40],
				[48, 64],
				[78, 60],
				[84, 44],
				[66, 30],
			].map(([x, y]) => (
				<rect
					key={`${x}-${y}`}
					x={x}
					y={y}
					width="3"
					height="3"
					rx="0.6"
					fill={CREAM}
					transform={`rotate(20 ${x} ${y})`}
				/>
			))}
		</g>
	);
}

/** A slice of pie with a lattice top and filling showing at the cut. */
function PieSliceShape(handle: Handle<{ filling?: string }>) {
	return () => (
		<g>
			<ellipse cx="60" cy="80" rx="46" ry="6" fill={INK} opacity="0.12" />
			<path
				d="M14 62 96 24l12 34-94 18Z"
				fill={handle.props.filling ?? BERRY}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M14 62 96 24l4 12-84 34Z"
				fill={CRUST}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M40 52l8 10M58 44l8 12M76 36l8 12"
				stroke={INK}
				stroke-width="2.5"
				stroke-linecap="round"
			/>
			<path
				d="M14 62v14l94-18V58"
				fill="none"
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path d="M14 70l94-18" stroke={CRUST_DEEP} stroke-width="5" opacity="0.6" />
		</g>
	);
}

/** A cup of coffee in a cream mug, steam rising. */
function CupShape() {
	return () => (
		<g>
			<ellipse cx="56" cy="82" rx="36" ry="5" fill={INK} opacity="0.12" />
			<path
				d="M50 6c-6 6 6 10 0 18M64 6c-6 6 6 10 0 18"
				fill="none"
				stroke={INK}
				stroke-width="2.5"
				stroke-linecap="round"
				opacity="0.5"
			/>
			<path
				d="M28 30h56v26c0 14-12 24-28 24S28 70 28 56Z"
				fill={CREAM}
				stroke={INK}
				stroke-width="3"
				stroke-linejoin="round"
			/>
			<path
				d="M84 38h6c8 0 10 14 0 16h-7"
				fill="none"
				stroke={INK}
				stroke-width="3"
				stroke-linecap="round"
			/>
			<ellipse cx="56" cy="30" rx="28" ry="5" fill={CRUST_DEEP} stroke={INK} stroke-width="3" />
			<path d="M36 50h40" stroke={BERRY} stroke-width="4" stroke-linecap="round" />
		</g>
	);
}

/** A braided challah, three strands with seeds. */
function BraidShape() {
	return () => (
		<g>
			<ellipse cx="60" cy="78" rx="50" ry="6" fill={INK} opacity="0.12" />
			{[22, 40, 58, 76, 94].map((x, index) => (
				<ellipse
					key={x}
					cx={x}
					cy={index % 2 === 0 ? 54 : 50}
					rx="14"
					ry="18"
					transform={`rotate(${index % 2 === 0 ? -28 : 28} ${x} 52)`}
					fill={index % 2 === 0 ? CRUST : CRUST_DEEP}
					stroke={INK}
					stroke-width="3"
				/>
			))}
			{[30, 48, 66, 84].map((x) => (
				<circle key={x} cx={x} cy="44" r="1.4" fill={CREAM} />
			))}
		</g>
	);
}

/** A slab of focaccia, dimpled, with rosemary and tomato. */
function FocacciaShape() {
	return () => (
		<g>
			<ellipse cx="60" cy="80" rx="48" ry="6" fill={INK} opacity="0.12" />
			<rect
				x="14"
				y="30"
				width="92"
				height="44"
				rx="10"
				fill={BUTTER}
				stroke={INK}
				stroke-width="3"
			/>
			<rect x="14" y="58" width="92" height="16" rx="6" fill={CRUST} opacity="0.7" />
			{[
				[30, 42],
				[52, 48],
				[74, 40],
				[92, 50],
				[40, 58],
				[66, 60],
			].map(([x, y]) => (
				<circle key={`${x}-${y}`} cx={x} cy={y} r="2.5" fill={CRUST_DEEP} />
			))}
			<circle cx="58" cy="38" r="5" fill={BERRY} stroke={INK} stroke-width="2" />
			<circle cx="86" cy="62" r="5" fill={BERRY} stroke={INK} stroke-width="2" />
			<path
				d="M28 54l10-6M34 50l-2-5M34 50l5 1"
				stroke={SAGE}
				stroke-width="2.5"
				stroke-linecap="round"
			/>
			<path
				d="M72 52l10-6M78 48l-2-5M78 48l5 1"
				stroke={SAGE}
				stroke-width="2.5"
				stroke-linecap="round"
			/>
		</g>
	);
}

/** One hollyhock bloom: five round petals around a butter heart. */
function Bloom(handle: Handle<{ x: number; y: number; r: number; fill?: string }>) {
	return () => {
		let { fill, r, x, y } = handle.props;
		return (
			<g>
				{[0, 72, 144, 216, 288].map((angle) => (
					<circle
						key={angle}
						cx={x + Math.cos((angle * Math.PI) / 180) * r * 0.55}
						cy={y + Math.sin((angle * Math.PI) / 180) * r * 0.55}
						r={r * 0.55}
						fill={fill ?? BERRY}
						stroke={INK}
						stroke-width="2"
					/>
				))}
				<circle cx={x} cy={y} r={r * 0.3} fill={BUTTER} stroke={INK} stroke-width="1.5" />
			</g>
		);
	};
}

/** Hollyhock's mark: a bloom on a round loaf, the two things the bakery is named for. */
export function Mark(handle: Handle<{ size?: string }>) {
	return () => (
		<svg
			viewBox="0 0 48 48"
			aria-hidden="true"
			focusable="false"
			mix={[drawingSize(handle.props.size ?? "2.25rem")]}
		>
			<path
				d="M4 32c0-12 9-20 20-20s20 8 20 20c0 5-4 8-9 8H13c-5 0-9-3-9-8Z"
				fill={CRUST}
				stroke={INK}
				stroke-width="2.5"
			/>
			<path
				d="M16 26c3 2 5 5 6 10M32 26c-3 2-5 5-6 10"
				fill="none"
				stroke={INK}
				stroke-width="2"
				stroke-linecap="round"
			/>
			<Bloom x={24} y={13} r={10} />
		</svg>
	);
}

/** The shop name beside the mark, set in the sign face. */
export function Wordmark() {
	return () => (
		<span
			mix={[
				raw({
					display: "inline-flex",
					alignItems: "center",
					gap: "0.5rem",
					color: "var(--ui-neutral-fg-emphasis)",
				}),
			]}
		>
			<Mark />
			<span
				mix={[
					raw({
						fontFamily: "var(--ui-font-display)",
						fontWeight: "700",
						fontSize: "1.375rem",
						letterSpacing: "-0.01em",
						lineHeight: "1",
					}),
				]}
			>
				Hollyhock
			</span>
		</span>
	);
}

namespace Storefront {
	/** Whether the door sign reads open, and the hours chalked under it. */
	export interface Props {
		open: boolean;
		chalk: string;
	}
}

/**
 * The shop on Alder Street: a striped awning with a scalloped hem, two windows of bakes, a
 * sage door whose hanging sign turns with the real opening status, and hollyhocks by the wall.
 */
export function Storefront(handle: Handle<Storefront.Props>) {
	return () => {
		let { chalk, open } = handle.props;
		let stripes = Array.from({ length: 10 }, (_, index) => index);
		return (
			<svg
				viewBox="0 0 480 400"
				role="img"
				aria-label={`Hollyhock Bakery's shop front, the sign on the door turned to ${open ? "open" : "closed"}.`}
				mix={[drawingSize("100%")]}
			>
				<ellipse cx="240" cy="386" rx="230" ry="10" fill={INK} opacity="0.1" />
				<rect
					x="40"
					y="60"
					width="400"
					height="320"
					rx="10"
					fill={CREAM}
					stroke={INK}
					stroke-width="4"
				/>
				<rect
					x="40"
					y="60"
					width="400"
					height="44"
					rx="10"
					fill={CRUST_DEEP}
					stroke={INK}
					stroke-width="4"
				/>
				<text
					x="240"
					y="91"
					text-anchor="middle"
					font-size="26"
					font-weight="700"
					fill={CREAM}
					mix={[raw({ fontFamily: "var(--ui-font-display)" })]}
				>
					Hollyhock Bakery
				</text>
				<g>
					{stripes.map((index) => (
						<rect
							key={`stripe-${index}`}
							x={28 + index * 42.4}
							y="104"
							width="42.4"
							height="44"
							fill={index % 2 === 0 ? "var(--ui-color-brand-500)" : BUTTER}
						/>
					))}
					{stripes.map((index) => (
						<path
							key={`hem-${index}`}
							d={`M${28 + index * 42.4} 148a21.2 21.2 0 0 0 42.4 0`}
							fill={index % 2 === 0 ? "var(--ui-color-brand-500)" : BUTTER}
							stroke={INK}
							stroke-width="4"
						/>
					))}
					<rect x="28" y="104" width="424" height="44" fill="none" stroke={INK} stroke-width="4" />
				</g>
				<rect
					x="64"
					y="190"
					width="132"
					height="120"
					rx="6"
					fill="oklch(0.9 0.07 85)"
					stroke={INK}
					stroke-width="4"
				/>
				<rect
					x="284"
					y="190"
					width="132"
					height="120"
					rx="6"
					fill="oklch(0.9 0.07 85)"
					stroke={INK}
					stroke-width="4"
				/>
				<path d="M64 270h132M284 270h132" stroke={INK} stroke-width="3" />
				<g transform="translate(70 214) scale(0.6)">
					<LoafShape />
				</g>
				<g transform="translate(130 222) scale(0.5)">
					<BunShape />
				</g>
				<g transform="translate(290 214) scale(0.6)">
					<CroissantShape />
				</g>
				<g transform="translate(350 220) scale(0.52)">
					<PieSliceShape />
				</g>
				<rect
					x="212"
					y="186"
					width="56"
					height="194"
					rx="4"
					fill={SAGE}
					stroke={INK}
					stroke-width="4"
				/>
				<rect
					x="222"
					y="198"
					width="36"
					height="52"
					rx="3"
					fill="oklch(0.9 0.07 85)"
					stroke={INK}
					stroke-width="3"
				/>
				<circle cx="258" cy="292" r="4" fill={BUTTER} stroke={INK} stroke-width="2" />
				<path d="M226 254l14-12 14 12" fill="none" stroke={INK} stroke-width="2" />
				<g data-slot="door-sign">
					<rect
						x="214"
						y="254"
						width="52"
						height="24"
						rx="4"
						fill={open ? BUTTER : "var(--ui-color-neutral-200)"}
						stroke={INK}
						stroke-width="3"
					/>
					<text
						x="240"
						y="271"
						text-anchor="middle"
						font-size="13"
						font-weight="800"
						fill={INK}
						mix={[raw({ fontFamily: "var(--ui-font-sans)", letterSpacing: "0.04em" })]}
					>
						{open ? "OPEN" : "CLOSED"}
					</text>
				</g>
				<g transform="rotate(-4 120 340)">
					<rect
						x="76"
						y="320"
						width="92"
						height="56"
						rx="6"
						fill="oklch(0.3 0.03 150)"
						stroke={INK}
						stroke-width="4"
					/>
					<text
						x="122"
						y="342"
						text-anchor="middle"
						font-size="13"
						font-weight="700"
						fill={CREAM}
						mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
					>
						Today
					</text>
					<text
						x="122"
						y="362"
						text-anchor="middle"
						font-size="12"
						fill={CREAM}
						mix={[raw({ fontFamily: "var(--ui-font-sans)" })]}
					>
						{chalk}
					</text>
				</g>
				<path
					d="M442 380c-6-60-2-130 6-190M18 380c4-50 2-110-6-160"
					stroke={SAGE}
					stroke-width="5"
					fill="none"
					stroke-linecap="round"
				/>
				<path
					d="M444 300c10-6 18-4 22 2M446 250c-10-6-18-4-22 2M14 300c-10-6-18-4-22 2"
					stroke={SAGE}
					stroke-width="5"
					fill="none"
					stroke-linecap="round"
				/>
				<Bloom x={448} y={190} r={16} />
				<Bloom x={444} y={232} r={14} fill="oklch(0.78 0.1 350)" />
				<Bloom x={440} y={274} r={13} />
				<Bloom x={12} y={222} r={15} fill="oklch(0.78 0.1 350)" />
				<Bloom x={16} y={262} r={13} />
				<rect
					x="300"
					y="340"
					width="110"
					height="10"
					rx="4"
					fill={CRUST_DEEP}
					stroke={INK}
					stroke-width="3"
				/>
				<path d="M312 350v26M398 350v26" stroke={INK} stroke-width="4" stroke-linecap="round" />
			</svg>
		);
	};
}
