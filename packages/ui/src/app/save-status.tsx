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
import { hidden, hstack } from "@sdxc/u/layout";
import { when } from "@sdxc/u/state";
import { nowrap, tabularNums, text } from "@sdxc/u/typography";
import { clientEntry } from "remix/component";

import { Button } from "../components/button.js";

import type { SaveStatusSync } from "./mixins/save-status-sync.js";

import { saveStatusSync } from "./mixins/save-status-sync.js";
import { formatEditedTime } from "./utils/edited-time.js";

/** The state rendered when `state` is omitted: the last edit time, or nothing. */
const DEFAULT_STATE: SaveStatusSync.State = "idle";

/** How long "Saving…" stays up at least, so a fast save never reads as a flicker. */
const DEFAULT_HOLD_MS = 1000;

/** How long "Saved" shows before decaying to the edit time. */
const DEFAULT_SAVED_MS = 3000;

/** Age after which the edit time reads as a timestamp rather than a relative time. */
const DEFAULT_DECAY_MS = 24 * 60 * 60 * 1000;

/**
 * Props {@link SaveStatus} serializes into the page for hydration, which is why they are a
 * `type`: `SerializableProps` rejects an interface.
 */
export type SaveStatusProps = {
	/** The element's `id`, which `setSaveStatus` targets. */
	id: string;
	/** The state the server rendered, such as `"saved"` after a save redirected back. */
	state?: SaveStatusSync.State;
	/** When the content was last edited, as an ISO string; feeds "Edited 2m ago". */
	editedAt?: string;
	/** The id of the form Retry submits; without one Retry only dispatches `ui:save-status-retry`. */
	form?: string;
	/** Locale for the relative and absolute edit times; defaults to the runtime's. */
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
		return () => {
			let { id, form, labels, locale, editedAt } = handle.props;
			let state = handle.props.state ?? DEFAULT_STATE;
			let decayMs = handle.props.decayMs ?? DEFAULT_DECAY_MS;
			let edited = editedAt ? new Date(editedAt) : null;
			let showsEdited = state === "idle" && edited !== null;

			return (
				<span
					id={id}
					data-slot="save-status"
					data-state={state}
					mix={[
						saveStatusSync({
							state,
							editedAt,
							labels,
							locale,
							holdMs: handle.props.holdMs ?? DEFAULT_HOLD_MS,
							savedMs: handle.props.savedMs ?? DEFAULT_SAVED_MS,
							decayMs,
						}),
						hstack({ gap: 2, align: "center" }),
						text("sm"),
						nowrap(),
						tabularNums(),
						fg("neutral.muted"),
						when('&[data-state="failed"]', fg("danger")),
					]}
				>
					<span role="status" aria-live="polite" data-slot="save-status-text">
						{state === "idle" ? "" : labels[state]}
					</span>
					<time
						data-slot="save-status-edited"
						hidden={!showsEdited}
						dateTime={edited?.toISOString()}
						title={edited?.toLocaleString(locale)}
					>
						{edited
							? labels.edited.replace(
									"{time}",
									formatEditedTime(edited, new Date(), decayMs, locale),
								)
							: null}
					</time>
					<span
						data-slot="save-status-retry"
						hidden={state !== "failed"}
						mix={[hstack({ gap: 2, align: "center" }), when("&[hidden]", hidden())]}
					>
						<span aria-hidden="true">·</span>
						<Button
							type={form ? "submit" : "button"}
							form={form}
							variant="ghost"
							color="danger"
							size="sm"
						>
							{labels.retry}
						</Button>
					</span>
				</span>
			);
		};
	},
);
