/**
 * Live preview island for `ListBox`. The rows render and submit as native radios without
 * script, and the ARIA listbox keyboard pattern is what script adds, so the preview
 * carries the wiring a reader would write: a `listbox.Context` holding the selected and
 * active values, `listboxKeys()` on the group, and `listbox.option()` on every row.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import * as listbox from "@remix-run/ui/listbox";
import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { text } from "@sdxc/u/typography";
import { Header, ListBox, Section } from "@sdxc/ui";
import { listboxKeys } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** The projects an issue can be moved into, grouped the way the picker shows them. */
const GROUPS = [
	{
		id: "active",
		label: "Active",
		options: [
			{ value: "design-system", label: "Design system" },
			{ value: "docs-site", label: "Documentation site" },
			{ value: "billing", label: "Billing" },
			{ value: "mobile", label: "Mobile app" },
		],
	},
	{
		id: "archived",
		label: "Archived",
		options: [
			{ value: "marketing-2025", label: "Marketing 2025" },
			{ value: "legacy-api", label: "Legacy API", disabled: true },
			{ value: "prototypes", label: "Prototypes" },
		],
	},
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let value = "docs-site";
let activeValue: listbox.ListboxValue = "docs-site";

<listbox.Context
	value={value}
	activeValue={activeValue}
	onSelect={(next) => {
		value = next ?? value;
		void handle.update();
	}}
	onHighlight={(next) => {
		activeValue = next;
		void handle.update();
	}}
>
	<div mix={[vstack({ gap: 2, align: "stretch" })]}>
		<Header mix={[m(0)]}>Move issue to</Header>

		<ListBox
			role="listbox"
			tabIndex={0}
			aria-label="Move issue to"
			name="projectId"
			mix={[listboxKeys()]}
		>
			{GROUPS.map((group) => (
				<Section key={group.id} aria-labelledby={group.id + "-heading"}>
					<Header id={group.id + "-heading"}>{group.label}</Header>
					{group.options.map((option) => (
						<ListBox.Item
							key={option.value}
							value={option.value}
							checked={value === option.value}
							disabled={option.disabled}
							mix={[listbox.option({ value: option.value, label: option.label, disabled: option.disabled })]}
						>
							{option.label}
						</ListBox.Item>
					))}
				</Section>
			))}
		</ListBox>

		<p mix={[m(0), text("xs")]}>
			Arrow keys move the active row, Enter selects it, and typing jumps to a match.
		</p>
	</div>
</listbox.Context>`;

/** A project picker, hydrated so arrows, Home/End, typeahead and Enter all reach the list. */
export const ListBoxPreview = clientEntry(import.meta.url, function ListBoxPreview(handle: Handle) {
	let value = "docs-site";
	let activeValue: listbox.ListboxValue = "docs-site";

	return () => (
		<listbox.Context
			value={value}
			activeValue={activeValue}
			onSelect={(next) => {
				value = next ?? value;
				void handle.update();
			}}
			onHighlight={(next) => {
				activeValue = next;
				void handle.update();
			}}
		>
			<div mix={[vstack({ gap: 2, align: "stretch" }), is("20rem")]}>
				<Header mix={[m(0)]}>Move issue to</Header>

				<ListBox
					role="listbox"
					tabIndex={0}
					aria-label="Move issue to"
					name="projectId"
					mix={[listboxKeys()]}
				>
					{GROUPS.map((group) => (
						<Section key={group.id} aria-labelledby={`${group.id}-heading`}>
							<Header id={`${group.id}-heading`}>{group.label}</Header>
							{group.options.map((option) => (
								<ListBox.Item
									key={option.value}
									value={option.value}
									checked={value === option.value}
									disabled={option.disabled}
									mix={[
										listbox.option({
											value: option.value,
											label: option.label,
											disabled: option.disabled,
										}),
									]}
								>
									{option.label}
								</ListBox.Item>
							))}
						</Section>
					))}
				</ListBox>

				<p mix={[m(0), text("xs"), fg("neutral.muted")]}>
					Arrow keys move the active row, Enter selects it, and typing jumps to a match.
				</p>
			</div>
		</listbox.Context>
	);
});

export default { code: CODE, render: () => <ListBoxPreview /> };
