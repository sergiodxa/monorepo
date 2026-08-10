/**
 * Bridges a Chart.Bar, Chart.Line, Chart.Area, or Chart.Pie root to its
 * sibling Chart.Tooltip surface: tracks whichever plotted point the pointer
 * currently sits nearest to — or, once keyboard focus lands directly on a
 * point, that exact point — and mirrors it onto Chart.Tooltip's rows and
 * position.
 *
 * Every point a chart root renders (a bar's `<rect>`, a line or area's vertex
 * marker, a pie's wedge `<path>`) carries {@link CHART_POINT_ATTRIBUTE} plus
 * its already-localized {@link CHART_POINT_LABEL_ATTRIBUTE} and
 * {@link CHART_POINT_VALUE_ATTRIBUTE}. Points that share one enclosing
 * {@link CHART_POINT_GROUP_ATTRIBUTE} ancestor — every series' point for one
 * category in a grouped bar or multi-line chart — populate the tooltip
 * together, one row each, in document order; a point with no such ancestor
 * populates a lone row on its own, which is the common case for a pie wedge
 * or a single-series chart.
 *
 * Chart.Tooltip pre-renders one {@link CHART_TOOLTIP_ROW_ATTRIBUTE} row per
 * series it could ever need to show at once. This mixin fills each row's
 * {@link CHART_TOOLTIP_LABEL_ATTRIBUTE} and {@link CHART_TOOLTIP_VALUE_ATTRIBUTE}
 * slots from the active point set, hides whichever rows are left over, and
 * writes the active point's screen position onto Chart.Tooltip's host as
 * {@link CHART_TOOLTIP_X_PROPERTY} and {@link CHART_TOOLTIP_Y_PROPERTY} —
 * pixel offsets relative to the chart root's own parent element, the shared
 * positioning container both elements render inside. {@link ChartTooltipChangeEvent}
 * dispatches on the chart root every time the active point set changes,
 * including to empty once nothing is hovered or focused, so a consumer can
 * drive a live-region announcement or cross-highlight a Chart.Legend swatch
 * without reading the tooltip's rows back off the DOM.
 *
 * Why JS: resolving which plotted point the pointer or keyboard focus
 * currently sits nearest to, and positioning a floating tooltip surface
 * against that point's live screen coordinates, both require reading pointer
 * coordinates and element geometry as they change — no CSS selector computes
 * "nearest point to the pointer" or interpolates one element's position from
 * another element's coordinates.
 * No-JS baseline: every point still shows the browser's native tooltip on
 * hover and stays reachable by keyboard focus, its accessible name read from
 * its own `<title>`; Chart.Tooltip itself is never part of that baseline —
 * without this mixin its rows simply stay empty and hidden, so nothing on
 * the page looks broken.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/ui";

import { createElement, createMixin, on } from "remix/ui";

/**
 * Attribute every plottable point a chart root renders carries: a bar's
 * `<rect>`, a line or area's vertex marker, or a pie's wedge `<path>`.
 * `chartTooltip()` reads every element carrying this attribute beneath its
 * host, in document order, both as the pointer-tracked lookup's candidate
 * set and, once one is resolved, as the entry point into its
 * {@link CHART_POINT_GROUP_ATTRIBUTE} group.
 */
export const CHART_POINT_ATTRIBUTE = "data-chart-point";

/**
 * Attribute a point carries its already-localized label on — the category,
 * series name, or slice name a chart renders it under. `chartTooltip()`
 * copies this value, unchanged, into the matching row's
 * {@link CHART_TOOLTIP_LABEL_ATTRIBUTE} slot whenever the point becomes
 * active.
 */
export const CHART_POINT_LABEL_ATTRIBUTE = "data-chart-label";

/**
 * Attribute a point carries its already-formatted value on, rendered through
 * the consumer's own `Intl` formatting rather than anything this mixin
 * computes. `chartTooltip()` copies this value, unchanged, into the matching
 * row's {@link CHART_TOOLTIP_VALUE_ATTRIBUTE} slot whenever the point becomes
 * active.
 */
export const CHART_POINT_VALUE_ATTRIBUTE = "data-chart-value";

/**
 * Attribute an ancestor of a cluster of related points carries — every
 * series' point for one category in a grouped or stacked bar chart, or every
 * line's vertex marker at one shared x position in a multi-line chart.
 * `chartTooltip()` walks up from whichever point resolves as active to find
 * the nearest ancestor carrying this attribute, and when one exists, every
 * point beneath it populates the tooltip together instead of just the
 * resolved point alone. A point with no such ancestor — the usual case for a
 * pie wedge or a single-series chart — populates a lone row on its own.
 */
export const CHART_POINT_GROUP_ATTRIBUTE = "data-chart-group";

/**
 * Attribute Chart.Tooltip's own root element carries. `chartTooltip()` looks
 * for it among its host's parent element's descendants to find the tooltip
 * surface it drives — the sibling relationship a chart root and its
 * Chart.Tooltip render in, both inside a shared positioning container the
 * consumer supplies.
 */
export const CHART_TOOLTIP_ATTRIBUTE = "data-chart-tooltip";

/**
 * Attribute every pre-rendered row inside Chart.Tooltip carries, one per
 * series it could ever need to show for one active point set, in document
 * order. `chartTooltip()` fills as many rows as the active point set holds
 * and sets the native `hidden` property on every row beyond that count,
 * rather than creating or removing rows itself.
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
 * own parent element. Chart.Tooltip's own styling reads this back —
 * `inset-inline-start: var(--ui-chart-tooltip-x)` alongside a centering
 * transform, for a positioning container with `position: relative` — instead
 * of any component tracking the active point's position as reactive state.
 */
export const CHART_TOOLTIP_X_PROPERTY = "--ui-chart-tooltip-x";

/**
 * CSS custom property `chartTooltip()` writes on Chart.Tooltip's host with
 * the active point's vertical pixel offset, relative to the chart root's own
 * parent element. Chart.Tooltip's own styling reads this back the same way
 * as {@link CHART_TOOLTIP_X_PROPERTY}.
 */
export const CHART_TOOLTIP_Y_PROPERTY = "--ui-chart-tooltip-y";

/**
 * Largest pixel distance from the pointer to a point's center that still
 * resolves as hovering it once no point sits directly beneath the pointer.
 * Without this ceiling, every position inside a chart root — including its
 * empty margin — would always resolve to whichever point happens to be
 * nearest, however far away that point visually sits.
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
 * point set changes: the pointer moves onto a different point (or off the
 * chart entirely), or keyboard focus moves onto a different point (or away
 * from all of them). Carries every active point's label and value, in the
 * same document order {@link CHART_TOOLTIP_ROW_ATTRIBUTE} rows fill in, so a
 * consumer can drive its own live-region announcement or cross-highlight a
 * Chart.Legend swatch without reading Chart.Tooltip's rows back off the DOM.
 * An empty `points` array means nothing is currently hovered or focused.
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
 * over a filled bar, area, or pie wedge, or exactly on a line's vertex
 * marker.
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
 * fallback case, matching a pointer that sits near but not exactly on a
 * line chart's thin vertex marker or a narrow bar.
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
 * document order, and sets the native `hidden` property on every row beyond
 * that count — never creating or removing a row itself.
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
 * relative to `host`'s own parent element — the shared positioning container
 * both `host` and `tooltip` render inside.
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
 * Chart.Line, Chart.Area, or Chart.Pie root. Moving the pointer over the
 * chart resolves the point beneath it (falling back to the nearest point
 * within range when none sits exactly beneath); moving keyboard focus onto a
 * point resolves that exact point directly. Either path resolves the point's
 * {@link CHART_POINT_GROUP_ATTRIBUTE} group, fills the sibling Chart.Tooltip's
 * rows and position (see {@link writeRows}, {@link writePosition}), and
 * dispatches {@link ChartTooltipChangeEvent} on the chart root. The pointer
 * leaving the chart, or focus leaving every point, clears Chart.Tooltip's
 * {@link CHART_TOOLTIP_ATTRIBUTE}-flagged `data-visible` state and dispatches
 * {@link ChartTooltipChangeEvent} with an empty `points` array.
 *
 * Applies to the chart root only — Chart.Tooltip itself takes no mixin of
 * its own, since this one drives it entirely from its sibling.
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
