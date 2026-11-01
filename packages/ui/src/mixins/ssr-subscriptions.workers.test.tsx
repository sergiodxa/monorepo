/**
 * Server-renders every mixin that subscribes to a model, session or frame inside workerd,
 * whose `addEventListener` accepts only a genuine `AbortSignal` — the check that turns a
 * subscription made during server rendering into an error reported on every request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { renderToStream } from "remix/component/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { DragSession } from "../app/behaviors/drag-session.js";
import { ResizeSession } from "../app/behaviors/resize-session.js";
import { SelectionModel } from "../app/behaviors/selection-model.js";
import { dragReorder } from "../app/mixins/drag-reorder.js";
import { dropZone } from "../app/mixins/drop-zone.js";
import { gridListKeys } from "../app/mixins/grid-list-keys.js";
import { rangePickerKeys } from "../app/mixins/range-picker-keys.js";
import { resizeHandle } from "../app/mixins/resize-handle.js";
import { treeKeys } from "../app/mixins/tree-keys.js";
import { CalendarModel } from "../behaviors/calendar-model.js";
import { FilterModel } from "../behaviors/filter-model.js";
import { ScrollFollowModel } from "../chat/behaviors/scroll-follow-model.js";
import { messageFollow } from "../chat/mixins/message-follow.js";

import { calendarKeys } from "./calendar-keys.js";
import { commandFilter } from "./command-filter.js";
import { commandKeys } from "./command-keys.js";
import { frameRefresh } from "./frame-refresh.js";
import { frameSubmit } from "./frame-submit.js";
import { rangePreview } from "./range-preview.js";
import { viewTransition } from "./view-transition.js";
import { whileLive } from "./while-live.js";

/** An island following a behavior-class instance the way an app's island follows its model. */
function Island(handle: Handle) {
	let model = new SelectionModel();
	whileLive(handle, (target: SelectionModel, signal) => {
		target.addEventListener("change", () => void handle.update(), { signal });
	})(model);

	return () => <div />;
}

/** Each mixin applied to the host it ships on, keyed by the mixin's name. */
const CASES: [name: string, node: () => RemixNode][] = [
	["calendarKeys", () => <div mix={[calendarKeys(new CalendarModel())]} />],
	["rangePreview", () => <div mix={[rangePreview(new CalendarModel())]} />],
	["gridListKeys", () => <div role="grid" mix={[gridListKeys(new SelectionModel())]} />],
	["treeKeys", () => <div role="tree" mix={[treeKeys(new SelectionModel())]} />],
	["dragReorder", () => <ul mix={[dragReorder(new DragSession())]} />],
	["dropZone", () => <div mix={[dropZone(new DragSession())]} />],
	["commandFilter", () => <div mix={[commandFilter(new FilterModel())]} />],
	["commandKeys", () => <div mix={[commandKeys(new FilterModel())]} />],
	["messageFollow", () => <div mix={[messageFollow(new ScrollFollowModel())]} />],
	["resizeHandle", () => <div mix={[resizeHandle("horizontal", new ResizeSession())]} />],
	["rangePickerKeys", () => <form mix={[rangePickerKeys()]} />],
	["viewTransition", () => <div mix={[viewTransition()]} />],
	["frameSubmit", () => <form mix={[frameSubmit()]} />],
	["frameRefresh", () => <div mix={[frameRefresh({ every: 1000, on: "app:saved" })]} />],
	["whileLive in an island", () => <Island />],
];

afterEach(() => {
	vi.restoreAllMocks();
});

describe("server rendering", () => {
	test.each(CASES)("%s renders without reporting an error", async (_name, node) => {
		/**
		 * A mixin that throws while rendering is isolated by logging it, so the log is where
		 * the failure surfaces alongside `onError`.
		 */
		let logged = vi.spyOn(console, "error").mockImplementation(() => {});
		let onError = vi.fn();

		let html = await new Response(renderToStream(node(), { onError })).text();

		expect(html).toContain("<");
		expect(onError).not.toHaveBeenCalled();
		expect(logged).not.toHaveBeenCalled();
	});
});
