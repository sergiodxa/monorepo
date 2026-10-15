/**
 * Live preview island for `CheckboxGroup`. The group is the accessible wrapper around a
 * run of checkboxes: it names the set, points at its own description and error, and lays
 * them out along one axis. A set that needs at least one pick is not something a native
 * attribute can express across several boxes, so the island holds that rule and writes the
 * group's `aria-invalid` and its `FieldError` from it, the same shape a server round-trip
 * would re-render with.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { maxIs } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Checkbox, CheckboxGroup, Description, FieldError, Label } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** Where an incident notification can be delivered, in the order the form lists them. */
const CHANNELS = [
	{ value: "email", label: "Email", hint: "ops@acme.com" },
	{ value: "sms", label: "SMS", hint: "+1 415 555 0134" },
	{ value: "slack", label: "Slack", hint: "#incidents" },
	{ value: "webhook", label: "Webhook", hint: "Disabled until a URL is saved", disabled: true },
];

/** The source the page shows, matching the markup below. */
const CODE = `let chosen = new Set(["email"]);

<div mix={[vstack({ gap: 2, align: "stretch" }), maxIs("26rem")]}>
	<CheckboxGroup
		orientation="vertical"
		aria-labelledby="preview-channels-label"
		aria-describedby="preview-channels-hint preview-channels-error"
		aria-invalid={chosen.size === 0 ? "true" : undefined}
		mix={[vstack({ gap: 3, align: "stretch" })]}
	>
		<Label id="preview-channels-label">Page me about incidents on</Label>

		{CHANNELS.map((channel) => (
			<Checkbox
				key={channel.value}
				name="channels"
				value={channel.value}
				checked={chosen.has(channel.value)}
				disabled={channel.disabled}
				mix={[
					ariaChecked(),
					on<HTMLInputElement, "change">("change", (event) => {
						if (event.currentTarget.checked) chosen.add(channel.value);
						else chosen.delete(channel.value);
						void handle.update();
					}),
				]}
			>
				<span mix={[vstack({ gap: 0, align: "start" })]}>
					<span mix={[text("sm")]}>{channel.label}</span>
					<span mix={[text("xs"), fg("neutral")]}>{channel.hint}</span>
				</span>
			</Checkbox>
		))}
	</CheckboxGroup>

	<Description id="preview-channels-hint">
		Severity 1 pages go to every channel you keep on.
	</Description>
	<FieldError id="preview-channels-error" hidden={chosen.size > 0}>
		Pick at least one channel.
	</FieldError>
</div>`;

/** A delivery-channel set that must keep one pick, hydrated so the rule reports itself. */
export const CheckboxGroupPreview = clientEntry(
	import.meta.url,
	function CheckboxGroupPreview(handle: Handle) {
		let chosen = new Set(["email"]);

		return () => (
			<div mix={[vstack({ gap: 2, align: "stretch" }), maxIs("26rem")]}>
				<CheckboxGroup
					orientation="vertical"
					aria-labelledby="preview-channels-label"
					aria-describedby="preview-channels-hint preview-channels-error"
					aria-invalid={chosen.size === 0 ? "true" : undefined}
					mix={[vstack({ gap: 3, align: "stretch" })]}
				>
					<Label id="preview-channels-label">Page me about incidents on</Label>

					{CHANNELS.map((channel) => (
						<Checkbox
							key={channel.value}
							name="channels"
							value={channel.value}
							checked={chosen.has(channel.value)}
							disabled={channel.disabled}
							mix={[
								ariaChecked(),
								on<HTMLInputElement, "change">("change", (event) => {
									if (event.currentTarget.checked) chosen.add(channel.value);
									else chosen.delete(channel.value);
									void handle.update();
								}),
							]}
						>
							<span mix={[vstack({ gap: 0, align: "start" })]}>
								<span mix={[text("sm")]}>{channel.label}</span>
								<span mix={[text("xs"), fg("neutral")]}>{channel.hint}</span>
							</span>
						</Checkbox>
					))}
				</CheckboxGroup>

				<Description id="preview-channels-hint">
					Severity 1 pages go to every channel you keep on.
				</Description>
				<FieldError id="preview-channels-error" hidden={chosen.size > 0}>
					Pick at least one channel.
				</FieldError>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: CODE, render: () => <CheckboxGroupPreview /> };
