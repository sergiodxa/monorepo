/**
 * How a reader customizes the icons the gallery draws: the size, stroke width, colour and
 * absolute stroke `LucideProps` takes. The server and the controls island read the same
 * rules, so a customized address renders what the live controls showed.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

/** One customization, as the controls set it and the props an icon renders with. */
export interface IconStyle {
	size: number;
	strokeWidth: number;
	absoluteStrokeWidth: boolean;
	/** A `#rrggbb` colour, or `null` for the text colour around the icon. */
	color: string | null;
}

/** What every icon renders with when the reader changes nothing, matching the package's defaults. */
export const DEFAULT_ICON_STYLE: IconStyle = {
	size: 24,
	strokeWidth: 2,
	absoluteStrokeWidth: false,
	color: null,
};

/** The range each slider offers, which the validator also holds an address to. */
export const ICON_STYLE_RANGES = {
	size: { min: 12, max: 64, step: 1 },
	strokeWidth: { min: 0.5, max: 3, step: 0.25 },
} as const;

/** The query parameter each field travels as, short enough to read in an address. */
export const ICON_STYLE_PARAMS = {
	size: "size",
	strokeWidth: "stroke",
	absoluteStrokeWidth: "absolute",
	color: "color",
} as const;

/** The custom properties a grid's tiles read their size, stroke and colour from. */
export const ICON_STYLE_VARS = {
	size: "--icon-size",
	strokeWidth: "--icon-stroke-width",
	color: "--icon-color",
} as const;

/**
 * The stroke width the icon is drawn with in its 24-unit viewBox. An absolute stroke keeps
 * the chosen width on screen at any size, which in viewBox units scales against the size.
 */
export function drawnStrokeWidth(style: IconStyle): number {
	if (!style.absoluteStrokeWidth) return style.strokeWidth;
	return (style.strokeWidth * DEFAULT_ICON_STYLE.size) / style.size;
}

/** The custom properties for a grid drawing `style`; a default colour leaves the text colour. */
export function iconStyleVars(style: IconStyle): Record<string, string> {
	let vars: Record<string, string> = {
		[ICON_STYLE_VARS.size]: `${style.size}px`,
		[ICON_STYLE_VARS.strokeWidth]: String(drawnStrokeWidth(style)),
	};
	if (style.color !== null) vars[ICON_STYLE_VARS.color] = style.color;
	return vars;
}

/** The query parameters for `style`, naming only what differs from the default. */
export function iconStyleParams(style: IconStyle): URLSearchParams {
	let params = new URLSearchParams();
	if (style.size !== DEFAULT_ICON_STYLE.size)
		params.set(ICON_STYLE_PARAMS.size, String(style.size));
	if (style.strokeWidth !== DEFAULT_ICON_STYLE.strokeWidth) {
		params.set(ICON_STYLE_PARAMS.strokeWidth, String(style.strokeWidth));
	}
	if (style.absoluteStrokeWidth) params.set(ICON_STYLE_PARAMS.absoluteStrokeWidth, "1");
	if (style.color !== null) params.set(ICON_STYLE_PARAMS.color, style.color);
	return params;
}

/**
 * The JSX props that render `style`, written the way a reader would, each only when it
 * differs from the default: `size={32} strokeWidth={1.5} absoluteStrokeWidth`.
 */
export function iconStyleProps(style: IconStyle): string {
	let props: string[] = [];
	if (style.size !== DEFAULT_ICON_STYLE.size) props.push(`size={${style.size}}`);
	if (style.strokeWidth !== DEFAULT_ICON_STYLE.strokeWidth) {
		props.push(`strokeWidth={${style.strokeWidth}}`);
	}
	if (style.absoluteStrokeWidth) props.push("absoluteStrokeWidth");
	if (style.color !== null) props.push(`color="${style.color}"`);
	return props.join(" ");
}
