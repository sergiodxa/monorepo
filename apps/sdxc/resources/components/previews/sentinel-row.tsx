/**
 * Live preview island for `SentinelRow`. It is the trailing row every list-shaped
 * component reuses for its loading placeholder, so the example shows it where it
 * belongs: at the end of a real notification list, holding the spinner and copy a
 * paired enhancement supplies. The row itself is decorative, so the `spin()` factory
 * through `mix` is what makes it read as still loading.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CircleAlertIcon, GitPullRequestIcon, MessageSquareIcon } from "@sdxc/icons";
import { gap, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Item, SentinelRow, Separator, Spinner } from "@sdxc/ui";
import { spin } from "@sdxc/ui/animations";
import { clientEntry } from "remix/component";

/** The page of notifications already loaded, which the sentinel row trails. */
const LOADED = [
	{
		id: "pr-412",
		title: "Review requested on #412",
		description: "sergiodxa · Second-factor authentication backoff",
	},
	{
		id: "alert-88",
		title: "Monitor degraded",
		description: "api.sdxc.dev answered in 4.2s for 5 minutes",
	},
	{
		id: "comment-19",
		title: "New comment on ADR-035",
		description: "“Can the backoff be per subject rather than per IP?”",
	},
];

/** The glyph each notification leads with, keyed by the kind of row it is. */
const GLYPHS = {
	"pr-412": GitPullRequestIcon,
	"alert-88": CircleAlertIcon,
	"comment-19": MessageSquareIcon,
};

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SENTINEL_ROW_CODE = `<div role="feed" aria-busy="true" aria-label="Notifications">
	{loaded.map((entry) => (
		<Item key={entry.id}>
			<Item.Media>
				<GitPullRequestIcon aria-hidden="true" />
			</Item.Media>
			<Item.Content>
				<Item.Title>{entry.title}</Item.Title>
				<Item.Description>{entry.description}</Item.Description>
			</Item.Content>
		</Item>
	))}

	<Separator />

	<SentinelRow mix={[gap(2)]}>
		<Spinner size="sm" mix={[spin()]} aria-label="Loading more notifications" />
		Loading more…
	</SentinelRow>
</div>`;

/** A notification feed's trailing loading row, hydrated so its spinner rotates. */
export const SentinelRowPreview = clientEntry(
	"/resources/components/previews/sentinel-row.tsx#SentinelRowPreview",
	function SentinelRowPreview() {
		return () => (
			<div
				role="feed"
				aria-busy="true"
				aria-label="Notifications"
				mix={[vstack({ gap: 1, align: "stretch" }), is("26rem")]}
			>
				{LOADED.map((entry) => {
					let Glyph = GLYPHS[entry.id as keyof typeof GLYPHS];

					return (
						<Item key={entry.id}>
							<Item.Media>
								<Glyph aria-hidden="true" />
							</Item.Media>
							<Item.Content>
								<Item.Title>{entry.title}</Item.Title>
								<Item.Description>{entry.description}</Item.Description>
							</Item.Content>
						</Item>
					);
				})}

				<Separator />

				<SentinelRow mix={[gap(2)]}>
					<Spinner size="sm" mix={[spin()]} aria-label="Loading more notifications" />
					Loading more…
				</SentinelRow>
			</div>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SENTINEL_ROW_CODE, render: () => <SentinelRowPreview /> };
