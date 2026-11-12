/**
 * Live preview for `TabBar`: a phone-sized screen of a reading app with four destinations
 * under the thumb, Inbox current and Alerts carrying a count. The screen is its own
 * containing block, so the fixed bar sits at the foot of the frame rather than the page.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, HouseIcon, InboxIcon, SearchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { TabBar } from "@sdxc/ui/app/tab-bar";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<TabBar label="Primary">
	<TabBar.Item href="/" icon={<HouseIcon />} label="Home" />
	<TabBar.Item href="/search" icon={<SearchIcon />} label="Search" />
	<TabBar.Item href="/inbox" icon={<InboxIcon />} label="Inbox" current />
	<TabBar.Item href="/alerts" icon={<BellIcon />} label="Alerts" count={3} countLabel="3 new" />
</TabBar>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					position: "relative",
					transform: "translateZ(0)",
					display: "flex",
					flexDirection: "column",
					inlineSize: "min(100%, 20rem)",
					blockSize: "18rem",
					overflow: "hidden",
					borderRadius: "1.25rem",
					border: "1px solid var(--ui-neutral-border)",
					backgroundColor: "var(--ui-bg)",
				}),
			]}
		>
			<div
				mix={[
					raw({
						flex: "1 1 auto",
						display: "grid",
						alignContent: "start",
						gap: "0.5rem",
						padding: "1rem",
					}),
				]}
			>
				<strong>Inbox</strong>
				{["Weekly digest", "Your order shipped", "Reading list: 3 new"].map((subject) => (
					<span
						mix={[
							raw({
								paddingBlock: "0.5rem",
								borderBlockEnd: "1px solid var(--ui-neutral-border)",
								fontSize: "0.875rem",
							}),
						]}
					>
						{subject}
					</span>
				))}
			</div>
			<TabBar label="Primary" hideFrom="never">
				<TabBar.Item href="#home" icon={<HouseIcon />} label="Home" />
				<TabBar.Item href="#search" icon={<SearchIcon />} label="Search" />
				<TabBar.Item href="#inbox" icon={<InboxIcon />} label="Inbox" current />
				<TabBar.Item
					href="#alerts"
					icon={<BellIcon />}
					label="Alerts"
					count={3}
					countLabel="3 new"
				/>
			</TabBar>
		</div>
	),
};
