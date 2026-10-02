/**
 * Live preview island for `Text`. Its single intensity only shows against the copy
 * it sits beside, so the example is a billing summary: a heading and figures at full
 * strength, every label, unit and footnote around them rendered through `Text`.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { Card, Separator, Text } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TEXT_CODE = `<Card>
	<Card.Header>
		<Card.Title>September usage</Card.Title>
		<Text>Billed on 1 October · Pro plan</Text>
	</Card.Header>
	<Card.Content>
		<div mix={[hstack({ gap: 2, align: "baseline", justify: "between" })]}>
			<Text>Requests</Text>
			<span>
				1,284,902 <Text>of 2M</Text>
			</span>
		</div>

		<div mix={[hstack({ gap: 2, align: "baseline", justify: "between" })]}>
			<Text>Bandwidth</Text>
			<span>
				38.4 <Text>GB</Text>
			</span>
		</div>

		<Separator />

		<Text>Overage is charged at $0.40 per additional 100k requests.</Text>
	</Card.Content>
</Card>`;

/** Muted copy carrying every label around emphasized figures, hydrated with the rest. */
export const TextPreview = clientEntry(
	"/resources/components/previews/text.tsx#TextPreview",
	function TextPreview() {
		return () => (
			<Card mix={[is("22rem")]}>
				<Card.Header>
					<Card.Title>September usage</Card.Title>
					<Text>Billed on 1 October · Pro plan</Text>
				</Card.Header>
				<Card.Content mix={[vstack({ gap: 3, align: "stretch" })]}>
					<div mix={[hstack({ gap: 2, align: "baseline", justify: "between" })]}>
						<Text>Requests</Text>
						<span mix={[text("lg"), weight("semibold")]}>
							1,284,902 <Text>of 2M</Text>
						</span>
					</div>

					<div mix={[hstack({ gap: 2, align: "baseline", justify: "between" })]}>
						<Text>Bandwidth</Text>
						<span mix={[text("lg"), weight("semibold")]}>
							38.4 <Text>GB</Text>
						</span>
					</div>

					<Separator />

					<Text>Overage is charged at $0.40 per additional 100k requests.</Text>
				</Card.Content>
			</Card>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TEXT_CODE, render: () => <TextPreview /> };
