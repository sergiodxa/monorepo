/**
 * The playable card on Encore's landing: a taste of the game with a small sample of the deck.
 * Tap to flip, draw the next one or shuffle, with the app's own sounds while the header's
 * speaker is on; once the sample runs out the table points to the App Store for the rest.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { ShuffleIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { block } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { landingCtaChrome } from "@sdxc/ui/styles";
import { clientEntry, on } from "remix/component";

import type { BadgeLanguage } from "~/resources/views/app-pages/app-store-badge";

import { play } from "~/resources/components/encore-sound";
import { AppStoreBadge } from "~/resources/views/app-pages/app-store-badge";
import { PlayingCard } from "~/resources/views/encore/card";

/** One card of the sample: its uppercase title and its challenge. */
export interface SampleCard {
	title?: string;
	prompt: string;
}

/** Props of the playable card. */
export interface EncoreDrawProps {
	/** The sample, in the order it deals: a few real cards, never the whole deck. */
	cards: ReadonlyArray<SampleCard>;
	/** The App Store badge the table shows once the sample runs out. */
	store: { href: string; label: string; language: BadgeLanguage };
	labels: {
		/** The app's hint on a face-down card, which names the card for assistive technology. */
		reveal: string;
		draw: string;
		shuffle: string;
		/** Where the reader is in the sample, with `{count}` and `{total}` where the numbers go. */
		left: string;
		/** What the table says once the sample runs out. */
		end: string;
	};
}

/** How long a card takes to leave the table before the next one lands, as in the app's swipe. */
const SWIPE_MS = 220;

/** Whether the reader asked for less motion, so cards change without travelling. */
function prefersLessMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * The island. It renders the first card face down on the server, so the page shows a real
 * card before it loads. Its shuffle button sits in the corner of the nearest positioned
 * ancestor, the band's stage. Every control works with mouse, touch and keyboard.
 */
export const EncoreDraw = clientEntry(
	import.meta.url,
	function EncoreDraw(handle: Handle<EncoreDrawProps>) {
		let index = 0;
		let revealed = false;
		let leaving = false;
		let timer: ReturnType<typeof setTimeout> | undefined;
		handle.signal.addEventListener("abort", () => clearTimeout(timer));

		/** Flips the face-down card over. */
		function reveal() {
			if (revealed) return;
			revealed = true;
			play("reveal");
			void handle.update();
		}

		/**
		 * Sends the card off the table and lands the next one face up, as a swipe does; after the
		 * last card of the sample, the table ends on the App Store.
		 */
		function draw() {
			let next = () => {
				index = Math.min(index + 1, handle.props.cards.length);
				revealed = true;
				leaving = false;
				void handle.update();
			};
			if (prefersLessMotion()) return next();
			leaving = true;
			void handle.update();
			clearTimeout(timer);
			timer = setTimeout(next, SWIPE_MS);
		}

		/** Deals the sample again from the first card, face down, as a shake does. */
		function shuffle() {
			index = 0;
			revealed = false;
			leaving = false;
			play("shuffle");
			void handle.update();
		}

		return () => {
			let { cards, labels, store } = handle.props;
			let card = cards[index];
			return (
				<div
					mix={[
						raw({
							display: "grid",
							justifyItems: "center",
							gap: "1rem",
							textAlign: "center",
						}),
					]}
				>
					{card ? (
						<button
							type="button"
							aria-label={revealed ? undefined : labels.reveal}
							aria-live="polite"
							mix={[
								on("click", () => (revealed ? draw() : reveal())),
								raw({
									inlineSize: "min(16rem, 64vw)",
									padding: "0",
									border: "0",
									background: "none",
									cursor: "pointer",
									perspective: "1400px",
									borderRadius: "1.25rem",
									"&:focus-visible": {
										outline: "2px solid var(--app-accent)",
										outlineOffset: "6px",
									},
								}),
							]}
						>
							<span
								data-revealed={revealed ? "" : undefined}
								data-leaving={leaving ? "" : undefined}
								mix={[
									raw({
										display: "grid",
										transformStyle: "preserve-3d",
										"&[data-revealed]": { transform: "rotateY(180deg)" },
										"&[data-leaving]": {
											transform: "translateX(70%) rotate(14deg) rotateY(180deg)",
											opacity: "0",
										},
										"@media (prefers-reduced-motion: no-preference)": {
											transition: "transform 0.6s cubic-bezier(0.3, 1.4, 0.5, 1)",
											"&[data-leaving]": {
												transition: `transform ${SWIPE_MS}ms ease-in, opacity ${SWIPE_MS}ms ease-in`,
											},
										},
										"& > *": { gridArea: "1 / 1", backfaceVisibility: "hidden" },
									}),
								]}
							>
								<span mix={[block()]}>
									<PlayingCard faceDown />
								</span>
								<span mix={[block(), raw({ transform: "rotateY(180deg)" })]}>
									<PlayingCard title={card.title} prompt={card.prompt} />
								</span>
							</span>
							{revealed ? (
								<span mix={[visuallyHidden()]}>
									{card.title}. {card.prompt}
								</span>
							) : null}
						</button>
					) : (
						<div mix={[raw({ inlineSize: "min(16rem, 64vw)", opacity: "0.85" })]}>
							<PlayingCard faceDown />
						</div>
					)}
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								justifyContent: "center",
								alignItems: "center",
								gap: "0.75rem",
								minBlockSize: "3rem",
							}),
						]}
					>
						{card ? (
							<Button type="button" mix={[on("click", draw), landingCtaChrome()]}>
								{labels.draw}
							</Button>
						) : (
							<AppStoreBadge href={store.href} label={store.label} language={store.language} />
						)}
					</div>
					<p
						aria-live={card ? undefined : "polite"}
						mix={[
							raw({
								margin: "0",
								display: "grid",
								alignContent: "start",
								justifyItems: "center",
								blockSize: "3rem",
								maxInlineSize: "22rem",
								lineHeight: "1.5",
								textWrap: "balance",
								fontSize: card ? "0.8125rem" : "1rem",
								fontWeight: card ? "400" : "600",
								fontVariantNumeric: "tabular-nums",
								color: card ? "var(--ui-neutral-fg)" : "var(--ui-neutral-fg-emphasis)",
							}),
						]}
					>
						{card
							? labels.left
									.replace("{count}", String(index + 1))
									.replace("{total}", String(cards.length))
							: labels.end}
					</p>
					<button
						type="button"
						aria-label={labels.shuffle}
						title={labels.shuffle}
						mix={[
							on("click", shuffle),
							raw({
								position: "absolute",
								insetBlockStart: "0.75rem",
								insetInlineEnd: "0.75rem",
								display: "grid",
								placeItems: "center",
								inlineSize: "2.5rem",
								blockSize: "2.5rem",
								padding: "0",
								borderRadius: "9999px",
								border: "0",
								cursor: "pointer",
								color: "var(--ui-neutral-fg-emphasis)",
								backgroundColor: "color-mix(in srgb, var(--app-card) 70%, transparent)",
								boxShadow: "inset 0 0 0 1px var(--ui-landing-hairline)",
								"&:hover": { backgroundColor: "var(--app-card)" },
								"&:focus-visible": {
									outline: "2px solid var(--app-accent)",
									outlineOffset: "2px",
								},
								"@media (prefers-reduced-motion: no-preference)": {
									transition: "rotate 0.3s ease",
									"&:active": { rotate: "-20deg" },
								},
							}),
						]}
					>
						<ShuffleIcon size={18} aria-hidden="true" />
					</button>
				</div>
			);
		};
	},
);
