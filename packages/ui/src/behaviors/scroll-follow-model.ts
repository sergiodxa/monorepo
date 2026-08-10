/**
 * Headless scroll-follow state for a conversational message viewport: owns
 * whether the reader is currently auto-following the live edge, which turn
 * the viewport is anchored to, which messages are currently visible, and
 * which scrollable edges can still be reached. Backs a message scroller's
 * viewport the same way `DragSession` backs a drag-and-drop interaction and
 * `ResizeSession` backs a resizable panel group — every measurement (scroll
 * position, resize, intersection) is taken outside this class and fed in as
 * a plain value, so the state and its transitions stay unit-testable without
 * a DOM.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { TypedEventTarget } from "remix/ui";

import { dispatchChange } from "../utils/dispatch-change";

/** Whether auto-follow starts engaged when a constructor option omits it. */
const DEFAULT_PINNED = true;

/** Alignment a scrolled-to message resolves to when an option omits it. */
const DEFAULT_ALIGN: ScrollFollowModel.Align = "start";

/** Whether a scroll intent animates when an option omits it. */
const DEFAULT_SMOOTH = true;

/**
 * Types associated with {@link ScrollFollowModel}: the shape of a scroll
 * intent, its constructor options, and the event it dispatches.
 */
export namespace ScrollFollowModel {
	/**
	 * Where a scrolled-to message should land inside the viewport once an
	 * intent is fulfilled, matching `Element.scrollIntoView`'s `block` option.
	 */
	export type Align = "start" | "center" | "end";

	/** Options accepted by {@link ScrollFollowModel.scrollToMessage}. */
	export interface ScrollToMessageOptions {
		/** Where the message lands in the viewport. Defaults to `"start"`. */
		align?: Align;
		/** Whether the viewport animates to the message instead of jumping instantly. Defaults to `true`. */
		smooth?: boolean;
	}

	/**
	 * One scroll intent recorded by an intent method (`scrollToEnd`,
	 * `scrollToStart`, `scrollToMessage`) and read back by the mixin that
	 * fulfills it against the real viewport.
	 */
	export type ScrollRequest =
		| { type: "end" }
		| { type: "start" }
		| { type: "message"; id: string; align: Align; smooth: boolean };

	/** Reachability of the two ends of the scrollable region, as measured by the mixin. */
	export interface ReachableEdges {
		/** Whether the viewport can still be scrolled toward its start edge. */
		start: boolean;
		/** Whether the viewport can still be scrolled toward its end edge. */
		end: boolean;
	}

	/** Constructor options for {@link ScrollFollowModel}. */
	export interface Options {
		/** Whether auto-follow starts engaged. Defaults to `true`. */
		pinned?: boolean;
		/** Turn id the viewport starts anchored to. Defaults to `null`. */
		anchorTurnId?: string | null;
		/** Message ids visible in the viewport at construction. Defaults to none. */
		visibleMessageIds?: Iterable<string>;
		/** Reachability of the start/end edges at construction. Defaults to both unreachable. */
		reachableEdges?: ReachableEdges;
	}

	/** Events dispatched by {@link ScrollFollowModel} as its state changes. */
	export interface EventMap {
		/** Dispatched after any owned state changes, or a scroll intent is recorded. */
		change: Event;
	}
}

/**
 * Owns the state a message scroller's viewport needs beyond what's already
 * on screen: whether the reader is auto-following the live edge, the turn
 * the viewport is anchored to while older history prepends above it, the set
 * of currently visible messages, and which scrollable edges remain
 * reachable. None of this is computed here — the mixin measures scroll
 * position, resize, and intersection and feeds the results in through the
 * setter methods below, keeping this class free of `getBoundingClientRect`
 * and observer calls.
 *
 * `scrollToEnd()`, `scrollToStart()`, and `scrollToMessage()` are intent
 * methods: they record what the viewport should do next and dispatch
 * `"change"`, and the mixin fulfills the recorded {@link ScrollFollowModel.ScrollRequest}
 * against the real viewport, then calls {@link ScrollFollowModel.consumeScrollRequest}
 * once it has. Any consumer that needs to know whether a particular message
 * is currently visible subscribes to `"change"` and reads
 * {@link ScrollFollowModel.isMessageVisible} instead of attaching its own
 * observer, mirroring the mixin's own lazily-attached one.
 *
 * @example
 * let model = new ScrollFollowModel();
 * model.addEventListener("change", () => update());
 * model.setReachableEdges({ start: true, end: false });
 * model.scrollToEnd();
 * model.consumeScrollRequest(); // { type: "end" }
 */
export class ScrollFollowModel extends TypedEventTarget<ScrollFollowModel.EventMap> {
	#pinned: boolean;
	#anchorTurnId: string | null;
	#visibleMessageIds: Set<string>;
	#startReachable: boolean;
	#endReachable: boolean;
	#pendingScrollRequest: ScrollFollowModel.ScrollRequest | null = null;

	/**
	 * @param options Initial pinned state, anchor turn, visible messages, and edge reachability. All are optional and default to a freshly pinned model anchored to nothing, with no visible messages and both edges unreachable.
	 */
	constructor(options: ScrollFollowModel.Options = {}) {
		super();

		this.#pinned = options.pinned ?? DEFAULT_PINNED;
		this.#anchorTurnId = options.anchorTurnId ?? null;
		this.#visibleMessageIds = new Set(options.visibleMessageIds ?? []);
		this.#startReachable = options.reachableEdges?.start ?? false;
		this.#endReachable = options.reachableEdges?.end ?? false;
	}

	/**
	 * Whether the viewport is currently auto-following the live edge: new
	 * messages should scroll the reader down as they arrive. Set by the
	 * mixin through {@link setPinned} as it observes the reader's own
	 * scrolling.
	 */
	get pinned(): boolean {
		return this.#pinned;
	}

	/**
	 * Id of the turn the viewport is currently anchored to, or `null` before
	 * one has been measured. Read back by the mixin to hold the reader's
	 * position when older history prepends above this turn.
	 */
	get anchorTurnId(): string | null {
		return this.#anchorTurnId;
	}

	/**
	 * Ids of the messages currently visible in the viewport, as last
	 * reported through {@link setMessageVisible}.
	 */
	get visibleMessageIds(): ReadonlySet<string> {
		return this.#visibleMessageIds;
	}

	/** Whether the viewport can still be scrolled toward its start edge. */
	get startReachable(): boolean {
		return this.#startReachable;
	}

	/** Whether the viewport can still be scrolled toward its end edge. */
	get endReachable(): boolean {
		return this.#endReachable;
	}

	/**
	 * The scroll intent recorded by the most recent call to
	 * {@link scrollToEnd}, {@link scrollToStart}, or {@link scrollToMessage}
	 * that the mixin hasn't fulfilled yet, or `null` once
	 * {@link consumeScrollRequest} has cleared it.
	 */
	get pendingScrollRequest(): ScrollFollowModel.ScrollRequest | null {
		return this.#pendingScrollRequest;
	}

	/**
	 * Records whether the viewport is auto-following the live edge. Called by
	 * the mixin as it observes the reader scrolling toward or away from it.
	 * A no-op, dispatching nothing, when `pinned` already matches the current
	 * value.
	 *
	 * @param pinned Whether auto-follow is engaged.
	 */
	setPinned(pinned: boolean): void {
		if (pinned === this.#pinned) return;

		this.#pinned = pinned;
		dispatchChange(this);
	}

	/**
	 * Records which turn the viewport is currently anchored to. Called by the
	 * mixin once it has measured which turn sits nearest the viewport's
	 * anchor edge. A no-op, dispatching nothing, when `id` already matches
	 * the current anchor.
	 *
	 * @param id Id of the turn to anchor to, or `null` when none is measured.
	 */
	setAnchorTurnId(id: string | null): void {
		if (id === this.#anchorTurnId) return;

		this.#anchorTurnId = id;
		dispatchChange(this);
	}

	/**
	 * Records whether a single message is currently visible in the viewport,
	 * mirroring one entry of the mixin's own `IntersectionObserver` callback.
	 * A no-op, dispatching nothing, when `visible` already matches the
	 * message's current membership in {@link visibleMessageIds}.
	 *
	 * @param id Id of the message the visibility report is about.
	 * @param visible Whether the message is currently visible.
	 */
	setMessageVisible(id: string, visible: boolean): void {
		let wasVisible = this.#visibleMessageIds.has(id);
		if (wasVisible === visible) return;

		if (visible) this.#visibleMessageIds.add(id);
		else this.#visibleMessageIds.delete(id);

		dispatchChange(this);
	}

	/**
	 * Reports whether a message is currently visible, per the last report
	 * given to {@link setMessageVisible}. The read side of the model's
	 * visibility API: a consumer calls this instead of measuring visibility
	 * itself.
	 *
	 * @param id Id of the message to test.
	 * @returns `true` when the message is currently visible.
	 */
	isMessageVisible(id: string): boolean {
		return this.#visibleMessageIds.has(id);
	}

	/**
	 * Records which scrollable edges the viewport can currently reach. Called
	 * by the mixin after every scroll or resize measurement, since both
	 * edges are always measured together in one pass. A no-op, dispatching
	 * nothing, when neither edge's reachability actually changes.
	 *
	 * @param edges Reachability of the start and end edges.
	 */
	setReachableEdges(edges: ScrollFollowModel.ReachableEdges): void {
		if (edges.start === this.#startReachable && edges.end === this.#endReachable) return;

		this.#startReachable = edges.start;
		this.#endReachable = edges.end;
		dispatchChange(this);
	}

	/**
	 * Records an intent to scroll to the live edge of the conversation.
	 * Always dispatches `"change"`, even when a request is already pending,
	 * so a repeated call (e.g. a second click on a "jump to latest" control)
	 * always reaches the mixin.
	 */
	scrollToEnd(): void {
		this.#pendingScrollRequest = { type: "end" };
		dispatchChange(this);
	}

	/**
	 * Records an intent to scroll to the start of the conversation. Always
	 * dispatches `"change"`, even when a request is already pending.
	 */
	scrollToStart(): void {
		this.#pendingScrollRequest = { type: "start" };
		dispatchChange(this);
	}

	/**
	 * Records an intent to scroll to a specific message. Always dispatches
	 * `"change"`, even when a request is already pending.
	 *
	 * @param id Id of the message to scroll to.
	 * @param options Alignment within the viewport and whether to animate; both default when omitted.
	 */
	scrollToMessage(id: string, options: ScrollFollowModel.ScrollToMessageOptions = {}): void {
		this.#pendingScrollRequest = {
			type: "message",
			id,
			align: options.align ?? DEFAULT_ALIGN,
			smooth: options.smooth ?? DEFAULT_SMOOTH,
		};
		dispatchChange(this);
	}

	/**
	 * Reads and clears the pending scroll request in one step. Called by the
	 * mixin once it has performed the recorded intent against the real
	 * viewport, so a request is fulfilled exactly once. Does not dispatch
	 * `"change"` itself — clearing the request is bookkeeping, not a state
	 * update a subscriber needs to react to.
	 *
	 * @returns The scroll request that was pending, or `null` when there was none.
	 */
	consumeScrollRequest(): ScrollFollowModel.ScrollRequest | null {
		let request = this.#pendingScrollRequest;
		this.#pendingScrollRequest = null;
		return request;
	}
}
