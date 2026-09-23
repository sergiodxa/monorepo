/**
 * Live preview island for `Input`. It is the bare native text control every other text
 * field is built on, so the example is the four states a form actually renders it in:
 * captioned and described, invalid with a message, read-only, and disabled.
 *
 * The first one is hydrated, because the thing a repository-name field owes its reader is
 * the address it is about to claim — the island mirrors each keystroke into the URL
 * underneath, which is the one part of a plain `<input>` no attribute provides.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { font, text } from "@sdxc/u/typography";
import { Description, FieldError, Input, Label } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const INPUT_CODE = `let name = "edge-router";

<Label htmlFor="repoName">Repository name</Label>
<Input
	id="repoName"
	name="repoName"
	value={name}
	required
	autoComplete="off"
	aria-describedby="repoName-hint"
	mix={[
		on<HTMLInputElement, "input">("input", (event) => {
			name = event.currentTarget.value;
			void handle.update();
		}),
	]}
/>
<Description id="repoName-hint">
	github.com/acme/{name === "" ? "…" : name}
</Description>

<Label htmlFor="repoOwner">Owner</Label>
<Input
	id="repoOwner"
	name="repoOwner"
	defaultValue="acme"
	aria-invalid="true"
	aria-describedby="repoOwner-error"
/>
<FieldError id="repoOwner-error">You do not have permission to create here.</FieldError>

<Label htmlFor="repoId">Repository ID</Label>
<Input id="repoId" name="repoId" readOnly value="R_kgDOKp2f1w" />

<Label htmlFor="repoTemplate">Template</Label>
<Input id="repoTemplate" name="repoTemplate" disabled value="None available on this plan" />`;

/** Four input states, hydrated so the first one's address follows what is typed. */
export const InputPreview = clientEntry(
	"/resources/components/previews/input.tsx#InputPreview",
	function InputPreview(handle: Handle) {
		let name = "edge-router";

		return () => (
			<div mix={[vstack({ gap: 5, align: "stretch" }), is("24rem")]}>
				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-repo-name">Repository name</Label>
					<Input
						id="preview-repo-name"
						name="repoName"
						value={name}
						required
						autoComplete="off"
						aria-describedby="preview-repo-name-hint"
						mix={[
							on<HTMLInputElement, "input">("input", (event) => {
								name = event.currentTarget.value;
								void handle.update();
							}),
						]}
					/>
					<Description id="preview-repo-name-hint">
						<span mix={[font("mono"), text("xs"), fg("neutral")]}>
							github.com/acme/{name === "" ? "…" : name}
						</span>
					</Description>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-repo-owner">Owner</Label>
					<Input
						id="preview-repo-owner"
						name="repoOwner"
						defaultValue="acme"
						aria-invalid="true"
						aria-describedby="preview-repo-owner-error"
					/>
					<FieldError id="preview-repo-owner-error">
						You do not have permission to create here.
					</FieldError>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-repo-id">Repository ID</Label>
					<Input id="preview-repo-id" name="repoId" readOnly value="R_kgDOKp2f1w" />
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-repo-template">Template</Label>
					<Input
						id="preview-repo-template"
						name="repoTemplate"
						disabled
						value="None available on this plan"
					/>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: INPUT_CODE, render: () => <InputPreview /> };
