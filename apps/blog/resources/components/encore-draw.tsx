/**
 * The playable card on Encore's landing: a round of the game in the page. Tap the card to
 * flip it, draw the next one, or shuffle the deck, with the app's own synthesized reveal and
 * shuffle sounds, on from the start since every sound answers the reader's own tap.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { visuallyHidden } from "@sdxc/u/a11y";
import { raw } from "@sdxc/u/general";
import { block } from "@sdxc/u/layout";
import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

import type { DeckEntry } from "~/resources/content/encore/deck";

import { PlayingCard } from "~/resources/views/encore/card";

/** Props of the playable card. */
export interface EncoreDrawProps {
	/** The deck in the order it deals, already shuffled. */
	cards: ReadonlyArray<DeckEntry>;
	labels: {
		/** The app's hint on a face-down card, which names the card for assistive technology. */
		reveal: string;
		draw: string;
		shuffle: string;
		sound: string;
		/** Where the reader is in the deck, with `{count}` and `{total}` where the numbers go. */
		left: string;
	};
}

/** How long a card takes to leave the table before the next one lands, as in the app's swipe. */
const SWIPE_MS = 220;

/** Whether the reader asked for less motion, so cards change without travelling. */
function prefersLessMotion(): boolean {
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * A mono buffer filled from `sample(time, duration)`, the way the app builds its effects, so
 * the page plays the same sounds without shipping a file.
 */
function buffer(
	context: AudioContext,
	duration: number,
	sample: (time: number, duration: number) => number,
): AudioBuffer {
	let rate = context.sampleRate;
	let result = context.createBuffer(1, Math.floor(rate * duration), rate);
	let data = result.getChannelData(0);
	for (let frame = 0; frame < data.length; frame++) data[frame] = sample(frame / rate, duration);
	return result;
}

/** The app's reveal: a 0.1 s rising chirp from 620 to 980 Hz under a sine envelope. */
function revealSound(time: number, duration: number): number {
	let progress = time / duration;
	return Math.sin(2 * Math.PI * (620 + 360 * progress) * time) * Math.sin(Math.PI * progress) * 0.5;
}

/** The app's shuffle: a 0.28 s fluttering tone, like a deck riffled under a thumb. */
function shuffleSound(time: number, duration: number): number {
	let progress = time / duration;
	let pulses = Math.max(0, Math.sin(2 * Math.PI * 15 * time)) ** 3;
	let frequency = 680 + 180 * Math.sin(2 * Math.PI * 6 * time);
	return Math.sin(2 * Math.PI * frequency * time) * (1 - progress) * (0.35 + 0.65 * pulses) * 0.6;
}

/** The audio session's kind, which Safari reads to follow the ringer switch. */
interface AudioSessionNavigator {
	audioSession?: { type: string };
}

/**
 * The island. It renders the first card face down on the server, so the page shows a real
 * card before it loads; once loaded, every control works with mouse, touch and keyboard.
 */
export const EncoreDraw = clientEntry(
	import.meta.url,
	function EncoreDraw(handle: Handle<EncoreDrawProps>) {
		let index = 0;
		let revealed = false;
		let leaving = false;
		let soundOn = true;
		let audio: AudioContext | undefined;
		let timer: ReturnType<typeof setTimeout> | undefined;
		handle.signal.addEventListener("abort", () => {
			clearTimeout(timer);
			void audio?.close();
		});

		/** Plays one of the app's effects, when the reader switched sound on. */
		function play(sample: typeof revealSound, duration: number) {
			if (!soundOn) return;
			let session = (navigator as AudioSessionNavigator).audioSession;
			if (session) session.type = "ambient";
			audio ??= new AudioContext();
			let source = audio.createBufferSource();
			source.buffer = buffer(audio, duration, sample);
			source.connect(audio.destination);
			source.start();
		}

		/** Flips the face-down card over. */
		function reveal() {
			if (revealed) return;
			revealed = true;
			play(revealSound, 0.1);
			void handle.update();
		}

		/** Sends the card off the table and lands the next one face up, as a swipe does. */
		function draw() {
			let next = () => {
				index = (index + 1) % handle.props.cards.length;
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

		/** Starts a fresh deck from a random card, face down, as a shake does. */
		function shuffle() {
			index = Math.floor(Math.random() * handle.props.cards.length);
			revealed = false;
			leaving = false;
			play(shuffleSound, 0.28);
			void handle.update();
		}

		return () => {
			let { cards, labels } = handle.props;
			let card = cards[index] ?? cards[0];
			return (
				<div
					mix={[
						raw({
							display: "grid",
							justifyItems: "center",
							gap: "1.25rem",
						}),
					]}
				>
					<button
						type="button"
						aria-label={revealed ? undefined : labels.reveal}
						aria-live="polite"
						mix={[
							on("click", () => (revealed ? draw() : reveal())),
							raw({
								inlineSize: "min(18rem, 78vw)",
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
								<PlayingCard title={card?.title} prompt={card?.prompt} />
							</span>
						</span>
						{revealed && card ? (
							<span mix={[visuallyHidden()]}>
								{card.title}. {card.prompt}
							</span>
						) : null}
					</button>
					<div
						mix={[
							raw({
								display: "flex",
								flexWrap: "wrap",
								justifyContent: "center",
								alignItems: "center",
								gap: "0.75rem",
							}),
						]}
					>
						<Button type="button" mix={[on("click", draw)]}>
							{labels.draw}
						</Button>
						<Button type="button" variant="surface" mix={[on("click", shuffle)]}>
							{labels.shuffle}
						</Button>
						<label
							mix={[
								raw({
									display: "inline-flex",
									alignItems: "center",
									gap: "0.5rem",
									fontSize: "0.875rem",
									cursor: "pointer",
								}),
							]}
						>
							<input
								type="checkbox"
								checked={soundOn}
								mix={[
									on("change", (event) => {
										soundOn = event.currentTarget.checked;
										void handle.update();
									}),
									raw({ accentColor: "var(--app-accent)", inlineSize: "1rem", blockSize: "1rem" }),
								]}
							/>
							{labels.sound}
						</label>
					</div>
					<p
						mix={[
							raw({
								margin: "0",
								fontSize: "0.8125rem",
								fontVariantNumeric: "tabular-nums",
								color: "var(--ui-neutral-fg)",
							}),
						]}
					>
						{labels.left
							.replace("{count}", String(index + 1))
							.replace("{total}", String(cards.length))}
					</p>
				</div>
			);
		};
	},
);
