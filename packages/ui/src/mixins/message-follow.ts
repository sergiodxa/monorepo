/**
 * Bridges a message scroller's viewport to `ScrollFollowModel`, reporting
 * live scroll position, viewport size, and turn visibility into the model
 * and fulfilling its scroll intents by writing scroll position directly, so
 * every visible part of the widget renders purely from state the model owns.
 * Why JS: tracking live scroll position, size, and turn geometry, and
 * telling a deliberate scroll from an auto-follow correction, needs script;
 * no CSS selector expresses that. No-JS baseline: turns still render in
 * document order and the viewport still scrolls natively by wheel, touch, and keyboard.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { ScrollFollowModel } from "../behaviors/scroll-follow-model";

import { prefersReducedMotion } from "../utils/prefers-reduced-motion";

/**
 * Attribute every conversational turn exposes itself on, its value the
 * turn's stable id; `messageFollow()` reads it to find the anchor turn and
 * to drive its lazily attached `IntersectionObserver`'s visibility tracking.
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
 * Attribute `messageFollow()` mirrors onto the viewport: a space-separated
 * token list of edges still reachable (`"start"`, `"end"`, or `"start end"`),
 * readable via `[data-scrollable~="end"]`; removed once neither edge is reachable.
 */
export const MESSAGE_SCROLLER_SCROLLABLE_ATTRIBUTE = "data-scrollable";

/**
 * How many pixels of rounding error the viewport's scroll position may still
 * sit at from a true edge and count as reached, so sub-pixel layout rounding
 * never leaves an edge visually reached but reported as still reachable.
 */
const EDGE_TOLERANCE_PX = 1;

/**
 * Keys whose native scrolling on a focused viewport — or a focused
 * descendant — advances or retreats the reader's position: the keyboard
 * half of detecting an intentional scroll away from the live edge.
 */
const SCROLL_KEYS = new Set(["ArrowUp", "ArrowDown", "PageUp", "PageDown", "Home", "End"]);

/**
 * Resolves the behavior a scroll-fulfilling call should animate with,
 * collapsing to an instant jump under `prefers-reduced-motion: reduce` so a
 * long jump never rides motion the reader has asked the platform to avoid.
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
 * carrying {@link MESSAGE_SCROLLER_ANCHOR_ATTRIBUTE} whose bottom edge
 * hasn't yet scrolled past the viewport's top edge, read back to hold position on prepend.
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
 * Jumps the viewport straight to its end edge when `model` is pinned, the
 * auto-follow behavior keeping a reader glued to the live edge as turns
 * arrive; always instant, since animating every streamed token would read as constant motion.
 *
 * @param host Viewport element to scroll.
 * @param model Model whose pinned state gates the jump.
 */
function stickToEndIfPinned(host: HTMLElement, model: ScrollFollowModel): void {
	if (model.pinned) host.scrollTop = host.scrollHeight;
}

/**
 * Re-measures the viewport's reachable edges and anchor turn into `model`,
 * and re-derives its pinned state: reaching the end edge re-engages
 * auto-follow, while a reader-initiated scroll away from it disengages it.
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
 * Performs the scroll a pending {@link ScrollFollowModel.ScrollRequest}
 * describes: jumping or animating to the end, start, or a specific turn at
 * its requested alignment, respecting `prefers-reduced-motion` throughout.
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
 * Mirrors `model`'s state onto the viewport and its jump-to-latest control:
 * autoscrolling and scrollable attributes track `pinned` and reachable
 * edges, and `inert` hides the control from tab order in the same step as visibility.
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
 * Adds live-scroll coordination to a message scroller's viewport: reports
 * scroll position, size, and turn visibility into `model`, mirrors its
 * pinned and reachable-edge state back onto the viewport, and fulfills its scroll requests.
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
	 * Lazily creates the visibility observer the first time a turn exists
	 * beneath `host`, then keeps it watching exactly the turns currently
	 * rendered, reporting hidden any turn that has left the document.
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
	 * Reacts to a batch of mutations: synchronously shifts scroll position for
	 * turns prepended above the anchor, before the next paint, so the
	 * reader's view stays visually still, then re-syncs after appended turns settle.
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

		if (prependHeight > 0) host.scrollTop += prependHeight;
		if (appendedNew) stickToEndIfPinned(host, model);

		ensureItemsObserved(host, model);
		resync(host, model, false);
	}

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;

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
