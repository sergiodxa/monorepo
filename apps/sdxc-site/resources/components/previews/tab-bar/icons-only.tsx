/**
 * Live example for `TabBar` with `showLabels={false}`: icons alone, as a social app draws
 * its bar, each item still named for assistive tech, and the current one in the brand colour.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { BellIcon, HouseIcon, MailIcon, SearchIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { TabBar } from "@sdxc/ui/app/tab-bar";

/** The source the page shows, matching the markup below apart from the preview's frame. */
const CODE = `<TabBar label="Primary" showLabels={false}>
	<TabBar.Item href="/" icon={<HouseIcon />} label="Home" current />
	<TabBar.Item href="/explore" icon={<SearchIcon />} label="Explore" />
	<TabBar.Item href="/notifications" icon={<BellIcon />} label="Notifications" count={12} countLabel="12 unread" />
	<TabBar.Item href="/messages" icon={<MailIcon />} label="Messages" />
</TabBar>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Icons only",
	code: CODE,
	render: () => (
		<div
			mix={[
				raw({
					position: "relative",
					transform: "translateZ(0)",
					display: "flex",
					flexDirection: "column",
					justifyContent: "flex-end",
					inlineSize: "min(100%, 20rem)",
					blockSize: "8rem",
					overflow: "hidden",
					borderRadius: "1.25rem",
					border: "1px solid var(--ui-neutral-border)",
					backgroundColor: "var(--ui-bg)",
				}),
			]}
		>
			<TabBar label="Primary" hideFrom="never" showLabels={false}>
				<TabBar.Item href="#home" icon={<HouseIcon />} label="Home" current />
				<TabBar.Item href="#explore" icon={<SearchIcon />} label="Explore" />
				<TabBar.Item
					href="#notifications"
					icon={<BellIcon />}
					label="Notifications"
					count={12}
					countLabel="12 unread"
				/>
				<TabBar.Item href="#messages" icon={<MailIcon />} label="Messages" />
			</TabBar>
		</div>
	),
};
