/**
 * The color-space math every `Color` operation stands on: sRGB transfer, Oklab and OKLCH,
 * HSL and HWB, CIE Lab and LCH, and the matrices that bring each `color()` space to linear
 * sRGB. Every function is pure and keeps values outside 0–1, so wide-gamut input survives.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** Three channels of one color space, in that space's channel order. */
export type Vector = [number, number, number];

/** A 3×3 matrix stored row by row. */
type Matrix = [Vector, Vector, Vector];

/**
 * The chroma below which an OKLCH color counts as achromatic, so its hue is powerless:
 * floating-point conversions leave grays a few millionths of chroma, never exactly zero.
 */
export const ACHROMATIC_CHROMA = 4e-6;

/** Linear sRGB to the LMS cone response Oklab is built on. */
const LINEAR_SRGB_TO_LMS: Matrix = [
	[0.4122214708, 0.5363325363, 0.0514459929],
	[0.2119034982, 0.6806995451, 0.1073969566],
	[0.0883024619, 0.2817188376, 0.6299787005],
];

/** Cube-rooted LMS to Oklab. */
const LMS_TO_OKLAB: Matrix = [
	[0.2104542553, 0.793617785, -0.0040720468],
	[1.9779984951, -2.428592205, 0.4505937099],
	[0.0259040371, 0.7827717662, -0.808675766],
];

/** Oklab to cube-rooted LMS, the exact inverse of `LMS_TO_OKLAB` so round trips stay tight. */
const OKLAB_TO_LMS: Matrix = [
	[0.9999999984505199, 0.39633779217376786, 0.2158037580607588],
	[1.0000000088817607, -0.10556134232365634, -0.0638541747717059],
	[1.000000054672411, -0.08948418209496577, -1.291485537864092],
];

/** LMS cone response to linear sRGB, the exact inverse of `LINEAR_SRGB_TO_LMS`. */
const LMS_TO_LINEAR_SRGB: Matrix = [
	[4.076741661347994, -3.3077115904081933, 0.23096992872942784],
	[-1.268438004092176, 2.6097574006633715, -0.34131939631021946],
	[-0.004196086541837046, -0.7034186144594494, 1.7076147009309446],
];

/** CIE XYZ relative to D65 to linear sRGB, derived from the sRGB primaries. */
const XYZ_D65_TO_LINEAR_SRGB: Matrix = [
	[3.2409699419045226, -1.537383177570094, -0.49861076029300344],
	[-0.9692436362808796, 1.8759675015077204, 0.0415550574071756],
	[0.05563007969699363, -0.2039769588889765, 1.0569715142428784],
];

/** CIE XYZ relative to D50 to linear sRGB, through the Bradford adaptation CSS uses. */
const XYZ_D50_TO_LINEAR_SRGB: Matrix = [
	[3.134135852900119, -1.6173859980180436, -0.49066221791109765],
	[-0.9787954765557777, 1.9162543773959888, 0.03344287339036693],
	[0.07195539255794739, -0.228976759815182, 1.4053860351131182],
];

/** Linear Display P3 to linear sRGB. */
const LINEAR_P3_TO_LINEAR_SRGB: Matrix = [
	[1.2249401762805596, -0.22494017628055984, 0],
	[-0.042056954709688066, 1.042056954709688, 0],
	[-0.019637554590334436, -0.07863604555063179, 1.0982736001409663],
];

/** Linear Adobe RGB (1998) to linear sRGB. */
const LINEAR_A98_TO_LINEAR_SRGB: Matrix = [
	[1.3983557439607786, -0.39835574396077855, 0],
	[0, 1, 0],
	[0, -0.04292898929447317, 1.0429289892944729],
];

/** Linear Rec. 2020 to linear sRGB. */
const LINEAR_REC2020_TO_LINEAR_SRGB: Matrix = [
	[1.6604910021084347, -0.5876411387885495, -0.07284986331988486],
	[-0.12455047452159052, 1.1328998971259598, -0.008349422604369487],
	[-0.01815076335490522, -0.10057889800800736, 1.1187296613629125],
];

/** Linear ProPhoto RGB, a D50 space, to linear sRGB. */
const LINEAR_PROPHOTO_TO_LINEAR_SRGB: Matrix = [
	[2.0343808495169964, -0.7276357899341352, -0.3067450595828619],
	[-0.22882573163305028, 1.2317425411901053, -0.002916809557054506],
	[-0.008558828783917382, -0.1532667021380372, 1.1618255309219545],
];

/** The D50 white point CIE Lab is relative to, as CSS defines it. */
const D50_WHITE: Vector = [0.3457 / 0.3585, 1, (1 - 0.3457 - 0.3585) / 0.3585];

/** CIE Lab's κ, the slope of the linear segment near black. */
const LAB_KAPPA = 24_389 / 27;

/** CIE Lab's ε, where the cube-root segment begins. */
const LAB_EPSILON = 216 / 24_389;

/** Rec. 2020's transfer constant α. */
const REC2020_ALPHA = 1.09929682680944;

/** Rec. 2020's transfer constant β. */
const REC2020_BETA = 0.018053968510807;

/** How one `color()` space reaches linear sRGB: its transfer function, then a matrix. */
export interface RgbSpace {
	toLinear(channel: number): number;
	matrix: Matrix | null;
}

/** The value itself, for spaces whose channels are already linear. */
function identity(channel: number): number {
	return channel;
}

/** Adobe RGB (1998)'s pure gamma of 563/256, mirrored for negative values. */
function a98ToLinear(channel: number): number {
	return Math.sign(channel) * Math.abs(channel) ** (563 / 256);
}

/** Rec. 2020's piecewise transfer, mirrored for negative values. */
function rec2020ToLinear(channel: number): number {
	let magnitude = Math.abs(channel);
	if (magnitude < REC2020_BETA * 4.5) return channel / 4.5;
	return Math.sign(channel) * ((magnitude + REC2020_ALPHA - 1) / REC2020_ALPHA) ** (1 / 0.45);
}

/** ProPhoto RGB's gamma of 1.8 with a linear toe, mirrored for negative values. */
function prophotoToLinear(channel: number): number {
	let magnitude = Math.abs(channel);
	if (magnitude <= 16 / 512) return channel / 16;
	return Math.sign(channel) * magnitude ** 1.8;
}

/**
 * Every predefined space `color()` accepts, keyed by its CSS name. `xyz` is CSS's alias of
 * `xyz-d65`, and a `null` matrix means the space is linear sRGB already.
 */
export const RGB_SPACES: Readonly<Record<string, RgbSpace>> = {
	srgb: { toLinear: srgbToLinear, matrix: null },
	"srgb-linear": { toLinear: identity, matrix: null },
	"display-p3": { toLinear: srgbToLinear, matrix: LINEAR_P3_TO_LINEAR_SRGB },
	"a98-rgb": { toLinear: a98ToLinear, matrix: LINEAR_A98_TO_LINEAR_SRGB },
	rec2020: { toLinear: rec2020ToLinear, matrix: LINEAR_REC2020_TO_LINEAR_SRGB },
	"prophoto-rgb": { toLinear: prophotoToLinear, matrix: LINEAR_PROPHOTO_TO_LINEAR_SRGB },
	xyz: { toLinear: identity, matrix: XYZ_D65_TO_LINEAR_SRGB },
	"xyz-d65": { toLinear: identity, matrix: XYZ_D65_TO_LINEAR_SRGB },
	"xyz-d50": { toLinear: identity, matrix: XYZ_D50_TO_LINEAR_SRGB },
};

/** `matrix × vector`. */
function multiply(matrix: Matrix, vector: Vector): Vector {
	return [
		matrix[0][0] * vector[0] + matrix[0][1] * vector[1] + matrix[0][2] * vector[2],
		matrix[1][0] * vector[0] + matrix[1][1] * vector[1] + matrix[1][2] * vector[2],
		matrix[2][0] * vector[0] + matrix[2][1] * vector[1] + matrix[2][2] * vector[2],
	];
}

/**
 * Decodes one gamma-encoded sRGB channel to linear light. The curve is mirrored around
 * zero, as CSS extends it, so a channel below 0 or above 1 keeps its meaning.
 */
export function srgbToLinear(channel: number): number {
	let magnitude = Math.abs(channel);
	if (magnitude <= 0.04045) return channel / 12.92;
	return Math.sign(channel) * ((magnitude + 0.055) / 1.055) ** 2.4;
}

/** Encodes one linear-light channel as gamma-encoded sRGB, mirrored around zero. */
export function linearToSrgb(channel: number): number {
	let magnitude = Math.abs(channel);
	if (magnitude <= 0.0031308) return channel * 12.92;
	return Math.sign(channel) * (1.055 * magnitude ** (1 / 2.4) - 0.055);
}

/** Converts a `color()` space's channels to gamma-encoded sRGB. */
export function rgbSpaceToSrgb(space: RgbSpace, channels: Vector): Vector {
	let linear: Vector = [
		space.toLinear(channels[0]),
		space.toLinear(channels[1]),
		space.toLinear(channels[2]),
	];
	let srgb = space.matrix === null ? linear : multiply(space.matrix, linear);
	return [linearToSrgb(srgb[0]), linearToSrgb(srgb[1]), linearToSrgb(srgb[2])];
}

/** Converts gamma-encoded sRGB to Oklab `[L, a, b]`. */
export function srgbToOklab(rgb: Vector): Vector {
	let lms = multiply(LINEAR_SRGB_TO_LMS, [
		srgbToLinear(rgb[0]),
		srgbToLinear(rgb[1]),
		srgbToLinear(rgb[2]),
	]);
	return multiply(LMS_TO_OKLAB, [Math.cbrt(lms[0]), Math.cbrt(lms[1]), Math.cbrt(lms[2])]);
}

/** Converts Oklab `[L, a, b]` to gamma-encoded sRGB, unclamped. */
export function oklabToSrgb(lab: Vector): Vector {
	let root = multiply(OKLAB_TO_LMS, lab);
	let linear = multiply(LMS_TO_LINEAR_SRGB, [root[0] ** 3, root[1] ** 3, root[2] ** 3]);
	return [linearToSrgb(linear[0]), linearToSrgb(linear[1]), linearToSrgb(linear[2])];
}

/** Wraps any angle into `[0, 360)`. */
export function normalizeHue(degrees: number): number {
	let hue = degrees % 360;
	return hue < 0 ? hue + 360 : hue;
}

/** Converts Oklab to OKLCH `[L, C, h]`, with a hue of 0 for an achromatic color. */
export function oklabToOklch(lab: Vector): Vector {
	let chroma = Math.hypot(lab[1], lab[2]);
	if (chroma < ACHROMATIC_CHROMA) return [lab[0], chroma, 0];
	return [lab[0], chroma, normalizeHue((Math.atan2(lab[2], lab[1]) * 180) / Math.PI)];
}

/** Converts OKLCH `[L, C, h]` to Oklab. */
export function oklchToOklab(lch: Vector): Vector {
	let radians = (lch[2] * Math.PI) / 180;
	return [lch[0], lch[1] * Math.cos(radians), lch[1] * Math.sin(radians)];
}

/**
 * Converts HSL to gamma-encoded sRGB. Hue is in degrees; saturation and lightness are 0–1.
 */
export function hslToSrgb(hue: number, saturation: number, lightness: number): Vector {
	let amount = saturation * Math.min(lightness, 1 - lightness);
	let channel = (offset: number): number => {
		let k = (offset + normalizeHue(hue) / 30) % 12;
		return lightness - amount * Math.max(-1, Math.min(k - 3, 9 - k, 1));
	};
	return [channel(0), channel(8), channel(4)];
}

/**
 * Converts gamma-encoded sRGB to HSL `[h, s, l]`, with hue in degrees and a hue of 0 for
 * a gray. The input is expected inside the sRGB gamut, which HSL cannot leave.
 */
export function srgbToHsl(rgb: Vector): Vector {
	let max = Math.max(...rgb);
	let min = Math.min(...rgb);
	let lightness = (max + min) / 2;
	let delta = max - min;
	if (delta < 1e-12) return [0, 0, lightness];

	let saturation =
		lightness === 0 || lightness === 1 ? 0 : (max - lightness) / Math.min(lightness, 1 - lightness);
	let hue = huePosition(rgb, max, delta) * 60;
	return [normalizeHue(hue), saturation, lightness];
}

/** Where the hue of `rgb` falls on the six-sector color wheel, as a sector position. */
function huePosition(rgb: Vector, max: number, delta: number): number {
	let [r, g, b] = rgb;
	if (max === r) return (g - b) / delta + (g < b ? 6 : 0);
	if (max === g) return (b - r) / delta + 2;
	return (r - g) / delta + 4;
}

/**
 * Converts HWB to gamma-encoded sRGB. Whiteness and blackness are 0–1; when they add up to
 * 1 or more the color is the gray their ratio names.
 */
export function hwbToSrgb(hue: number, whiteness: number, blackness: number): Vector {
	if (whiteness + blackness >= 1) {
		let gray = whiteness / (whiteness + blackness);
		return [gray, gray, gray];
	}
	let pure = hslToSrgb(hue, 1, 0.5);
	let scale = 1 - whiteness - blackness;
	return [pure[0] * scale + whiteness, pure[1] * scale + whiteness, pure[2] * scale + whiteness];
}

/** Converts CIE Lab (D50, L in 0–100) to gamma-encoded sRGB, unclamped. */
export function labToSrgb(lab: Vector): Vector {
	let fy = (lab[0] + 16) / 116;
	let fx = lab[1] / 500 + fy;
	let fz = fy - lab[2] / 200;
	let x = fx ** 3 > LAB_EPSILON ? fx ** 3 : (116 * fx - 16) / LAB_KAPPA;
	let y = lab[0] > LAB_KAPPA * LAB_EPSILON ? fy ** 3 : lab[0] / LAB_KAPPA;
	let z = fz ** 3 > LAB_EPSILON ? fz ** 3 : (116 * fz - 16) / LAB_KAPPA;
	return rgbSpaceToSrgb({ toLinear: identity, matrix: XYZ_D50_TO_LINEAR_SRGB }, [
		x * D50_WHITE[0],
		y * D50_WHITE[1],
		z * D50_WHITE[2],
	]);
}

/** Converts CIE LCH `[L, C, h]` to CIE Lab. */
export function lchToLab(lch: Vector): Vector {
	let radians = (lch[2] * Math.PI) / 180;
	return [lch[0], lch[1] * Math.cos(radians), lch[1] * Math.sin(radians)];
}
