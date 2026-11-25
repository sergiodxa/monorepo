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

import type { PageLocale } from "~/app/services/page-locale";
import type { LandingCopy } from "~/resources/content/malfoid/landing";
import type { StickerId } from "~/resources/content/malfoid/stickers";

import { appStoreUrl } from "~/config/malfoid";
import { LANDING_COPY } from "~/resources/content/malfoid/landing";
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
		/** The language of the alt text. English by default. */
		locale?: PageLocale;
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
		let { decorative, eager, id, locale = "en", sizes } = handle.props;
		let base = `${MALFOID_ASSETS}/stickers/${id}`;
		return (
			<img
				src={`${base}-480.webp`}
				srcSet={`${base}-240.webp 240w, ${base}-480.webp 480w`}
				sizes={sizes}
				alt={decorative ? "" : STICKER_CATALOG[id].alt[locale]}
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
		/** The page's words, English by default. */
		copy?: LandingCopy;
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
		let copy = handle.props.copy ?? LANDING_COPY.en;
		return (
			<AppStoreBadge
				href={href}
				label={href ? copy.appStore.available : copy.appStore.soon}
				language={copy.locale === "es-AR" ? "es-mx" : "en-us"}
			/>
		);
	};
}

/**
 * The landing's address in `locale`: bare for English, with `?lang=` for any other language.
 *
 * @param locale The language to link.
 * @returns The landing's path.
 */
export function landingHref(locale: PageLocale = "en"): string {
	let href = routes.malfoid.landing.href();
	return locale === "en" ? href : `${href}?lang=${locale}`;
}

namespace Chrome {
	/** Props of the header and wordmark. */
	export interface Props {
		/** The page's words, English by default. */
		copy?: LandingCopy;
	}
}

/**
 * The wordmark linking home in the page's language: Malfoid's smug face in a small
 * emerald-ringed circle beside the pack's name in the display serif.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the link.
 */
export function Wordmark(handle: Handle<Chrome.Props>) {
	return () => (
		<a
			href={landingHref(handle.props.copy?.locale)}
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
				<span mix={[raw({ "@media (max-width: 26rem)": { display: "none" } })]}> Stickers</span>
			</span>
		</a>
	);
}

/**
 * The header: the wordmark home, then Support and Privacy, which fit beside it at 320px
 * without a menu. Support and the policy are written in English, so a page in another
 * language marks those links as English.
 *
 * @param handle Runtime handle carrying the page's words.
 * @returns The render function producing the header.
 */
export function MalfoidHeader(handle: Handle<Chrome.Props>) {
	return () => {
		let copy = handle.props.copy ?? LANDING_COPY.en;
		let hrefLang = copy.locale === "en" ? undefined : "en";
		return (
			<header mix={[pi(4), at("md", pi(6))]}>
				<nav
					aria-label={copy.chrome.navLabel}
					mix={[
						hstack({ gap: 4, align: "center", justify: "between" }),
						maxIs("72rem"),
						mi("auto"),
						pb(4),
					]}
				>
					<Wordmark copy={copy} />
					<span mix={[hstack({ gap: 5, align: "center" }), text("sm")]}>
						<QuietLink
							href={routes.malfoid.support.index.href()}
							label={copy.chrome.support}
							hrefLang={hrefLang}
						/>
						<QuietLink
							href={routes.malfoid.privacy.href()}
							label={copy.chrome.privacy}
							hrefLang={hrefLang}
						/>
					</span>
				</nav>
			</header>
		);
	};
}
