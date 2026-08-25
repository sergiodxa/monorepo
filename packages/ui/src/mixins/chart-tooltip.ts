/**
 * Bridges a Chart.Bar, Chart.Line, Chart.Area, or Chart.Pie root to its
 * sibling Chart.Tooltip surface: tracks whichever plotted point the pointer
 * or keyboard focus currently resolves to, and mirrors it onto
 * Chart.Tooltip's rows and position.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute every plottable point a chart root renders carries: a bar's
 * `<rect>`, a line or area's vertex marker, or a pie's wedge `<path>`.
 * `chartTooltip()` reads it to build its pointer-tracked candidate set.
 */
export const CHART_POINT_ATTRIBUTE = "data-chart-point";

/**
 * Attribute a point carries its already-localized label on — the category,
 * series name, or slice name a chart renders it under. `chartTooltip()`
 * copies it unchanged into the matching row's {@link CHART_TOOLTIP_LABEL_ATTRIBUTE}.
 */
export const CHART_POINT_LABEL_ATTRIBUTE = "data-chart-label";

/**
 * Attribute a point carries its already-formatted value on, rendered through
 * the consumer's own `Intl` formatting. `chartTooltip()` copies it unchanged
 * into the matching row's {@link CHART_TOOLTIP_VALUE_ATTRIBUTE} slot.
 */
export const CHART_POINT_VALUE_ATTRIBUTE = "data-chart-value";

/**
 * Attribute an ancestor of a cluster of related points carries — every
 * series' point for one category in a grouped bar chart. Every point beneath
 * the nearest such ancestor populates the tooltip together, one row each.
 */
export const CHART_POINT_GROUP_ATTRIBUTE = "data-chart-group";

/**
 * Attribute Chart.Tooltip's own root element carries. `chartTooltip()` finds
 * it among its host's parent element's descendants — the sibling
 * relationship a chart root and its Chart.Tooltip render in.
 */
export const CHART_TOOLTIP_ATTRIBUTE = "data-chart-tooltip";

/**
 * Attribute every pre-rendered row inside Chart.Tooltip carries, one per
 * series it could ever need to show, in document order. `chartTooltip()`
 * fills as many as the active point set holds and hides the rest.
 */
export const CHART_TOOLTIP_ROW_ATTRIBUTE = "data-chart-tooltip-row";

/**
 * Attribute the element inside a Chart.Tooltip row that receives the active
 * point's {@link CHART_POINT_LABEL_ATTRIBUTE} text carries.
 */
export const CHART_TOOLTIP_LABEL_ATTRIBUTE = "data-chart-tooltip-label";

/**
 * Attribute the element inside a Chart.Tooltip row that receives the active
 * point's {@link CHART_POINT_VALUE_ATTRIBUTE} text carries.
 */
export const CHART_TOOLTIP_VALUE_ATTRIBUTE = "data-chart-tooltip-value";

/**
 * CSS custom property `chartTooltip()` writes on Chart.Tooltip's host with
 * the active point's horizontal pixel offset, relative to the chart root's
 * own parent element, for its own styling to read back via `var()`.
 */
export const CHART_TOOLTIP_X_PROPERTY = "--ui-chart-tooltip-x";

/**
 * CSS custom property `chartTooltip()` writes on Chart.Tooltip's host with
 * the active point's vertical pixel offset, relative to the chart root's own
 * parent element, read back the same way as {@link CHART_TOOLTIP_X_PROPERTY}.
 */
export const CHART_TOOLTIP_Y_PROPERTY = "--ui-chart-tooltip-y";

/**
 * Largest pixel distance from the pointer to a point's center that still
 * resolves as hovering it once no point sits directly beneath the pointer,
 * keeping empty chart margin from always resolving to the nearest point.
 */
const NEAREST_POINT_MAX_DISTANCE_PX = 48;

/** DOM event type dispatched on a chart root by {@link chartTooltip} whenever the active point set changes. */
const CHART_TOOLTIP_CHANGE_EVENT = "ui:chart-tooltip-change" as const;

declare global {
	interface HTMLElementEventMap {
		[CHART_TOOLTIP_CHANGE_EVENT]: ChartTooltipChangeEvent;
	}
}

/**
 * One point's already-localized label and value text, read off
 * {@link CHART_POINT_LABEL_ATTRIBUTE} and {@link CHART_POINT_VALUE_ATTRIBUTE},
 * as carried by {@link ChartTooltipChangeEvent}.
 */
export interface ChartTooltipPoint {
	/** The point's label, copied from {@link CHART_POINT_LABEL_ATTRIBUTE} unchanged. */
	readonly label: string;
	/** The point's value, copied from {@link CHART_POINT_VALUE_ATTRIBUTE} unchanged. */
	readonly value: string;
}

/**
 * Dispatched on a chart root by {@link chartTooltip} every time the active
 * point set changes, carrying every active point's label and value so a
 * consumer can drive a live-region announcement or cross-highlight a legend.
 */
export class ChartTooltipChangeEvent extends Event {
	/** Every currently active point's label and value, in document order, or an empty array when nothing is active. */
	readonly points: readonly ChartTooltipPoint[];

	/**
	 * @param points Every currently active point's label and value.
	 */
	constructor(points: readonly ChartTooltipPoint[]) {
		super(CHART_TOOLTIP_CHANGE_EVENT, { bubbles: true });
		this.points = points;
	}
}

/**
 * Reads every point beneath `host`, in document order.
 *
 * @param host Chart root to search beneath.
 * @returns Every element carrying {@link CHART_POINT_ATTRIBUTE}.
 */
function queryPoints(host: HTMLElement): HTMLElement[] {
	return Array.from(host.querySelectorAll<HTMLElement>(`[${CHART_POINT_ATTRIBUTE}]`));
}

/**
 * Resolves the point directly beneath viewport position `(clientX, clientY)`,
 * scoped to `host` — the precise case, matching a pointer sitting anywhere
 * over a filled bar, area, pie wedge, or exactly on a line's vertex marker.
 *
 * @param host Chart root the resolved point must fall inside.
 * @param clientX Pointer's horizontal viewport position.
 * @param clientY Pointer's vertical viewport position.
 * @returns The point directly beneath the position, or `undefined` when none sits there.
 */
function hitTestPoint(
	host: HTMLElement,
	clientX: number,
	clientY: number,
): HTMLElement | undefined {
	let element = document.elementFromPoint(clientX, clientY);
	let point = element?.closest<HTMLElement>(`[${CHART_POINT_ATTRIBUTE}]`) ?? undefined;
	return point && host.contains(point) ? point : undefined;
}

/**
 * Resolves the point whose center sits closest to viewport position
 * `(clientX, clientY)`, within {@link NEAREST_POINT_MAX_DISTANCE_PX} — the
 * fallback for a pointer near, but not exactly on, a thin vertex marker.
 *
 * @param host Chart root to search beneath.
 * @param clientX Pointer's horizontal viewport position.
 * @param clientY Pointer's vertical viewport position.
 * @returns The nearest point within range, or `undefined` when every point sits too far away (or none render at all).
 */
function nearestPoint(
	host: HTMLElement,
	clientX: number,
	clientY: number,
): HTMLElement | undefined {
	let nearest: HTMLElement | undefined;
	let nearestDistance = Infinity;

	for (let point of queryPoints(host)) {
		let rect = point.getBoundingClientRect();
		let dx = rect.left + rect.width / 2 - clientX;
		let dy = rect.top + rect.height / 2 - clientY;
		let distance = Math.sqrt(dx * dx + dy * dy);

		if (distance < nearestDistance) {
			nearestDistance = distance;
			nearest = point;
		}
	}

	return nearest !== undefined && nearestDistance <= NEAREST_POINT_MAX_DISTANCE_PX
		? nearest
		: undefined;
}

/**
 * Resolves the active point at viewport position `(clientX, clientY)`: an
 * exact {@link hitTestPoint} hit first, falling back to {@link nearestPoint}
 * when the pointer isn't directly over any point.
 *
 * @param host Chart root to resolve a point against.
 * @param clientX Pointer's horizontal viewport position.
 * @param clientY Pointer's vertical viewport position.
 * @returns The resolved point, or `undefined` when neither strategy finds one.
 */
function resolvePointAt(
	host: HTMLElement,
	clientX: number,
	clientY: number,
): HTMLElement | undefined {
	return hitTestPoint(host, clientX, clientY) ?? nearestPoint(host, clientX, clientY);
}

/**
 * Resolves `anchor`'s group: every point beneath its nearest enclosing
 * {@link CHART_POINT_GROUP_ATTRIBUTE} ancestor, scoped to `host`, or `anchor`
 * alone when it has no such ancestor.
 *
 * @param host Chart root the group's ancestor must fall inside.
 * @param anchor Point to resolve the group for.
 * @returns Every point in `anchor`'s group, in document order.
 */
function resolveGroup(host: HTMLElement, anchor: HTMLElement): HTMLElement[] {
	let container = anchor.closest<HTMLElement>(`[${CHART_POINT_GROUP_ATTRIBUTE}]`);
	if (container && host.contains(container)) {
		return Array.from(container.querySelectorAll<HTMLElement>(`[${CHART_POINT_ATTRIBUTE}]`));
	}

	return [anchor];
}

/**
 * Reads each point's already-localized label and value off
 * {@link CHART_POINT_LABEL_ATTRIBUTE} and {@link CHART_POINT_VALUE_ATTRIBUTE}.
 *
 * @param points Points to read, in the order the result should preserve.
 * @returns One {@link ChartTooltipPoint} per input point, in the same order.
 */
function readPoints(points: readonly HTMLElement[]): ChartTooltipPoint[] {
	return points.map((point) => ({
		label: point.getAttribute(CHART_POINT_LABEL_ATTRIBUTE) ?? "",
		value: point.getAttribute(CHART_POINT_VALUE_ATTRIBUTE) ?? "",
	}));
}

/**
 * Finds the Chart.Tooltip sibling a chart root's own mixin drives: the
 * nearest element carrying {@link CHART_TOOLTIP_ATTRIBUTE} among `host`'s
 * parent element's descendants.
 *
 * @param host Chart root to search alongside.
 * @returns The matched Chart.Tooltip, or `undefined` when `host` has no parent or renders no such sibling.
 */
function findTooltip(host: HTMLElement): HTMLElement | undefined {
	return (
		host.parentElement?.querySelector<HTMLElement>(`[${CHART_TOOLTIP_ATTRIBUTE}]`) ?? undefined
	);
}

/**
 * Fills as many of `tooltip`'s pre-rendered rows as `points` holds, in
 * document order, and hides every row beyond that count.
 *
 * @param tooltip Chart.Tooltip host to write rows onto.
 * @param points Active point set to fill rows from, in the order rows should receive them.
 */
function writeRows(tooltip: HTMLElement, points: readonly ChartTooltipPoint[]): void {
	let rows = tooltip.querySelectorAll<HTMLElement>(`[${CHART_TOOLTIP_ROW_ATTRIBUTE}]`);

	rows.forEach((row, index) => {
		let point = points[index];
		row.hidden = point === undefined;
		if (point === undefined) return;

		let label = row.querySelector<HTMLElement>(`[${CHART_TOOLTIP_LABEL_ATTRIBUTE}]`);
		let value = row.querySelector<HTMLElement>(`[${CHART_TOOLTIP_VALUE_ATTRIBUTE}]`);
		if (label) label.textContent = point.label;
		if (value) value.textContent = point.value;
	});
}

/**
 * Writes `anchor`'s screen position onto `tooltip` as
 * {@link CHART_TOOLTIP_X_PROPERTY} and {@link CHART_TOOLTIP_Y_PROPERTY},
 * relative to `host`'s own parent element, the shared positioning container.
 *
 * @param host Chart root `anchor` belongs to.
 * @param tooltip Chart.Tooltip host to write the position onto.
 * @param anchor Active point to position the tooltip against.
 */
function writePosition(host: HTMLElement, tooltip: HTMLElement, anchor: HTMLElement): void {
	let origin = (host.parentElement ?? host).getBoundingClientRect();
	let anchorRect = anchor.getBoundingClientRect();

	let x = anchorRect.left + anchorRect.width / 2 - origin.left;
	let y = anchorRect.top - origin.top;

	tooltip.style.setProperty(CHART_TOOLTIP_X_PROPERTY, `${x}px`);
	tooltip.style.setProperty(CHART_TOOLTIP_Y_PROPERTY, `${y}px`);
}

/**
 * Resolves the point carrying {@link CHART_POINT_ATTRIBUTE} that `target`
 * itself is, or is nested inside, scoped to `host`.
 *
 * @param host Chart root the resolved point must fall inside.
 * @param target Candidate element — typically a focus event's target or related target.
 * @returns The matched point, or `undefined` when `target` isn't a point, or isn't inside `host`.
 */
function resolveOwnPoint(host: HTMLElement, target: EventTarget | null): HTMLElement | undefined {
	if (!(target instanceof Element)) return undefined;

	let point = target.closest<HTMLElement>(`[${CHART_POINT_ATTRIBUTE}]`) ?? undefined;
	return point && host.contains(point) ? point : undefined;
}

/**
 * Adds pointer- and focus-tracked tooltip coordination to a Chart.Bar,
 * Chart.Line, Chart.Area, or Chart.Pie root, resolving the active point and
 * its group into the sibling Chart.Tooltip's rows, position, and events.
 *
 * @returns A mixin descriptor for a chart root's `mix` prop.
 * @example
 * <div mix={[css({ position: "relative" })]}>
 *   <Chart.Bar data={points} mix={chartTooltip()} />
 *   <Chart.Tooltip>
 *     <Chart.Tooltip.Row>
 *       <Chart.Tooltip.Label />
 *       <Chart.Tooltip.Value />
 *     </Chart.Tooltip.Row>
 *   </Chart.Tooltip>
 * </div>
 */
export const chartTooltip: MixinFactory<HTMLElement> = createMixin<HTMLElement>((handle) => {
	let activePoint: HTMLElement | undefined;

	/** Activates `anchor` on `host`'s Chart.Tooltip and reports the change, unless `anchor` is already active. */
	function activate(host: HTMLElement, anchor: HTMLElement): void {
		if (anchor === activePoint) return;
		activePoint = anchor;

		let points = readPoints(resolveGroup(host, anchor));
		let tooltip = findTooltip(host);

		if (tooltip) {
			writeRows(tooltip, points);
			writePosition(host, tooltip, anchor);
			tooltip.setAttribute("data-visible", "");
		}

		host.dispatchEvent(new ChartTooltipChangeEvent(points));
	}

	/** Deactivates `host`'s Chart.Tooltip and reports the change, unless nothing is currently active. */
	function deactivate(host: HTMLElement): void {
		if (activePoint === undefined) return;
		activePoint = undefined;

		findTooltip(host)?.removeAttribute("data-visible");
		host.dispatchEvent(new ChartTooltipChangeEvent([]));
	}

	return () =>
		createElement(handle.element, {
			mix: [
				on<HTMLElement, "pointermove">("pointermove", (event) => {
					let host = event.currentTarget;
					let point = resolvePointAt(host, event.clientX, event.clientY);
					if (point) activate(host, point);
					else deactivate(host);
				}),
				on<HTMLElement, "pointerdown">("pointerdown", (event) => {
					let host = event.currentTarget;
					let point = resolvePointAt(host, event.clientX, event.clientY);
					if (point) activate(host, point);
				}),
				on<HTMLElement, "pointerleave">("pointerleave", (event) => {
					deactivate(event.currentTarget);
				}),
				on<HTMLElement, "focusin">("focusin", (event) => {
					let host = event.currentTarget;
					let point = resolveOwnPoint(host, event.target);
					if (point) activate(host, point);
				}),
				on<HTMLElement, "focusout">("focusout", (event) => {
					let host = event.currentTarget;
					if (resolveOwnPoint(host, event.relatedTarget) === undefined) deactivate(host);
				}),
			],
		});
});
