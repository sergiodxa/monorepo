/**
 * The pieces every Encore page is drawn from: the language provider, the sparkle mark and
 * wordmark, the challenge card drawn from the app's own geometry, and the phone and Watch
 * screens, which hold labelled placeholders until each capture is exported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { block, hstack, shrink, vstack } from "@sdxc/u/layout";
import { motionSafe } from "@sdxc/u/responsive";
import { is } from "@sdxc/u/size";
import { focusVisible } from "@sdxc/u/state";
import { font, leading, text, weight } from "@sdxc/u/typography";

import type { CardId, EncoreCopy, ScreenName } from "~/resources/content/encore/copy";

import { ENCORE_APP_STORE_URL, inLanguage } from "~/config/encore";
import { ENCORE_COPY } from "~/resources/content/encore";
import { EN } from "~/resources/content/encore/en";
import { AppStoreBadge } from "~/resources/views/app-pages/app-store-badge";
import { PhoneFrame, screenCorners } from "~/resources/views/app-pages/phone";
import { PlayingCard, sparklePath } from "~/resources/views/encore/card";
import routes from "~/routes/web";

/** Where the pages' images are served from. */
export const ENCORE_ASSETS = "/apps/encore";

namespace EncoreLanguage {
	/** Props of the language provider. */
	export interface Props {
		copy: EncoreCopy;
		children: RemixNode;
	}
}

/**
 * Hands one language's copy to every Encore component inside it, so the bands, the cards and
 * the screens all print in the page's language.
 *
 * @param handle Runtime handle carrying the copy and the page.
 * @returns The render function producing the page unchanged.
 */
export function EncoreLanguage(handle: Handle<EncoreLanguage.Props, EncoreCopy>) {
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
 * The copy of the language the nearest {@link EncoreLanguage} provides, English outside one.
 *
 * @param handle The reading component's runtime handle.
 * @returns The page's copy.
 */
export function copyOf(handle: ContextReader): EncoreCopy {
	return (handle.context.get(EncoreLanguage) as EncoreCopy | undefined) ?? EN;
}

/**
 * The mark beside the wordmark until the app icon's own mark is exported: the card back's
 * applause burst, a sparkle inside eight rays, in the current text colour. Decorative.
 *
 * @param handle Runtime handle carrying the edge length in pixels.
 * @returns The render function producing the mark.
 */
export function EncoreMark(handle: Handle<{ size: number }>) {
	return () => {
		let rays = Array.from({ length: 8 }, (_, index) => {
			let angle = (index * Math.PI) / 4 + Math.PI / 8;
			let inner = 9;
			let outer = index % 2 === 0 ? 15 : 13;
			return {
				key: index,
				d: `M${16 + Math.cos(angle) * inner} ${16 + Math.sin(angle) * inner}L${16 + Math.cos(angle) * outer} ${16 + Math.sin(angle) * outer}`,
			};
		});
		return (
			<svg
				width={handle.props.size}
				height={handle.props.size}
				viewBox="0 0 32 32"
				aria-hidden="true"
				mix={[shrink(0)]}
			>
				<path d={sparklePath(16, 16, 7.5)} fill="currentColor" />
				{rays.map((ray) => (
					<path
						key={ray.key}
						d={ray.d}
						stroke="currentColor"
						strokeWidth={2.2}
						strokeLinecap="round"
					/>
				))}
			</svg>
		);
	};
}

/**
 * The wordmark linking home: the sparkle beside ENCORE in widely spaced gold capitals, the
 * lockup the App Store campaign uses.
 *
 * @returns The render function producing the link.
 */
export function Wordmark(handle: Handle) {
	return () => (
		<a
			href={inLanguage(routes.encore.href(), copyOf(handle).locale)}
			aria-label="Encore"
			mix={[
				hstack({ gap: 2, align: "center" }),
				raw({
					color: "var(--encore-gold-ink)",
					textDecoration: "none",
					letterSpacing: "0.32em",
					marginInlineEnd: "-0.32em",
				}),
				font("sans"),
				text("base"),
				weight("semibold"),
				focusVisible(raw({ outline: "2px solid currentColor", outlineOffset: "4px" })),
			]}
		>
			<EncoreMark size={26} />
			<span aria-hidden="true">ENCORE</span>
		</a>
	);
}

/**
 * The download call every Encore page repeats: Apple's badge, in the page's language, linking
 * the listing.
 *
 * @returns The render function producing the badge.
 */
export function AppStoreCall(handle: Handle) {
	return () => {
		let copy = copyOf(handle);
		return (
			<AppStoreBadge href={ENCORE_APP_STORE_URL} label={copy.appStore} language={copy.badge} />
		);
	};
}

/**
 * One capture of the app: its path under `/apps/encore/` without the extension, whether it
 * was shot in both appearances (`-light`/`-dark`), its pixel size, and whether the file is
 * in `public/` yet. Setting `ready` once the file is there swaps the placeholder for it.
 */
interface Screen {
	file: string;
	dark: boolean;
	width: number;
	height: number;
	ready: boolean;
}

/** The folder of the captures shot in each page language. */
const CAPTURES = { en: "en", "es-AR": "es", ja: "ja" } as const;

/**
 * The captures the pages frame, each under its language's folder. Phone screens are 560 × 1218, half the device's width, so
 * they stay sharp at the 280px a phone is drawn at; Watch screens are the 416 × 496 capture.
 */
export const SCREENS: Record<ScreenName, Screen> = {
	"card-back": {
		file: "screenshots/{lang}/card-back",
		dark: true,
		width: 560,
		height: 1218,
		ready: false,
	},
	challenge: {
		file: "screenshots/{lang}/challenge",
		dark: true,
		width: 560,
		height: 1218,
		ready: false,
	},
	swipe: { file: "screenshots/{lang}/swipe", dark: true, width: 560, height: 1218, ready: false },
	shuffle: {
		file: "screenshots/{lang}/shuffle",
		dark: true,
		width: 560,
		height: 1218,
		ready: false,
	},
	generated: {
		file: "screenshots/{lang}/generated",
		dark: true,
		width: 560,
		height: 1218,
		ready: false,
	},
	"watch-ready": {
		file: "watch/{lang}/card-ready",
		dark: false,
		width: 416,
		height: 496,
		ready: false,
	},
	"watch-challenge": {
		file: "watch/{lang}/challenge",
		dark: false,
		width: 416,
		height: 496,
		ready: false,
	},
};

namespace Capture {
	/** Props of one capture or its placeholder. */
	export interface Props {
		screen: ScreenName;
		/** Loads at once with high priority, for the screens in the first viewport. */
		eager?: boolean;
		/** The corners the capture clips to inside its frame. */
		corners: ReturnType<typeof raw>;
	}
}

/**
 * The capture itself once its file is exported, following the visitor's scheme when it was
 * shot in both; until then a placeholder of the same size naming the screen and the file to
 * export, so the layout already holds the real proportions.
 *
 * @param handle Runtime handle carrying the screen, its priority and its corners.
 * @returns The render function producing the picture or the placeholder.
 */
function Capture(handle: Handle<Capture.Props>) {
	return () => {
		let { corners, eager, screen } = handle.props;
		let copy = copyOf(handle);
		let template = SCREENS[screen];
		let shot = { ...template, file: template.file.replace("{lang}", CAPTURES[copy.locale]) };
		let alt = copy.screens[screen];
		let base = shot.dark ? `${shot.file}-light` : shot.file;

		if (!shot.ready) {
			return (
				<div
					role="img"
					aria-label={alt}
					data-placeholder={screen}
					mix={[
						corners,
						vstack({ gap: 2, align: "center", justify: "center" }),
						raw({
							aspectRatio: `${shot.width} / ${shot.height}`,
							paddingInline: "12%",
							textAlign: "center",
							background: "var(--encore-backdrop)",
							color: "var(--encore-card-ink)",
							outline: "1px dashed color-mix(in srgb, currentColor 35%, transparent)",
							outlineOffset: "-0.6rem",
						}),
					]}
				>
					<span
						mix={[
							text("xs"),
							weight("semibold"),
							raw({ textTransform: "uppercase", letterSpacing: "0.14em", opacity: "0.7" }),
						]}
					>
						{copy.placeholder}
					</span>
					<span mix={[text("sm"), weight("semibold"), leading("snug")]}>{alt}</span>
					<code
						mix={[
							raw({ fontSize: "0.625rem", opacity: "0.7", overflowWrap: "anywhere" }),
							leading("snug"),
						]}
					>
						{shot.dark ? `${shot.file}-{light,dark}.webp` : `${shot.file}.webp`}
					</code>
				</div>
			);
		}

		return (
			<picture mix={[block(), corners]}>
				{shot.dark ? (
					<source
						media="(prefers-color-scheme: dark)"
						srcSet={`${ENCORE_ASSETS}/${shot.file}-dark.webp`}
						width={shot.width}
						height={shot.height}
					/>
				) : null}
				<img
					src={`${ENCORE_ASSETS}/${base}.webp`}
					alt={alt}
					width={shot.width}
					height={shot.height}
					loading={eager ? "eager" : "lazy"}
					decoding="async"
					fetchpriority={eager ? "high" : undefined}
					mix={[block(), is("full"), raw({ blockSize: "auto" })]}
				/>
			</picture>
		);
	};
}

namespace Phone {
	/** Props of a framed phone screen. */
	export interface Props {
		screen: ScreenName;
		eager?: boolean;
	}
}

/**
 * A phone screen in the shared bezel: the capture once it exists, its placeholder until then.
 *
 * @param handle Runtime handle carrying the screen and its loading priority.
 * @returns The render function producing the framed screen.
 */
export function Phone(handle: Handle<Phone.Props>) {
	return () => (
		<PhoneFrame>
			<Capture screen={handle.props.screen} eager={handle.props.eager} corners={screenCorners()} />
		</PhoneFrame>
	);
}

/**
 * An Apple Watch screen in a rounded-square bezel, the capture's proportions inside.
 *
 * @param handle Runtime handle carrying the screen.
 * @returns The render function producing the framed screen.
 */
export function Watch(handle: Handle<{ screen: ScreenName }>) {
	return () => (
		<div
			mix={[
				is("full"),
				raw({
					padding: "7%",
					backgroundColor: "var(--app-bezel)",
					borderRadius: "30% / 26%",
					boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12), var(--encore-card-shadow)",
				}),
			]}
		>
			<Capture
				screen={handle.props.screen}
				corners={raw({ overflow: "hidden", borderRadius: "22% / 19%" })}
			/>
		</div>
	);
}

/** The ornament colours a sparkle can take. */
const SPARKLE_COLORS = [
	"var(--encore-gold)",
	"var(--encore-coral)",
	"var(--encore-violet)",
	"var(--encore-pink)",
] as const;

/** The app's four-point sparkle as a mask, so CSS can paint and animate it in any colour. */
const SPARKLE_MASK = `url("data:image/svg+xml,${encodeURIComponent(
	'<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20"><path d="M10 0C11.8 8.2 11.8 8.2 20 10C11.8 11.8 11.8 11.8 10 20C8.2 11.8 8.2 11.8 0 10C8.2 8.2 8.2 8.2 10 0Z"/></svg>',
)}")`;

/**
 * Where the sparkles sit: a deterministic scatter, alternating sides, each placed a fraction of
 * the way into its side's gutter, so the same render always draws the same sky.
 */
function scatter(seed: number, count: number) {
	let state = seed * 9301 + 49297;
	let next = () => {
		state = (state * 9301 + 49297) % 233280;
		return state / 233280;
	};
	return Array.from({ length: count }, (_, index) => {
		let side = index % 2 === 0;
		return {
			key: index,
			start: side,
			depth: 0.15 + next() * 0.7,
			y: 4 + next() * 92,
			size: 8 + Math.round(next() * 10),
			color: SPARKLE_COLORS[Math.floor(next() * SPARKLE_COLORS.length)] ?? SPARKLE_COLORS[0],
			duration: 2.4 + next() * 2.6,
			delay: -next() * 5,
		};
	});
}

namespace Sparkles {
	/** Props of a band's sparkle field. */
	export interface Props {
		/** Picks the scatter. */
		seed: number;
		/** How many sparkles the field holds. @default 8 */
		count?: number;
	}
}

/**
 * The app's sparkles scattered down the page's gutters, outside the 72rem content column, each
 * shining on its own rhythm in pure CSS, and still for readers who ask for less motion.
 * Decorative; it fills its positioned parent above the bands, staying out of every column.
 *
 * @param handle Runtime handle carrying the scatter's seed and size.
 * @returns The render function producing the field.
 */
export function Sparkles(handle: Handle<Sparkles.Props>) {
	return () => (
		<span
			aria-hidden="true"
			mix={[
				raw({
					position: "absolute",
					inset: "0",
					zIndex: "1",
					pointerEvents: "none",
					overflow: "hidden",
					opacity: "0.8",
					"--sparkle-gutter": "max(1rem, calc((100% - 72rem) / 2))",
				}),
			]}
		>
			{scatter(handle.props.seed, handle.props.count ?? 8).map((sparkle) => (
				<span
					key={sparkle.key}
					mix={[
						keyframes("encore-shine", {
							"0%, 100%": { scale: "1", opacity: "1", rotate: "0deg" },
							"50%": { scale: "0.45", opacity: "0.35", rotate: "45deg" },
						}),
						raw({
							position: "absolute",
							insetInlineStart: sparkle.start
								? `calc(var(--sparkle-gutter) * ${sparkle.depth.toFixed(2)})`
								: `calc(100% - var(--sparkle-gutter) * ${sparkle.depth.toFixed(2)} - ${sparkle.size}px)`,
							insetBlockStart: `${sparkle.y.toFixed(1)}%`,
							inlineSize: `${sparkle.size}px`,
							blockSize: `${sparkle.size}px`,
							backgroundColor: sparkle.color,
							maskImage: SPARKLE_MASK,
							maskSize: "contain",
						}),
						motionSafe(
							raw({
								animationName: "encore-shine",
								animationDuration: `${sparkle.duration.toFixed(2)}s`,
								animationDelay: `${sparkle.delay.toFixed(2)}s`,
								animationTimingFunction: "ease-in-out",
								animationIterationCount: "infinite",
							}),
						),
					]}
				/>
			))}
		</span>
	);
}

namespace DeckCard {
	/** Props of one card from the deck. */
	export interface Props {
		card: CardId;
		/** The face's capitals for a generated challenge, which has no title of its own. */
		badge?: string;
	}
}

/**
 * One card from the deck, face up, in the page's language: its title and prompt as the app
 * prints them.
 *
 * @param handle Runtime handle carrying the card's id.
 * @returns The render function producing the card.
 */
export function DeckCard(handle: Handle<DeckCard.Props>) {
	return () => {
		let text = copyOf(handle).cards[handle.props.card];
		return <PlayingCard title={text.title ?? handle.props.badge} prompt={text.prompt} />;
	};
}

namespace FlipCard {
	/** Props of a card the reader can turn over. */
	export interface Props {
		card: CardId;
		/** Labels the generated card's face, which carries no title. */
		badge?: string;
		/** Degrees the card leans, for a hand dealt on a table rather than a grid. */
		tilt?: number;
	}
}

/**
 * A face-down card the reader turns over with a tap, the way a round starts in the app: a
 * native checkbox named with the app's own "Tap to reveal" flips it in 3D, with no script.
 * Under reduced motion it swaps faces at once; tapping again turns it back.
 *
 * @param handle Runtime handle carrying the card and its lean.
 * @returns The render function producing the card.
 */
export function FlipCard(handle: Handle<FlipCard.Props>) {
	return () => {
		let { badge, card, tilt = 0 } = handle.props;
		let copy = copyOf(handle);
		let title = copy.cards[card].title ?? badge ?? "";
		return (
			<label
				mix={[
					block(),
					raw({
						cursor: "pointer",
						perspective: "1200px",
						rotate: `${tilt}deg`,
						"&:has(input:focus-visible)": {
							outline: "2px solid var(--app-accent)",
							outlineOffset: "6px",
							borderRadius: "1rem",
						},
					}),
				]}
			>
				<input type="checkbox" mix={[visuallyHidden()]} />
				<span mix={[visuallyHidden()]}>
					{copy.deck.reveal}: {title}
				</span>
				<span
					aria-hidden="true"
					mix={[
						block(),
						raw({
							display: "grid",
							transformStyle: "preserve-3d",
							"@media (prefers-reduced-motion: no-preference)": {
								transition: "transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1)",
							},
							":is(input:checked) ~ &": { transform: "rotateY(180deg)" },
							"& > *": { gridArea: "1 / 1", backfaceVisibility: "hidden" },
						}),
					]}
				>
					<span mix={[block()]}>
						<PlayingCard faceDown />
					</span>
					<span mix={[block(), raw({ transform: "rotateY(180deg)" })]}>
						<DeckCard card={card} badge={badge} />
					</span>
				</span>
			</label>
		);
	};
}

/**
 * The language of a page and the copy for it, for a view that receives only the locale.
 *
 * @param locale The page's language.
 * @returns The copy in that language.
 */
export function encoreCopy(locale: EncoreCopy["locale"]): EncoreCopy {
	return ENCORE_COPY[locale];
}
