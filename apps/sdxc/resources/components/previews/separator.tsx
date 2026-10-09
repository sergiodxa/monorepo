/**
 * Live preview island for `Separator`. A hairline only means something between two
 * groups, so the example is a repository summary card: horizontal dividers ruling
 * the metadata rows apart, and a vertical one splitting the stats cluster that sits
 * on one line.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Badge, Card, Separator, Text } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const SEPARATOR_CODE = `<Card>
	<Card.Header>
		<Card.Title>sergiodxa/monorepo</Card.Title>
		<Card.Description>Small TypeScript packages built on web standards.</Card.Description>
	</Card.Header>
	<Card.Content>
		<div mix={[hstack({ gap: 4, align: "center" })]}>
			<span>TypeScript</span>
			<Separator aria-orientation="vertical" />
			<span>MIT</span>
			<Separator aria-orientation="vertical" />
			<span>51 packages</span>
		</div>

		<Separator />

		<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
			<Text>Latest release</Text>
			<Badge color="success" variant="secondary">2026.9.17</Badge>
		</div>

		<Separator />

		<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
			<Text>Last deploy</Text>
			<Text>12 minutes ago</Text>
		</div>
	</Card.Content>
</Card>`;

/** Dividers on both axes inside one card, hydrated alongside the rest of the catalogue. */
export const SeparatorPreview = clientEntry(import.meta.url, function SeparatorPreview() {
	return () => (
		<Card mix={[is("24rem")]}>
			<Card.Header>
				<Card.Title>sergiodxa/monorepo</Card.Title>
				<Card.Description>Small TypeScript packages built on web standards.</Card.Description>
			</Card.Header>
			<Card.Content mix={[vstack({ gap: 3, align: "stretch" })]}>
				<div mix={[hstack({ gap: 4, align: "center" }), text("sm"), weight("medium")]}>
					<span>TypeScript</span>
					<Separator aria-orientation="vertical" />
					<span>MIT</span>
					<Separator aria-orientation="vertical" />
					<span>51 packages</span>
				</div>

				<Separator />

				<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
					<Text>Latest release</Text>
					<Badge color="success" variant="secondary">
						2026.9.17
					</Badge>
				</div>

				<Separator />

				<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
					<Text>Last deploy</Text>
					<Text>12 minutes ago</Text>
				</div>
			</Card.Content>
		</Card>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: SEPARATOR_CODE, render: () => <SeparatorPreview /> };
