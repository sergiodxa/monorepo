/**
 * Pointer-driven resize for one handle of a Resizable panel group: turns a
 * pointer press on the handle into a `ResizeSession`, feeds it the pointer's
 * position along the group's resize axis as the pointer moves, and mirrors
 * every solved panel size back onto its panel element as a CSS custom
 * property, so the panels' own styles read the live layout without any
 * component in the tree holding reactive state.
 *
 * Why JS: dragging a boundary between two flexible panels to redistribute
 * their space — honoring each panel's min/max constraints and cascading a
 * shrink into further panels once an immediate neighbor bottoms out — has no
 * declarative HTML or CSS equivalent; nothing in markup can turn a pointer
 * press/move/release gesture into a solved set of panel sizes.
 * No-JS baseline: the group still renders every panel at its default size;
 * the boundary between panels is fixed in place and cannot be dragged.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { ResizeSession } from "../behaviors/resize-session";

import { isNewPrimaryPress } from "../utils/is-new-primary-press";

import { trackHostNode } from "./track-host-node";

/**
 * Axis a Resizable panel group lays its panels out along, and the direction
 * `resizeHandle()` reads pointer movement on: `"horizontal"` panels sit
 * side by side and their shared boundary drags left/right; `"vertical"`
 * panels stack and their shared boundary drags up/down.
 */
export type ResizableAxis = "horizontal" | "vertical";

/**
 * Attribute a Resizable panel group's own host element carries.
 * `resizeHandle()` walks up from its handle to the nearest ancestor carrying
 * this attribute to find the group whose direct-child panels and handles it
 * coordinates — the same boundary a nested Resizable group's own handles
 * stop at, so one group's handles never reach into another's panels.
 */
export const RESIZABLE_GROUP_ATTRIBUTE = "data-resizable-group";

/**
 * Attribute every panel in a Resizable group carries as a direct child of
 * the group's host element. `resizeHandle()` reads every matching direct
 * child, in document order, as the group's panel list — the same order
 * `ResizeSession`'s `panels` snapshot is indexed by.
 */
export const RESIZABLE_PANEL_ATTRIBUTE = "data-resizable-panel";

/**
 * Attribute every handle in a Resizable group carries as a direct child of
 * the group's host element. `resizeHandle()` reads every matching direct
 * child, in document order, to resolve which pair of panels its own host
 * sits between.
 */
export const RESIZABLE_HANDLE_ATTRIBUTE = "data-resizable-handle";

/**
 * Attribute a panel optionally carries to set the smallest percentage of the
 * group's main-axis size it may shrink to, as a plain number (`"20"`, not
 * `"20%"`). Omitted entirely, a panel is free to shrink to 0.
 */
export const RESIZABLE_PANEL_MIN_ATTRIBUTE = "data-resizable-min";

/**
 * Attribute a panel optionally carries to set the largest percentage of the
 * group's main-axis size it may grow to, as a plain number (`"80"`, not
 * `"80%"`). Omitted entirely, a panel is free to grow to 100.
 */
export const RESIZABLE_PANEL_MAX_ATTRIBUTE = "data-resizable-max";

/**
 * CSS custom property `resizeHandle()` writes on every panel with its
 * current resolved size, as a percentage of the group's main-axis size
 * (`"42.5%"`). A panel's own styles read its size back through this
 * property — `flex-basis: var(--ui-resizable-panel-size)` for a
 * flex-laid-out group — instead of any component tracking size as reactive
 * state.
 */
export const RESIZABLE_PANEL_SIZE_PROPERTY = "--ui-resizable-panel-size";

/** DOM event type dispatched by {@link resizeHandle} on the panel group once a drag settles a new layout. */
const RESIZABLE_LAYOUT_CHANGE_EVENT = "ui:resizable-layout-change" as const;

declare global {
	interface HTMLElementEventMap {
		[RESIZABLE_LAYOUT_CHANGE_EVENT]: ResizableLayoutChangeEvent;
	}
}

/**
 * Dispatched on a Resizable group's host by {@link resizeHandle} once a
 * pointer drag ends by releasing over the handle, carrying every panel's
 * settled size so a consumer can persist the layout — writing it to a
 * cookie so the server renders the same split on the next page load, for
 * instance — without holding onto the `ResizeSession` instance itself.
 * Cancelling a drag (`Escape`, a `pointercancel`, or the handle unmounting
 * mid-drag) reverts the panels instead of dispatching this event, since
 * nothing actually settled.
 */
export class ResizableLayoutChangeEvent extends Event {
	/** Every panel's settled size, min, and max, in group order. */
	readonly panels: readonly ResizeSession.Panel[];

	/**
	 * @param panels Every panel's settled state at the moment the drag ended.
	 */
	constructor(panels: readonly ResizeSession.Panel[]) {
		super(RESIZABLE_LAYOUT_CHANGE_EVENT, { bubbles: true });
		this.panels = panels;
	}
}

/**
 * Finds the nearest enclosing panel group, identified by
 * {@link RESIZABLE_GROUP_ATTRIBUTE}.
 *
 * @param node Handle element to search upward from.
 * @returns The matched group, or `undefined` when `node` sits outside one.
 */
function findGroup(node: HTMLElement): HTMLElement | undefined {
	return node.closest<HTMLElement>(`[${RESIZABLE_GROUP_ATTRIBUTE}]`) ?? undefined;
}

/**
 * Reads every direct child of `groupNode` carrying `attribute`, in document
 * order — the scoping rule every query in this module uses so a nested
 * Resizable group's own panels and handles never leak into an ancestor
 * group's coordination.
 *
 * @param groupNode Panel group element to read direct children of.
 * @param attribute Attribute name identifying the child elements to collect.
 * @returns The matched direct children, in document order.
 */
function queryGroupChildren(groupNode: HTMLElement, attribute: string): HTMLElement[] {
	return Array.from(groupNode.querySelectorAll<HTMLElement>(`:scope > [${attribute}]`));
}

/**
 * Reads a panel's current resolved size off {@link RESIZABLE_PANEL_SIZE_PROPERTY},
 * falling back to `fallback` when the property is unset or holds a
 * value that doesn't resolve to a finite number.
 *
 * @param node Panel element to read.
 * @param fallback Size to use when the property is unset or unparsable.
 */
function readPanelSize(node: HTMLElement, fallback: number): number {
	let raw = getComputedStyle(node).getPropertyValue(RESIZABLE_PANEL_SIZE_PROPERTY).trim();
	if (raw === "") return fallback;

	let value = Number(raw.replace(/%$/, ""));
	return Number.isFinite(value) ? value : fallback;
}

/**
 * Reads a panel's numeric constraint attribute (`min` or `max`), returning
 * `undefined` when the attribute is absent or doesn't hold a finite number —
 * letting `ResizeSession.start()` fall back to its own default in either case.
 *
 * @param node Panel element to read.
 * @param attribute Constraint attribute to read off it.
 */
function readPanelConstraint(node: HTMLElement, attribute: string): number | undefined {
	let raw = node.getAttribute(attribute);
	if (raw === null) return undefined;

	let value = Number(raw);
	return Number.isFinite(value) ? value : undefined;
}

/**
 * Builds the `ResizeSession.PanelInput` snapshot `start()` needs from a
 * group's panel elements: each panel's id comes from its own `id` attribute,
 * falling back to a positional id when absent; its starting size comes from
 * {@link readPanelSize}, falling back to an even split across every panel
 * when unset; its min/max come from {@link readPanelConstraint}.
 *
 * @param panelNodes A group's panel elements, in document order.
 * @returns The matching panel snapshot, in the same order.
 */
function readPanelInputs(panelNodes: readonly HTMLElement[]): ResizeSession.PanelInput[] {
	let evenSize = panelNodes.length > 0 ? 100 / panelNodes.length : 0;

	return panelNodes.map((node, index) => ({
		id: node.id || `panel-${index}`,
		size: readPanelSize(node, evenSize),
		min: readPanelConstraint(node, RESIZABLE_PANEL_MIN_ATTRIBUTE),
		max: readPanelConstraint(node, RESIZABLE_PANEL_MAX_ATTRIBUTE),
	}));
}

/**
 * Reads the pointer coordinate `ResizeSession.move()` solves against,
 * matching whichever axis the group resizes on: `clientX` for
 * `"horizontal"`, `clientY` for `"vertical"`.
 *
 * @param event Pointer event to read a coordinate from.
 * @param axis Axis the enclosing group resizes along.
 */
function axisPointerPosition(event: PointerEvent, axis: ResizableAxis): number {
	return axis === "horizontal" ? event.clientX : event.clientY;
}

/**
 * Measures `groupNode`'s size along `axis`, in pixels — the unit
 * `ResizeSession` converts pixel pointer deltas against to solve percentage
 * sizes.
 *
 * @param groupNode Panel group element to measure.
 * @param axis Axis the group resizes along.
 */
function measureGroupSize(groupNode: HTMLElement, axis: ResizableAxis): number {
	let rect = groupNode.getBoundingClientRect();
	return axis === "horizontal" ? rect.width : rect.height;
}

/**
 * Rounds a solved percentage to two decimal places before it's written to
 * {@link RESIZABLE_PANEL_SIZE_PROPERTY}, so a repeating fraction from
 * `ResizeSession`'s division doesn't land as a long floating-point string.
 *
 * @param value Percentage to round.
 */
function roundPercent(value: number): number {
	return Math.round(value * 100) / 100;
}

/**
 * Adds pointer-driven resizing to one handle of a Resizable panel group.
 * Pressing the handle starts `session` against the enclosing group's
 * direct-child panels and handles — found through
 * {@link RESIZABLE_GROUP_ATTRIBUTE}, {@link RESIZABLE_PANEL_ATTRIBUTE}, and
 * {@link RESIZABLE_HANDLE_ATTRIBUTE} — dragging feeds the pointer's position
 * along `axis` into `session.move()`, and releasing ends the session.
 * `Escape`, a `pointercancel`, or the handle unmounting mid-drag all cancel
 * the session instead, reverting every panel to the size it had when the
 * drag began.
 *
 * Every `session` `"change"` — from a live drag or a cancelled one reverting
 * — mirrors every panel's resolved size onto it as
 * {@link RESIZABLE_PANEL_SIZE_PROPERTY}, and mirrors this handle's own
 * adjacent panel's size, min, and max onto its `aria-valuenow`,
 * `aria-valuemin`, and `aria-valuemax`, so a screen reader announces the
 * live split the same way sighted users see it drag. A drag that ends by
 * releasing the pointer dispatches {@link ResizableLayoutChangeEvent} on the
 * group with every panel's settled size.
 *
 * Apply one `resizeHandle()` call per handle in the group, all sharing the
 * same `session` instance — only one handle can be mid-drag at a time,
 * which `session` itself enforces.
 *
 * @param axis Axis the enclosing group resizes along.
 * @param session Resize session shared by every handle in the same panel group.
 * @example
 * let session = new ResizeSession();
 * <div data-resizable-group>
 *   <section data-resizable-panel id="sidebar">Sidebar</section>
 *   <div
 *     data-resizable-handle
 *     role="separator"
 *     aria-orientation="vertical"
 *     aria-label={resizeSidebarLabel}
 *     tabIndex={0}
 *     mix={resizeHandle("horizontal", session)}
 *   />
 *   <section data-resizable-panel id="content">Content</section>
 * </div>
 */
export const resizeHandle = createMixin<HTMLElement, [axis: ResizableAxis, session: ResizeSession]>(
	(handle) => {
		let getHostNode = trackHostNode(handle);
		let boundSession: ResizeSession | undefined;
		let activePointerId: number | undefined;

		/** Mirrors `session`'s resolved sizes onto their panel elements, and this handle's adjacent panel onto its own ARIA value attributes. */
		function syncLayout(session: ResizeSession): void {
			let hostNode = getHostNode();
			if (!hostNode) return;

			let groupNode = findGroup(hostNode);
			if (!groupNode) return;

			let panels = session.panels;
			let panelNodes = queryGroupChildren(groupNode, RESIZABLE_PANEL_ATTRIBUTE);

			for (let index = 0; index < panelNodes.length; index++) {
				let panel = panels[index];
				let panelNode = panelNodes[index];
				if (panel && panelNode) {
					panelNode.style.setProperty(
						RESIZABLE_PANEL_SIZE_PROPERTY,
						`${roundPercent(panel.size)}%`,
					);
				}
			}

			let handleNodes = queryGroupChildren(groupNode, RESIZABLE_HANDLE_ATTRIBUTE);
			let handleIndex = handleNodes.indexOf(hostNode);
			let adjacentPanel = handleIndex === -1 ? undefined : panels[handleIndex];
			if (!adjacentPanel) return;

			hostNode.setAttribute("aria-valuenow", String(Math.round(adjacentPanel.size)));
			hostNode.setAttribute("aria-valuemin", String(Math.round(adjacentPanel.min)));
			hostNode.setAttribute("aria-valuemax", String(Math.round(adjacentPanel.max)));
		}

		return (axis, session) => {
			if (boundSession !== session) {
				boundSession = session;

				session.addEventListener("change", () => syncLayout(session), { signal: handle.signal });

				// Only this handle's own in-progress drag should be cancelled by its
				// removal — a sibling handle in the same group unmounting while this
				// one is idle must leave whichever other handle is mid-drag alone.
				handle.signal.addEventListener("abort", () => {
					if (activePointerId !== undefined) session.cancel();
				});
			}

			return createElement(handle.element, {
				mix: [
					on<HTMLElement, "pointerdown">("pointerdown", (event) => {
						if (!isNewPrimaryPress(event, activePointerId)) return;

						let hostNode = getHostNode();
						if (!hostNode || session.isActive) return;

						let groupNode = findGroup(hostNode);
						if (!groupNode) return;

						let panelNodes = queryGroupChildren(groupNode, RESIZABLE_PANEL_ATTRIBUTE);
						let handleNodes = queryGroupChildren(groupNode, RESIZABLE_HANDLE_ATTRIBUTE);
						let handleIndex = handleNodes.indexOf(hostNode);
						if (handleIndex === -1 || panelNodes.length < 2) return;

						activePointerId = event.pointerId;
						hostNode.setPointerCapture(event.pointerId);

						session.start({
							handleIndex,
							panels: readPanelInputs(panelNodes),
							pointerPosition: axisPointerPosition(event, axis),
							groupSize: measureGroupSize(groupNode, axis),
						});
					}),
					on<HTMLElement, "pointermove">("pointermove", (event) => {
						if (event.pointerId !== activePointerId || !session.isActive) return;
						session.move(axisPointerPosition(event, axis));
					}),
					on<HTMLElement, "pointerup">("pointerup", (event) => {
						let hostNode = getHostNode();
						if (event.pointerId !== activePointerId || !hostNode) return;
						activePointerId = undefined;

						session.end();
						findGroup(hostNode)?.dispatchEvent(new ResizableLayoutChangeEvent(session.panels));
					}),
					on<HTMLElement, "pointercancel">("pointercancel", (event) => {
						if (event.pointerId !== activePointerId) return;
						activePointerId = undefined;
						session.cancel();
					}),
					on<HTMLElement, "keydown">("keydown", (event) => {
						if (event.key !== "Escape" || activePointerId === undefined) return;
						activePointerId = undefined;
						session.cancel();
					}),
				],
			});
		};
	},
);
