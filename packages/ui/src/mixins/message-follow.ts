/**
 * Bridges a message scroller's viewport to `ScrollFollowModel`: measures the
 * reader's live scroll position, the viewport's size, and which turns
 * intersect it, and reports all three into the model through its setter
 * methods, then fulfills every scroll intent the model records — jumping to
 * the live edge, the start of the conversation, or a specific turn — by
 * writing the viewport's scroll position directly. The model's own state
 * mirrors back onto the viewport as `data-autoscrolling`/`data-scrollable`
 * attributes and onto its jump-to-latest control's visibility and tab-order
 * reachability, so every visual part of the widget renders purely from state
 * the model owns.
 *
 * Why JS: detecting a reader scrolling away from the live edge — so
 * auto-follow disengages instead of fighting a deliberate scroll — anchoring
 * a newly arrived turn near the top of the viewport, and preserving the
 * reader's scroll position as older history prepends above it all require
 * reading live scroll position, viewport size, and turn geometry as they
 * change; no CSS selector expresses any of that.
 * No-JS baseline: every turn still renders in document order and the
 * viewport still scrolls natively by wheel, touch, trackpad, and keyboard;
 * only auto-follow, the prepend-preserving anchor, and the jump-to-latest
 * control are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { ScrollFollowModel } from "../behaviors/scroll-follow-model";

import { prefersReducedMotion } from "../utils/prefers-reduced-motion";

/**
 * Attribute every conversational turn exposes itself on, its value the
 * turn's stable id. `messageFollow()` reads every element carrying this
 * attribute beneath the viewport, in document order, both to measure which
 * turn sits nearest the start edge (fed into `ScrollFollowModel.setAnchorTurnId`)
 * and as the target list its lazily attached `IntersectionObserver` watches
 * (fed into `ScrollFollowModel.setMessageVisible`) — one attribute serving
 * both readings, since a turn is exactly the unit the model tracks for each.
 */
export const MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE = "data-scroll-anchor";

/**
 * Attribute the viewport's jump-to-latest control carries. `messageFollow()`
 * finds it beneath the viewport to wire its click and to mirror
 * `ScrollFollowModel.pinned` onto its visibility and tab-order reachability.
 */
export const MESSAGE_SCROLLER_JUMP_ATTRIBUTE = "data-scroll-jump";

/**
 * Attribute `messageFollow()` mirrors onto the viewport whenever
 * `ScrollFollowModel.pinned` is `true` — present while auto-follow is
 * engaged, absent once the reader has scrolled away from the live edge.
 */
export const MESSAGE_SCROLLER_AUTOSCROLLING_ATTRIBUTE = "data-autoscrolling";

/**
 * Attribute `messageFollow()` mirrors onto the viewport with a
 * space-separated token list of whichever edges still have more content
 * beyond them (`"start"`, `"end"`, or `"start end"`), readable with the `~=`
 * selector operator (`[data-scrollable~="end"]`), and removed entirely once
 * neither edge has anything left to reach.
 */
export const MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE = "data-scrollable";

/**
 * How many pixels of rounding error the viewport's scroll position may still
 * sit at from a true edge and count as having reached it, so sub-pixel
 * layout rounding never leaves the model reporting an edge as reachable when
 * the viewport is visually already sitting at it.
 */
const EDGE_TOLERANCE_PX = 1;

/**
 * Keys whose native scrolling behavior on a focused viewport — or a focused
 * descendant inside it — advances or retreats the reader's position: the
 * keyboard half of detecting an intentional scroll away from the live edge,
 * alongside the wheel and touchmove listeners this mixin also attaches.
 */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/**
 * Resolves the behavior a scroll-fulfilling call should animate with,
 * collapsing to an instant jump under `prefers-reduced-motion: reduce` so a
 * long jump to the live edge, the start of the conversation, or a distant
 * turn never rides a motion effect the reader has asked the platform to
 * avoid.
 *
 * @returns `"instant"` when the reader prefers reduced motion, `"smooth"` otherwise.
 */
function resolveScrollBehavior(): ScrollBehavior {
	return prefersReducedMotion() ? "instant" : "smooth";
}

/**
 * Measures which of the viewport's two scrollable edges the reader can still
 * reach, within {@link EDGE_TOLERANCE_PX} of the true edge.
 *
 * @param host Viewport element to measure.
 * @returns Whether the start and end edges still have more content beyond them.
 */
function readScrollEdges(host: HTMLElement): ScrollFollowModel.ReachableEdges {
	let maxScrollTop = Math.max(0, host.scrollHeight - host.clientHeight);

	return {
		start: host.scrollTop > EDGE_TOLERANCE_PX,
		end: host.scrollTop < maxScrollTop - EDGE_TOLERANCE_PX,
	};
}

/**
 * Finds the turn nearest the viewport's start edge: the first element
 * carrying {@link MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE}, in document order,
 * whose bottom edge hasn't yet scrolled past the viewport's own top edge.
 * `ScrollFollowModel` reads this turn's id back to hold the reader's
 * position while older history prepends above it.
 *
 * @param host Viewport element to search beneath.
 * @returns The turn nearest the start edge, or `undefined` when the viewport holds none.
 */
function findAnchorItem(host: HTMLElement): HTMLElement | undefined {
	let hostTop = host.getBoundingClientRect().top;
	let items = host.querySelectorAll<HTMLElement>(`[${MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE}]`);

	for (let item of items) {
		if (item.getBoundingClientRect().bottom > hostTop) return item;
	}

	return undefined;
}

/**
 * Finds the turn carrying a specific id in
 * {@link MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE} — the lookup a `"message"`-type
 * {@link ScrollFollowModel.ScrollRequest} is fulfilled against.
 *
 * @param host Viewport element to search beneath.
 * @param id Id to match against the attribute's value.
 * @returns The matching turn, or `undefined` when none carries `id`.
 */
function findItemById(host: HTMLElement, id: string): HTMLElement | undefined {
	return (
		host.querySelector<HTMLElement>(`[${MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE}="${CSS.escape(id)}"]`) ??
		undefined
	);
}

/**
 * Reports whether `node` sits earlier in document order than `reference` —
 * the test that tells a turn prepended above the reader's current anchor
 * apart from one appended below it.
 *
 * @param node Node to test.
 * @param reference Node to test `node`'s position against.
 * @returns `true` when `node` precedes `reference` in the document.
 */
function precedes(node: Node, reference: Node): boolean {
	let position = reference.compareDocumentPosition(node);
	return (position & Node.DOCUMENT_POSITION_PRECEDING) !== 0;
}

/**
 * Jumps the viewport straight to its end edge when `model` is currently
 * pinned — the auto-follow behavior that keeps a reader who hasn't scrolled
 * away glued to the live edge as new turns arrive or the viewport itself
 * resizes. Always an instant jump, never a smooth scroll: animating every
 * incremental token of a streaming turn would read as constant motion
 * instead of a viewport that stays attached.
 *
 * @param host Viewport element to scroll.
 * @param model Model whose pinned state gates the jump.
 */
function stickToEndIfPinned(host: HTMLElement, model: ScrollFollowModel): void {
	if (model.pinned) host.scrollTop = host.scrollHeight;
}

/**
 * Re-measures the viewport's reachable edges and anchor turn and reports
 * both into `model`. Also re-derives `model`'s pinned state: reaching the
 * end edge always re-engages auto-follow, and — only when `userInitiated`
 * marks the triggering scroll as the reader's own wheel, touch, or keyboard
 * gesture rather than one this mixin performed itself — scrolling away from
 * the end edge disengages it, so auto-follow never fights a deliberate
 * scroll.
 *
 * @param host Viewport element to measure.
 * @param model Model to report the measurement into.
 * @param userInitiated Whether the triggering scroll came from the reader's own gesture.
 */
function resync(host: HTMLElement, model: ScrollFollowModel, userInitiated: boolean): void {
	let edges = readScrollEdges(host);
	model.setReachableEdges(edges);

	if (!edges.end) model.setPinned(true);
	else if (userInitiated) model.setPinned(false);

	let anchor = findAnchorItem(host);
	model.setAnchorTurnId(anchor?.getAttribute(MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE) ?? null);
}

/**
 * Performs the actual scroll a pending {@link ScrollFollowModel.ScrollRequest}
 * describes: jumping or animating to the end or start edge, or to a specific
 * turn at its requested alignment, respecting `prefers-reduced-motion`
 * throughout.
 *
 * @param host Viewport element to scroll.
 * @param request Scroll request consumed from the model.
 */
function fulfillScrollRequest(host: HTMLElement, request: ScrollFollowModel.ScrollRequest): void {
	switch (request.type) {
		case "end":
			host.scrollTo({ top: host.scrollHeight, behavior: resolveScrollBehavior() });
			return;
		case "start":
			host.scrollTo({ top: 0, behavior: resolveScrollBehavior() });
			return;
		case "message": {
			let target = findItemById(host, request.id);
			target?.scrollIntoView({
				block: request.align,
				behavior: request.smooth ? resolveScrollBehavior() : "instant",
			});
			return;
		}
	}
}

/**
 * Builds {@link MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE}'s value from the
 * model's reachable edges.
 *
 * @param model Model to read reachable edges from.
 * @returns The attribute value to set, or `null` to remove the attribute entirely.
 */
function scrollableTokens(model: ScrollFollowModel): string | null {
	let tokens: string[] = [];
	if (model.startReachable) tokens.push("start");
	if (model.endReachable) tokens.push("end");
	return tokens.length > 0 ? tokens.join(" ") : null;
}

/**
 * Mirrors `model`'s current state onto the viewport and its jump-to-latest
 * control: {@link MESSAGE_SCROLLER_AUTOSCROLLING_ATTRIBUTE} tracks `pinned`,
 * {@link MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE} tracks the reachable edges,
 * and the control identified by {@link MESSAGE_SCROLLER_JUMP_ATTRIBUTE} is
 * shown and made reachable by keyboard and assistive technology only while
 * `pinned` is `false` — `inert` removes it from tab order and the
 * accessibility tree in the same step it's visually hidden, and
 * `data-visible` is left for its own styling to key an entrance/exit
 * transition off.
 *
 * @param host Viewport element to mirror state onto.
 * @param model Model to read state from.
 */
function syncAttributesFromModel(host: HTMLElement, model: ScrollFollowModel): void {
	if (model.pinned) host.setAttribute(MESSAGE_SCROLLER_AUTOSCROLLING_ATTRIBUTE, "");
	else host.removeAttribute(MESSAGE_SCROLLER_AUTOSCROLLING_ATTRIBUTE);

	let tokens = scrollableTokens(model);
	if (tokens) host.setAttribute(MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE, tokens);
	else host.removeAttribute(MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE);

	let button = host.querySelector<HTMLElement>(`[${MESSAGE_SCROLLER_JUMP_ATTRIBUTE}]`);
	if (!button) return;

	let visible = !model.pinned;
	button.inert = !visible;
	if (visible) button.setAttribute("data-visible", "");
	else button.removeAttribute("data-visible");
}

/**
 * Adds live-scroll coordination to a message scroller's viewport. Wheel,
 * touch, keyboard, and native `scroll` events feed `model.setReachableEdges`,
 * `model.setPinned`, and `model.setAnchorTurnId`; a `MutationObserver`
 * compensates the reader's scroll position for turns prepended above the
 * current anchor and sticks the viewport to its end edge for turns appended
 * while `model.pinned` is `true`; and an `IntersectionObserver` — attached
 * lazily, the first time a turn exists beneath the viewport for it to report
 * on — feeds `model.setMessageVisible`.
 *
 * Every `model` `"change"` mirrors `pinned` onto the viewport as
 * {@link MESSAGE_SCROLLER_AUTOSCROLLING_ATTRIBUTE}, the reachable edges as
 * {@link MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE}, and shows, hides, and
 * `inert`s the jump-to-latest control identified by
 * {@link MESSAGE_SCROLLER_JUMP_ATTRIBUTE} — and fulfills any scroll request
 * the change carries by scrolling to the live edge, the start of the
 * conversation, or a specific turn (identified by
 * {@link MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE}) at its requested alignment.
 * Clicking the jump-to-latest control calls `model.scrollToEnd()` directly,
 * so wiring the control needs nothing beyond rendering it inside the
 * viewport.
 *
 * @param model Scroll-follow state shared with the rest of the widget.
 * @example
 * let model = new ScrollFollowModel();
 * <div class="viewport" mix={messageFollow(model)}>
 *   <div class="content">
 *     {turns.map((turn) => (
 *       <div key={turn.id} data-scroll-anchor={turn.id}>{turn.body}</div>
 *     ))}
 *   </div>
 *   <button data-scroll-jump aria-label={jumpToLatestLabel}>↓</button>
 * </div>
 */
export const messageFollow = createMixin<HTMLElement, [model: ScrollFollowModel]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundModel: ScrollFollowModel | undefined;
	let userScrollIntent = false;
	let itemsObserver: IntersectionObserver | undefined;
	let observedItems = new Set<HTMLElement>();

	/**
	 * Lazily creates the visibility observer the first time there's a turn
	 * beneath `host` to report on, and keeps it watching exactly the turns
	 * currently rendered — unobserving, and reporting hidden, any turn that
	 * has left the document since the last pass.
	 */
	function ensureItemsObserved(host: HTMLElement, model: ScrollFollowModel): void {
		for (let item of observedItems) {
			if (host.contains(item)) continue;

			itemsObserver?.unobserve(item);
			observedItems.delete(item);

			let id = item.getAttribute(MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE);
			if (id) model.setMessageVisible(id, false);
		}

		let items = host.querySelectorAll<HTMLElement>(`[${MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE}]`);
		if (items.length === 0) return;

		if (!itemsObserver) {
			itemsObserver = new IntersectionObserver(
				(entries) => {
					for (let entry of entries) {
						let id = entry.target.getAttribute(MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE);
						if (id) model.setMessageVisible(id, entry.isIntersecting);
					}
				},
				{ root: host },
			);
		}

		for (let item of items) {
			if (observedItems.has(item)) continue;
			observedItems.add(item);
			itemsObserver.observe(item);
		}
	}

	/**
	 * Reacts to a batch of Content mutations: compensates the reader's
	 * scroll position for every turn prepended above the current anchor,
	 * sticks the viewport to its end edge when a turn was appended instead
	 * while `model` is pinned, then re-syncs measurement and visibility
	 * tracking against the settled layout.
	 */
	function handleMutations(
		host: HTMLElement,
		model: ScrollFollowModel,
		records: MutationRecord[],
	): void {
		let anchorId = model.anchorTurnId;
		let anchorNode = anchorId ? findItemById(host, anchorId) : undefined;
		let prependHeight = 0;
		let appendedNew = false;

		for (let record of records) {
			for (let node of record.addedNodes) {
				if (!(node instanceof HTMLElement)) continue;

				if (anchorNode && precedes(node, anchorNode))
					prependHeight += node.getBoundingClientRect().height;
				else appendedNew = true;
			}
		}

		// Shifting scrollTop here, synchronously within the mutation callback and
		// before the next paint, is what keeps the reader's view visually still
		// while older history grows the content above them.
		if (prependHeight > 0) host.scrollTop += prependHeight;
		if (appendedNew) stickToEndIfPinned(host, model);

		ensureItemsObserved(host, model);
		resync(host, model, false);
	}

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;

		// `boundModel` is already set by this point: the mixin's runner (below)
		// always executes once during render before "insert" fires for the same
		// node, since insertion is a post-commit lifecycle step.
		if (boundModel) {
			stickToEndIfPinned(hostNode, boundModel);
			ensureItemsObserved(hostNode, boundModel);
			resync(hostNode, boundModel, false);
		}

		let mutationObserver = new MutationObserver((records) => {
			if (hostNode && boundModel) handleMutations(hostNode, boundModel, records);
		});
		mutationObserver.observe(event.node, { childList: true, subtree: true });

		let resizeObserver = new ResizeObserver(() => {
			if (!hostNode || !boundModel) return;
			stickToEndIfPinned(hostNode, boundModel);
			resync(hostNode, boundModel, false);
		});
		resizeObserver.observe(event.node);

		handle.signal.addEventListener("abort", () => {
			mutationObserver.disconnect();
			resizeObserver.disconnect();
			itemsObserver?.disconnect();
		});
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	return (model) => {
		if (boundModel !== model) {
			boundModel = model;

			model.addEventListener(
				"change",
				() => {
					if (!hostNode) return;

					syncAttributesFromModel(hostNode, model);

					let request = model.consumeScrollRequest();
					if (request) fulfillScrollRequest(hostNode, request);
				},
				{ signal: handle.signal },
			);
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "scroll">("scroll", (event) => {
					resync(event.currentTarget, model, userScrollIntent);
					userScrollIntent = false;
				}),
				on<HTMLElement, "wheel">("wheel", () => {
					userScrollIntent = true;
				}),
				on<HTMLElement, "touchmove">("touchmove", () => {
					userScrollIntent = true;
				}),
				on<HTMLElement, "keydown">("keydown", (event) => {
					if (SCROLL_KEYS.has(event.key)) userScrollIntent = true;
				}),
				on<HTMLElement, "click">("click", (event) => {
					let target = event.target;
					if (target instanceof Element && target.closest(`[${MESSAGE_SCROLLER_JUMP_ATTRIBUTE}]`)) {
						model.scrollToEnd();
					}
				}),
			],
		});
	};
});
