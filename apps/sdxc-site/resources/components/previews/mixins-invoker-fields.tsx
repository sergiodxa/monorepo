/**
 * Live preview island for `invokerFields()`: three buttons open one "New ticket" dialog, and
 * each opens it with its own type already chosen. Closing the dialog puts the type back.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { flexWrap, hidden, hstack, vstack } from "@sdxc/u/layout";
import { Button, Dialog, Label, Select, TextField } from "@sdxc/ui";
import { invokerFields } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The ticket types the dialog offers, and the buttons that preset one. */
const TYPES = [
	{ value: "question", label: "Question" },
	{ value: "bug", label: "Bug" },
	{ value: "feature", label: "Feature request" },
];

/** The source the page shows, matching the markup below. */
const CODE = `<Button commandfor="new-ticket" command="show-modal">New ticket</Button>
<Button commandfor="new-ticket" command="show-modal" name="type" value="bug">Report a bug</Button>
<Button commandfor="new-ticket" command="show-modal" name="type" value="feature">Request a feature</Button>

<Dialog id="new-ticket" aria-labelledby="new-ticket-title">
	<span hidden mix={[invokerFields()]} />
	<form method="dialog">
		<Dialog.Header>
			<Dialog.Title id="new-ticket-title">New ticket</Dialog.Title>
		</Dialog.Header>
		<TextField label="Subject" name="subject" />
		<Label htmlFor="new-ticket-type">Type</Label>
		<Select id="new-ticket-type" name="type">
			<Select.Option value="question" selected>Question</Select.Option>
			<Select.Option value="bug">Bug</Select.Option>
			<Select.Option value="feature">Feature request</Select.Option>
		</Select>
		<Dialog.Footer>
			<Button commandfor="new-ticket" command="close" variant="outline">Cancel</Button>
			<Button type="submit">Create</Button>
		</Dialog.Footer>
	</form>
</Dialog>`;

/** The three openers and the dialog they share, hydrated so the presets apply. */
export const InvokerFieldsPreview = clientEntry(import.meta.url, function InvokerFieldsPreview() {
	return () => (
		<div mix={[hstack({ gap: 2, align: "center" }), flexWrap()]}>
			<Button commandfor="preview-new-ticket" command="show-modal">
				New ticket
			</Button>
			<Button
				variant="outline"
				color="neutral"
				commandfor="preview-new-ticket"
				command="show-modal"
				name="type"
				value="bug"
			>
				Report a bug
			</Button>
			<Button
				variant="outline"
				color="neutral"
				commandfor="preview-new-ticket"
				command="show-modal"
				name="type"
				value="feature"
			>
				Request a feature
			</Button>
			<Dialog id="preview-new-ticket" aria-labelledby="preview-new-ticket-title">
				<span mix={[hidden(), invokerFields()]} />
				<form method="dialog" mix={[vstack({ gap: 4, align: "stretch" })]}>
					<Dialog.Header>
						<Dialog.Title id="preview-new-ticket-title">New ticket</Dialog.Title>
					</Dialog.Header>
					<TextField label="Subject" name="subject" />
					<div mix={[vstack({ gap: 1.5, align: "stretch" })]}>
						<Label htmlFor="preview-new-ticket-type">Type</Label>
						<Select id="preview-new-ticket-type" name="type">
							{TYPES.map((type, index) => (
								<Select.Option value={type.value} selected={index === 0}>
									{type.label}
								</Select.Option>
							))}
						</Select>
					</div>
					<Dialog.Footer>
						<Button
							type="button"
							variant="outline"
							color="neutral"
							commandfor="preview-new-ticket"
							command="close"
						>
							Cancel
						</Button>
						<Button type="submit">Create</Button>
					</Dialog.Footer>
				</form>
			</Dialog>
		</div>
	);
});

export default { code: CODE, render: () => <InvokerFieldsPreview /> };
