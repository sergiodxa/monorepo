/**
 * Live preview island for `Switch`. The control ships no authored `aria-checked`,
 * because a value written on the server goes stale the instant the switch is
 * flipped, so the preview carries the `ariaChecked()` wiring a reader applies to
 * keep the attribute following live checkedness. The example is a real notification
 * panel: three switches, each with its own caption and supporting copy.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Card, Separator, Switch, Text } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry, css } from "remix/component";

/** One row of the panel, so the three switches differ by more than their labels. */
interface Preference {
	name: string;
	label: string;
	description: string;
	defaultChecked: boolean;
}

/** The preferences the panel offers, each its own switch. */
const PREFERENCES: Preference[] = [
	{
		name: "incidents",
		label: "Incident alerts",
		description: "Email the on-call address the moment a monitor goes down.",
		defaultChecked: true,
	},
	{
		name: "digest",
		label: "Weekly digest",
		description: "One summary every Monday with uptime and response times.",
		defaultChecked: true,
	},
	{
		name: "marketing",
		label: "Product news",
		description: "Occasional notes about new features. No more than once a month.",
		defaultChecked: false,
	},
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SWITCH_CODE = `<Card>
	<Card.Header>
		<Card.Title>Notifications</Card.Title>
		<Card.Description>Choose what we email you about.</Card.Description>
	</Card.Header>
	<Card.Content>
		{preferences.map((preference) => (
			<label
				key={preference.name}
				htmlFor={\`preview-switch-\${preference.name}\`}
				mix={[hstack({ gap: 4, align: "start", justify: "between" })]}
			>
				<span mix={[vstack({ gap: 1, align: "start" })]}>
					{preference.label}
					<Text>{preference.description}</Text>
				</span>
				<Switch
					id={\`preview-switch-\${preference.name}\`}
					name={preference.name}
					defaultChecked={preference.defaultChecked}
					mix={[ariaChecked()]}
				/>
			</label>
		))}
	</Card.Content>
</Card>`;

/** A notification panel of three switches, hydrated so each one's `aria-checked` follows it. */
export const SwitchPreview = clientEntry(
	"/resources/components/previews/switch.tsx#SwitchPreview",
	function SwitchPreview() {
		return () => (
			<Card mix={[is("26rem")]}>
				<Card.Header>
					<Card.Title>Notifications</Card.Title>
					<Card.Description>Choose what we email you about.</Card.Description>
				</Card.Header>
				<Card.Content mix={[vstack({ gap: 4, align: "stretch" })]}>
					{PREFERENCES.map((preference, index) => (
						<div key={preference.name} mix={[vstack({ gap: 4, align: "stretch" })]}>
							{index > 0 ? <Separator /> : null}
							<label
								htmlFor={`preview-switch-${preference.name}`}
								mix={[
									hstack({ gap: 4, align: "start", justify: "between" }),
									css({ cursor: "pointer" }),
								]}
							>
								<span mix={[vstack({ gap: 1, align: "start" })]}>
									<span mix={[text("sm"), weight("medium")]}>{preference.label}</span>
									<Text>{preference.description}</Text>
								</span>
								<Switch
									id={`preview-switch-${preference.name}`}
									name={preference.name}
									defaultChecked={preference.defaultChecked}
									mix={[ariaChecked(), css({ flexShrink: "0" })]}
								/>
							</label>
						</div>
					))}
				</Card.Content>
			</Card>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SWITCH_CODE, render: () => <SwitchPreview /> };
