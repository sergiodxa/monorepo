/**
 * Re-themes one demo landing: its own brand and neutral palettes, faces and marketing
 * tokens, applied to a wrapper so the page shows how far the tokens alone take a brand
 * without touching the site around it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";

/** The eleven lightness steps every palette scale declares, lightest first. */
const STEPS = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950] as const;

/** One palette, a colour per step of {@link STEPS}, lightest first. */
export type PaletteScale = readonly [
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
	string,
];

namespace DemoTheme {
	/** A demo's palettes and tokens; the wrapper re-declares the semantic tokens over them. */
	export interface Props {
		/** The brand scale, eleven `oklch()` values from 50 to 950. */
		brand: PaletteScale;
		/** The neutral scale, eleven values from 50 to 950; the site's neutrals when omitted. */
		neutral?: PaletteScale;
		/** Custom properties set last, over the palettes: faces, CTA radius, display max. */
		tokens?: Record<`--${string}`, string>;
		children: RemixNode;
	}
}

/**
 * The semantic tokens a scale feeds in light mode. The theme declares them on the root,
 * where the site's palette has already been read, so the wrapper declares them again over
 * its own palette; dark mode re-reads them on every element, from the palette inherited here.
 */
function semanticTokens(tone: "brand" | "neutral"): Record<string, string> {
	let step = (n: number) => `var(--ui-color-${tone}-${n})`;
	let solid = tone === "brand" ? step(600) : step(900);

	return {
		[`--ui-${tone}-bg-tint`]: step(50),
		[`--ui-${tone}-bg-solid`]: solid,
		[`--ui-${tone}-fg`]: step(600),
		[`--ui-${tone}-fg-muted`]: step(500),
		[`--ui-${tone}-fg-emphasis`]: step(900),
		[`--ui-${tone}-border`]: step(200),
		[`--ui-${tone}-border-strong`]: step(600),
		[`--ui-${tone}-ring`]: step(500),
		[`--ui-${tone}-bg-tint-hover`]: step(100),
		[`--ui-${tone}-bg-tint-pressed`]: step(200),
		[`--ui-${tone}-bg-solid-hover`]: tone === "brand" ? step(700) : step(800),
		[`--ui-${tone}-bg-solid-pressed`]: tone === "brand" ? step(800) : step(700),
		[`--ui-${tone}-border-hover`]: step(300),
	};
}

/** One scale's palette declarations, `--ui-color-<tone>-<step>`. */
function paletteTokens(tone: "brand" | "neutral", scale: PaletteScale): Record<string, string> {
	return Object.fromEntries(
		scale.map((colour, index) => [`--ui-color-${tone}-${STEPS[index]}`, colour]),
	);
}

/**
 * Wraps a demo in its palettes and tokens and paints the page background from them, so
 * the demo fills the window as its own site would.
 *
 * @param handle Runtime handle carrying the palettes, tokens and page.
 * @returns The render function producing the themed page.
 */
export default function DemoTheme(handle: Handle<DemoTheme.Props>) {
	return () => {
		let { brand, children, neutral, tokens } = handle.props;
		let neutralTokens = neutral
			? {
					...paletteTokens("neutral", neutral),
					...semanticTokens("neutral"),
					"--ui-bg": "var(--ui-neutral-bg-tint)",
					"--ui-fg": "var(--ui-neutral-fg-emphasis)",
				}
			: {};

		return (
			<div
				data-slot="demo-theme"
				mix={[
					raw({
						...paletteTokens("brand", brand),
						...semanticTokens("brand"),
						...neutralTokens,
						"--ui-marketing-hairline":
							"color-mix(in oklch, var(--ui-neutral-fg-emphasis) 7%, transparent)",
						...tokens,
						inlineSize: "100%",
						minBlockSize: "100dvh",
						backgroundColor: "var(--ui-bg)",
						color: "var(--ui-neutral-fg-emphasis)",
						fontFamily: "var(--ui-font-sans)",
						display: "flex",
						flexDirection: "column",
					}),
				]}
			>
				{children}
			</div>
		);
	};
}
