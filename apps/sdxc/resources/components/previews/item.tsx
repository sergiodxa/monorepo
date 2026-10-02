/**
 * Live preview island for `Item`. The row's shape is leading media, a title over a
 * description, and trailing actions, which is what a settings list is made of — the same
 * three slots hold an icon, the setting's name and consequence, and the control that
 * changes it.
 *
 * The switches carry `ariaChecked()`, because a native checkbox's `checked` state lives in
 * the DOM rather than in an attribute: without the mixin, `aria-checked` would report
 * whatever the server rendered forever. The island also reads the rows back, so the
 * summary underneath states what the list currently says.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { BellIcon, MailIcon, SmartphoneIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Description, Header, Item, Switch } from "@sdxc/ui";
import { ariaChecked } from "@sdxc/ui/mixins";
import { clientEntry, on } from "remix/component";

/** The rows the list holds, each with the channel it governs. */
const CHANNELS = [
	{
		id: "email",
		title: "Email",
		description: "A digest every weekday morning, plus anything urgent.",
		enabled: true,
	},
	{
		id: "push",
		title: "Push",
		description: "Only mentions and direct replies, on this device.",
		enabled: true,
	},
	{
		id: "sms",
		title: "SMS",
		description: "Security alerts only. Standard rates apply.",
		enabled: false,
	},
];

/** The glyph each channel's media slot carries. */
const CHANNEL_ICONS = { email: MailIcon, push: BellIcon, sms: SmartphoneIcon };

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const ITEM_CODE = `let enabled = new Set(CHANNELS.filter((c) => c.enabled).map((c) => c.id));

function toggleChannel(event: Event) {
	let input = event.target as HTMLInputElement;
	if (input.checked) enabled.add(input.name);
	else enabled.delete(input.name);
	void handle.update();
}

<Header>Notifications</Header>

// A checkbox's change event bubbles, so the list is where the island listens.
<div mix={[on<HTMLDivElement, "change">("change", toggleChannel)]}>
	{CHANNELS.map((channel) => {
		let Glyph = CHANNEL_ICONS[channel.id];

		return (
			<Item key={channel.id}>
				<Item.Media>
					<Glyph aria-hidden="true" />
				</Item.Media>
				<Item.Content>
					<Item.Title>{channel.title}</Item.Title>
					<Item.Description>{channel.description}</Item.Description>
				</Item.Content>
				<Item.Actions>
					<Switch
						name={channel.id}
						defaultChecked={channel.enabled}
						aria-label={\`Notify me by \${channel.title}\`}
						mix={[ariaChecked()]}
					/>
				</Item.Actions>
			</Item>
		);
	})}
</div>

<Description>
	{enabled.size === 0
		? "You will not be notified at all."
		: \`Notifying you by \${[...enabled].join(", ")}.\`}
</Description>`;

/** A notification settings list, hydrated so each switch reports its own live state. */
export const ItemPreview = clientEntry(
	"/resources/components/previews/item.tsx#ItemPreview",
	function ItemPreview(handle: Handle) {
		let enabled = new Set(
			CHANNELS.filter((channel) => channel.enabled).map((channel) => channel.id),
		);

		/** Keeps the summary below honest about what the switches are set to. */
		function toggleChannel(event: Event) {
			let input = event.target as HTMLInputElement;
			if (input.checked) enabled.add(input.name);
			else enabled.delete(input.name);
			void handle.update();
		}

		return () => (
			<div mix={[vstack({ gap: 3, align: "stretch" }), is("26rem")]}>
				<Header>Notifications</Header>

				{/* A checkbox's change event bubbles, so the list is where the island listens. */}
				<div
					mix={[
						vstack({ gap: 2, align: "stretch" }),
						on<HTMLDivElement, "change">("change", toggleChannel),
					]}
				>
					{CHANNELS.map((channel) => {
						let Glyph = CHANNEL_ICONS[channel.id as keyof typeof CHANNEL_ICONS];

						return (
							<Item key={channel.id}>
								<Item.Media>
									<Glyph aria-hidden="true" />
								</Item.Media>
								<Item.Content>
									<Item.Title>{channel.title}</Item.Title>
									<Item.Description>{channel.description}</Item.Description>
								</Item.Content>
								<Item.Actions>
									<Switch
										name={channel.id}
										defaultChecked={channel.enabled}
										aria-label={`Notify me by ${channel.title}`}
										mix={[ariaChecked()]}
									/>
								</Item.Actions>
							</Item>
						);
					})}
				</div>

				<Description>
					{enabled.size === 0
						? "You will not be notified at all."
						: `Notifying you by ${[...enabled].join(", ")}.`}
				</Description>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: ITEM_CODE, render: () => <ItemPreview /> };
