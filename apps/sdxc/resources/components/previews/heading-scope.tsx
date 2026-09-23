/**
 * Live preview island for `HeadingScope`. The scope publishes a depth and everything with
 * a title reads it, so the example is a document deep enough for the depth to matter: the
 * article's own title, a section inside it, and a subsection inside that, each heading
 * getting its tag from where it sits rather than from what it was told.
 *
 * `Empty.Title` sits in the deepest scope to show that every title slot reads the same
 * ambient depth, not just `Heading`. Nothing here needs a mixin — the scope is context, and
 * it resolves on the server.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is, pis } from "@sdxc/u/size";
import { Empty, Heading, HeadingScope, Text } from "@sdxc/ui";
import { clientEntry } from "remix/ui";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const HEADING_SCOPE_CODE = `<HeadingScope>
	<Heading>Deploying to the edge</Heading>
	<Text>Rendered as &lt;h1&gt;: no scope wraps this one.</Text>

	<HeadingScope>
		<Heading>Choosing a region</Heading>
		<Text>Rendered as &lt;h2&gt;: one level past the scope above.</Text>

		<HeadingScope>
			<Heading>Latency budgets</Heading>
			<Text>Rendered as &lt;h3&gt;.</Text>

			<Empty>
				<Empty.Title>No measurements yet</Empty.Title>
				<Empty.Description>
					Empty.Title reads the same ambient depth, so it renders as &lt;h3&gt; too.
				</Empty.Description>
			</Empty>
		</HeadingScope>
	</HeadingScope>
</HeadingScope>`;

/** A three-level document outline, hydrated so the whole page runs through one island. */
export const HeadingScopePreview = clientEntry(
	"/resources/components/previews/heading-scope.tsx#HeadingScopePreview",
	function HeadingScopePreview() {
		return () => (
			<HeadingScope mix={[vstack({ gap: 2, align: "stretch" }), is("26rem")]}>
				<Heading>Deploying to the edge</Heading>
				<Text>Rendered as &lt;h1&gt;: no scope wraps this one.</Text>

				<HeadingScope mix={[vstack({ gap: 2, align: "stretch" }), pis(4)]}>
					<Heading>Choosing a region</Heading>
					<Text>Rendered as &lt;h2&gt;: one level past the scope above.</Text>

					<HeadingScope mix={[vstack({ gap: 2, align: "stretch" }), pis(4)]}>
						<Heading>Latency budgets</Heading>
						<Text>Rendered as &lt;h3&gt;.</Text>

						<Empty>
							<Empty.Title>No measurements yet</Empty.Title>
							<Empty.Description>
								Empty.Title reads the same ambient depth, so it renders as &lt;h3&gt; too.
							</Empty.Description>
						</Empty>
					</HeadingScope>
				</HeadingScope>
			</HeadingScope>
		);
	},
);

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: HEADING_SCOPE_CODE, render: () => <HeadingScopePreview /> };
