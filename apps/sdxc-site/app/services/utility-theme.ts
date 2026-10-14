/**
 * How a utility's page teaches its theme: which of the `--ui-*` scales the utility reads,
 * and for each one the stylesheet that redefines or extends it and the call that then
 * uses the new value. A scale is read off the utility's signature and the variables its
 * implementation names, so a page shows exactly the scales its utility answers to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { UtilityReference } from "~/app/services/utilities";

/** One scale a theme customizes, as a utility's page teaches it. */
export interface ThemeScale {
	/** The fragment the section is linked by, unique on the page. */
	id: string;
	title: string;
	/** The sentence introducing the stylesheet, with code in backticks. */
	lead: string;
	/** The stylesheet that redefines or adds a value. */
	css: string;
	/**
	 * The declaration merge that lets the utility accept a new name, or `null` for a scale
	 * whose values are numbers or a closed set of names.
	 */
	declaration: string | null;
	/** The sentence introducing the call, with code in backticks. */
	usageLead: string;
	usage: string;
}

/** A scale before it is written for one utility: what detects it, and how it is taught. */
interface ScaleDefinition {
	id: string;
	title: string;
	/** Type names in a signature that take this scale's values. */
	types: string[];
	/** Variable prefixes an implementation reads this scale through. */
	prefixes: string[];
	lead: string;
	css: string;
	declaration: string | null;
	/** The value a call passes to reach the new entry, as it is written in source. */
	value: string;
	/** The utility the usage is written with when the page's own takes no such argument. */
	fallback: string;
}

/** Every scale a theme customizes, in the order a page lists them. */
const SCALES: ScaleDefinition[] = [
	{
		id: "theme-spacing",
		title: "Customizing spacing",
		types: ["SpacingValue", "SizeValue"],
		prefixes: ["--ui-spacing"],
		lead: "Every numeric step multiplies `--ui-spacing`, so redefining it rescales every spacing and sizing utility at once:",
		css: `:root {
	--ui-spacing: 0.25rem;
}`,
		declaration: null,
		value: "4",
		fallback: "p",
	},
	{
		id: "theme-colors",
		title: "Customizing colors",
		types: ["ColorValue"],
		prefixes: [
			"--ui-color-",
			"--ui-brand-",
			"--ui-neutral-",
			"--ui-success-",
			"--ui-warning-",
			"--ui-danger-",
			"--ui-bg",
			"--ui-fg",
			"--ui-border",
			"--ui-ring",
		],
		lead: "Define a palette as `--ui-color-{name}-{50..950}` and map a tone onto it with the `--ui-{tone}-*` variables, the way `theme.css` maps the built-in ones:",
		css: `:root {
	--ui-color-info-50: oklch(0.97 0.02 230);
	--ui-color-info-200: oklch(0.88 0.06 230);
	--ui-color-info-500: oklch(0.62 0.16 230);
	--ui-color-info-600: oklch(0.52 0.18 230);
	--ui-color-info-900: oklch(0.3 0.1 230);

	--ui-info-bg-tint: var(--ui-color-info-50);
	--ui-info-bg-solid: var(--ui-color-info-600);
	--ui-info-fg: var(--ui-color-info-600);
	--ui-info-fg-muted: var(--ui-color-info-500);
	--ui-info-fg-emphasis: var(--ui-color-info-900);
	--ui-info-fg-on-solid: white;
	--ui-info-border: var(--ui-color-info-200);
	--ui-info-border-strong: var(--ui-color-info-600);
	--ui-info-ring: var(--ui-color-info-500);
}`,
		declaration: `declare module "@sdxc/u" {
	interface ColorPalettes {
		info: true;
	}
	interface SemanticTones {
		info: true;
	}
}`,
		value: `"info"`,
		fallback: "bg",
	},
	{
		id: "theme-radius",
		title: "Customizing radii",
		types: ["RadiusName"],
		prefixes: ["--ui-radius"],
		lead: "Redefine a `--ui-radius-*` variable to change a step, or declare a new one:",
		css: `:root {
	--ui-radius-2xl: 1rem;
}`,
		declaration: `declare module "@sdxc/u" {
	interface Radii {
		"2xl": true;
	}
}`,
		value: `"2xl"`,
		fallback: "rounded",
	},
	{
		id: "theme-text",
		title: "Customizing text sizes",
		types: ["TextSizeName"],
		prefixes: ["--ui-text"],
		lead: "Redefine a `--ui-text-*` variable to change a step, or declare a new one with the line height it sets beside it:",
		css: `:root {
	--ui-text-10xl: 10rem;
	--ui-leading-10xl: 1;
}`,
		declaration: `declare module "@sdxc/u" {
	interface TextSizes {
		"10xl": true;
	}
}`,
		value: `"10xl"`,
		fallback: "text",
	},
	{
		id: "theme-fonts",
		title: "Customizing font families",
		types: ["FontFamilyName"],
		prefixes: ["--ui-font"],
		lead: "Redefine a `--ui-font-*` variable to change a family, or declare a new one:",
		css: `:root {
	--ui-font-display: "Inter Display", ui-sans-serif, system-ui, sans-serif;
}`,
		declaration: `declare module "@sdxc/u" {
	interface FontFamilies {
		display: true;
	}
}`,
		value: `"display"`,
		fallback: "font",
	},
	{
		id: "theme-leading",
		title: "Customizing line heights",
		types: ["LeadingValue"],
		prefixes: ["--ui-leading"],
		lead: "Each named line height reads a `--ui-leading-*` variable before its built-in value, so a theme retunes one by declaring it:",
		css: `:root {
	--ui-leading-relaxed: 1.7;
}`,
		declaration: null,
		value: `"relaxed"`,
		fallback: "leading",
	},
	{
		id: "theme-tracking",
		title: "Customizing letter spacing",
		types: ["TrackingValue"],
		prefixes: ["--ui-tracking"],
		lead: "Each named letter spacing reads a `--ui-tracking-*` variable before its built-in value, so a theme retunes one by declaring it:",
		css: `:root {
	--ui-tracking-wide: 0.04em;
}`,
		declaration: null,
		value: `"wide"`,
		fallback: "tracking",
	},
	{
		id: "theme-shadows",
		title: "Customizing shadows",
		types: ["ShadowName"],
		prefixes: ["--ui-shadow"],
		lead: "Redefine a `--ui-shadow-*` variable to change a step, or declare a new one:",
		css: `:root {
	--ui-shadow-2xl: 0 25px 50px -12px rgb(0 0 0 / 0.25);
}`,
		declaration: `declare module "@sdxc/u" {
	interface Shadows {
		"2xl": true;
	}
}`,
		value: `"2xl"`,
		fallback: "shadow",
	},
	{
		id: "theme-blur",
		title: "Customizing blur",
		types: ["BlurName"],
		prefixes: ["--ui-blur"],
		lead: "Redefine a `--ui-blur-*` variable to change a step, or declare a new one:",
		css: `:root {
	--ui-blur-xl: 24px;
}`,
		declaration: `declare module "@sdxc/u" {
	interface Blurs {
		xl: true;
	}
}`,
		value: `"xl"`,
		fallback: "blur",
	},
	{
		id: "theme-containers",
		title: "Customizing container sizes",
		types: ["ContainerName"],
		prefixes: ["--ui-container"],
		lead: "Redefine a `--ui-container-*` variable to move a breakpoint, or declare a new one:",
		css: `:root {
	--ui-container-3xl: 96rem;
}`,
		declaration: `declare module "@sdxc/u" {
	interface Containers {
		"3xl": true;
	}
}`,
		value: `"3xl"`,
		fallback: "at",
	},
];

/**
 * The scales a utility reads, each written for that utility's page.
 *
 * @param reference - The utility as the catalogue document holds it.
 * @returns One entry per scale the signature takes or the implementation reads, in the
 * order of `SCALES`; an empty list for a utility no theme variable reaches.
 */
export function themeScales(reference: UtilityReference): ThemeScale[] {
	return SCALES.filter((scale) => reads(reference, scale)).map((scale) => ({
		id: scale.id,
		title: scale.title,
		lead: scale.lead,
		css: scale.css,
		declaration: scale.declaration,
		usageLead:
			scale.declaration === null
				? "Every call that names the step now reads the new value:"
				: "The new name is then accepted wherever the scale is:",
		usage: usage(reference, scale),
	}));
}

/** Whether the utility's signature takes the scale or its implementation reads it. */
function reads(reference: UtilityReference, scale: ScaleDefinition): boolean {
	return (
		scale.types.some((type) => new RegExp(`\\b${type}\\b`).test(reference.signature)) ||
		reference.tokens.some((token) => scale.prefixes.some((prefix) => token.startsWith(prefix)))
	);
}

/**
 * A call reaching the scale's new value: through the page's own utility when its first
 * parameter takes the scale, and through the scale's canonical utility otherwise. A
 * required parameter after the first is written as `...`, so the call still reads whole.
 */
function usage(reference: UtilityReference, scale: ScaleDefinition): string {
	let params = /\(([^)]*)\)/.exec(reference.signature)?.[1]?.split(",") ?? [];
	let direct = scale.types.some((type) => new RegExp(`\\b${type}\\b`).test(params[0] ?? ""));
	let name = direct ? reference.name : scale.fallback;

	if (name === "at") return `at(${scale.value}, p(8))`;
	let required = params.slice(1).some((param) => !/\?|\.\.\.|=/.test(param));
	return `${name}(${scale.value}${direct && required ? ", ..." : ""})`;
}
