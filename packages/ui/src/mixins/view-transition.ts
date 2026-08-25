/**
 * Bridges a SharedElement's enclosing Frame to the native View Transition
 * API: each Frame reload now runs inside `document.startViewTransition()`,
 * since the platform only opens one when script explicitly wraps an
 * in-place update, so elements sharing a `view-transition-name` morph
 * across the reload instead of popping, one transition shared per Frame.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { FrameHandle, MixinFactory } from "remix/ui";

import { createElement, createMixin } from "remix/ui";

import { prefersReducedMotion } from "../utils/prefers-reduced-motion";

import { trackHostNode } from "./track-host-node";

/**
 * `data-*` attribute {@link viewTransition} sets on a SharedElement's host
 * while its Frame's transition is in flight, so styling can suppress hover
 * affordances or pointer input for the span of the morph.
 */
export const TRANSITIONING_ATTRIBUTE = "data-transitioning";

/** DOM event type dispatched on a SharedElement's host by {@link viewTransition} each time its Frame starts reloading. */
const VIEW_TRANSITION_EVENT = "ui:view-transition" as const;

declare global {
	interface HTMLElementEventMap {
		[VIEW_TRANSITION_EVENT]: ViewTransitionEvent;
	}
}

/**
 * The object `document.startViewTransition()` returns, referenced
 * structurally so this module never has to name the DOM's own
 * `ViewTransition` global directly.
 */
type NativeViewTransition = ReturnType<Document["startViewTransition"]>;

/**
 * Dispatched on a SharedElement's host by {@link viewTransition} each time
 * its Frame starts reloading, carrying the native transition so a consumer
 * can await it or call `skipTransition()` — or `null` when the browser lacks `startViewTransition()` or the visitor prefers reduced motion.
 */
export class ViewTransitionEvent extends Event {
	/** The transition the reload now runs inside, or `null` when none could be opened. */
	readonly transition: NativeViewTransition | null;

	/**
	 * @param transition The transition the reload now runs inside, or `null` when none could be opened.
	 */
	constructor(transition: NativeViewTransition | null) {
		super(VIEW_TRANSITION_EVENT, { bubbles: true });
		this.transition = transition;
	}
}

/**
 * Bookkeeping {@link viewTransition} keeps per Frame for one reload's span,
 * shared by every SharedElement instance on that Frame, so many of them
 * open exactly one native transition instead of one each.
 */
interface FrameTransitionState {
	/** The transition the current reload runs inside, or `null` when none could be opened. */
	transition: NativeViewTransition | null;
	/** Whether `reloadComplete` has already fired for the reload this state was opened for. */
	completed: boolean;
	/** Resolves the transition's update callback once the browser has invoked it; unset until then. */
	resolveUpdate?: () => void;
}

/**
 * Transition state currently in flight per Frame, so every SharedElement
 * mixin instance reacting to the same Frame's `reloadStart` reuses the one
 * transition already opened for it instead of opening a second.
 */
const frameTransitions = new WeakMap<FrameHandle, FrameTransitionState>();

/**
 * Opens (or reuses) the native transition wrapping `frame`'s current reload,
 * skipping `startViewTransition()` when unsupported or reduced motion is
 * preferred, staying open until {@link settleFrameTransition} reports it done.
 *
 * @param frame Frame whose reload this transition wraps.
 */
function ensureFrameTransition(frame: FrameHandle): FrameTransitionState {
	let existing = frameTransitions.get(frame);
	if (existing) return existing;

	let state: FrameTransitionState = { transition: null, completed: false };
	let supportsViewTransitions = typeof document.startViewTransition === "function";

	if (supportsViewTransitions && !prefersReducedMotion()) {
		state.transition = document.startViewTransition(
			() =>
				new Promise<void>((resolve) => {
					if (state.completed) resolve();
					else state.resolveUpdate = resolve;
				}),
		);
	}

	frameTransitions.set(frame, state);
	return state;
}

/**
 * Marks `frame`'s in-flight transition complete, resolving its update
 * callback now if already invoked, or leaving {@link ensureFrameTransition}'s
 * executor to resolve it once invoked, then clears state for the next reload.
 *
 * @param frame Frame whose reload just finished.
 */
function settleFrameTransition(frame: FrameHandle): void {
	let state = frameTransitions.get(frame);
	if (!state) return;

	state.completed = true;
	state.resolveUpdate?.();
	frameTransitions.delete(frame);
}

/**
 * Wraps a SharedElement's enclosing Frame reload in one native view
 * transition, shared by every SharedElement on that Frame, so elements
 * sharing a `view-transition-name` morph instead of popping — settling `finished` on success and failure alike keeps a skipped transition from stranding the host or surfacing as an unhandled rejection.
 *
 * @returns A mixin descriptor for a SharedElement's `mix` prop.
 * @example
 * <SharedElement id="cover" mix={viewTransition()}>
 * 	<img src={cover.src} alt={cover.alt} />
 * </SharedElement>
 */
export const viewTransition: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let getHostNode = trackHostNode(handle);
	let frame = handle.frame;

	frame.addEventListener(
		"reloadStart",
		() => {
			let state = ensureFrameTransition(frame);
			let hostNode = getHostNode();
			hostNode?.dispatchEvent(new ViewTransitionEvent(state.transition));

			if (!state.transition) return;

			let stopTransitioning = () => getHostNode()?.removeAttribute(TRANSITIONING_ATTRIBUTE);

			hostNode?.toggleAttribute(TRANSITIONING_ATTRIBUTE, true);
			void state.transition.finished.then(stopTransitioning, stopTransitioning);
		},
		{ signal: handle.signal },
	);

	frame.addEventListener("reloadComplete", () => settleFrameTransition(frame), {
		signal: handle.signal,
	});

	return () => createElement(handle.element, {});
});
