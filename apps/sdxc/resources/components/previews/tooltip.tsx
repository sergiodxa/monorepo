/**
 * Live preview island for `Tooltip`. The hint reveals on plain `:hover`/`:focus-visible`
 * of the sibling right before it, with no script in the path — but a popover only
 * gets an implicit anchor when an invoker opens it, so a hover-revealed hint needs an
 * explicit one: each trigger names an anchor through `anchorName()` and its hint
 * points back with `positionAnchor()`. Without that pair the hint lands in the
 * corner of the page instead of against its control.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { ArchiveIcon, StarIcon, Trash2Icon } from "@sdxc/icons";
import { anchorName, hstack, positionAnchor } from "@sdxc/u/layout";
import { Button, Toolbar, Tooltip } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The icon-only actions the row offers, each with the hint that names it. */
const ACTIONS = [
	{ id: "star", label: "Star", hint: "Keep this thread at the top of the list.", placement: "top" },
	{
		id: "archive",
		label: "Archive",
		hint: "Move it out of the inbox. Nothing is deleted.",
		placement: "bottom",
	},
	{
		id: "delete",
		label: "Delete",
		hint: "Delete for everyone. This cannot be undone.",
		placement: "right",
	},
] as const;

/** The source the page shows, matching the markup below. */
const TOOLTIP_CODE = `<Toolbar aria-label="Thread actions">
	{actions.map((action) => (
		<span key={action.id} mix={[hstack({ gap: 0, align: "center" })]}>
			<Button
				variant="ghost"
				size="sm"
				aria-label={action.label}
				aria-describedby={\`preview-tip-\${action.id}\`}
				mix={[anchorName(\`preview-tip-\${action.id}\`)]}
			>
				<StarIcon />
			</Button>
			<Tooltip
				id={\`preview-tip-\${action.id}\`}
				placement={action.placement}
				mix={[positionAnchor(\`preview-tip-\${action.id}\`)]}
			>
				{action.hint}
			</Tooltip>
		</span>
	))}
</Toolbar>`;

/** Three icon-only actions with anchored hints, hydrated alongside the rest of the catalogue. */
export const TooltipPreview = clientEntry(
	"/resources/components/previews/tooltip.tsx#TooltipPreview",
	function TooltipPreview() {
		return () => (
			<Toolbar aria-label="Thread actions">
				{ACTIONS.map((action) => {
					let Glyph =
						action.id === "star" ? StarIcon : action.id === "archive" ? ArchiveIcon : Trash2Icon;

					return (
						<span key={action.id} mix={[hstack({ gap: 0, align: "center" })]}>
							<Button
								variant="ghost"
								size="sm"
								color={action.id === "delete" ? "danger" : "neutral"}
								aria-label={action.label}
								aria-describedby={`preview-tip-${action.id}`}
								mix={[anchorName(`preview-tip-${action.id}`)]}
							>
								<Glyph />
							</Button>
							<Tooltip
								id={`preview-tip-${action.id}`}
								placement={action.placement}
								mix={[positionAnchor(`preview-tip-${action.id}`)]}
							>
								{action.hint}
							</Tooltip>
						</span>
					);
				})}
			</Toolbar>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TOOLTIP_CODE, render: () => <TooltipPreview /> };
