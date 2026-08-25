/**
 * Pointer-driven resize for one handle of a Resizable panel group: turns a
 * pointer press into a `ResizeSession`, feeds it pointer position along the
 * group's axis, and mirrors solved panel sizes back as CSS custom properties.
 *
 * Why JS: redistributing space between flexible panels — honoring min/max
 * constraints and cascading a shrink once a neighbor bottoms out — has no
 * declarative equivalent for turning a pointer gesture into solved sizes.
 * No-JS baseline: every panel renders at its default size and the boundary
 * between them is fixed.
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
 * `resizeHandle()` reads pointer movement on: `"horizontal"` drags
 * left/right between side-by-side panels; `"vertical"` drags up/down.
 */
export type ResizableAxis = "horizontal" | "vertical";

/**
 * Attribute a Resizable panel group's own host element carries.
 * `resizeHandle()` walks up to the nearest ancestor carrying it to find the
 * group to coordinate, so a nested group's handles never reach outside it.
 */
export const RESIZABLE_GROUP_ATTRIBUTE = "data-resizable-group";

/**
 * Attribute every panel in a Resizable group carries as a direct child of
 * the group's host element. `resizeHandle()` reads matching direct children,
 * in document order, as the panel list `ResizeSession`'s `panels` indexes by.
 */
export const RESIZABLE_PANEL_ATTRIBUTE = "data-resizable-panel";

/**
 * Attribute every handle in a Resizable group carries as a direct child of
 * the group's host element. `resizeHandle()` reads matching direct children,
 * in document order, to resolve which pair of panels its host sits between.
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
 * current resolved size as a percentage (`"42.5%"`) of the group's
 * main-axis size, letting a panel's own styles read it back directly.
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
 * drag ends by releasing over the handle, carrying every panel's settled
 * size; a cancelled drag reverts the panels instead of dispatching this.
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
 * group's panels and handles never leak into an ancestor's coordination.
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
 * group's panel elements: id, size, and min/max each fall back to a
 * default — a positional id, an even split, and `start()`'s own limits.
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
 * Adds pointer-driven resizing to one handle of a Resizable panel group,
 * sharing `session` with every other handle in the group; unmounting only
 * cancels a handle's own in-progress drag, leaving a sibling's drag alone.
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
