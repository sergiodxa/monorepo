/**
 * Live example for `Tooltip` naming an icon-only link, placed to its right with no arrow.
 * The hint reveals on the link's hover or keyboard focus with no script, and the
 * `anchorName()`/`positionAnchor()` pair keeps it against the link it describes.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { SettingsIcon } from "@sdxc/icons";
import { anchorName, hstack, positionAnchor } from "@sdxc/u/layout";
import { LinkButton, Tooltip } from "@sdxc/ui";

/** The source the page shows, matching the markup below. */
const CODE = `<span mix={[hstack({ gap: 0, align: "center" })]}>
	<LinkButton
		href="/settings"
		variant="ghost"
		size="sm"
		aria-label="Settings"
		aria-describedby="settings-tooltip"
		mix={[anchorName("settings-tooltip")]}
	>
		<SettingsIcon aria-hidden />
	</LinkButton>
	<Tooltip
		id="settings-tooltip"
		placement="right"
		showArrow={false}
		mix={[positionAnchor("settings-tooltip")]}
	>
		Workspace settings
	</Tooltip>
</span>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Without an arrow",
	code: CODE,
	render: () => (
		<span mix={[hstack({ gap: 0, align: "center" })]}>
			<LinkButton
				href="/settings"
				variant="ghost"
				size="sm"
				aria-label="Settings"
				aria-describedby="example-tooltip-without-arrow"
				mix={[anchorName("example-tooltip-without-arrow")]}
			>
				<SettingsIcon aria-hidden />
			</LinkButton>
			<Tooltip
				id="example-tooltip-without-arrow"
				placement="right"
				showArrow={false}
				mix={[positionAnchor("example-tooltip-without-arrow")]}
			>
				Workspace settings
			</Tooltip>
		</span>
	),
};
