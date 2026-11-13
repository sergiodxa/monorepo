/**
 * Live example for a `Tree` of a pull request's changed files: each file is a `Tree.Leaf` link
 * with its status letter and line counts, the file being read is marked current, a
 * `Tree.Filter` narrows the rows as the reader types, and `Tree.Navigation` adds the arrow keys.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle, RemixNode } from "remix/component";

import { FolderIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { is, maxIs } from "@sdxc/u/size";
import { Tree } from "@sdxc/ui/app/tree";

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const CODE = `<Tree.Filter tree="changed-files" label="Filter changed files" placeholder="Filter changed files…" action="/acme/delta/pull/412/files" />

<Tree id="changed-files" aria-label="Changed files" frame="diff">
	<Tree.Navigation labels={{ group: "Changed files" }} />
	<Tree.Item id="src" open>
		<Tree.ItemContent aria-expanded="true">
			<Tree.ExpandButton />
			<FolderIcon aria-hidden="true" />
			src
		</Tree.ItemContent>
		<Tree.Item id="src-lexer" open>
			<Tree.ItemContent aria-expanded="true">
				<Tree.ExpandButton />
				<FolderIcon aria-hidden="true" />
				lexer
			</Tree.ItemContent>
			<Tree.Leaf
				href="/acme/delta/pull/412/files#diff-identifier"
				name="identifier.ts"
				path="src/lexer/identifier.ts"
				current
				status="modified"
				statusLabel="Modified"
				additions={18}
				deletions={4}
			/>
			<Tree.Leaf href="…" name="unicode.ts" path="src/lexer/unicode.ts" status="added" statusLabel="Added" additions={96} />
			…
		</Tree.Item>
	</Tree.Item>
</Tree>`;

/** One changed file as the pull request lists it. */
interface ChangedFile {
	name: string;
	path: string;
	status: Tree.LeafStatus;
	additions?: number;
	deletions?: number;
}

/** What assistive technology reads for each status letter. */
const STATUS_LABELS: Record<Tree.LeafStatus, string> = {
	added: "Added",
	modified: "Modified",
	deleted: "Deleted",
	renamed: "Renamed",
};

/** The pull request's files under `src/lexer`. */
const LEXER: ChangedFile[] = [
	{ name: "chars.ts", path: "src/lexer/chars.ts", status: "modified", additions: 7, deletions: 2 },
	{
		name: "identifier.ts",
		path: "src/lexer/identifier.ts",
		status: "modified",
		additions: 18,
		deletions: 4,
	},
	{ name: "legacy-ascii.ts", path: "src/lexer/legacy-ascii.ts", status: "deleted", deletions: 61 },
	{ name: "unicode.ts", path: "src/lexer/unicode.ts", status: "added", additions: 96 },
];

/** The pull request's tests. */
const TESTS: ChangedFile[] = [
	{
		name: "identifier.test.ts",
		path: "test/lexer/identifier.test.ts",
		status: "modified",
		additions: 42,
		deletions: 3,
	},
	{
		name: "unicode.test.ts",
		path: "test/lexer/unicode.test.ts",
		status: "renamed",
		additions: 5,
		deletions: 5,
	},
];

/** Props for {@link Leaf}. */
interface LeafProps {
	file: ChangedFile;
	current?: boolean;
}

/** A changed file's row, linking to its diff in the preview. */
function Leaf(handle: Handle<LeafProps>) {
	return () => {
		let { file, current } = handle.props;
		return (
			<Tree.Leaf
				href={`/examples/acme/delta/pull/412/files?file=${encodeURIComponent(file.path)}`}
				name={file.name}
				path={file.path}
				current={current}
				status={file.status}
				statusLabel={STATUS_LABELS[file.status]}
				additions={file.additions}
				deletions={file.deletions}
			/>
		);
	};
}

/** Props for {@link Folder}. */
interface FolderProps {
	id: string;
	name: string;
	children: RemixNode;
}

/** A folder row that starts open. */
function Folder(handle: Handle<FolderProps>) {
	return () => (
		<Tree.Item id={handle.props.id} open>
			<Tree.ItemContent aria-expanded="true">
				<Tree.ExpandButton />
				<FolderIcon aria-hidden="true" />
				{handle.props.name}
			</Tree.ItemContent>
			{handle.props.children}
		</Tree.Item>
	);
}

/** What the preview registry reads: the title, the source to show, and the markup to draw. */
export default {
	title: "Changed files, with a filter and the arrow keys",
	code: CODE,
	render: () => (
		<div mix={[vstack({ gap: 2 }), is("full"), maxIs("24rem")]}>
			<Tree.Filter
				tree="preview-changed-files"
				label="Filter changed files"
				placeholder="Filter changed files…"
				action="/examples/acme/delta/pull/412/files"
			/>
			<Tree id="preview-changed-files" aria-label="Changed files">
				<Tree.Navigation labels={{ group: "Changed files" }} />
				<Folder id="preview-changed-src" name="src">
					<Folder id="preview-changed-src-lexer" name="lexer">
						{LEXER.map((file) => (
							<Leaf file={file} current={file.name === "identifier.ts"} />
						))}
					</Folder>
				</Folder>
				<Folder id="preview-changed-test" name="test/lexer">
					{TESTS.map((file) => (
						<Leaf file={file} />
					))}
				</Folder>
			</Tree>
		</div>
	),
};
