/**
 * The quick-add box: one line, posted as is, that the server turns into an event. With script, a
 * line under the box reads the phrases back as they are typed, so the visitor sees "Thu, Nov 19 ·
 * 1:00 – 2:00 PM · every week" before pressing Enter.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { find, strip } from "@sdxc/natural-dates";
import { isFailure } from "@sdxc/result";
import { raw } from "@sdxc/u/general";
import { clientEntry } from "remix/component";

/** The id of the quick-add form, which the preview island watches. */
export const QUICK_ADD_ID = "sundial-quick-add";

/** The repeat words the preview shows for each frequency. */
const EVERY: Record<string, string> = {
	daily: "every day",
	weekly: "every week",
	monthly: "every month",
	yearly: "every year",
};

/** A `YYYY-MM-DD` day as "Thu, Nov 19". */
function day(date: string): string {
	return new Intl.DateTimeFormat("en-US", {
		weekday: "short",
		month: "short",
		day: "numeric",
		timeZone: "UTC",
	}).format(Date.parse(`${date}T00:00:00Z`));
}

/** An `HH:MM` time as "1:00 PM". */
function time(value: string): string {
	return new Intl.DateTimeFormat("en-US", {
		hour: "numeric",
		minute: "2-digit",
		timeZone: "UTC",
	}).format(Date.UTC(2000, 0, 1, Number(value.slice(0, 2)), Number(value.slice(3, 5))));
}

/** What a line reads as, in a few words, or the empty string when it names no date. */
export function preview(text: string, timeZone: string, now: Date): string {
	let read = find(text, { now, timeZone });
	if (isFailure(read) || read.data.matches.length === 0) return "";
	let found = read.data;
	let parts: string[] = [];
	let title = strip(text, found.matches);
	if (title !== "") parts.push(`“${title}”`);
	if (found.date)
		parts.push(found.endDate ? `${day(found.date)} – ${day(found.endDate)}` : day(found.date));
	if (found.allDay) parts.push("all day");
	else if (found.start)
		parts.push(found.end ? `${time(found.start)} – ${time(found.end)}` : time(found.start));
	if (found.repeat) {
		let interval = found.repeat.interval ?? 1;
		let base = EVERY[found.repeat.frequency] ?? "repeats";
		parts.push(interval > 1 ? `${base.replace("every", `every ${interval}`)}s` : base);
	}
	return parts.join(" · ");
}

namespace QuickAddPreview {
	export interface Props {
		timeZone: string;
	}
}

/**
 * Reads the quick-add line back as it is typed, into the box's status line. Script only; the box
 * posts the same line without it.
 */
export const QuickAddPreview = clientEntry(
	import.meta.url,
	function QuickAddPreview(handle: Handle<QuickAddPreview.Props>) {
		handle.queueTask(() => {
			let form = document.getElementById(QUICK_ADD_ID);
			if (!(form instanceof HTMLFormElement) || handle.signal.aborted) return;
			let output = form.querySelector("output");
			form.addEventListener(
				"input",
				() => {
					let field = form.elements.namedItem("text");
					let text = field instanceof HTMLInputElement ? field.value : "";
					if (output) output.textContent = preview(text, handle.props.timeZone, new Date());
				},
				{ signal: handle.signal },
			);
		});
		return () => <span hidden data-quick-add-preview="" />;
	},
);

namespace QuickAdd {
	export interface Props {
		action: string;
		back: string;
		timeZone: string;
	}
}

/** The box: a labelled line that posts on Enter, its read-back line, and the preview island. */
export function QuickAdd(handle: Handle<QuickAdd.Props>) {
	return () => {
		let { action, back, timeZone } = handle.props;
		return (
			<form
				id={QUICK_ADD_ID}
				method="post"
				action={action}
				mix={[raw({ display: "grid", gap: "0.25rem", paddingInline: "0.5rem" })]}
			>
				<input type="hidden" name="back" value={back} />
				<label
					htmlFor={`${QUICK_ADD_ID}-text`}
					mix={[
						raw({
							fontSize: "0.6875rem",
							fontWeight: "600",
							letterSpacing: "0.05em",
							textTransform: "uppercase",
							color: "var(--ui-neutral-fg-muted)",
						}),
					]}
				>
					Quick add
				</label>
				<input
					id={`${QUICK_ADD_ID}-text`}
					type="text"
					name="text"
					required
					autocomplete="off"
					maxLength={300}
					placeholder="Lunch with Ana tomorrow 1pm"
					aria-describedby={`${QUICK_ADD_ID}-preview`}
					mix={[
						raw({
							blockSize: "2.25rem",
							paddingInline: "0.625rem",
							borderRadius: "0.5rem",
							border: "1px solid var(--ui-neutral-border)",
							backgroundColor: "var(--ui-bg, Canvas)",
							color: "var(--ui-neutral-fg-emphasis)",
							font: "inherit",
							fontSize: "0.875rem",
							"&:focus-visible": {
								outline: "2px solid var(--ui-brand-ring)",
								outlineOffset: "1px",
							},
						}),
					]}
				/>
				<output
					id={`${QUICK_ADD_ID}-preview`}
					aria-live="polite"
					mix={[
						raw({
							fontSize: "0.75rem",
							lineHeight: "1rem",
							color: "var(--ui-neutral-fg-muted)",
							"&:empty": { display: "none" },
						}),
					]}
				/>
				<QuickAddPreview timeZone={timeZone} />
			</form>
		);
	};
}
