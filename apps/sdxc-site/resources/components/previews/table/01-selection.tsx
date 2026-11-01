/**
 * Live example for `Table` selection: a CMS posts list whose checkboxes submit with a bulk
 * form elsewhere on the page. Two rows start checked, so select-all opens indeterminate, and
 * shift-click checks every post between two clicks.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { Table } from "@sdxc/ui/app/table";

/** One post in the list. */
interface Post {
	id: string;
	title: string;
	author: string;
	words: number;
	selected?: boolean;
}

/** The drafts on the page. */
const POSTS: Post[] = [
	{
		id: "post_118",
		title: "Shipping status pages in an afternoon",
		author: "Ana Ruiz",
		words: 1840,
	},
	{
		id: "post_117",
		title: "What we learned from a week of 5xx alerts",
		author: "Kenji Mori",
		words: 2310,
		selected: true,
	},
	{
		id: "post_116",
		title: "Release notes: October",
		author: "Ana Ruiz",
		words: 960,
		selected: true,
	},
	{ id: "post_115", title: "Choosing a check interval", author: "Lena Vogt", words: 1275 },
	{ id: "post_114", title: "Incident review: DNS at the edge", author: "Kenji Mori", words: 3105 },
];

/** The source the page shows, matching the markup below. */
const CODE = `<form id="bulk-posts" method="post" action="/posts/bulk" />

<Table.Container>
	<Table aria-label="Drafts">
		<Table.Header>
			<Table.Row>
				<Table.SelectAll label="Select all drafts" />
				<Table.Column>Title</Table.Column>
				<Table.Column>Author</Table.Column>
				<Table.Column numeric>Words</Table.Column>
			</Table.Row>
		</Table.Header>
		<Table.Body>
			{posts.map((post) => (
				<Table.Row key={post.id}>
					<Table.Select
						name="post"
						value={post.id}
						form="bulk-posts"
						checked={post.selected}
						label={\`Select \${post.title}\`}
					/>
					<Table.Cell>
						<Table.RowLink href={\`/posts/\${post.id}/edit\`}>{post.title}</Table.RowLink>
					</Table.Cell>
					<Table.Cell>{post.author}</Table.Cell>
					<Table.NumberCell value={post.words} locale="en" />
				</Table.Row>
			))}
		</Table.Body>
	</Table>
</Table.Container>`;

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Selection with select-all and shift-click ranges",
	code: CODE,
	render: () => (
		<>
			<form id="example-bulk-posts" method="post" action="/examples/posts/bulk" />
			<Table.Container>
				<Table aria-label="Drafts">
					<Table.Header>
						<Table.Row>
							<Table.SelectAll label="Select all drafts" />
							<Table.Column>Title</Table.Column>
							<Table.Column>Author</Table.Column>
							<Table.Column numeric>Words</Table.Column>
						</Table.Row>
					</Table.Header>
					<Table.Body>
						{POSTS.map((post) => (
							<Table.Row key={post.id}>
								<Table.Select
									name="post"
									value={post.id}
									form="example-bulk-posts"
									checked={post.selected}
									label={`Select ${post.title}`}
								/>
								<Table.Cell>
									<Table.RowLink href={`/examples/posts/${post.id}/edit`}>
										{post.title}
									</Table.RowLink>
								</Table.Cell>
								<Table.Cell>{post.author}</Table.Cell>
								<Table.NumberCell value={post.words} locale="en" />
							</Table.Row>
						))}
					</Table.Body>
				</Table>
			</Table.Container>
		</>
	),
};
