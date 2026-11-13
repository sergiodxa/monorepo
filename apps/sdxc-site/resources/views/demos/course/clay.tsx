/**
 * Centered's drawings, all in SVG: the lesson camera's frame of clay on a wheel under one
 * warm lamp, in the state each chapter reaches, and the pots a student can throw after each
 * module, glazed or bare. The page ships no picture that is not drawn here.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";

import type { ClayState, PotShape } from "~/resources/views/demos/course/data";

/** Wet terracotta, the clay the course throws, lit from the left. */
const CLAY = {
	light: "oklch(0.68 0.12 48)",
	base: "oklch(0.56 0.12 42)",
	shade: "oklch(0.42 0.1 38)",
};

/** Hands in the frame: slip-covered skin, the same warmth as the clay but paler. */
const HAND = "oklch(0.74 0.06 50)";

/** The clay's outline in each chapter, standing on the wheel head at y = 132. */
const CLAY_PATHS: Record<ClayState, string> = {
	lump: "M116 132C114 114 126 100 148 97C172 94 199 103 203 120L204 132Z",
	"cone-up": "M128 132C136 110 148 72 160 50C172 72 184 110 192 132Z",
	"cone-down": "M114 132C114 116 126 104 160 101C194 104 206 116 206 132Z",
	brace: "M120 132C120 108 138 96 160 96C182 96 200 108 200 132Z",
	still: "M120 132C120 108 138 96 160 96C182 96 200 108 200 132Z",
	wobble: "M118 132C119 107 140 95 163 97C184 99 201 111 201 132Z",
	dome: "M120 132C120 108 138 96 160 96C182 96 200 108 200 132Z",
};

/** Props for {@link WheelFrame}. */
interface WheelFrameProps {
	/** Where the clay stands in this frame. */
	clay: ClayState;
	/** Unique on the page; seeds the frame's gradient ids. */
	id: string;
}

/**
 * The overhead-angle frame the lessons are filmed in: a dark studio, one lamp, the splash
 * pan and wheel head, the clay in the given state and the hands doing what the chapter
 * teaches. It is drawn at 16:9 and scales to any size, from a chapter still to the screen.
 *
 * @param handle Runtime handle carrying the clay state and the id seed.
 * @returns The render function producing the frame.
 */
export function WheelFrame(handle: Handle<WheelFrameProps>) {
	return () => {
		let { clay, id } = handle.props;
		let lamp = `${id}-lamp`;
		let body = `${id}-clay`;
		return (
			<svg
				viewBox="0 0 320 180"
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
				mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<radialGradient id={lamp} cx="0.42" cy="0.18" r="0.8">
						<stop offset="0" stop-color="oklch(0.46 0.06 60)" />
						<stop offset="0.55" stop-color="oklch(0.22 0.025 50)" />
						<stop offset="1" stop-color="oklch(0.12 0.01 40)" />
					</radialGradient>
					<linearGradient id={body} x1="0" x2="1" y1="0" y2="0">
						<stop offset="0" stop-color={CLAY.light} />
						<stop offset="0.55" stop-color={CLAY.base} />
						<stop offset="1" stop-color={CLAY.shade} />
					</linearGradient>
				</defs>
				<rect width="320" height="180" fill={`url(#${lamp})`} />
				<ellipse cx="160" cy="146" rx="132" ry="26" fill="oklch(0.2 0.012 50)" />
				<ellipse cx="160" cy="141" rx="110" ry="19" fill="oklch(0.15 0.01 50)" />
				<ellipse cx="160" cy="135" rx="74" ry="11" fill="oklch(0.48 0.008 60)" />
				<ellipse cx="160" cy="133" rx="74" ry="10" fill="oklch(0.36 0.008 60)" />
				{clay === "wobble" ? (
					<path
						d={CLAY_PATHS.wobble}
						transform="translate(-6 0)"
						fill="none"
						stroke={CLAY.light}
						stroke-opacity="0.35"
						stroke-dasharray="3 3"
					/>
				) : null}
				<path d={CLAY_PATHS[clay]} fill={`url(#${body})`} />
				<g fill="none" stroke="white" stroke-opacity="0.16" stroke-width="1">
					<path d="M128 124Q160 128 192 124" />
					<path d="M134 114Q160 118 186 114" />
				</g>
				<Hands clay={clay} />
			</svg>
		);
	};
}

/**
 * The hands each chapter shows: both squeezing the cone, the right heel pressing it down,
 * both braced at the sides, one still finger, and none while the clay is shown alone.
 *
 * @param handle Runtime handle carrying the clay state.
 * @returns The render function producing the hands, or nothing.
 */
function Hands(handle: Handle<{ clay: ClayState }>) {
	return () => {
		switch (handle.props.clay) {
			case "cone-up":
				return (
					<g fill={HAND}>
						<rect x="104" y="104" width="34" height="18" rx="9" transform="rotate(-24 121 113)" />
						<rect x="182" y="104" width="34" height="18" rx="9" transform="rotate(24 199 113)" />
					</g>
				);
			case "cone-down":
				return (
					<g fill={HAND}>
						<rect x="150" y="78" width="46" height="22" rx="11" transform="rotate(-8 173 89)" />
					</g>
				);
			case "brace":
				return (
					<g fill={HAND}>
						<rect x="88" y="104" width="40" height="20" rx="10" />
						<rect x="192" y="104" width="40" height="20" rx="10" />
					</g>
				);
			case "still":
				return (
					<g fill={HAND}>
						<rect x="200" y="104" width="38" height="8" rx="4" />
						<circle cx="201" cy="108" r="1.5" fill="oklch(0.85 0.05 60)" />
					</g>
				);
			default:
				return null;
		}
	};
}

/**
 * The second camera, straight down over the wheel: the splash pan and wheel head as
 * rings, the centered clay as a disc with its throwing rings, one still finger at its edge,
 * the angle that shows whether the clay runs true.
 *
 * @param handle Runtime handle carrying the id seed.
 * @returns The render function producing the frame.
 */
export function OverheadFrame(handle: Handle<{ id: string }>) {
	return () => {
		let lamp = `${handle.props.id}-lamp`;
		let body = `${handle.props.id}-clay`;
		return (
			<svg
				viewBox="0 0 320 180"
				preserveAspectRatio="xMidYMid slice"
				aria-hidden="true"
				mix={[raw({ display: "block", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<radialGradient id={lamp} cx="0.5" cy="0.5" r="0.7">
						<stop offset="0" stop-color="oklch(0.36 0.04 60)" />
						<stop offset="1" stop-color="oklch(0.12 0.01 40)" />
					</radialGradient>
					<radialGradient id={body} cx="0.4" cy="0.4" r="0.7">
						<stop offset="0" stop-color={CLAY.light} />
						<stop offset="1" stop-color={CLAY.shade} />
					</radialGradient>
				</defs>
				<rect width="320" height="180" fill={`url(#${lamp})`} />
				<circle cx="160" cy="90" r="84" fill="oklch(0.2 0.012 50)" />
				<circle cx="160" cy="90" r="70" fill="oklch(0.15 0.01 50)" />
				<circle cx="160" cy="90" r="52" fill="oklch(0.4 0.008 60)" />
				<circle cx="160" cy="90" r="34" fill={`url(#${body})`} />
				<g fill="none" stroke="white" stroke-opacity="0.18">
					<circle cx="160" cy="90" r="26" />
					<circle cx="160" cy="90" r="17" />
					<circle cx="160" cy="90" r="8" />
				</g>
				<rect x="194" y="86" width="40" height="8" rx="4" fill={HAND} />
			</svg>
		);
	};
}

/** The profile of each module's piece, standing on y = 90 of a 100×100 box. */
const POT_PATHS: Record<PotShape, string> = {
	ball: "M30 90C24 84 26 56 50 50C74 56 76 84 70 90Z",
	dome: "M24 90C24 66 36 56 50 56C64 56 76 66 76 90Z",
	cylinder: "M31 90L32 30Q50 27 68 30L69 90Z",
	bowl: "M12 42Q50 47 88 42Q86 76 61 86L59 90L41 90L39 86Q14 76 12 42Z",
	mug: "M30 90L30 40Q48 37 66 40L66 90Z",
	jar: "M35 90C20 82 18 56 34 46L36 38L64 38L66 46C82 56 80 82 65 90Z",
};

/** Where each open piece's rim sits, drawn as an ellipse in the glaze's darker step. */
const RIMS: Partial<Record<PotShape, { cx: number; cy: number; rx: number; ry: number }>> = {
	cylinder: { cx: 50, cy: 29.5, rx: 18, ry: 3 },
	bowl: { cx: 50, cy: 43, rx: 38, ry: 5 },
	mug: { cx: 48, cy: 39.5, rx: 18, ry: 3 },
};

/** Props for {@link Pot}. */
interface PotProps {
	shape: PotShape;
	/** The glaze over the top of the piece; the foot stays bare clay. Omit for a bare pot. */
	glaze?: string;
	/** Unique on the page; seeds the pot's clip id. */
	id: string;
	/** Lean the piece a few degrees, the honest wobble of a first attempt. */
	tilt?: number;
}

/**
 * One piece in profile: the clay body, the glaze dipped over all but the foot, a rim on
 * open forms, a handle on a mug and a lid on a jar.
 *
 * @param handle Runtime handle carrying the shape, glaze, id seed and tilt.
 * @returns The render function producing the pot.
 */
export function Pot(handle: Handle<PotProps>) {
	return () => {
		let { glaze, id, shape, tilt = 0 } = handle.props;
		let clip = `${id}-dip`;
		let rim = RIMS[shape];
		let ink = glaze ?? CLAY.base;
		return (
			<svg
				viewBox="0 0 100 100"
				aria-hidden="true"
				mix={[
					raw({ display: "block", inlineSize: "100%", blockSize: "100%", overflow: "visible" }),
				]}
			>
				<defs>
					<clipPath id={clip}>
						<path d={POT_PATHS[shape]} />
					</clipPath>
				</defs>
				<ellipse cx="50" cy="91" rx="30" ry="3" fill="black" opacity="0.12" />
				<g transform={`rotate(${tilt} 50 90)`}>
					{shape === "mug" ? (
						<path
							d="M65 50C82 50 84 76 65 78"
							fill="none"
							stroke={ink}
							stroke-width="6"
							stroke-linecap="round"
						/>
					) : null}
					<path d={POT_PATHS[shape]} fill={CLAY.base} />
					{glaze ? (
						<g clip-path={`url(#${clip})`}>
							<path d="M0 0H100V78Q75 83 50 79Q25 75 0 81Z" fill={glaze} />
						</g>
					) : null}
					<path d={POT_PATHS[shape]} fill="none" stroke="black" stroke-opacity="0.18" />
					{rim ? <ellipse {...rim} fill={`color-mix(in oklch, ${ink} 70%, black)`} /> : null}
					{shape === "jar" ? (
						<g fill={ink}>
							<path d="M35 38Q50 27 65 38Z" />
							<circle cx="50" cy="29" r="3.5" />
						</g>
					) : null}
					<g clip-path={`url(#${clip})`}>
						<path
							d="M38 82Q35 62 40 40"
							stroke="white"
							stroke-opacity="0.25"
							stroke-width="2.5"
							fill="none"
						/>
					</g>
				</g>
			</svg>
		);
	};
}
