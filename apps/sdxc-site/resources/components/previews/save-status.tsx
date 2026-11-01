/**
 * Live preview for `SaveStatus`: each state an editor's persistence signal passes through,
 * beside the publish button it pairs with. Saving is quiet muted text; publication is the
 * loud primary button, whose label carries its own state and is disabled when clean.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { fg } from "@sdxc/u/color";
import { grid, hstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Button } from "@sdxc/ui";
import { SaveStatus } from "@sdxc/ui/app/save-status";
import { css } from "remix/component";

/** Every string the status shows. */
const LABELS = {
	saving: "Saving…",
	saved: "Saved",
	failed: "Failed",
	retry: "Retry",
	edited: "Edited {time}",
};

/** Holds "Saved" in place for the preview, where the decay would otherwise hide it. */
const HOLD_SAVED_MS = 60 * 60 * 1000;

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<SaveStatus id="post-status" state="saving" labels={labels} />
<SaveStatus id="post-status" state="saved" labels={labels} />
<SaveStatus id="post-status" editedAt={post.updatedAt} labels={labels} />
<SaveStatus id="post-status" state="failed" form="post-form" labels={labels} />

// Beside it, publication carries its own state on the primary button:
<Button size="sm" disabled={!hasUnpublishedChanges}>Publish</Button>
<Button size="sm" isPending>Publishing…</Button>
<Button size="sm" disabled>Published</Button>

// An autosave drives the status from the client:
setSaveStatus("post-status", "saving");
let response = await fetch(autosaveUrl, { method: "POST", body: new FormData(form) });
setSaveStatus("post-status", response.ok ? "saved" : "failed");`;

namespace StateRow {
	export interface Props {
		name: string;
		children?: RemixNode;
	}
}

/** One labelled sample row, naming the state the sample shows. */
function StateRow(handle: Handle<StateRow.Props>) {
	return () => (
		<>
			<span mix={[text("xs"), fg("neutral.muted")]}>{handle.props.name}</span>
			<span mix={[hstack({ gap: 3, align: "center" })]}>{handle.props.children}</span>
		</>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				grid(),
				is("100%"),
				css({
					gridTemplateColumns: "max-content minmax(0, 1fr)",
					gap: "0.75rem 1.5rem",
					alignItems: "center",
				}),
			]}
		>
			<StateRow name="Saving">
				<SaveStatus id="preview-status-saving" state="saving" labels={LABELS} />
				<Button size="sm" disabled>
					Publish
				</Button>
			</StateRow>
			<StateRow name="Saved">
				<SaveStatus
					id="preview-status-saved"
					state="saved"
					savedMs={HOLD_SAVED_MS}
					labels={LABELS}
				/>
				<Button size="sm">Publish</Button>
			</StateRow>
			<StateRow name="Edited">
				<SaveStatus
					id="preview-status-edited"
					editedAt={new Date(Date.now() - 2 * 60 * 1000).toISOString()}
					labels={LABELS}
				/>
				<Button size="sm" isPending>
					Publishing…
				</Button>
			</StateRow>
			<StateRow name="Failed">
				<SaveStatus id="preview-status-failed" state="failed" labels={LABELS} />
				<Button size="sm" disabled>
					Published
				</Button>
			</StateRow>
		</div>
	),
};
