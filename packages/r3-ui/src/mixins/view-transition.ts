/**
 * Bridges a SharedElement's enclosing Frame to the native View Transition
 * API: every time that Frame reloads — the mechanism this framework uses to
 * update the page's content without a full navigation — the reload now runs
 * inside a `document.startViewTransition()`, so elements sharing a
 * `view-transition-name` across the reload's old and new content morph
 * between their old and new positions and sizes instead of popping. A Frame
 * reloaded by more than one SharedElement shares a single transition between
 * them, rather than opening one per element.
 *
 * Why JS: a cross-document navigation gets a view transition automatically
 * from the browser once the page declares `@view-transition { navigation: auto; }`
 * in CSS — no script involved. A Frame reload never gets that treatment: it
 * updates the same document in place, and the platform only opens a view
 * transition when script explicitly asks for one around the update, which a
 * Frame reload's own fetch-then-patch cycle does not do on its own.
 * No-JS baseline: the Frame still reloads and shows its new content exactly
 * as it would without this mixin; only the cross-fade/morph animation between
 * old and new state is unavailable, and a SharedElement inside the reload
 * simply swaps in place instead of appearing to move.
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
 * for as long as its Frame's transition is in flight, so the element's own
 * styling (or an app's) can suppress hover affordances or pointer input for
 * the span of the morph.
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
 * Dispatched on a SharedElement's host by {@link viewTransition} each time its
 * Frame starts reloading, carrying the native transition the reload now runs
 * inside so a consumer can await its `ready`/`finished` promises or call
 * `skipTransition()` — or `null` when no transition could be opened, because
 * the browser has no `document.startViewTransition()` to call, or the
 * visitor prefers reduced motion, in which case the reload still proceeds
 * plainly.
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
 * Bookkeeping {@link viewTransition} keeps per Frame for the span of one
 * reload, shared by every SharedElement mixin instance whose closest Frame is
 * the same one, so a Frame reloaded by many of them opens exactly one native
 * transition instead of one per element.
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
 * skipping `document.startViewTransition()` entirely when the browser
 * doesn't implement it or the visitor prefers reduced motion. The transition
 * stays open until {@link settleFrameTransition} reports the reload complete,
 * regardless of how many callers observe the same reload.
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
 * Marks `frame`'s in-flight transition state complete, resolving its update
 * callback right away if the browser already invoked it, or leaving
 * {@link ensureFrameTransition}'s promise executor to resolve it immediately
 * once the browser does invoke it, then clears the state so the next reload
 * opens a fresh transition.
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
 * Wraps a SharedElement's enclosing Frame reload in a native view transition:
 * as soon as the Frame's reload starts, this opens a
 * `document.startViewTransition()` whose update resolves only once the
 * reload's fetched content has actually committed — the "old" snapshot lands
 * before the reload's network round-trip, the "new" one after, exactly the
 * window a Frame reload's own asynchrony provides. Elements sharing a
 * `view-transition-name` across the old and new content, set through CSS,
 * morph between their old and new positions and sizes instead of popping.
 *
 * A Frame reloaded by several SharedElement instances shares this same
 * transition between them: only the first instance to observe a given
 * reload's start opens it, and the rest read the one already open.
 *
 * Opens no transition — letting the reload proceed exactly as it would
 * without this mixin — when the browser has no
 * `document.startViewTransition()`, or when the visitor's system requests
 * `prefers-reduced-motion: reduce`. Either way {@link ViewTransitionEvent}
 * still reports `null`, so a consumer can tell the two apart from a
 * transition that actually opened.
 *
 * While its Frame's transition is in flight the host carries
 * {@link TRANSITIONING_ATTRIBUTE}, so its own styling (or an app's) can
 * suppress hover affordances or pointer input for the span of the morph.
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

			hostNode?.toggleAttribute(TRANSITIONING_ATTRIBUTE, true);
			state.transition.finished.finally(() =>
				getHostNode()?.removeAttribute(TRANSITIONING_ATTRIBUTE),
			);
		},
		{ signal: handle.signal },
	);

	frame.addEventListener("reloadComplete", () => settleFrameTransition(frame), {
		signal: handle.signal,
	});

	return () => createElement(handle.element, {});
});
