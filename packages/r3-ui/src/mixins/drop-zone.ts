/**
 * Drag-and-drop file acceptance for a DropZone: tracks a file drag hovering
 * the host through a shared `DragSession`, mirrors its target onto the host
 * as a `data-*` attribute for the drag-over highlight, and turns a
 * completed drop into a typed custom event carrying the dropped files.
 *
 * Why JS: `dragenter`/`dragover`/`dragleave`/`drop` and reading `File`
 * objects off a drag payload are JavaScript-only APIs — nothing in markup
 * or CSS can tell a file being dragged over an element apart from dragged
 * text or an in-page selection, or read the files it carries.
 * No-JS baseline: the zone still renders a native `<input type="file">`
 * control, so picking files through the system file picker keeps working
 * without a script; only accepting files dragged in from outside the page,
 * and the drag-over highlight while one hovers, are unavailable.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { DragSession } from "../behaviors/drag-session";

/**
 * `data-*` attribute {@link dropZone} toggles on its host for as long as a
 * file drag from outside the page is hovering over it — present with an
 * empty string value while hovering, absent otherwise — so a DropZone's own
 * styling can render the drag-over highlight from this attribute alone.
 */
export const DROP_TARGET_ATTRIBUTE = "data-drop-target";

/**
 * Stable `DragSession` key identifying the drop surface a `dropZone()` host
 * represents. A drop zone only ever tracks one candidate — itself — so
 * every call into the session reuses this same key instead of reading a
 * per-element identifier the way a multi-item widget coordinating several
 * drop candidates would.
 */
const DROP_ZONE_KEY = "drop-zone";

/** DOM event type dispatched by {@link dropZone} once a drop carries at least one file. */
const DROP_FILES_EVENT = "ui:drop-files" as const;

declare global {
	interface HTMLElementEventMap {
		[DROP_FILES_EVENT]: DropFilesEvent;
	}
}

/**
 * Dispatched on a DropZone's host by {@link dropZone} once a drag ending in
 * a drop carries at least one file, carrying those files so a consumer can
 * start uploading them without reaching into the originating `DragEvent`'s
 * `dataTransfer` itself.
 */
export class DropFilesEvent extends Event {
	/** Files carried by the drop that triggered this event. */
	readonly files: readonly File[];

	/**
	 * @param files Files pulled from the drop's drag payload.
	 */
	constructor(files: readonly File[]) {
		super(DROP_FILES_EVENT, { bubbles: true });
		this.files = files;
	}
}

/**
 * Whether `dataTransfer` is carrying at least one file rather than dragged
 * text, a link, or an in-page selection. Checked by scanning its `types`
 * list for `"Files"`, since the actual `File` objects an OS-level drag
 * carries aren't readable until the drop itself fires.
 *
 * @param dataTransfer Drag payload from a `dragenter`, `dragover`, or `drop` event.
 * @returns Whether the drag carries files.
 */
function isFileDrag(dataTransfer: DataTransfer | null): boolean {
	return dataTransfer !== null && dataTransfer.types.includes("Files");
}

/**
 * Adds drag-and-drop file acceptance to a DropZone. Delegates the drag
 * itself to `session` — a `DragSession` instance the consumer constructs and
 * can share with a DropIndicator observing the same drag — so this mixin
 * only ever translates native `dragenter`, `dragover`, `dragleave`, and
 * `drop` events into calls against it, never tracking the drag-over state
 * itself.
 *
 * A drag carrying files that enters the host starts (or re-targets)
 * `session` against the zone's own stable key; leaving the host outright —
 * checked against the leave event's `relatedTarget` so moving over a child
 * element inside the host never registers as leaving — cancels it. Every
 * resulting `"change"` on `session` mirrors its current target onto the host
 * as the {@link DROP_TARGET_ATTRIBUTE} attribute, so the zone's styling can
 * render the drag-over highlight from CSS alone. A drag carrying anything
 * other than files is ignored throughout, leaving the platform's default
 * handling in place.
 *
 * Dropping ends `session` and, when the drop's drag payload carries at least
 * one file, dispatches {@link DropFilesEvent} on the host with those files.
 *
 * @param session `DragSession` instance the mixin drives; share the same
 * instance with a DropIndicator or another mixin that needs to observe the
 * same drag.
 * @example
 * let session = new DragSession();
 * <div id="uploads" mix={dropZone(session)}>
 *   <input type="file" multiple />
 * </div>
 */
export const dropZone = createMixin<HTMLElement, [session: DragSession<unknown>]>((handle) => {
	let hostNode: HTMLElement | undefined;
	let boundSession: DragSession<unknown> | undefined;

	handle.addEventListener("insert", (event) => {
		hostNode = event.node;
	});
	handle.addEventListener("remove", () => {
		hostNode = undefined;
	});

	/** Mirrors `session`'s current target onto the host as {@link DROP_TARGET_ATTRIBUTE}. */
	function syncDropTarget(session: DragSession<unknown>): void {
		if (!hostNode) return;

		if (session.target) hostNode.setAttribute(DROP_TARGET_ATTRIBUTE, "");
		else hostNode.removeAttribute(DROP_TARGET_ATTRIBUTE);
	}

	return (session) => {
		if (boundSession !== session) {
			boundSession = session;
			session.addEventListener("change", () => syncDropTarget(session), {
				signal: handle.signal,
			});
			handle.signal.addEventListener("abort", () => session.cancel());
		}

		return createElement(handle.element, {
			mix: [
				on<HTMLElement, "dragenter">("dragenter", (event) => {
					if (!isFileDrag(event.dataTransfer)) return;

					event.preventDefault();
					if (!session.active) session.start({ key: DROP_ZONE_KEY });
					session.moveOver({ key: DROP_ZONE_KEY, position: "on" });
				}),
				on<HTMLElement, "dragover">("dragover", (event) => {
					if (!isFileDrag(event.dataTransfer)) return;

					event.preventDefault();
					if (event.dataTransfer) event.dataTransfer.dropEffect = "copy";
				}),
				on<HTMLElement, "dragleave">("dragleave", (event) => {
					if (!session.active) return;

					let related = event.relatedTarget;
					if (related instanceof Node && event.currentTarget.contains(related)) return;

					session.cancel();
				}),
				on<HTMLElement, "drop">("drop", (event) => {
					if (!isFileDrag(event.dataTransfer)) return;

					event.preventDefault();
					let detail = session.drop();
					if (!detail) return;

					let files = Array.from(event.dataTransfer?.files ?? []);
					if (files.length === 0) return;

					event.currentTarget.dispatchEvent(new DropFilesEvent(files));
				}),
			],
		});
	};
});
