/**
 * The pieces every Encore page is drawn from: the language provider, the sparkle mark and
 * wordmark, the challenge card drawn from the app's own geometry, and the phone and Watch
 * screens, which hold labelled placeholders until each capture is exported.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { raw } from "@sdxc/u/general";
import { block, hstack, shrink, vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { focusVisible } from "@sdxc/u/state";
import { font, leading, text, weight } from "@sdxc/u/typography";

import type { CardId, EncoreCopy, ScreenName } from "~/resources/content/encore/copy";

import { ENCORE_APP_STORE_URL, inLanguage } from "~/config/encore";
import { ENCORE_COPY } from "~/resources/content/encore";
import { EN } from "~/resources/content/encore/en";
import { AppStoreBadge } from "~/resources/views/app-pages/app-store-badge";
import { PhoneFrame, screenCorners } from "~/resources/views/app-pages/phone";
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
 * The app's four-point sparkle, as `CardStackView` draws it: four cubic arcs pinched toward
 * the centre, each with both control points 18% of the radius off it.
 *
 * @param cx The centre's x.
 * @param cy The centre's y.
 * @param r The distance from the centre to each point.
 * @returns The SVG path data.
 */
export function sparklePath(cx: number, cy: number, r: number): string {
	let k = r * 0.18;
	return [
		`M${cx} ${cy - r}`,
		`C${cx + k} ${cy - k} ${cx + k} ${cy - k} ${cx + r} ${cy}`,
		`C${cx + k} ${cy + k} ${cx + k} ${cy + k} ${cx} ${cy + r}`,
		`C${cx - k} ${cy + k} ${cx - k} ${cy + k} ${cx - r} ${cy}`,
		`C${cx - k} ${cy - k} ${cx - k} ${cy - k} ${cx} ${cy - r}Z`,
	].join(" ");
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

/** The ornament colours, as the app's gradient stops run: violet into coral into gold. */
const RIBBON_STOPS = ["var(--encore-violet)", "var(--encore-coral)", "var(--encore-gold)"];

/**
 * The four corner flourishes of a card face, in the card's 320 × 460 points: each a ribbon of
 * two cubic curves entering from the edge, with a sparkle beside it.
 */
function faceFlourishes() {
	let ribbons: Array<{ key: string; d: string; sparkle: string; tone: string; flip: boolean }> = [];
	for (let side of [-1, 1]) {
		for (let vertical of [-1, 1]) {
			let y = vertical > 0 ? 28 : 432;
			let x = (offset: number) => 160 + offset * side;
			let d = [
				`M${x(146)} ${y}`,
				`C${x(88)} ${y + 12 * vertical} ${x(142)} ${y + 46 * vertical} ${x(104)} ${y + 66 * vertical}`,
				`C${x(74)} ${y + 76 * vertical} ${x(110)} ${y + 98 * vertical} ${x(132)} ${y + 92 * vertical}`,
			].join(" ");
			ribbons.push({
				key: `${side}${vertical}`,
				d,
				sparkle: sparklePath(x(112), y + 30 * vertical, 7),
				tone: side < 0 ? "var(--encore-pink)" : "var(--encore-gold)",
				flip: vertical < 0,
			});
		}
	}
	return ribbons;
}

/** The sparse sparkles along a card face's edges: point, radius and colour. */
const EDGE_MARKS = [
	[48, 145, 4, "var(--encore-coral)"],
	[272, 145, 4, "var(--encore-violet)"],
	[42, 230, 5, "var(--encore-gold)"],
	[278, 230, 5, "var(--encore-gold)"],
	[48, 315, 4, "var(--encore-violet)"],
	[272, 315, 4, "var(--encore-coral)"],
] as const;

namespace PlayingCard {
	/** Props of a drawn card. */
	export interface Props {
		/** The card whose words it shows, in the page's language; omitted for a face-down card. */
		card?: CardId;
		/** Draws the card back instead of its face. */
		faceDown?: boolean;
		/** Labels the face for a reader that names it, such as the combined-challenge chip. */
		badge?: string;
	}
}

/**
 * A challenge card drawn as the app draws it: 320 × 460 points with 20-point corners, a warm
 * face (plum in dark) with ribbon flourishes cropped into its corners, a calm field in the
 * middle for the prompt, sparkles along the edges and a thin gold inner frame; or the ornate
 * plum back. It scales to its column, its type with it, so it reads the same at any size.
 *
 * @param handle Runtime handle carrying the card and which side shows.
 * @returns The render function producing the card.
 */
export function PlayingCard(handle: Handle<PlayingCard.Props>) {
	return () => {
		let { badge, card, faceDown } = handle.props;
		let text = card ? copyOf(handle).cards[card] : undefined;
		let id = `encore-card-${handle.id}`;

		return (
			<div
				mix={[
					is("full"),
					raw({
						containerType: "inline-size",
						position: "relative",
						aspectRatio: "320 / 460",
						borderRadius: "6.25% / 4.35%",
						overflow: "hidden",
						background: faceDown ? "var(--encore-card-back)" : "var(--encore-card-face)",
						boxShadow: "0 0 0 1px var(--encore-card-border), var(--encore-card-shadow)",
						color: "var(--encore-card-ink)",
						fontFamily: "var(--encore-font-card)",
					}),
				]}
			>
				{faceDown ? <CardBack id={id} /> : <CardFace id={id} />}
				{text && !faceDown ? (
					<div
						mix={[
							raw({
								position: "absolute",
								inset: "0",
								display: "flex",
								flexDirection: "column",
								alignItems: "center",
								paddingBlockStart: "6cqi",
								paddingInline: "10cqi",
								textAlign: "center",
							}),
						]}
					>
						<p
							mix={[
								m(0),
								weight("semibold"),
								raw({
									minBlockSize: "1.4em",
									fontSize: "4cqi",
									letterSpacing: "0.2em",
									textTransform: "uppercase",
									color: "var(--encore-card-muted)",
								}),
							]}
						>
							{text.title ?? badge ?? ""}
						</p>
						<p
							mix={[
								m(0),
								raw({
									marginBlock: "auto",
									fontSize: "7cqi",
									fontWeight: "500",
									lineHeight: "1.3",
									textWrap: "balance",
								}),
							]}
						>
							{text.prompt}
						</p>
					</div>
				) : null}
			</div>
		);
	};
}

/**
 * The ornaments of a card face, scaled with it: the reading field's glow, the four corner
 * ribbons and their sparkles, the edge sparkles and the gold inner frame. Decorative.
 *
 * @param handle Runtime handle carrying an id unique to the card, for its gradient.
 * @returns The render function producing the ornaments.
 */
function CardFace(handle: Handle<{ id: string }>) {
	return () => {
		let id = handle.props.id;
		return (
			<svg
				viewBox="0 0 320 460"
				aria-hidden="true"
				preserveAspectRatio="none"
				mix={[raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<radialGradient
						id={`${id}-field`}
						cx="160"
						cy="230"
						r="178"
						gradientUnits="userSpaceOnUse"
					>
						<stop offset="0.25" stopColor="var(--encore-card-field)" />
						<stop offset="1" stopColor="var(--encore-card-field)" stopOpacity="0" />
					</radialGradient>
					{faceFlourishes().map((ribbon) => (
						<linearGradient
							key={ribbon.key}
							id={`${id}-ribbon-${ribbon.key}`}
							x1="0"
							x2="0"
							y1={ribbon.flip ? "1" : "0"}
							y2={ribbon.flip ? "0" : "1"}
						>
							{RIBBON_STOPS.map((color, index) => (
								<stop key={color} offset={index / 2} stopColor={color} />
							))}
						</linearGradient>
					))}
				</defs>
				<rect x="0" y="0" width="320" height="460" fill={`url(#${id}-field)`} />
				<g mix={[raw({ opacity: "var(--encore-flourish-opacity)" })]}>
					{faceFlourishes().map((ribbon) => (
						<g key={ribbon.key}>
							<path
								d={ribbon.d}
								fill="none"
								stroke={`url(#${id}-ribbon-${ribbon.key})`}
								strokeWidth={9}
								strokeLinecap="round"
							/>
							<path d={ribbon.sparkle} fill={ribbon.tone} />
						</g>
					))}
					{EDGE_MARKS.map(([x, y, r, color]) => (
						<path key={`${x}-${y}`} d={sparklePath(x, y, r)} fill={color} />
					))}
				</g>
				<rect
					x="12"
					y="12"
					width="296"
					height="436"
					rx="13"
					fill="none"
					stroke="var(--encore-gold)"
					strokeWidth={1.5}
					mix={[raw({ opacity: "var(--encore-frame-opacity)" })]}
				/>
			</svg>
		);
	};
}

/**
 * The card back, drawn from the app's own code-native pattern: mirrored ribbons, an applause
 * burst of eighteen rays around a gold sparkle, a dotted ring, small sparkles and a double
 * frame, on the plum gradient. Decorative.
 *
 * @param handle Runtime handle carrying an id unique to the card, for its gradients.
 * @returns The render function producing the back.
 */
function CardBack(handle: Handle<{ id: string }>) {
	return () => {
		let id = handle.props.id;
		let rays = Array.from({ length: 18 }, (_, index) => {
			let angle = (index * Math.PI * 2) / 18;
			let outer = index % 2 === 0 ? 68 : 56;
			return {
				key: index,
				d: `M${160 + Math.cos(angle) * 28} ${230 + Math.sin(angle) * 28}L${160 + Math.cos(angle) * outer} ${230 + Math.sin(angle) * outer}`,
				color: index % 3 === 0 ? "var(--encore-gold)" : "var(--encore-coral)",
				width: index % 2 === 0 ? 7 : 4,
			};
		});
		let ribbons = [-1, 1].map((side) => {
			let x = (offset: number) => 160 + offset * side;
			return {
				key: side,
				outer: `M${x(112)} 42 C${x(30)} 82 ${x(144)} 142 ${x(88)} 222 C${x(22)} 306 ${x(146)} 342 ${x(110)} 418`,
				inner: `M${x(50)} 54 C${x(112)} 92 ${x(8)} 148 ${x(48)} 204 C${x(106)} 266 ${x(4)} 338 ${x(52)} 406`,
			};
		});
		let sparkles = [
			[62, 88, 8, "var(--encore-coral)"],
			[258, 88, 8, "var(--encore-coral)"],
			[82, 172, 6, "var(--encore-gold)"],
			[238, 172, 6, "var(--encore-gold)"],
			[68, 292, 7, "var(--encore-pink)"],
			[252, 292, 7, "var(--encore-pink)"],
			[102, 370, 8, "var(--encore-violet)"],
			[218, 370, 8, "var(--encore-violet)"],
			[160, 112, 7, "var(--encore-gold)"],
			[160, 348, 7, "var(--encore-gold)"],
		] as const;

		return (
			<svg
				viewBox="0 0 320 460"
				aria-hidden="true"
				preserveAspectRatio="none"
				mix={[raw({ position: "absolute", inset: "0", inlineSize: "100%", blockSize: "100%" })]}
			>
				<defs>
					<linearGradient id={`${id}-back`} x1="0" x2="0" y1="0" y2="1">
						{RIBBON_STOPS.map((color, index) => (
							<stop key={color} offset={index / 2} stopColor={color} />
						))}
					</linearGradient>
				</defs>
				{ribbons.map((ribbon) => (
					<g key={ribbon.key}>
						<path
							d={ribbon.outer}
							fill="none"
							stroke={`url(#${id}-back)`}
							strokeWidth={14}
							strokeLinecap="round"
						/>
						<path
							d={ribbon.inner}
							fill="none"
							stroke="var(--encore-pink)"
							strokeWidth={6}
							strokeLinecap="round"
							opacity={0.85}
						/>
					</g>
				))}
				{rays.map((ray) => (
					<path
						key={ray.key}
						d={ray.d}
						stroke={ray.color}
						strokeWidth={ray.width}
						strokeLinecap="round"
					/>
				))}
				<path d={sparklePath(160, 230, 17)} fill="var(--encore-gold)" />
				<circle
					cx="160"
					cy="230"
					r="79"
					fill="none"
					stroke="var(--encore-violet)"
					strokeWidth={2}
					strokeDasharray="2 8"
					opacity={0.28}
				/>
				{sparkles.map(([x, y, r, color]) => (
					<path key={`${x}-${y}`} d={sparklePath(x, y, r)} fill={color} />
				))}
				<rect
					x="12"
					y="12"
					width="296"
					height="436"
					rx="13"
					fill="none"
					stroke="var(--encore-gold)"
					strokeWidth={2}
					opacity={0.9}
				/>
				<rect
					x="18"
					y="18"
					width="284"
					height="424"
					rx="10"
					fill="none"
					stroke="var(--encore-violet)"
					strokeWidth={1}
					opacity={0.65}
				/>
			</svg>
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
