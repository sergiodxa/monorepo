/**
 * Live preview island for `Group`. The cluster's job is to make several controls read as
 * one field, which only shows when the controls actually belong together: a read-only key
 * beside the button that copies it, and a currency select fused to the amount it applies
 * to.
 *
 * `copyToClipboard()` is what makes the first group do its one job: the button names the
 * field through `commandfor`, the mixin reads that field's value onto the clipboard, and
 * the `ui:copy` event it reports back is what lets the label say the press landed. That
 * label is the button's accessible name and carries the result, so it stays in the markup
 * and only leaves the page: sighted readers get the glyph swap, and a screen reader hears
 * the name change from "Copy" to "Copied".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { CheckIcon, ClipboardIcon } from "@sdxc/icons";
import { visuallyHidden } from "@sdxc/u/a11y";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Button, Description, Group, Input, Label, Select } from "@sdxc/ui";
import { COPY_COMMAND, copyToClipboard } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const GROUP_CODE = `let copied = false;

<Label htmlFor="apiKey">Secret key</Label>
<Group>
	<Input id="apiKey" name="apiKey" readOnly value="sk_live_51Nc8yR2eZvKYlo2C" />
	<Button
		variant="outline"
		color="neutral"
		commandfor="apiKey"
		command={COPY_COMMAND}
		mix={[
			copyToClipboard(),
			on<HTMLButtonElement, "ui:copy">("ui:copy", (event) => {
				copied = event.success;
				void handle.update();
			}),
		]}
	>
		{copied ? <CheckIcon /> : <ClipboardIcon />}
		<span mix={[visuallyHidden()]}>{copied ? "Copied" : "Copy"}</span>
	</Button>
</Group>
<Description>Rotating the key revokes the previous one after an hour.</Description>

<Label htmlFor="amount">Invoice total</Label>
<Group>
	<Select name="currency" aria-label="Currency">
		<Select.Option value="eur" selected>
			EUR
		</Select.Option>
		<Select.Option value="usd">USD</Select.Option>
		<Select.Option value="gbp">GBP</Select.Option>
	</Select>
	<Input id="amount" name="amount" type="number" min={0} step={0.01} defaultValue="1250.00" />
</Group>`;

/** Two fused control clusters, hydrated so the copy button actually copies. */
export const GroupPreview = clientEntry(
	"/resources/components/previews/group.tsx#GroupPreview",
	function GroupPreview(handle: Handle) {
		let copied = false;

		return () => (
			<div mix={[vstack({ gap: 5, align: "stretch" }), is("24rem")]}>
				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-api-key">Secret key</Label>
					<Group>
						<Input id="preview-api-key" name="apiKey" readOnly value="sk_live_51Nc8yR2eZvKYlo2C" />
						<Button
							variant="outline"
							color="neutral"
							commandfor="preview-api-key"
							command={COPY_COMMAND}
							mix={[
								copyToClipboard(),
								on<HTMLButtonElement, "ui:copy">("ui:copy", (event) => {
									copied = event.success;
									void handle.update();
								}),
							]}
						>
							{copied ? <CheckIcon /> : <ClipboardIcon />}
							<span mix={[visuallyHidden()]}>{copied ? "Copied" : "Copy"}</span>
						</Button>
					</Group>
					<Description>Rotating the key revokes the previous one after an hour.</Description>
				</div>

				<div mix={[vstack({ gap: 2, align: "stretch" })]}>
					<Label htmlFor="preview-amount">Invoice total</Label>
					<Group>
						<Select name="currency" aria-label="Currency">
							<Select.Option value="eur" selected>
								EUR
							</Select.Option>
							<Select.Option value="usd">USD</Select.Option>
							<Select.Option value="gbp">GBP</Select.Option>
						</Select>
						<Input
							id="preview-amount"
							name="amount"
							type="number"
							min={0}
							step={0.01}
							defaultValue="1250.00"
						/>
					</Group>
				</div>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: GROUP_CODE, render: () => <GroupPreview /> };
