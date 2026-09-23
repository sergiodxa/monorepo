/**
 * Live preview island for `Tabs`. There is no tracked selection here: every tab is a
 * real link, and whichever one points at the page being viewed is the selected one.
 * The preview keeps that contract by reading the URL — the fragment, standing in for
 * the route segment an app would use — so clicking a tab navigates and the strip
 * re-renders from the new URL, indicator and panel together.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/ui";

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, Tabs, Text } from "@sdxc/ui";
import { clientEntry, on } from "remix/ui";

/** Each tab's own page, so the panel changes with the URL rather than with state. */
const SECTIONS = [
	{
		fragment: "#profile",
		label: "Profile",
		heading: "Public profile",
		body: "Your name, avatar and bio as everyone else sees them.",
	},
	{
		fragment: "#billing",
		label: "Billing",
		heading: "Billing",
		body: "Pro plan, billed yearly. The next invoice is due on 1 October.",
	},
	{
		fragment: "#members",
		label: "Members",
		heading: "Members",
		body: "Five people, two of them administrators. Invites expire after a week.",
	},
];

/** Every tab is the same width, which is what lets the list place its own indicator. */
const TAB_SIZE = "7rem";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TABS_CODE = `// The active tab comes from the URL, never from tracked state.
let activeIndex = sections.findIndex((section) => section.fragment === fragment);
let active = sections[activeIndex];

<Tabs>
	<Tabs.List aria-label="Settings sections" activeIndex={activeIndex} tabSize="7rem">
		{sections.map((section, index) => (
			<Tabs.Tab
				key={section.fragment}
				href={section.fragment}
				aria-selected={index === activeIndex}
				mix={[
					is("7rem"),
					// A fragment navigation leaves no history entry the runtime reports,
					// so the island reads the URL back on the press itself.
					on<HTMLAnchorElement, "click">("click", () => {
						fragment = section.fragment;
						void handle.update();
					}),
				]}
			>
				{section.label}
			</Tabs.Tab>
		))}
	</Tabs.List>
	<Tabs.Panels>
		<Tabs.Panel aria-label={active.heading} mix={[vstack({ gap: 2, align: "start" })]}>
			<div mix={[hstack({ gap: 2, align: "center" })]}>
				<span mix={[text("base"), weight("semibold")]}>{active.heading}</span>
				<Badge variant="secondary">{active.fragment}</Badge>
			</div>
			<Text>{active.body}</Text>
		</Tabs.Panel>
	</Tabs.Panels>
</Tabs>`;

/** A routing-driven tab strip, hydrated so a tab press re-reads the URL it navigated to. */
export const TabsPreview = clientEntry(
	"/resources/components/previews/tabs.tsx#TabsPreview",
	function TabsPreview(handle: Handle) {
		let fragment = SECTIONS[0]!.fragment;

		/** Re-reads the URL whenever it changes under the island, however that happens. */
		function readFragment() {
			fragment = globalThis.location.hash;
			void handle.update();
		}

		// The window outlives the island, so the subscription is dropped when the
		// island disconnects rather than through an options signal, which is an
		// inert stub during the server render.
		globalThis.addEventListener("hashchange", readFragment);
		handle.signal.addEventListener("abort", () =>
			globalThis.removeEventListener("hashchange", readFragment),
		);

		return () => {
			let activeIndex = Math.max(
				0,
				SECTIONS.findIndex((section) => section.fragment === fragment),
			);
			let active = SECTIONS[activeIndex]!;

			return (
				<Tabs mix={[is("28rem")]}>
					<Tabs.List aria-label="Settings sections" activeIndex={activeIndex} tabSize={TAB_SIZE}>
						{SECTIONS.map((section, index) => (
							<Tabs.Tab
								key={section.fragment}
								href={section.fragment}
								aria-selected={index === activeIndex}
								mix={[
									is(TAB_SIZE),
									// A fragment navigation leaves no history entry the runtime reports,
									// so the island reads the URL back on the press itself.
									on<HTMLAnchorElement, "click">("click", () => {
										fragment = section.fragment;
										void handle.update();
									}),
								]}
							>
								{section.label}
							</Tabs.Tab>
						))}
					</Tabs.List>
					<Tabs.Panels>
						<Tabs.Panel aria-label={active.heading} mix={[vstack({ gap: 2, align: "start" })]}>
							<div mix={[hstack({ gap: 2, align: "center" })]}>
								<span mix={[text("base"), weight("semibold")]}>{active.heading}</span>
								<Badge variant="secondary">{active.fragment}</Badge>
							</div>
							<Text>{active.body}</Text>
						</Tabs.Panel>
					</Tabs.Panels>
				</Tabs>
			);
		};
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TABS_CODE, render: () => <TabsPreview /> };
