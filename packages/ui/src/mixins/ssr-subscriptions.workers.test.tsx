/**
 * Server-renders every mixin that subscribes to a model, session or frame inside workerd,
 * whose `addEventListener` accepts only a genuine `AbortSignal` — the check that turns a
 * subscription made during server rendering into an error reported on every request.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

import { renderToStream } from "remix/component/server";
import { afterEach, describe, expect, test, vi } from "vitest";

import { CalendarModel } from "../behaviors/calendar-model.js";
import { DragSession } from "../behaviors/drag-session.js";
import { FilterModel } from "../behaviors/filter-model.js";
import { ResizeSession } from "../behaviors/resize-session.js";
import { ScrollFollowModel } from "../behaviors/scroll-follow-model.js";
import { SelectionModel } from "../behaviors/selection-model.js";

import { calendarKeys } from "./calendar-keys.js";
import { commandFilter } from "./command-filter.js";
import { commandKeys } from "./command-keys.js";
import { dragReorder } from "./drag-reorder.js";
import { dropZone } from "./drop-zone.js";
import { gridListKeys } from "./grid-list-keys.js";
import { messageFollow } from "./message-follow.js";
import { rangePreview } from "./range-preview.js";
import { resizeHandle } from "./resize-handle.js";
import { treeKeys } from "./treeKeys.js";
import { viewTransition } from "./view-transition.js";

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
	["viewTransition", () => <div mix={[viewTransition()]} />],
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
