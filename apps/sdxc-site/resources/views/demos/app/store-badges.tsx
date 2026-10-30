/**
 * The download badges the hero, the closing band and the footer share: an app-store
 * badge and a play-store badge drawn here as SVG glyphs beside live text, set as one
 * row that wraps instead of stretching when the hero stacks its actions on a phone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { hstack, inlineFlex, items, vstack } from "@sdxc/u/layout";
import { focusVisible, hover } from "@sdxc/u/state";
import { leading, text, weight } from "@sdxc/u/typography";
import { interactiveTransition } from "@sdxc/ui/styles";

/** A rounded fruit with a leaf, the glyph of the phone-and-tablet store. */
const FRUIT =
	"M12 7.2c-1.6-1.1-4.1-1.3-5.7.3-2.1 2-2 5.8-.4 9 1.2 2.5 2.8 4.6 4.5 4.6.8 0 1.1-.5 1.6-.5s.8.5 1.6.5c1.7 0 3.3-2.1 4.5-4.6 1.6-3.2 1.7-7-.4-9-1.6-1.6-4.1-1.4-5.7-.3ZM12.2 6.4c0-2.3 1.5-4.1 3.8-4.4-.1 2.4-1.6 4.2-3.8 4.4Z";

/** A rounded play triangle split into two tones, the glyph of the other store. */
const PLAY = "M4.5 2.6c-.3.3-.5.8-.5 1.4v16c0 .6.2 1.1.5 1.4L13.6 12 4.5 2.6Z";

/** The upper and lower facets that complete the play glyph's triangle. */
const PLAY_FACETS = [
	"M16.6 9 5.6 2.4c-.3-.2-.7-.3-1.1-.2l9.1 9.4L16.6 9Z",
	"M16.6 15 13.6 12l-9.1 9.4c.4.1.8 0 1.1-.2L16.6 15Z",
	"M20.4 10.8 17.6 9.2 14.4 12l3.2 2.8 2.8-1.6c.8-.5.8-1.9 0-2.4Z",
];

namespace StoreBadge {
	/** Props of one store badge. */
	export interface Props {
		/** Page anchor the badge points at. */
		href: string;
		/** The small line above the store name. */
		kicker: string;
		/** The store's name, set large. */
		store: string;
		/** The glyph drawn before the text. */
		glyph: RemixNode;
	}
}

/**
 * One store badge: an ink pill with a glyph and two lines of type, at the page's CTA
 * height and radius, so a badge beside a button reads as the same shape and size.
 *
 * @param handle Runtime handle carrying the link, copy and glyph.
 * @returns The render function producing the badge link.
 */
export function StoreBadge(handle: Handle<StoreBadge.Props>) {
	return () => {
		let { glyph, href, kicker, store } = handle.props;
		return (
			<a
				href={href}
				mix={[
					inlineFlex(),
					items("center"),
					interactiveTransition(),
					raw({
						gap: "0.625rem",
						blockSize: "var(--ui-marketing-cta-height, 3rem)",
						paddingInline: "1.125rem 1.5rem",
						borderRadius: "var(--ui-marketing-cta-radius, 0.75rem)",
						backgroundColor: "oklch(0.2 0.02 290)",
						color: "white",
						textDecoration: "none",
						boxShadow:
							"inset 0 0 0 1px rgb(255 255 255 / 0.14), 0 1px 2px rgb(0 0 0 / 0.12), 0 4px 12px -4px rgb(0 0 0 / 0.2)",
					}),
					hover(raw({ backgroundColor: "oklch(0.28 0.03 290)" })),
					focusVisible(raw({ outline: "2px solid var(--ui-brand-ring)", outlineOffset: "2px" })),
				]}
			>
				{glyph}
				<span mix={[vstack({ gap: 0, align: "start" })]}>
					<span mix={[raw({ fontSize: "0.625rem", letterSpacing: "0.02em" }), leading("none")]}>
						{kicker}
					</span>
					<span mix={[text("base"), weight("semibold"), leading("tight")]}>{store}</span>
				</span>
			</a>
		);
	};
}

namespace StoreBadges {
	/** Props of the badge row. */
	export interface Props {
		/** Where the row packs its badges; a centered band centers them. */
		align?: "start" | "center";
		/** Further downloads set in the same row after the badges, such as a desktop link. */
		children?: RemixNode;
	}
}

/**
 * Both store badges in one wrapping row, the download call the page repeats in the
 * hero, the closing band and the footer, with room for a further download after them.
 *
 * @returns The render function producing the badge row.
 */
export function StoreBadges(handle: Handle<StoreBadges.Props>) {
	return () => (
		<div
			mix={[
				hstack({
					gap: 3,
					align: "center",
					justify: handle.props.align === "center" ? "center" : "start",
				}),
				raw({ flexWrap: "wrap" }),
			]}
		>
			<StoreBadge
				href="#download"
				kicker="Download on the"
				store="App Store"
				glyph={
					<svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
						<path d={FRUIT} />
					</svg>
				}
			/>
			<StoreBadge
				href="#download"
				kicker="Get it on"
				store="Google Play"
				glyph={
					<svg width="22" height="22" viewBox="0 0 24 24" aria-hidden="true">
						<path d={PLAY} fill="oklch(0.86 0.16 92)" />
						<path d={PLAY_FACETS[0]} fill="white" fill-opacity="0.9" />
						<path d={PLAY_FACETS[1]} fill="var(--ui-color-brand-400)" />
						<path d={PLAY_FACETS[2]} fill="white" fill-opacity="0.65" />
					</svg>
				}
			/>
			{handle.props.children}
		</div>
	);
}
