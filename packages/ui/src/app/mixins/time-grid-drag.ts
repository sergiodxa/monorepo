/**
 * Why JS: a scroller opens at midnight, a line drawn on the server stays at the minute it was
 * drawn, and a pointer has no way to say "from here to here". No-JS baseline: the grid opens at
 * its first hour, and each event's own form moves, resizes and creates it.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { MixinFactory } from "remix/component";

import { createMixin } from "remix/component";

/** Minutes in a day, a column's full height. */
const DAY_MINUTES = 1440;

/** How far a mouse travels before a press on an event becomes a drag rather than a click. */
const DRAG_THRESHOLD = 4;

/** How long a finger rests on an event before it lifts for a drag, so a swipe still scrolls. */
const TOUCH_HOLD_MS = 350;

/** How long keyboard moves wait for another key before posting, so a run of presses posts once. */
const KEY_SETTLE_MS = 700;

/** How often the now line moves on. */
const NOW_TICK_MS = 30_000;

/** What a click on empty time creates: an hour from the minute clicked. */
const CLICK_LENGTH = 60;

/** Where each grid was scrolled, by id, so a grid redrawn by a post or a week change stays put. */
const SCROLLS = new Map<string, number>();

/** The event a keyboard move posted, focused again once the grid it lands in is drawn. */
let pendingFocus: { grid: string; event: string } | null = null;

/** Options {@link timeGridDrag} reads. */
export interface TimeGridDragOptions {
	/** What a keyboard move announces, with `{title}` and `{time}`. */
	moved: string;
	/** What a keyboard resize announces, with `{title}` and `{time}`. */
	resized: string;
}

/** A change in progress: what is changing and where it would land. */
interface Change {
	kind: "create" | "move" | "resize";
	/** The event being changed; `null` for a create. */
	event: HTMLElement | null;
	date: string;
	start: number;
	end: number;
}

/**
 * Applied to a marker inside a `TimeGrid`: opens the grid scrolled to its working day (or where
 * it was), moves the now line with the clock, and turns drags and Alt+arrow keys into posts of
 * the grid's create and move forms.
 *
 * @example <span hidden mix={[timeGridDrag({ moved: "{title} moved to {time}", resized: "{title} now ends at {time}" })]} />
 */
export const timeGridDrag: MixinFactory<HTMLElement, [options: TimeGridDragOptions]> = createMixin<
	HTMLElement,
	[options: TimeGridDragOptions]
>((handle) => {
	let options: TimeGridDragOptions = { moved: "", resized: "" };
	let cleanup: Array<() => void> = [];

	handle.addEventListener("insert", (event: { node: HTMLElement }) => {
		let grid = event.node.closest<HTMLElement>('[data-slot="time-grid"]');
		if (!grid) return;
		cleanup.push(openScroll(grid), tickNow(grid), drag(grid), keys(grid));
	});

	handle.addEventListener("remove", () => {
		for (let stop of cleanup) stop();
		cleanup = [];
	});

	return (next) => {
		options = next;
	};

	/** Formats a minute of the day in the grid's locale. */
	function clock(grid: HTMLElement, minute: number): string {
		return new Intl.DateTimeFormat(grid.dataset.locale ?? "en", {
			hour: "numeric",
			minute: "2-digit",
			timeZone: "UTC",
		}).format(Date.UTC(2000, 0, 1, 0, minute));
	}

	/** Scrolls to where the grid was, or else to its opening minute, and remembers each scroll. */
	function openScroll(grid: HTMLElement): () => void {
		let body = grid.querySelector<HTMLElement>('[data-slot="time-grid-body"]');
		let column = grid.querySelector<HTMLElement>('[data-slot="time-grid-column"]');
		if (!body || !column) return () => {};
		let saved = SCROLLS.get(grid.id);
		let target = Number(grid.dataset.scrollTo ?? "480");
		body.scrollTop = saved ?? (column.offsetHeight / DAY_MINUTES) * target;
		let remember = () => SCROLLS.set(grid.id, body.scrollTop);
		body.addEventListener("scroll", remember, { passive: true });
		if (pendingFocus?.grid === grid.id) {
			let trigger = grid.querySelector<HTMLElement>(
				`[data-slot="time-grid-event"][data-id="${CSS.escape(pendingFocus.event)}"] [data-slot="time-grid-trigger"]`,
			);
			trigger?.focus({ preventScroll: true });
			pendingFocus = null;
		}
		return () => body.removeEventListener("scroll", remember);
	}

	/** Moves the now line on from the minute the server read, hiding it once the day is over. */
	function tickNow(grid: HTMLElement): () => void {
		let line = grid.querySelector<HTMLElement>('[data-slot="time-grid-now"]');
		if (!line) return () => {};
		let base = Number(line.dataset.minute);
		let at = Number(line.dataset.at);
		let place = () => {
			let minute = base + (Date.now() - at) / 60_000;
			line.hidden = minute >= DAY_MINUTES;
			line.style.top = `calc(var(--ui-time-grid-hour, 3rem) * ${minute / 60})`;
		};
		place();
		let timer = setInterval(place, NOW_TICK_MS);
		return () => clearInterval(timer);
	}

	/** The day columns, in order. */
	function columnsOf(grid: HTMLElement): HTMLElement[] {
		return [...grid.querySelectorAll<HTMLElement>('[data-slot="time-grid-column"]')];
	}

	/** The column under a horizontal position, clamped to the first and last. */
	function columnAt(grid: HTMLElement, x: number): HTMLElement | undefined {
		let columns = columnsOf(grid);
		return (
			columns.find((column) => {
				let box = column.getBoundingClientRect();
				return x >= box.left && x < box.right;
			}) ?? (x < (columns[0]?.getBoundingClientRect().left ?? 0) ? columns[0] : columns.at(-1))
		);
	}

	/** The minute under a vertical position in a column, rounded to the grid's step. */
	function minuteAt(grid: HTMLElement, column: HTMLElement, y: number): number {
		let step = Number(grid.dataset.step ?? "15");
		let box = column.getBoundingClientRect();
		let raw = ((y - box.top) / box.height) * DAY_MINUTES;
		return Math.min(DAY_MINUTES, Math.max(0, Math.round(raw / step) * step));
	}

	/** Places an element at a start and end minute on the grid's hour scale. */
	function position(element: HTMLElement, start: number, end: number): void {
		element.style.top = `calc(var(--ui-time-grid-hour, 3rem) * ${start / 60})`;
		element.style.height = `max(1.25rem, calc(var(--ui-time-grid-hour, 3rem) * ${(end - start) / 60}))`;
	}

	/** Fills the grid's form for a change with its fields, and posts it. */
	function submit(grid: HTMLElement, change: Change): void {
		let form = grid.querySelector<HTMLFormElement>(
			`form[data-time-grid-form="${change.kind === "create" ? "create" : "move"}"]`,
		);
		if (!form) return;
		for (let added of form.querySelectorAll("[data-time-grid-field]")) added.remove();
		let fields: Record<string, string> = {
			date: change.date,
			start: String(change.start),
			end: String(change.end),
		};
		if (change.event?.dataset.id) fields.id = change.event.dataset.id;
		for (let [name, value] of Object.entries(fields)) {
			let input = document.createElement("input");
			input.type = "hidden";
			input.name = name;
			input.value = value;
			input.dataset.timeGridField = "";
			form.appendChild(input);
		}
		form.requestSubmit();
	}

	/** Drags across empty time to create, an event to move it, and its edge to resize it. */
	function drag(grid: HTMLElement): () => void {
		let editable = grid.querySelector("form[data-time-grid-form]") !== null;
		if (!editable) return () => {};
		let press: {
			id: number;
			x: number;
			y: number;
			kind: Change["kind"];
			event: HTMLElement | null;
			anchor: number;
			grab: number;
			active: boolean;
			hold?: ReturnType<typeof setTimeout>;
		} | null = null;
		let preview: HTMLElement | null = null;
		let change: Change | null = null;

		/** Starts a change from a press, choosing its kind from what was pressed. */
		function down(event: PointerEvent): void {
			if (event.button !== 0 || press) return;
			let target = event.target as HTMLElement;
			let column = target.closest<HTMLElement>('[data-slot="time-grid-column"]');
			if (!column || !grid.contains(column)) return;
			let block = target.closest<HTMLElement>('[data-slot="time-grid-event"]');
			let resize = target.closest('[data-slot="time-grid-resize"]') !== null;
			let minute = minuteAt(grid, column, event.clientY);
			if (block) {
				if (!block.hasAttribute("data-editable")) return;
				let start = Number(block.dataset.start);
				press = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					kind: resize ? "resize" : "move",
					event: block,
					anchor: start,
					grab: minute - start,
					active: resize,
				};
				if (event.pointerType === "touch" && !resize) {
					press.hold = setTimeout(() => {
						if (press) {
							press.active = true;
							begin(column);
						}
					}, TOUCH_HOLD_MS);
				}
				if (resize) {
					event.preventDefault();
					begin(column);
				}
			} else {
				if (event.pointerType === "touch") return;
				if (!grid.querySelector('form[data-time-grid-form="create"]')) return;
				press = {
					id: event.pointerId,
					x: event.clientX,
					y: event.clientY,
					kind: "create",
					event: null,
					anchor: minute,
					grab: 0,
					active: false,
				};
			}
		}

		/** Draws the preview the first time a press becomes a drag. */
		function begin(column: HTMLElement): void {
			if (!press) return;
			grid.setAttribute("data-dragging", "");
			if (press.event) {
				press.event.setAttribute("data-dragging", "");
				preview = press.event.cloneNode(true) as HTMLElement;
				for (let node of preview.querySelectorAll("[id], [popover]")) {
					if (node.hasAttribute("popover")) node.remove();
					else node.removeAttribute("id");
				}
				preview.removeAttribute("data-dragging");
				preview.setAttribute("data-preview", "");
				preview.style.left = "1px";
				preview.style.width = "calc(100% - 3px)";
			} else {
				let color = getComputedStyle(grid).getPropertyValue("--ui-brand-bg-solid");
				preview = document.createElement("div");
				preview.setAttribute("data-slot", "time-grid-ghost");
				preview.setAttribute("aria-hidden", "true");
				Object.assign(preview.style, {
					position: "absolute",
					left: "1px",
					width: "calc(100% - 3px)",
					zIndex: "3",
					boxSizing: "border-box",
					borderRadius: "0.375rem",
					padding: "0.1875rem 0.5rem",
					fontSize: "0.75rem",
					fontWeight: "600",
					color: "var(--ui-brand-fg-on-solid, white)",
					backgroundColor: color || "var(--ui-brand-bg-solid)",
					boxShadow: "0 8px 24px -8px rgb(0 0 0 / 0.35)",
					pointerEvents: "none",
				});
			}
			preview.style.pointerEvents = "none";
			column.appendChild(preview);
		}

		/** Follows the pointer, snapping the preview to the step under it. */
		function move(event: PointerEvent): void {
			if (!press || event.pointerId !== press.id) return;
			let travelled = Math.hypot(event.clientX - press.x, event.clientY - press.y);
			if (!press.active) {
				if (press.hold !== undefined) {
					if (travelled > 8) cancel();
					return;
				}
				if (travelled < DRAG_THRESHOLD) return;
				press.active = true;
				let column = columnAt(grid, press.x);
				if (!column) return;
				begin(column);
			}
			event.preventDefault();
			let column = columnAt(grid, event.clientX);
			if (!column || !preview) return;
			let step = Number(grid.dataset.step ?? "15");
			let minute = minuteAt(grid, column, event.clientY);
			let date = column.dataset.date ?? "";
			if (press.kind === "create") {
				let start = Math.min(press.anchor, minute);
				let end = Math.max(press.anchor + step, minute);
				change = { kind: "create", event: null, date, start, end: Math.min(DAY_MINUTES, end) };
				preview.textContent = `${clock(grid, change.start)} – ${clock(grid, change.end)}`;
			} else if (press.kind === "move" && press.event) {
				let length = Number(press.event.dataset.end) - Number(press.event.dataset.start);
				let start = Math.max(0, Math.min(DAY_MINUTES - length, minute - press.grab));
				start = Math.round(start / step) * step;
				change = { kind: "move", event: press.event, date, start, end: start + length };
			} else if (press.event) {
				let start = Number(press.event.dataset.start);
				date =
					press.event.closest<HTMLElement>('[data-slot="time-grid-column"]')?.dataset.date ?? date;
				column = press.event.closest<HTMLElement>('[data-slot="time-grid-column"]') ?? column;
				let end = Math.max(start + step, minuteAt(grid, column, event.clientY));
				change = { kind: "resize", event: press.event, date, start, end };
			}
			if (!change) return;
			if (preview.parentElement !== column) column.appendChild(preview);
			position(preview, change.start, change.end);
			let time = preview.querySelector('[data-slot="time-grid-time"]');
			if (time) time.textContent = `${clock(grid, change.start)} – ${clock(grid, change.end)}`;
		}

		/** Posts the change a drag ends on, swallowing the click that would open the popover. */
		function up(event: PointerEvent): void {
			if (!press || event.pointerId !== press.id) return;
			let finished = press;
			let landed = change;
			if (finished.active) {
				swallowClick();
			} else if (finished.kind === "create" && finished.hold === undefined) {
				let column = columnAt(grid, finished.x);
				if (column) {
					landed = {
						kind: "create",
						event: null,
						date: column.dataset.date ?? "",
						start: Math.min(finished.anchor, DAY_MINUTES - CLICK_LENGTH),
						end: Math.min(DAY_MINUTES, finished.anchor + CLICK_LENGTH),
					};
				}
			}
			reset();
			if (!landed) return;
			if (
				landed.event &&
				landed.start === Number(landed.event.dataset.start) &&
				landed.end === Number(landed.event.dataset.end) &&
				landed.date ===
					landed.event.closest<HTMLElement>('[data-slot="time-grid-column"]')?.dataset.date
			) {
				return;
			}
			if (landed.event) {
				let column = columnsOf(grid).find((entry) => entry.dataset.date === landed.date);
				if (column) column.appendChild(landed.event);
				position(landed.event, landed.start, landed.end);
				landed.event.dataset.start = String(landed.start);
				landed.event.dataset.end = String(landed.end);
			}
			submit(grid, landed);
		}

		/** Drops the change, as Escape or a cancelled pointer does. */
		function cancel(): void {
			reset();
		}

		/** Clears every trace of the press. */
		function reset(): void {
			if (press?.hold !== undefined) clearTimeout(press.hold);
			press?.event?.removeAttribute("data-dragging");
			preview?.remove();
			grid.removeAttribute("data-dragging");
			press = null;
			preview = null;
			change = null;
		}

		/** Swallows the one click a finished drag produces, so its popover stays shut. */
		function swallowClick(): void {
			let stop = (event: Event) => {
				event.preventDefault();
				event.stopPropagation();
			};
			window.addEventListener("click", stop, { capture: true, once: true });
			setTimeout(() => window.removeEventListener("click", stop, { capture: true }), 0);
		}

		/** Escape abandons a drag in progress. */
		function escape(event: KeyboardEvent): void {
			if (event.key === "Escape" && press) {
				event.preventDefault();
				cancel();
			}
		}

		/** Keeps a held finger from scrolling the grid once a drag has begun. */
		function touchmove(event: TouchEvent): void {
			if (press?.active) event.preventDefault();
		}

		grid.addEventListener("pointerdown", down);
		window.addEventListener("pointermove", move);
		window.addEventListener("pointerup", up);
		window.addEventListener("pointercancel", cancel);
		window.addEventListener("keydown", escape);
		grid.addEventListener("touchmove", touchmove, { passive: false });
		return () => {
			reset();
			grid.removeEventListener("pointerdown", down);
			window.removeEventListener("pointermove", move);
			window.removeEventListener("pointerup", up);
			window.removeEventListener("pointercancel", cancel);
			window.removeEventListener("keydown", escape);
			grid.removeEventListener("touchmove", touchmove);
		};
	}

	/**
	 * Alt+Up and Alt+Down move the focused event a step, Alt+Left and Alt+Right move it a day,
	 * and Alt+Shift+Up and Alt+Shift+Down change when it ends; each run of presses posts once.
	 */
	function keys(grid: HTMLElement): () => void {
		if (!grid.querySelector('form[data-time-grid-form="move"]')) return () => {};
		let timer: ReturnType<typeof setTimeout> | undefined;
		let pending: Change | null = null;

		/** Applies one key press to the focused event, and schedules the post. */
		function press(event: KeyboardEvent): void {
			if (!event.altKey || !event.key.startsWith("Arrow")) return;
			let block = (event.target as HTMLElement).closest<HTMLElement>(
				'[data-slot="time-grid-event"][data-editable]',
			);
			if (!block || !grid.contains(block)) return;
			event.preventDefault();
			let step = Number(grid.dataset.step ?? "15");
			let start = Number(block.dataset.start);
			let end = Number(block.dataset.end);
			let columns = columnsOf(grid);
			let column = block.closest<HTMLElement>('[data-slot="time-grid-column"]');
			let index = column ? columns.indexOf(column) : -1;
			let resize = event.shiftKey && (event.key === "ArrowUp" || event.key === "ArrowDown");
			if (resize) {
				end = Math.min(
					DAY_MINUTES,
					Math.max(start + step, end + (event.key === "ArrowUp" ? -step : step)),
				);
			} else if (event.key === "ArrowUp" || event.key === "ArrowDown") {
				let shift = event.key === "ArrowUp" ? -step : step;
				if (start + shift < 0 || end + shift > DAY_MINUTES) return;
				start += shift;
				end += shift;
			} else {
				let next = columns[index + (event.key === "ArrowLeft" ? -1 : 1)];
				if (!next) return;
				let trigger = document.activeElement as HTMLElement | null;
				next.appendChild(block);
				trigger?.focus({ preventScroll: true });
				column = next;
			}
			block.dataset.start = String(start);
			block.dataset.end = String(end);
			block.style.left = "1px";
			block.style.width = "calc(100% - 3px)";
			position(block, start, end);
			let time = block.querySelector('[data-slot="time-grid-time"]');
			if (time) time.textContent = `${clock(grid, start)} – ${clock(grid, end)}`;
			block.scrollIntoView({ block: "nearest" });
			let date = column?.dataset.date ?? "";
			pending = { kind: resize ? "resize" : "move", event: block, date, start, end };
			announce(
				(resize ? options.resized : options.moved)
					.replace("{title}", block.dataset.title ?? "")
					.replace("{time}", resize ? clock(grid, end) : `${date} ${clock(grid, start)}`),
			);
			clearTimeout(timer);
			timer = setTimeout(flush, KEY_SETTLE_MS);
		}

		/** Posts the moves made since the last post. */
		function flush(): void {
			if (!pending) return;
			let change = pending;
			pending = null;
			pendingFocus = { grid: grid.id, event: change.event?.dataset.id ?? "" };
			submit(grid, change);
		}

		/** Says what moved through the grid's live region. */
		function announce(message: string): void {
			let status = grid.querySelector('[data-slot="time-grid-status"]');
			if (status) status.textContent = message;
		}

		grid.addEventListener("keydown", press);
		return () => {
			clearTimeout(timer);
			grid.removeEventListener("keydown", press);
		};
	}
});
