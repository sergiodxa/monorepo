/**
 * How the player waits on the stage: decoding images before a change shows them, running a
 * scenery change as a View Transition typed by its name, and awaiting or finishing every
 * finite animation under the stage, so built-in and app-written transitions end the same way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FrameStage } from "../stage.js";

import { resolveSource } from "./source.js";

/** Scenery transitions the player draws itself; any other name is a class the app styles. */
export const BUILT_IN_TRANSITIONS: ReadonlySet<string> = new Set([
	"fade",
	"dissolve",
	"slide-left",
	"slide-right",
	"slide-up",
	"slide-down",
	"wipe",
	"zoom",
	"flash",
	"shake",
]);

/**
 * Whether the reader asked the system for reduced motion, which finishes every transition at once.
 *
 * @returns `true` under `prefers-reduced-motion: reduce`.
 */
export function prefersReducedMotion(): boolean {
	return typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/**
 * Every image file a stage draws, in drawing order.
 *
 * @param stage - The stage a frame shows.
 * @param locale - The reader's locale, which picks a localized image's file.
 * @returns The URLs, without duplicates.
 */
export function stageImages(stage: FrameStage, locale: string): string[] {
	let sources = [
		stage.background?.src,
		stage.image?.src,
		...stage.characters.flatMap((character) => character.images),
	];
	let urls = sources.flatMap((source) =>
		source === undefined ? [] : [resolveSource(source, locale)],
	);
	return [...new Set(urls)].filter((url) => url !== "");
}

/**
 * Decodes images before they are shown, so a transition never starts on a half-drawn frame. A
 * file that fails to load is skipped; the `<img>` shows the broken state rather than block the play.
 *
 * @param urls - The files to decode.
 * @returns Once every file decoded or failed.
 */
export async function decodeImages(urls: string[]): Promise<void> {
	await Promise.all(
		urls.map(async (url) => {
			let image = new Image();
			image.src = url;
			await image.decode().catch(() => undefined);
		}),
	);
}

/**
 * The scenery transition a frame starts with: the background's, else the full-screen image's.
 *
 * @param stage - The stage a frame shows; transitions are set only on the stop that changed it.
 * @returns The transition's name, or `undefined` when the scenery did not change with one.
 */
export function sceneryTransition(stage: FrameStage): string | undefined {
	return stage.background?.transition ?? stage.image?.transition;
}

/** A transition running on the stage, which a click or skip finishes early. */
export interface RunningTransition {
	/** Settles when the change is drawn and every animation it started has ended. */
	finished: Promise<void>;
	/** Jumps every animation to its end. */
	finish(): void;
}

/**
 * Applies a stage change, as a View Transition typed `novel-<name>` when the browser has the
 * API, the transition is built in and motion is allowed; otherwise the change is applied
 * directly and a custom transition runs as the class the stage element carries.
 *
 * @param update - Renders the new frame and resolves once it is committed.
 * @param name - The scenery transition, or `undefined` for a change without one.
 * @param instant - Skips the View Transition, for skip mode and reduced motion.
 * @returns The running transition.
 */
export function transitionStage(
	update: () => Promise<void>,
	name: string | undefined,
	instant: boolean,
): RunningTransition {
	let canTransition =
		!instant &&
		name !== undefined &&
		BUILT_IN_TRANSITIONS.has(name) &&
		typeof document !== "undefined" &&
		typeof document.startViewTransition === "function";
	if (!canTransition) {
		return { finished: update(), finish: () => undefined };
	}
	let transition = document.startViewTransition({
		update,
		types: ["novel-stage", `novel-${name}`],
	});
	transition.ready.catch(() => undefined);
	let finished = transition.finished.then(
		() => undefined,
		() => undefined,
	);
	return {
		finished: transition.updateCallbackDone.then(() => finished),
		finish: () => transition.skipTransition(),
	};
}

/** The interface drawn over the stage, whose animations (a menu's countdown) a frame never waits for. */
const OVERLAY =
	"[data-novel-ui], [data-novel-textbox], [data-novel-choices], [data-novel-interaction]";

/**
 * The finite animations and transitions of the stage's layers and characters under `root`;
 * looping effects and the interface drawn over the stage are left out.
 *
 * @param root - The stage, or any element whose subtree animates.
 * @returns The animations a frame waits for.
 */
export function finiteAnimations(root: Element): Animation[] {
	return root.getAnimations({ subtree: true }).filter((animation) => {
		let end = animation.effect?.getComputedTiming().endTime;
		if (typeof end !== "number" || !Number.isFinite(end)) return false;
		let target = animation.effect instanceof KeyframeEffect ? animation.effect.target : null;
		return target?.closest(OVERLAY) === null || target === null;
	});
}

/**
 * Waits for every finite animation under `root` to end, including ones started while waiting.
 *
 * @param root - The stage.
 * @returns Once nothing finite is running.
 */
export async function settle(root: Element): Promise<void> {
	let running = finiteAnimations(root);
	while (running.length > 0) {
		await Promise.allSettled(running.map((animation) => animation.finished));
		running = finiteAnimations(root).filter((animation) => animation.playState === "running");
	}
}

/**
 * Jumps every finite animation under `root` to its end, which a click during a transition does.
 *
 * @param root - The stage.
 */
export function finishAnimations(root: Element): void {
	for (let animation of finiteAnimations(root)) {
		try {
			animation.finish();
		} catch {
			animation.cancel();
		}
	}
}
