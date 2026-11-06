/**
 * The pieces every Wakaba page is drawn from: the 学 mark, the phone a real screenshot is
 * framed in, and the App Store call, which stays a "coming soon" note until the listing has
 * an id. Screens and art are optimised copies under `/apps/wakaba/` in `public/`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { HourglassIcon, SmartphoneIcon } from "@sdxc/icons";
import { bg, border, fg } from "@sdxc/u/color";
import { rounded } from "@sdxc/u/effects";
import { raw } from "@sdxc/u/general";
import { block, hstack, shrink, vstack } from "@sdxc/u/layout";
import { bs, is, m, maxIs, p, pi } from "@sdxc/u/size";
import { focusVisible, hover } from "@sdxc/u/state";
import { leading, nowrap, text, weight } from "@sdxc/u/typography";
import { interactiveTransition } from "@sdxc/ui/styles";

import { appStoreUrl } from "~/config/wakaba";

/** Where the page's optimised images are served from. */
export const WAKABA_ASSETS = "/apps/wakaba";

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
	alt: string;
	dark?: boolean;
}

/**
 * The real captures the pages frame: app screenshots under `screenshots/` and widget gallery
 * captures under `widgets/`. Each is the English capture at 560 × 1218, half the device's
 * width, so it stays sharp at the 280px a phone is drawn at.
 */
export const SCREENS = {
	"path-kitsune": {
		file: "screenshots/path-kitsune",
		alt: "Wakaba's learning path at Level 1: numbered session stones, with Kitsune pointing to the next one.",
	},
	"flashcards-fish": {
		file: "screenshots/flashcards-fish",
		alt: "A flashcard for 魚, fish: furigana さかな above the kanji and the romaji sakana below.",
		dark: true,
	},
	practice: {
		file: "screenshots/practice",
		alt: "A practice question asking for the meaning of みず, with Aka Oni beside the word and three answers below.",
		dark: true,
	},
	"flashcards-water": {
		file: "screenshots/flashcards-water",
		alt: "A flashcard for 水, water: furigana みず over the kanji, the meaning and the romaji mizu.",
	},
	conjugations: {
		file: "screenshots/conjugations",
		alt: "The details of 食べる, to eat: its dictionary form and conjugations such as 食べます and 食べません.",
	},
	"level-exam-path": {
		file: "screenshots/level-exam-path",
		alt: "The learning path reaching the Level 2 exam, with Kitsune beside the next sessions.",
	},
	listening: {
		file: "screenshots/listening",
		alt: "A listening question: a speaker button plays the word and three meanings wait below.",
	},
	speaking: {
		file: "screenshots/speaking",
		alt: "Speaking practice asking the learner to say みず aloud, with a microphone button.",
	},
	"build-sentence": {
		file: "screenshots/build-sentence",
		alt: "A sentence to build in Japanese from word tiles, for “I ask the teacher a question.”",
	},
	"conjugation-practice": {
		file: "screenshots/conjugation-practice",
		alt: "A conjugation question: write たべる, to eat, in its polite non-past form.",
	},
	"oni-correction": {
		file: "screenshots/oni-correction",
		alt: "Aka Oni after a wrong answer: the right word みず, water, and a note on how it differs.",
	},
	"kana-tracing": {
		file: "screenshots/kana-tracing",
		alt: "Katakana tracing practice: a stroke drawn over the guide, numbered in stroke order.",
	},
	"stroke-guide": {
		file: "screenshots/stroke-guide",
		alt: "The stroke-order guide for 水, its second stroke highlighted and numbered.",
	},
	"new-word": {
		file: "screenshots/new-word",
		alt: "A new word introduced before any question: みず, water, mizu, with Tengu and a Start exercise button.",
	},
	"practice-feedback": {
		file: "screenshots/practice-feedback",
		alt: "A correct answer: “You got it!” over みず, water, mizu, with a Next word button.",
	},
	"oni-mistakes": {
		file: "screenshots/oni-mistakes",
		alt: "A review of earlier mistakes with Aka Oni, asking for the reading of みず in romaji.",
	},
	"widget-progress": {
		file: "widgets/progress-medium",
		alt: "The Practice bonsai widget in the iOS widget gallery: a bonsai, a 23-day streak, 36 words learned and “Practiced today”.",
		dark: true,
	},
	"widget-word": {
		file: "widgets/word-large",
		alt: "The Word of the day widget in the iOS widget gallery: 機, ki, machine (kanji component).",
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
		let shot: Screen = SCREENS[screen];
		let base = shot.dark ? `${shot.file}-light` : shot.file;

		return (
			<div
				mix={[
					is("full"),
					p(1.5),
					raw({
						backgroundColor: "var(--wakaba-bezel)",
						borderRadius: "15% / 7%",
						boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
					}),
				]}
			>
				<picture mix={[block(), raw({ overflow: "hidden", borderRadius: "12.5% / 5.8%" })]}>
					{shot.dark ? (
						<source
							media="(prefers-color-scheme: dark)"
							srcSet={`${WAKABA_ASSETS}/${shot.file}-dark.webp`}
							width={560}
							height={1218}
						/>
					) : null}
					<img
						src={`${WAKABA_ASSETS}/${base}.webp`}
						alt={shot.alt}
						width={560}
						height={1218}
						loading={eager ? "eager" : "lazy"}
						decoding="async"
						fetchpriority={eager ? "high" : undefined}
						mix={[block(), is("full"), raw({ blockSize: "auto" })]}
					/>
				</picture>
			</div>
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
 * The download call every Wakaba page repeats. With a listing it is an ink badge linking to
 * the App Store; before release it is a quiet outlined note that reads as a status, not a
 * control, so nobody taps a link that leads nowhere.
 *
 * @param handle Runtime handle carrying the listing URL.
 * @returns The render function producing the badge or the note.
 */
export function AppStoreCall(handle: Handle<AppStoreCall.Props>) {
	return () => {
		let href = handle.props.href === undefined ? appStoreUrl() : handle.props.href;

		if (!href) {
			return (
				<p
					data-app-store="coming-soon"
					mix={[
						hstack({ gap: 2.5, align: "center" }),
						bs(12),
						pi(5),
						m(0),
						rounded("full"),
						border({ width: 1, color: "brand" }),
						bg("brand.tint"),
						fg("brand.emphasis"),
					]}
				>
					<HourglassIcon size={18} aria-hidden="true" />
					<span mix={[vstack({ gap: 0, align: "start" })]}>
						<span mix={[text("xs"), leading("none")]}>Coming soon to the</span>
						<span mix={[text("base"), weight("semibold"), leading("tight"), nowrap()]}>
							App Store
						</span>
					</span>
				</p>
			);
		}

		return (
			<a
				href={href}
				data-app-store="available"
				mix={[
					hstack({ gap: 2.5, align: "center" }),
					bs(12),
					pi(5),
					maxIs("full"),
					rounded("full"),
					bg("neutral.solid"),
					fg("neutral.onSolid"),
					raw({ textDecoration: "none" }),
					interactiveTransition(),
					hover(bg("neutral.bg-solid-hover")),
					focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "2px" })),
				]}
			>
				<SmartphoneIcon size={18} aria-hidden="true" />
				<span mix={[vstack({ gap: 0, align: "start" })]}>
					<span mix={[text("xs"), leading("none")]}>Download on the</span>
					<span mix={[text("base"), weight("semibold"), leading("tight"), nowrap()]}>
						App Store
					</span>
				</span>
			</a>
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
