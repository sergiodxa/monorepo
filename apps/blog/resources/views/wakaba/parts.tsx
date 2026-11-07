/**
 * The pieces every Wakaba page is drawn from: the 学 mark, the phone a real screenshot is
 * framed in, and the App Store call, which stays a "coming soon" note until the listing has
 * an id. Screens and art are optimised copies under `/apps/wakaba/` in `public/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { block, shrink } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";

import type { PageLocale } from "~/app/services/page-locale";
import type { WakabaCopy } from "~/resources/content/wakaba/copy";

import { appStoreUrl } from "~/config/wakaba";
import { EN } from "~/resources/content/wakaba/en";
import { ES } from "~/resources/content/wakaba/es-AR";
import { AppStoreBadge } from "~/resources/views/app-pages/app-store-badge";
import { PhoneFrame, screenCorners } from "~/resources/views/app-pages/phone";

/** Where the page's optimised images are served from. */
export const WAKABA_ASSETS = "/apps/wakaba";

/** Wakaba's pages in each language they are written in. */
export const WAKABA_COPY: Record<PageLocale, WakabaCopy> = { en: EN, "es-AR": ES };

namespace WakabaLanguage {
	/** Props of the language provider. */
	export interface Props {
		copy: WakabaCopy;
		children: RemixNode;
	}
}

/**
 * Hands one language's copy to every Wakaba component inside it, so the bands, the frames and
 * the App Store call all print, and pick captures, in the page's language.
 *
 * @param handle Runtime handle carrying the copy and the page.
 * @returns The render function producing the page unchanged.
 */
export function WakabaLanguage(handle: Handle<WakabaLanguage.Props, WakabaCopy>) {
	return () => {
		handle.context.set(handle.props.copy);
		return handle.props.children;
	};
}

/** What a component's handle offers for reading its ancestors' context. */
interface ContextReader {
	context: { get(component: unknown): unknown };
}

/**
 * The copy of the language the nearest {@link WakabaLanguage} provides, English outside one.
 *
 * @param handle The reading component's runtime handle.
 * @returns The page's copy.
 */
export function copyOf(handle: ContextReader): WakabaCopy {
	return (handle.context.get(WakabaLanguage) as WakabaCopy | undefined) ?? EN;
}

/** The logo's strokes: the kanji 学 drawn as a curved trunk under three leaves. */
const MARK_PATHS = [
	"M348 261 C399 252 478 310 502 365 C444 355 368 316 348 261 Z",
	"M536 339 C558 256 665 190 763 196 C740 256 650 310 536 339 Z",
	"M752 366 C764 312 831 259 905 262 C894 304 825 350 752 366 Z",
	"M289 368 C475 383 806 383 964 368 C960 430 963 492 972 552 L910 552 C910 522 910 476 901 445 C893 428 878 420 853 420 L398 420 C367 420 352 431 350 452 L347 552 L280 552 C288 498 292 427 289 368 Z",
	"M409 483 C560 491 710 491 838 483 L867 518 C807 567 728 611 685 645 C663 662 653 672 653 682 L876 681 C918 680 948 675 981 668 C981 700 979 734 961 746 C858 728 752 730 659 731 C675 780 696 824 682 875 C674 912 652 945 624 960 C574 975 484 970 456 959 L440 899 C482 906 532 908 561 887 C590 867 600 840 595 810 C592 783 581 754 576 733 L361 733 C333 734 304 737 296 741 C283 740 277 714 273 669 C369 683 474 681 579 681 C578 654 584 632 607 613 C648 585 716 555 778 537 L408 538 Z",
] as const;

namespace WakabaMark {
	/** Props of the 学 mark. */
	export interface Props {
		/** Edge length in pixels. */
		size: number;
	}
}

/**
 * The app icon's 学 mark in the current text colour, so it takes the accent in either
 * scheme from whatever wraps it. Decorative: the wordmark beside it names the app.
 *
 * @param handle Runtime handle carrying the size.
 * @returns The render function producing the mark.
 */
export function WakabaMark(handle: Handle<WakabaMark.Props>) {
	return () => (
		<svg
			width={handle.props.size}
			height={handle.props.size}
			viewBox="0 0 1254 1254"
			fill="currentColor"
			aria-hidden="true"
			mix={[shrink(0)]}
		>
			{MARK_PATHS.map((d) => (
				<path key={d} d={d} />
			))}
		</svg>
	);
}

/**
 * One capture of the app: its file under `/apps/wakaba/` without the extension, and the
 * `-light`/`-dark` suffix the file carries when the app was shot in both appearances.
 */
interface Screen {
	file: string;
	dark?: boolean;
}

/**
 * The real captures the pages frame: app screenshots under `screenshots/` and widget gallery
 * captures under `widgets/`. Each is the English capture at 560 × 1218, half the device's
 * width, so it stays sharp at the 280px a phone is drawn at.
 */
export const SCREENS = {
	"path-kitsune": {
		file: "screenshots/{lang}/path-kitsune",
	},
	"flashcards-fish": {
		file: "screenshots/{lang}/flashcards-fish",
		dark: true,
	},
	practice: {
		file: "screenshots/{lang}/practice",
		dark: true,
	},
	"flashcards-water": {
		file: "screenshots/{lang}/flashcards-water",
	},
	conjugations: {
		file: "screenshots/{lang}/conjugations",
	},
	"level-exam-path": {
		file: "screenshots/{lang}/level-exam-path",
	},
	listening: {
		file: "screenshots/{lang}/listening",
	},
	speaking: {
		file: "screenshots/{lang}/speaking",
	},
	"build-sentence": {
		file: "screenshots/{lang}/build-sentence",
	},
	"conjugation-practice": {
		file: "screenshots/{lang}/conjugation-practice",
	},
	"oni-correction": {
		file: "screenshots/{lang}/oni-correction",
	},
	"kana-tracing": {
		file: "screenshots/{lang}/kana-tracing",
	},
	"stroke-guide": {
		file: "screenshots/{lang}/stroke-guide",
	},
	"new-word": {
		file: "screenshots/{lang}/new-word",
	},
	"practice-feedback": {
		file: "screenshots/{lang}/practice-feedback",
	},
	"oni-mistakes": {
		file: "screenshots/{lang}/oni-mistakes",
	},
	"widget-progress": {
		file: "widgets/{lang}/progress-medium",
		dark: true,
	},
	"widget-word": {
		file: "widgets/{lang}/word-large",
		dark: true,
	},
} as const satisfies Record<string, Screen>;

/** A screenshot's key in {@link SCREENS}. */
export type ScreenName = keyof typeof SCREENS;

namespace Phone {
	/** Props of a framed screenshot. */
	export interface Props {
		screen: ScreenName;
		/** Loads at once with high priority, for the screens in the first viewport. */
		eager?: boolean;
	}
}

/**
 * A real screenshot in an ink phone bezel. The capture already carries the status bar, so
 * the frame adds only the hardware: the bezel and the screen's rounded corners, in the
 * proportions of the capture, at whatever width the column gives it. A screen shot in both
 * schemes follows the visitor's.
 *
 * @param handle Runtime handle carrying the screen and its loading priority.
 * @returns The render function producing the framed screenshot.
 */
export function Phone(handle: Handle<Phone.Props>) {
	return () => {
		let { eager, screen } = handle.props;
		let copy = copyOf(handle);
		let shot: Screen = SCREENS[screen];
		let file = shot.file.replace("{lang}", copy.captures);
		let base = shot.dark ? `${file}-light` : file;

		return (
			<PhoneFrame>
				<picture mix={[block(), screenCorners()]}>
					{shot.dark ? (
						<source
							media="(prefers-color-scheme: dark)"
							srcSet={`${WAKABA_ASSETS}/${file}-dark.webp`}
							width={560}
							height={1218}
						/>
					) : null}
					<img
						src={`${WAKABA_ASSETS}/${base}.webp`}
						alt={copy.screens[screen]}
						width={560}
						height={1218}
						loading={eager ? "eager" : "lazy"}
						decoding="async"
						fetchpriority={eager ? "high" : undefined}
						mix={[block(), is("full"), raw({ blockSize: "auto" })]}
					/>
				</picture>
			</PhoneFrame>
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
 * The download call every Wakaba page repeats, in the page's language: Apple's badge linking
 * the listing once there is one, and before release a quiet note that reads as a status.
 *
 * @param handle Runtime handle carrying the listing URL.
 * @returns The render function producing the badge or the note.
 */
export function AppStoreCall(handle: Handle<AppStoreCall.Props>) {
	return () => {
		let href = handle.props.href === undefined ? appStoreUrl() : handle.props.href;
		let copy = copyOf(handle);
		return (
			<AppStoreBadge
				href={href}
				label={href ? `${copy.appStore.available} App Store` : copy.appStore.soon}
				language={copy.locale === "es-AR" ? "es-mx" : "en-us"}
			/>
		);
	};
}

/** The character poses under `characters/`, by file name. */
export type MascotPose =
	| "kitsune-celebrate"
	| "kitsune-pointing"
	| "kitsune-study"
	| "kitsune-wave"
	| "oni-checkpoint"
	| "oni-correction"
	| "tanuki-applause"
	| "tanuki-celebrate"
	| "tanuki-listening"
	| "tanuki-wave"
	| "tengu-celebrate"
	| "tengu-teaching"
	| "tengu-welcome";

/**
 * How large a mascot stands: a peek beside a heading, a figure beside a card, a host, or the
 * whole width of a wrapper that sizes it.
 */
const MASCOT_SIZES = { sm: "4.5rem", md: "7rem", lg: "9rem", fill: "100%" } as const;

namespace Mascot {
	/** Props of one character standing in the page. */
	export interface Props {
		pose: MascotPose;
		size?: keyof typeof MASCOT_SIZES;
		/** Degrees the character leans, for a little life where several stand together. */
		tilt?: number;
	}
}

/**
 * One of the companions keeping the reader company outside their own band. Decorative, so it
 * carries empty alt text: the companions band introduces each character by name and role.
 *
 * @param handle Runtime handle carrying the pose, size and lean.
 * @returns The render function producing the character.
 */
export function Mascot(handle: Handle<Mascot.Props>) {
	return () => {
		let { pose, size = "md", tilt = 0 } = handle.props;
		return (
			<img
				src={`${WAKABA_ASSETS}/characters/${pose}.webp`}
				alt=""
				width={360}
				height={360}
				loading="lazy"
				decoding="async"
				mix={[
					block(),
					shrink(0),
					raw({
						inlineSize: MASCOT_SIZES[size],
						blockSize: size === "fill" ? "auto" : MASCOT_SIZES[size],
						rotate: `${tilt}deg`,
					}),
				]}
			/>
		);
	};
}
