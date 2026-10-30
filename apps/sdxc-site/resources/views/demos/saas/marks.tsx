/**
 * The SVG marks the Keel demo draws: its own logo, a hull over a waterline, and the
 * wordmarks of the invented customers in its logo cloud. Every mark paints in
 * `currentColor`, so a band's ink and the logo cloud's muting reach it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { hstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { text, tracking, weight } from "@sdxc/u/typography";

namespace KeelLogo {
	export interface Props {
		/** Draws the mark alone, for a place where the name is already written beside it. */
		markOnly?: boolean;
	}
}

/**
 * Keel's logo: a brand-filled tile holding a hull over a waterline, then the name. The
 * tile keeps the brand colour inside every band, so the logo reads on inverse and brand fills.
 *
 * @param handle Runtime handle carrying whether the name is drawn.
 * @returns The render function producing the logo.
 */
export function KeelLogo(handle: Handle<KeelLogo.Props>) {
	return () => (
		<span mix={[hstack({ gap: 2.5, align: "center" })]}>
			<svg viewBox="0 0 32 32" aria-hidden="true" mix={[is("1.75rem"), bs("1.75rem")]}>
				<rect width="32" height="32" rx="9" fill="var(--ui-color-brand-600)" />
				<path d="M7 12h18l-4.5 8.5h-9L7 12Z" fill="white" />
				<path d="M15.25 20.5h1.5V26h-1.5z" fill="white" />
				<path
					d="M6 9.5c2.5-1.6 4.5-1.6 7 0s4.5 1.6 7 0 4.5-1.6 6 0"
					fill="none"
					stroke="white"
					stroke-width="1.6"
					stroke-linecap="round"
					opacity="0.7"
				/>
			</svg>
			{handle.props.markOnly ? null : (
				<span mix={[text("lg"), weight("semibold"), tracking("tight")]}>Keel</span>
			)}
		</span>
	);
}

namespace CustomerMark {
	export interface Props {
		/** The company the mark spells. */
		name: string;
		/** Which glyph leads the name. */
		glyph: Glyph;
	}

	export type Glyph = "orbit" | "parcel" | "sundial" | "hatch" | "tessera" | "spark";
}

/** Each customer glyph in a 24-unit box: filled shapes, so they hold at 28px. */
const GLYPHS: Record<CustomerMark.Glyph, string> = {
	orbit:
		"M12 2a10 10 0 1 0 0 20 10 10 0 0 0 0-20Zm0 3.5a6.5 6.5 0 1 1 0 13 6.5 6.5 0 0 1 0-13Zm0 3.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
	parcel: "M12 2 21 7v10l-9 5-9-5V7l9-5Zm0 3.2L6.4 8.3 12 11.4l5.6-3.1L12 5.2Z",
	sundial: "M12 3a9 9 0 0 1 9 9H12V3Zm-2 2.3V14h8.7A9 9 0 1 1 10 5.3Z",
	hatch: "M3 3h8v8H3V3Zm10 0h8v8h-8V3ZM3 13h8v8H3v-8Zm10 4 4-4 4 4-4 4-4-4Z",
	tessera: "M12 2 22 12 12 22 2 12 12 2Zm0 5-5 5 5 5 5-5-5-5Z",
	spark:
		"M12 2c.8 5.2 4.8 9.2 10 10-5.2.8-9.2 4.8-10 10-.8-5.2-4.8-9.2-10-10 5.2-.8 9.2-4.8 10-10Z",
};

/**
 * One invented customer's wordmark, glyph and name in `currentColor`, sized by the
 * logo cloud like any adopter's SVG file.
 *
 * @param handle Runtime handle carrying the name and glyph.
 * @returns The render function producing the SVG.
 */
export function CustomerMark(handle: Handle<CustomerMark.Props>) {
	return () => {
		let { glyph, name } = handle.props;
		let width = 32 + name.length * 11.5;

		return (
			<svg viewBox={`0 0 ${width} 28`} role="img" aria-label={name} fill="currentColor">
				<path d={GLYPHS[glyph]} transform="translate(0 2)" />
				<text
					x="31"
					y="20.5"
					font-size="19.5"
					font-weight="700"
					letter-spacing="-0.6"
					font-family="ui-sans-serif, system-ui, sans-serif"
				>
					{name}
				</text>
			</svg>
		);
	};
}

/** The companies the logo cloud names, in the order it shows them. */
export const CUSTOMERS: readonly CustomerMark.Props[] = [
	{ name: "Orbitkit", glyph: "orbit" },
	{ name: "Parcelbase", glyph: "parcel" },
	{ name: "Sundial", glyph: "sundial" },
	{ name: "Hatchway", glyph: "hatch" },
	{ name: "Tessera", glyph: "tessera" },
	{ name: "Brightpath", glyph: "spark" },
];
