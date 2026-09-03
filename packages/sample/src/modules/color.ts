/**
 * Colors, in the notations a stylesheet and a design token file use.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { Dataset } from "../dataset";
import type { Random } from "../random";

const CSS_SPACES = [
	"sRGB",
	"display-p3",
	"rec2020",
	"a98-rgb",
	"prophoto-rgb",
	"xyz",
	"xyz-d50",
	"xyz-d65",
] as const;

const CSS_FUNCTIONS = [
	"rgb",
	"rgba",
	"hsl",
	"hsla",
	"hwb",
	"lab",
	"lch",
	"oklab",
	"oklch",
	"color",
] as const;

/** How a color comes back: as its numbers, or as the CSS notation. */
export type ColorFormat = "values" | "css";

/** Options shared by every notation. */
export interface ColorOptions {
	/** `"values"` by default for everything but {@link ColorModule.rgb}. */
	format?: ColorFormat;
}

/** Options for an RGB color. */
export interface RgbOptions extends ColorOptions {
	/** Returns `#rrggbb` rather than the numbers. Default when no format is given. */
	hex?: boolean;
	/** Adds an alpha channel. */
	includeAlpha?: boolean;
}

/** Options for a color in a named CSS color space. */
export interface SpaceOptions extends ColorOptions {
	/** The space to draw in; one is picked when none is named. */
	space?: string;
}

/** Colors as names, channels, or CSS notation. */
export interface ColorModule {
	/** A color a person would name, such as `"teal"`. */
	human(): string;
	/** A CSS color space, such as `"display-p3"`. */
	space(): string;
	/** A CSS color space, the name {@link ColorModule.space} also answers to. */
	cssSupportedSpace(): string;
	/** A CSS color function, such as `"oklch"`. */
	cssSupportedFunction(): string;
	/** `#rrggbb` by default, or the channels. */
	rgb(options?: RgbOptions): string | number[];
	/** Hue, saturation, lightness. */
	hsl(options?: ColorOptions): string | number[];
	/** Hue, whiteness, blackness. */
	hwb(options?: ColorOptions): string | number[];
	/** Lightness and the two opponent axes. */
	lab(options?: ColorOptions): string | number[];
	/** Lightness, chroma, hue. */
	lch(options?: ColorOptions): string | number[];
	/** Cyan, magenta, yellow, key. */
	cmyk(options?: ColorOptions): string | number[];
	/** A color written in a named CSS color space. */
	colorByCSSColorSpace(options?: SpaceOptions): string | number[];
}

/** Create the `color` module over one stream and dataset. */
export function createColorModule(random: Random, data: Dataset): ColorModule {
	function channels(
		values: number[],
		notation: string,
		options: ColorOptions = {},
	): string | number[] {
		if (options.format !== "css") return values;
		return `${notation}(${values.join(" ")})`;
	}

	let color: ColorModule = {
		human() {
			return random.pick(data.colorNames);
		},
		space() {
			return random.pick(CSS_SPACES);
		},
		cssSupportedSpace() {
			return color.space();
		},
		cssSupportedFunction() {
			return random.pick(CSS_FUNCTIONS);
		},
		rgb(options = {}) {
			let values = Array.from({ length: 3 }, () => random.int(0, 255));
			if (options.includeAlpha === true) values.push(Number(random.float(0, 1).toFixed(2)));
			if (options.format === "values") return values;
			if (options.format === "css")
				return channels(values, values.length === 4 ? "rgba" : "rgb", options);
			if (options.hex === false) return values;
			return `#${values
				.slice(0, 3)
				.map((value) => value.toString(16).padStart(2, "0"))
				.join("")}`;
		},
		hsl(options) {
			let values = [random.int(0, 360), random.int(0, 100), random.int(0, 100)];
			return channels(values, "hsl", options);
		},
		hwb(options) {
			let values = [random.int(0, 360), random.int(0, 100), random.int(0, 100)];
			return channels(values, "hwb", options);
		},
		lab(options) {
			let values = [
				Number(random.float(0, 100).toFixed(2)),
				Number(random.float(-128, 128).toFixed(2)),
				Number(random.float(-128, 128).toFixed(2)),
			];
			return channels(values, "lab", options);
		},
		lch(options) {
			let values = [
				Number(random.float(0, 100).toFixed(2)),
				Number(random.float(0, 230).toFixed(2)),
				random.int(0, 360),
			];
			return channels(values, "lch", options);
		},
		cmyk(options) {
			let values = Array.from({ length: 4 }, () => Number(random.float(0, 1).toFixed(2)));
			return channels(values, "cmyk", options);
		},
		colorByCSSColorSpace(options = {}) {
			let space = options.space ?? color.space();
			let values = Array.from({ length: 3 }, () => Number(random.float(0, 1).toFixed(2)));
			if (options.format !== "css") return values;
			return `color(${space} ${values.join(" ")})`;
		},
	};

	return color;
}
