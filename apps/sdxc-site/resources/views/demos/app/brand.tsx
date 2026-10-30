/**
 * Rooftree's drawn marks: the roof-and-tree glyph on its ember tile, the wordmark beside
 * it, and the invented press mastheads the proof band lists. Every mark is inline SVG in
 * `currentColor` or the page's brand tokens, so it follows the palette and the scheme.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { text, tracking, weight } from "@sdxc/u/typography";

/** The roof chevron and the tree under it, drawn on a 32-unit tile. */
const ROOF = "M8 15.5 16 8.5l8 7";

/** Faces a masthead draws with: a bookish serif or the system sans. */
const MASTHEAD_FACES = {
	serif: "ui-serif, Georgia, 'Times New Roman', serif",
	sans: "ui-sans-serif, system-ui, sans-serif",
} as const;

namespace LogoMark {
	/** Props of the tile mark. */
	export interface Props {
		/** Edge length in CSS pixels. */
		size?: number;
	}
}

/**
 * The app icon: a rounded ember tile holding a roof over a small tree. It is decorative
 * wherever the wordmark or a label names the product beside it.
 *
 * @param handle Runtime handle carrying the edge length.
 * @returns The render function producing the tile.
 */
export function LogoMark(handle: Handle<LogoMark.Props>) {
	return () => {
		let size = handle.props.size ?? 28;
		return (
			<svg width={size} height={size} viewBox="0 0 32 32" aria-hidden="true">
				<rect width="32" height="32" rx="9" fill="var(--ui-brand-bg-solid)" />
				<path
					d={ROOF}
					fill="none"
					stroke="white"
					stroke-width="2.6"
					stroke-linecap="round"
					stroke-linejoin="round"
				/>
				<circle cx="16" cy="17.5" r="3.6" fill="white" fill-opacity="0.92" />
				<path d="M16 20v4.5" stroke="white" stroke-width="2.2" stroke-linecap="round" />
			</svg>
		);
	};
}

/**
 * The tile beside the product name, the lockup the header and footer lead with; the
 * name stays live text so it reads and translates as text.
 *
 * @returns The render function producing the lockup.
 */
export function Wordmark() {
	return () => (
		<span mix={[hstack({ gap: 2, align: "center" })]}>
			<LogoMark />
			<span mix={[text("lg"), weight("bold"), tracking("tight"), fg("neutral.emphasis")]}>
				Rooftree
			</span>
		</span>
	);
}

namespace Masthead {
	/** Props of one invented publication's masthead. */
	export interface Props {
		/** The publication's name, also its accessible name. */
		name: string;
		/** Which face sets the name. */
		face: keyof typeof MASTHEAD_FACES;
		/** Optional small glyph drawn before the name, as a path on a 24-unit box. */
		glyph?: string;
		/** Sets the name in small capitals with open tracking. */
		caps?: boolean;
	}
}

/**
 * A publication masthead drawn as SVG text in `currentColor`, sized by its own name so
 * a logo cloud can scale every mark to one height.
 *
 * @param handle Runtime handle carrying the name, face and glyph.
 * @returns The render function producing the masthead.
 */
export function Masthead(handle: Handle<Masthead.Props>) {
	return () => {
		let { caps, face, glyph, name } = handle.props;
		let label = caps ? name.toUpperCase() : name;
		let offset = glyph ? 30 : 0;
		let size = caps ? 16 : 21;
		let textWidth = Math.round(label.length * size * (caps ? 0.78 : 0.5));
		let width = offset + textWidth;

		return (
			<svg viewBox={`0 0 ${width} 28`} role="img" aria-label={name} fill="currentColor">
				{glyph ? (
					<path
						d={glyph}
						transform="translate(0 2)"
						fill="none"
						stroke="currentColor"
						stroke-width="2.2"
						stroke-linecap="round"
						stroke-linejoin="round"
					/>
				) : null}
				<text
					x={offset}
					y="20.5"
					textLength={textWidth}
					lengthAdjust="spacingAndGlyphs"
					font-size={size}
					font-weight={face === "serif" ? "600" : "700"}
					font-style={face === "serif" && !caps ? "italic" : "normal"}
					font-family={MASTHEAD_FACES[face]}
				>
					{label}
				</text>
			</svg>
		);
	};
}

/** The invented outlets the proof band lists, in reading order. */
export const MASTHEADS: readonly Masthead.Props[] = [
	{ name: "Weekly Hearth", face: "serif" },
	{ name: "Signal & Noise", face: "sans", glyph: "M2 12h4l3-8 6 16 3-8h4" },
	{ name: "Apartment Life", face: "serif", caps: true },
	{ name: "Kitbag", face: "sans", glyph: "M4 8h16l-2 12H6L4 8Zm4 0a4 4 0 0 1 8 0" },
	{ name: "Morning Tablet", face: "serif" },
];
