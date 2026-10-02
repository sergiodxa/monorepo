/**
 * Live preview island for `Heading`. It picks its own tag from the nearest ambient
 * `HeadingScope`, which is what keeps a reusable panel from hard-coding `<h3>` and
 * breaking a document outline.
 *
 * An independently hydrated island has no ancestor scope to read, so the page threads its
 * own depth in as a `level` prop and the island opens a scope at that depth. Every heading
 * beneath then resolves from where it sits, and a heading naming its own level overrides
 * that wherever it appears.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { HeadingLevel } from "@sdxc/ui";
import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is, pis } from "@sdxc/u/size";
import { Heading, HeadingScope, Text } from "@sdxc/ui";
import { clientEntry } from "remix/component";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const HEADING_CODE = `// The page knows the depth it is placing the island at, and hands it over:
// <RelatedArticles level={2} />

function RelatedArticles(handle: Handle<{ level: HeadingLevel }>) {
	return () => (
		<HeadingScope level={handle.props.level}>
			<Heading>Related articles</Heading>
			<Text>
				Rendered as &lt;h{handle.props.level}&gt;: the scope this island opens says how deep it sits.
			</Text>

			<HeadingScope>
				<Heading>Published this month</Heading>
				<Text>Rendered as &lt;h{handle.props.level + 1}&gt;: one level past the scope above.</Text>
			</HeadingScope>

			<Heading level={6}>A fine-print aside</Heading>
			<Text>Rendered as &lt;h6&gt;: an explicit level always wins.</Text>
		</HeadingScope>
	);
}`;

/** A panel's headings, hydrated with the depth the page placed it at threaded in. */
export const HeadingPreview = clientEntry(
	"/resources/components/previews/heading.tsx#HeadingPreview",
	function HeadingPreview(handle: Handle<{ level: HeadingLevel }>) {
		return () => (
			<HeadingScope
				level={handle.props.level}
				mix={[vstack({ gap: 2, align: "stretch" }), is("26rem")]}
			>
				<Heading>Related articles</Heading>
				<Text>
					Rendered as &lt;h{String(handle.props.level)}&gt;: the scope this island opens says how
					deep it sits.
				</Text>

				<HeadingScope mix={[vstack({ gap: 2, align: "stretch" }), pis(4)]}>
					<Heading>Published this month</Heading>
					<Text>
						Rendered as &lt;h{String(handle.props.level + 1)}&gt;: one level past the scope above.
					</Text>
				</HeadingScope>

				<Heading level={6}>A fine-print aside</Heading>
				<Text>Rendered as &lt;h6&gt;: an explicit level always wins.</Text>
			</HeadingScope>
		);
	},
);

/**
 * What the preview registry reads. The page states the depth it is placing the island at,
 * which is what an island with no ancestor scope to read needs.
 */
export default { code: HEADING_CODE, render: () => <HeadingPreview level={2} /> };
