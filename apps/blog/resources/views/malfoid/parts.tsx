/**
 * The pieces every Malfoid Stickers page is drawn from: a sticker from the pack's real
 * artwork, the wordmark and header, and the App Store call, which stays a "coming soon" note
 * until the listing has an id. The artwork is served from `/apps/malfoid/` in `public/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { block, hstack, shrink } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";
import { maxIs, mi, pb, pi } from "@sdxc/u/size";
import { focusVisible } from "@sdxc/u/state";
import { font, text, weight } from "@sdxc/u/typography";

import type { StickerId } from "~/resources/content/malfoid/stickers";

import { appStoreUrl } from "~/config/malfoid";
import { STICKER_CATALOG } from "~/resources/content/malfoid/stickers";
import { AppStoreBadge } from "~/resources/views/app-pages/app-store-badge";
import { QuietLink } from "~/resources/views/app-pages/footer";
import routes from "~/routes/web";

/** Where the pack's optimised artwork is served from. */
export const MALFOID_ASSETS = "/apps/malfoid";

namespace StickerImage {
	/** Props of one sticker. */
	export interface Props {
		id: StickerId;
		/** The `sizes` the browser picks a file with, the tile's rendered width. */
		sizes: string;
		/** Loads at once with high priority, for the stickers in the first viewport. */
		eager?: boolean;
		/** Empty alt text, for a sticker whose meaning the text beside it already carries. */
		decorative?: boolean;
	}
}

/**
 * One sticker as the pack ships it: transparent, white-outlined, square, at 240 or 480 pixels
 * by what the tile's width needs on this screen. It fills its wrapper's width, so a layout
 * sizes it, and holds its square before the file arrives.
 *
 * @param handle Runtime handle carrying the sticker, its sizes and its loading priority.
 * @returns The render function producing the image.
 */
export function StickerImage(handle: Handle<StickerImage.Props>) {
	return () => {
		let { decorative, eager, id, sizes } = handle.props;
		let base = `${MALFOID_ASSETS}/stickers/${id}`;
		return (
			<img
				src={`${base}-480.webp`}
				srcSet={`${base}-240.webp 240w, ${base}-480.webp 480w`}
				sizes={sizes}
				alt={decorative ? "" : STICKER_CATALOG[id].alt}
				width={480}
				height={480}
				loading={eager ? "eager" : "lazy"}
				decoding="async"
				fetchpriority={eager ? "high" : undefined}
				mix={[block(), shrink(0), raw({ inlineSize: "100%", blockSize: "auto" })]}
			/>
		);
	};
}

namespace AppStoreCall {
	/** Props of the download call. */
	export interface Props {
		/** The listing's URL; the configured one by default, or `null` before release. */
		href?: string | null;
	}
}

/**
 * The download call every page repeats: Apple's badge linking the listing once there is one,
 * and before release a quiet note that reads as a status, so nobody taps a dead link.
 *
 * @param handle Runtime handle carrying the listing URL.
 * @returns The render function producing the badge or the note.
 */
export function AppStoreCall(handle: Handle<AppStoreCall.Props>) {
	return () => {
		let href = handle.props.href === undefined ? appStoreUrl() : handle.props.href;
		return (
			<AppStoreBadge
				href={href}
				label={href ? "Download on the App Store" : "Coming soon to the"}
				language="en-us"
			/>
		);
	};
}

/**
 * The wordmark linking home: Malfoid's smug face in a small emerald-ringed circle beside the
 * pack's name in the display serif.
 *
 * @returns The render function producing the link.
 */
export function Wordmark() {
	return () => (
		<a
			href={routes.malfoid.landing.href()}
			mix={[
				hstack({ gap: 2.5, align: "center" }),
				fg("neutral.emphasis"),
				raw({ textDecoration: "none" }),
				font("display"),
				text("xl"),
				weight("semibold"),
				focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
			]}
		>
			<img
				src={`${MALFOID_ASSETS}/branding/face.webp`}
				alt=""
				width={36}
				height={36}
				mix={[
					block(),
					shrink(0),
					raw({
						borderRadius: "9999px",
						backgroundColor: "var(--malfoid-tile)",
						boxShadow: "0 0 0 2px var(--ui-brand-bg-solid)",
					}),
				]}
			/>
			<span>
				Malfoid
				<span mix={[raw({ "@media (max-width: 22rem)": { display: "none" } })]}> Stickers</span>
			</span>
		</a>
	);
}

/**
 * The header: the wordmark home, then Support and Privacy, which fit beside it at 320px
 * without a menu.
 *
 * @returns The render function producing the header.
 */
export function MalfoidHeader() {
	return () => (
		<header mix={[pi(4), at("md", pi(6))]}>
			<nav
				aria-label="Malfoid Stickers"
				mix={[
					hstack({ gap: 4, align: "center", justify: "between" }),
					maxIs("72rem"),
					mi("auto"),
					pb(4),
				]}
			>
				<Wordmark />
				<span mix={[hstack({ gap: 5, align: "center" }), text("sm")]}>
					<QuietLink href={routes.malfoid.support.index.href()} label="Support" />
					<QuietLink href={routes.malfoid.privacy.href()} label="Privacy" />
				</span>
			</nav>
		</header>
	);
}
