import { on } from "remix/component";

/**
 * Interface sounds: a sound as the pointer or focus reaches an option, and another as the reader
 * picks one, played on the mixer's interface channel so the reader can turn them down alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */
import type { AssetDeclaration } from "../declarations.js";

import type { AudioMixer } from "./audio.js";

import { pickSource } from "./source.js";

/** The sounds the interface plays, each a declared sound asset. */
export interface InterfaceSounds {
	/** Plays as the pointer enters an option, or keyboard and gamepad focus moves to one. */
	hover?: AssetDeclaration<"sound">;
	/** Plays as the reader picks an option. */
	select?: AssetDeclaration<"sound">;
}

/** A role an interface sound plays in: reaching an option, or picking one. */
export type InterfaceSoundRole = keyof InterfaceSounds;

/** What the listeners read on every event, so a new `sounds` prop or locale applies at once. */
interface InterfaceSoundsSource {
	/** Answers the mixer, called only when a declared sound plays. */
	mixer: () => AudioMixer;
	sounds: InterfaceSounds | undefined;
	locale: string;
}

/**
 * The elements a reader picks: buttons, links, tabs, options and form controls. The stage's
 * click-to-advance surface is none of them, so advancing a line stays silent.
 */
const OPTION_SELECTOR = [
	"button",
	"a[href]",
	"summary",
	"select",
	"input:not([type='hidden'])",
	"[role='tab']",
	"[role='option']",
	"[role='menuitem']",
].join(", ");

/** The option `target` sits in, when it is one the reader can use. */
function optionOf(target: EventTarget | null): Element | null {
	if (!(target instanceof Element)) return null;
	let option = target.closest(OPTION_SELECTOR);
	if (option === null || option.matches(":disabled, [aria-disabled='true']")) return null;
	return option;
}

/** Plays one interface sound, when the play declared it. */
function play(source: InterfaceSoundsSource, sound: AssetDeclaration<"sound"> | undefined): void {
	if (sound === undefined) return;
	playInterfaceSound(source.mixer(), sound, source.locale);
}

/**
 * Plays a sound on the mixer's interface channel, picking the file for the reader's locale the
 * way the interface's own hover and select sounds do, so a preview sounds like the real thing.
 *
 * @param mixer - The player's or the title screen's mixer.
 * @param sound - The declared sound.
 * @param locale - The reader's locale.
 */
export function playInterfaceSound(
	mixer: AudioMixer,
	sound: AssetDeclaration<"sound">,
	locale: string,
): void {
	mixer.playInterface(pickSource(sound.src, locale));
}

/**
 * How long after a pick the interface stays quiet, so opening a dialog sounds its pick alone,
 * without a hover for the focus it moves or the option it opens under the pointer.
 */
const PICK_QUIET_MS = 250;

/**
 * Listens on a root for the reader reaching and picking options. Hover sounds once per option
 * entered, so moving within one button stays quiet, and focus sounds only when it is visible,
 * which a click that focuses a button never is. Picks are heard on the way down, so a pick that
 * swaps the screen, such as New game, sounds before its root leaves the page.
 *
 * @param read - Answers the mixer, the sounds and the locale at the moment of each event.
 */
export function interfaceSounds(read: () => InterfaceSoundsSource) {
	let picked = Number.NEGATIVE_INFINITY;
	return [
		on<HTMLElement, "pointerover">("pointerover", (event) => {
			let option = optionOf(event.target);
			if (option === null || option === optionOf(event.relatedTarget)) return;
			if (event.timeStamp - picked < PICK_QUIET_MS) return;
			let source = read();
			play(source, source.sounds?.hover);
		}),
		on<HTMLElement, "focusin">("focusin", (event) => {
			let option = optionOf(event.target);
			if (option === null || !option.matches(":focus-visible")) return;
			if (event.timeStamp - picked < PICK_QUIET_MS) return;
			let source = read();
			play(source, source.sounds?.hover);
		}),
		on<HTMLElement, "click">(
			"click",
			(event) => {
				if (optionOf(event.target) === null) return;
				picked = event.timeStamp;
				let source = read();
				play(source, source.sounds?.select);
			},
			true,
		),
	];
}
