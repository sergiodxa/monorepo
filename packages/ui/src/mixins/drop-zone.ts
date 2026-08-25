/**
 * Drag-and-drop file acceptance for a DropZone: tracks a file drag over
 * the host through a shared `DragSession`, mirrors its target onto the
 * host as a `data-*` attribute for the drag-over highlight, and turns a
 * completed drop into a typed event carrying the dropped files.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { createElement, createMixin, on } from "remix/ui";

import type { DragSession } from "../behaviors/drag-session";

/**
 * `data-*` attribute {@link dropZone} toggles on its host while a file
 * drag from outside the page hovers over it, so a DropZone's styling can
 * render the drag-over highlight from this attribute alone.
 */
export const DROP_TARGET_ATTRIBUTE = "data-drop-target";

/**
 * Stable `DragSession` key identifying the single drop surface a
 * `dropZone()` host represents, reused by every call into the session
 * since the host itself is the only drop candidate being tracked.
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
 * Dispatched on a DropZone's host by {@link dropZone} once a drop carries
 * at least one file, carrying those files directly so a consumer can
 * start uploading from the event detail.
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
 * Whether `dataTransfer` carries at least one file, checked via its
 * `types` list for `"Files"` — the one signal available before a drop
 * reveals the actual `File` objects.
 *
 * @param dataTransfer Drag payload from a `dragenter`, `dragover`, or `drop` event.
 * @returns Whether the drag carries files.
 */
function isFileDrag(dataTransfer: DataTransfer | null): boolean {
	return dataTransfer !== null && dataTransfer.types.includes("Files");
}

/**
 * Adds drag-and-drop file acceptance to a DropZone, driving `session`
 * through native `dragenter`/`dragover`/`dragleave`/`drop` events and
 * mirroring its target onto the host as {@link DROP_TARGET_ATTRIBUTE}.
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
