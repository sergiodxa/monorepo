/**
 * The speaker in Encore's header that turns the page's sound effects on and off: a toggle
 * button whose waves pulse while sound is on and give way to a small cross when it is off,
 * blipping up or down as it changes. The choice is remembered in this browser.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { keyframes } from "@sdxc/u/animation";
import { raw } from "@sdxc/u/general";
import { motionSafe } from "@sdxc/u/responsive";
import { clientEntry, on } from "remix/component";

import { play, SOUND_CHANGE, setSoundOn, soundOn } from "~/resources/components/encore-sound";

/** Props of the speaker. */
export interface EncoreSoundToggleProps {
	/** Names the button for assistive technology, "Sound effects" in the page's language. */
	label: string;
}

/**
 * A sound wave's pulse: it fades and breathes outward, the inner wave leading the outer one,
 * only for readers who allow motion.
 */
function pulse(delay: string) {
	return [
		keyframes("encore-wave", {
			"0%, 100%": { opacity: "1", translate: "0 0" },
			"50%": { opacity: "0.35", translate: "1px 0" },
		}),
		motionSafe(
			raw({
				animationName: "encore-wave",
				animationDuration: "1.6s",
				animationDelay: delay,
				animationTimingFunction: "ease-in-out",
				animationIterationCount: "infinite",
			}),
		),
	];
}

/**
 * The island. It renders on, the default, on the server, then reads the reader's stored
 * choice once mounted, and follows any other control that changes it.
 */
export const EncoreSoundToggle = clientEntry(
	import.meta.url,
	function EncoreSoundToggle(handle: Handle<EncoreSoundToggleProps>) {
		let enabled = true;

		handle.queueTask((signal) => {
			enabled = soundOn();
			void handle.update();
			window.addEventListener(
				SOUND_CHANGE,
				(event) => {
					enabled = (event as CustomEvent<boolean>).detail;
					void handle.update();
				},
				{ signal },
			);
		});

		/** Flips the choice, blipping up when sound comes on and down as it goes off. */
		function toggle() {
			enabled = !enabled;
			play(enabled ? "on" : "off", true);
			setSoundOn(enabled);
			void handle.update();
		}

		return () => (
			<button
				type="button"
				aria-pressed={enabled ? "true" : "false"}
				aria-label={handle.props.label}
				title={handle.props.label}
				mix={[
					on("click", toggle),
					raw({
						display: "inline-grid",
						placeItems: "center",
						inlineSize: "2rem",
						blockSize: "2rem",
						marginBlock: "-0.375rem",
						padding: "0",
						border: "0",
						borderRadius: "9999px",
						background: "none",
						color: "var(--ui-neutral-fg)",
						cursor: "pointer",
						"&:hover": { color: "var(--ui-neutral-fg-emphasis)" },
						"&:focus-visible": { outline: "2px solid currentColor", outlineOffset: "2px" },
					}),
				]}
			>
				<svg
					width="22"
					height="22"
					viewBox="0 0 24 24"
					fill="none"
					stroke="currentColor"
					strokeWidth={2}
					strokeLinecap="round"
					strokeLinejoin="round"
					aria-hidden="true"
				>
					<path d="M11 5 6 9H3v6h3l5 4z" />
					{enabled ? (
						<>
							<path d="M15.5 9.5a3.5 3.5 0 0 1 0 5" mix={[pulse("0s")]} />
							<path d="M18.5 6.5a8 8 0 0 1 0 11" mix={[pulse("0.25s")]} />
						</>
					) : (
						<>
							<path d="m16 9.5 5 5" />
							<path d="m21 9.5-5 5" />
						</>
					)}
				</svg>
			</button>
		);
	},
);
