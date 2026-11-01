/**
 * Client island: the quiet persistence signal an editor shows beside its publish button.
 * "Saving…" holds at least a second, "Saved" shows for three, then the text decays to
 * "Edited 2m ago" and later to a timestamp; a failure says so and offers Retry.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { EntryComponent } from "remix/component";

import { fg } from "@sdxc/u/color";
import { hstack } from "@sdxc/u/layout";
import { text, nowrap, tabularNums } from "@sdxc/u/typography";
import { clientEntry, on, ref } from "remix/component";

import { Button } from "../components/button.js";

/** Event an app dispatches on the status element to report a save, through {@link setSaveStatus}. */
export const SAVE_STATUS_EVENT = "ui-save-status";

/** Event the status element dispatches, bubbling, when Retry is pressed. */
export const SAVE_STATUS_RETRY_EVENT = "ui-save-status-retry";

/** How long "Saving…" stays up at least, so a fast save never reads as a flicker. */
const DEFAULT_HOLD_MS = 1000;

/** How long "Saved" shows before decaying to the edit time. */
const DEFAULT_SAVED_MS = 3000;

/** Age after which the edit time reads as a timestamp rather than a relative time. */
const DEFAULT_DECAY_MS = 24 * 60 * 60 * 1000;

/** How often the relative edit time redraws. */
const TICK_MS = 30_000;

/** Units the relative edit time steps through, each with its length in seconds. */
const UNITS: ReadonlyArray<[Intl.RelativeTimeFormatUnit, number]> = [
	["hour", 3600],
	["minute", 60],
	["second", 1],
];

/**
 * Where a save stands. `"idle"` shows the last edit time, or nothing when there is none.
 */
export type SaveStatusState = "idle" | "saving" | "saved" | "failed";

/** What an app reports through {@link SAVE_STATUS_EVENT}. */
export interface SaveStatusDetail {
	state: SaveStatusState;
	/** When the content was saved; defaults to the moment the event arrives. */
	at?: Date;
}

/**
 * Props {@link SaveStatus} serializes into the page for hydration, which is why they are a
 * `type`: `SerializableProps` rejects an interface.
 */
export type SaveStatusProps = {
	/** The element's `id`, which {@link setSaveStatus} targets. */
	id: string;
	/** The state the server rendered, such as `"saved"` after a save redirected back. */
	state?: SaveStatusState;
	/** When the content was last edited, as an ISO string; feeds "Edited 2m ago". */
	editedAt?: string;
	/** The id of the form Retry submits; without one Retry only dispatches its event. */
	form?: string;
	/** Locale for the relative and absolute edit times; defaults to the browser's. */
	locale?: string;
	labels: {
		saving: string;
		saved: string;
		failed: string;
		retry: string;
		/** The edit time line, with `{time}` where the time goes: "Edited {time}". */
		edited: string;
	};
	/** @default 1000 */
	holdMs?: number;
	/** @default 3000 */
	savedMs?: number;
	/** @default 86400000 */
	decayMs?: number;
};

/**
 * Reports a save to a {@link SaveStatus}, which is how an autosave drives it.
 *
 * @param target The status element or its `id`.
 * @param state Where the save stands.
 * @param at When the content was saved.
 * @example
 * setSaveStatus("post-status", "saving");
 * let response = await fetch(url, { method: "POST", body });
 * setSaveStatus("post-status", response.ok ? "saved" : "failed");
 */
export function setSaveStatus(target: Element | string, state: SaveStatusState, at?: Date): void {
	let element = typeof target === "string" ? document.getElementById(target) : target;
	element?.dispatchEvent(
		new CustomEvent<SaveStatusDetail>(SAVE_STATUS_EVENT, { detail: { state, at } }),
	);
}

/**
 * Formats how long ago `at` was: relative within `decayMs`, a date and time after.
 *
 * @param at When the content was edited.
 * @param now The moment to measure from.
 * @param decayMs Age at which the text becomes a timestamp.
 * @param locale Locale to format in.
 * @returns The time text the edited label embeds.
 */
export function formatEditedTime(at: Date, now: Date, decayMs: number, locale?: string): string {
	let elapsed = now.getTime() - at.getTime();
	if (elapsed >= decayMs) {
		return new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" }).format(at);
	}
	let seconds = Math.max(0, Math.round(elapsed / 1000));
	let format = new Intl.RelativeTimeFormat(locale, { numeric: "auto", style: "narrow" });
	for (let [unit, length] of UNITS) {
		if (seconds >= length || unit === "second") {
			return format.format(-Math.floor(seconds / length), unit);
		}
	}
	return format.format(0, "second");
}

/**
 * Renders the status. Saving, Saved and Failed are announced through a polite live
 * region; the ticking edit time sits outside it, so a screen reader hears each outcome
 * once. Pair it with a publish button whose label carries publication's own state.
 *
 * @example
 * <SaveStatus id="post-status" editedAt={post.updatedAt} form="post-form"
 * 	labels={{ saving: "Saving…", saved: "Saved", failed: "Failed", retry: "Retry", edited: "Edited {time}" }} />
 */
export const SaveStatus: EntryComponent<SaveStatusProps> = clientEntry(
	"@sdxc/ui/app/save-status#SaveStatus",
	function SaveStatus(handle) {
		let shown: SaveStatusState = handle.props.state ?? "idle";
		let editedAt = handle.props.editedAt ? new Date(handle.props.editedAt) : null;
		let savingSince = shown === "saving" ? Date.now() : 0;
		let now = new Date();
		let pending: ReturnType<typeof setTimeout> | undefined;

		/** Shows `next` and redraws. */
		function show(next: SaveStatusState) {
			shown = next;
			now = new Date();
			void handle.update();
		}

		/** Shows "Saved", then decays to the edit time once its moment has passed. */
		function showSaved(at: Date) {
			editedAt = at;
			show("saved");
			pending = setTimeout(() => show("idle"), handle.props.savedMs ?? DEFAULT_SAVED_MS);
		}

		/** Applies a reported state, holding "Saving…" for its minimum before an outcome replaces it. */
		function apply({ state, at }: SaveStatusDetail) {
			clearTimeout(pending);
			if (state === "saving") {
				if (shown !== "saving") savingSince = Date.now();
				show("saving");
				return;
			}
			let held = shown === "saving" ? Date.now() - savingSince : Infinity;
			let wait = Math.max(0, (handle.props.holdMs ?? DEFAULT_HOLD_MS) - held);
			let settle = () => {
				if (state === "saved") showSaved(at ?? new Date());
				else {
					if (at) editedAt = at;
					show(state);
				}
			};
			if (wait > 0) pending = setTimeout(settle, wait);
			else settle();
		}

		let listen = ref((node, signal) => {
			node.addEventListener(
				SAVE_STATUS_EVENT,
				(event) => apply((event as CustomEvent<SaveStatusDetail>).detail),
				{ signal },
			);
			let tick = setInterval(() => {
				if (shown !== "idle" || !editedAt) return;
				now = new Date();
				void handle.update();
			}, TICK_MS);
			if (shown === "saved") {
				pending = setTimeout(() => show("idle"), handle.props.savedMs ?? DEFAULT_SAVED_MS);
			}
			signal.addEventListener("abort", () => {
				clearInterval(tick);
				clearTimeout(pending);
			});
		});

		return () => {
			let { id, form, labels, locale, decayMs = DEFAULT_DECAY_MS } = handle.props;
			let announcement = shown === "idle" ? "" : labels[shown];
			let showsEdited = shown === "idle" && editedAt !== null;

			return (
				<span
					id={id}
					data-slot="save-status"
					data-state={shown}
					mix={[
						listen,
						hstack({ gap: 2, align: "center" }),
						text("sm"),
						nowrap(),
						tabularNums(),
						fg(shown === "failed" ? "danger" : "neutral.muted"),
					]}
				>
					<span role="status" aria-live="polite" data-slot="save-status-text">
						{announcement}
					</span>
					{showsEdited && editedAt ? (
						<time
							dateTime={editedAt.toISOString()}
							title={editedAt.toLocaleString(locale)}
							data-slot="save-status-edited"
						>
							{labels.edited.replace("{time}", formatEditedTime(editedAt, now, decayMs, locale))}
						</time>
					) : null}
					{shown === "failed" ? <span aria-hidden="true">·</span> : null}
					{shown === "failed" ? (
						<Button
							type={form ? "submit" : "button"}
							form={form}
							variant="ghost"
							color="danger"
							size="sm"
							mix={[
								on("click", (event) => {
									event.currentTarget.dispatchEvent(
										new CustomEvent(SAVE_STATUS_RETRY_EVENT, { bubbles: true }),
									);
								}),
							]}
						>
							{labels.retry}
						</Button>
					) : null}
				</span>
			);
		};
	},
);
