/**
 * Live example island for `SelectionIndicator` as a tab's underline. Every tab holds its
 * own bar and only the selected one shows it, so the strip never reflows as the selection
 * moves; the island tracks the active tab so pressing one moves the bar.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { bg } from "@sdxc/u/color";
import { absolute, insBe, insIe, insIs, relative } from "@sdxc/u/layout";
import { bs, is } from "@sdxc/u/size";
import { SelectionIndicator, Tabs } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

/** The tabs the strip offers, so the bar has somewhere to move between. */
const SECTIONS = [
	{ id: "profile", label: "Profile" },
	{ id: "billing", label: "Billing" },
	{ id: "members", label: "Members" },
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `let activeTab = "billing";

<Tabs>
	<Tabs.List aria-label="Settings sections">
		{sections.map((section) => (
			<Tabs.Tab
				key={section.id}
				href={"#" + section.id}
				aria-selected={activeTab === section.id ? "true" : "false"}
				mix={[
					relative(),
					on<HTMLAnchorElement, "click">("click", (event) => {
						event.preventDefault();
						activeTab = section.id;
						void handle.update();
					}),
				]}
			>
				{section.label}
				<SelectionIndicator
					aria-selected={activeTab === section.id ? "true" : "false"}
					mix={[absolute(), insIs(0), insIe(0), insBe("-0.125rem"), is("auto"), bs("0.125rem"), bg("brand.solid")]}
				/>
			</Tabs.Tab>
		))}
	</Tabs.List>
</Tabs>`;

/** A tab strip whose underline follows the pressed tab, hydrated so the selection can move. */
export const TabUnderline = clientEntry(import.meta.url, function TabUnderline(handle: Handle) {
	let activeTab = "billing";

	return () => (
		<Tabs mix={[is("24rem")]}>
			<Tabs.List aria-label="Settings sections">
				{SECTIONS.map((section) => (
					<Tabs.Tab
						key={section.id}
						href={"#" + section.id}
						aria-selected={activeTab === section.id ? "true" : "false"}
						mix={[
							relative(),
							on<HTMLAnchorElement, "click">("click", (event) => {
								event.preventDefault();
								activeTab = section.id;
								void handle.update();
							}),
						]}
					>
						{section.label}
						<SelectionIndicator
							aria-selected={activeTab === section.id ? "true" : "false"}
							mix={[
								absolute(),
								insIs(0),
								insIe(0),
								insBe("-0.125rem"),
								is("auto"),
								bs("0.125rem"),
								bg("brand.solid"),
							]}
						/>
					</Tabs.Tab>
				))}
			</Tabs.List>
		</Tabs>
	);
});

/** What the preview registry reads: the title, the source to show, and the island to draw. */
export default {
	title: "Tab underline",
	code: CODE,
	render: () => <TabUnderline />,
};
