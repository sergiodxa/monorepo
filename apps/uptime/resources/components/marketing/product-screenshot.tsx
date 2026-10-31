/**
 * The Uptime dashboard screenshot in a product frame, switching between its light and dark
 * captures with the visitor's colour scheme. A marketing page shows the real product here,
 * so the screenshot is the one image every page draws from.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { block } from "@sdxc/u/layout";
import { overflow } from "@sdxc/u/overflow";
import { bs, is } from "@sdxc/u/size";
import { ProductFrame } from "@sdxc/ui/patterns";

/** Light-mode capture, also the `<img>` fallback for engines without `<picture>` support. */
export const SCREENSHOT_LIGHT = "/screenshot-light.webp";

/** Dark-mode capture, selected by the `<source>` media condition. */
export const SCREENSHOT_DARK = "/screenshot-dark.webp";

/**
 * Preloads for both captures, each limited to its colour scheme, for a page that shows the
 * screenshot above the fold. Pass them to the document's `preload`.
 */
export const SCREENSHOT_PRELOADS = [
	{ href: SCREENSHOT_LIGHT, as: "image", media: "(prefers-color-scheme: light)" },
	{ href: SCREENSHOT_DARK, as: "image", media: "(prefers-color-scheme: dark)" },
];

namespace ProductScreenshot {
	export interface Props {
		/** Describes what the dashboard shows (`landing.hero.screenshot.alt`). */
		alt: string;
	}
}

/**
 * Renders the framed screenshot at its intrinsic 3216×2080 ratio, so the frame reserves
 * its height before the image arrives and the page below it does not shift.
 */
export default function ProductScreenshot(handle: Handle<ProductScreenshot.Props>) {
	return () => (
		<ProductFrame lights>
			<picture mix={[block(), overflow("hidden")]}>
				<source media="(prefers-color-scheme: dark)" srcSet={SCREENSHOT_DARK} />
				<source media="(prefers-color-scheme: light)" srcSet={SCREENSHOT_LIGHT} />
				<img
					src={SCREENSHOT_LIGHT}
					alt={handle.props.alt}
					width={3216}
					height={2080}
					mix={[block(), is("full"), bs("auto")]}
				/>
			</picture>
		</ProductFrame>
	);
}
