/**
 * Live example for `Tabs` with the strip down the side. Every tab shares one height, which
 * lets the list place its accent bar from `activeIndex` alone; the selected tab comes from
 * the route an app renders, so the example is that server markup with Profile current.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { Tabs, Text } from "@sdxc/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Tabs orientation="vertical">
	<Tabs.List aria-label="Settings sections" activeIndex={0} tabSize="2.25rem">
		<Tabs.Tab href="#settings-profile" aria-selected="true" mix={[bs("2.25rem")]}>
			Profile
		</Tabs.Tab>
		<Tabs.Tab href="#settings-billing" aria-selected="false" mix={[bs("2.25rem")]}>
			Billing
		</Tabs.Tab>
		<Tabs.Tab href="#settings-members" aria-selected="false" mix={[bs("2.25rem")]}>
			Members
		</Tabs.Tab>
	</Tabs.List>
	<Tabs.Panels>
		<Tabs.Panel aria-label="Profile" mix={[vstack({ gap: 2, align: "start" })]}>
			<Text>Your name, avatar and bio as everyone at Acme sees them.</Text>
		</Tabs.Panel>
	</Tabs.Panels>
</Tabs>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Vertical",
	code: CODE,
	render: () => (
		<Tabs orientation="vertical" mix={[is("28rem")]}>
			<Tabs.List aria-label="Settings sections" activeIndex={0} tabSize="2.25rem">
				<Tabs.Tab href="#settings-profile" aria-selected="true" mix={[bs("2.25rem")]}>
					Profile
				</Tabs.Tab>
				<Tabs.Tab href="#settings-billing" aria-selected="false" mix={[bs("2.25rem")]}>
					Billing
				</Tabs.Tab>
				<Tabs.Tab href="#settings-members" aria-selected="false" mix={[bs("2.25rem")]}>
					Members
				</Tabs.Tab>
			</Tabs.List>
			<Tabs.Panels>
				<Tabs.Panel aria-label="Profile" mix={[vstack({ gap: 2, align: "start" })]}>
					<Text>Your name, avatar and bio as everyone at Acme sees them.</Text>
				</Tabs.Panel>
			</Tabs.Panels>
		</Tabs>
	),
};
