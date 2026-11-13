/**
 * Delta's file tree, the pane beside the code: every folder and file of the repository as an
 * `@sdxc/ui` tree with a "Go to file" filter on top. It sits outside the swapped `main` area,
 * so its open folders and scroll survive every file a visitor opens.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { fg } from "@sdxc/u/color";
import { raw } from "@sdxc/u/general";
import { text, weight } from "@sdxc/u/typography";
import { Tree } from "@sdxc/ui/app/tree";

import type { TreeNode } from "./data";

import { ancestorsOf, fileHref, findHref } from "./data";
import { COPY, TREE_LABELS } from "./labels";
import { DeltaTreeSync } from "./tree-sync";

/** The tree's id, which its filter narrows and the sync island follows. */
export const TREE_ID = "delta-tree";

/** The pane's id, which scrolls the tree. */
export const PANE_ID = "delta-files";

/** A folder's element id, derived from its path so each render keeps the same ids. */
function folderId(path: string): string {
	return `delta-folder-${path.replace(/[^a-z0-9]+/gi, "-")}`;
}

namespace TreeNodes {
	export interface Props {
		nodes: readonly TreeNode[];
		/** The open file's path, whose row is current and whose folders render open. */
		current?: string;
	}
}

/** One level of the tree: a `<details>` per folder holding its own level, a link per file. */
function TreeNodes(handle: Handle<TreeNodes.Props>) {
	return () => {
		let { current, nodes } = handle.props;
		let open = new Set(current === undefined ? [] : ancestorsOf(current));
		return (
			<>
				{nodes.map((node) =>
					node.children === undefined ? (
						<Tree.Leaf
							href={fileHref(node.path)}
							name={node.name}
							path={node.path}
							current={node.path === current}
							data-delta-leaf={node.path}
							data-rmx-prefetch="intent"
						/>
					) : (
						<Tree.Item id={folderId(node.path)} open={open.has(node.path)}>
							<Tree.ItemContent>
								<Tree.ExpandButton />
								{node.name}
							</Tree.ItemContent>
							<TreeNodes nodes={node.children} current={current} />
						</Tree.Item>
					),
				)}
			</>
		);
	};
}

namespace FilesPane {
	export interface Props {
		nodes: readonly TreeNode[];
		/** The file open on the first screen; later screens mark their own through the island. */
		current?: string;
	}
}

/**
 * Renders the pane: its title, the filter (a GET to the finder without script, narrowing the
 * tree as the visitor types with it) and the tree with keyboard navigation.
 */
export function FilesPane(handle: Handle<FilesPane.Props>) {
	return () => {
		let { current, nodes } = handle.props;
		return (
			<>
				<h2 mix={[text("sm"), weight("semibold"), fg("neutral.emphasis"), raw({ margin: 0 })]}>
					{COPY.files.title}
				</h2>
				<Tree.Filter
					action={findHref()}
					tree={TREE_ID}
					name="q"
					label={COPY.files.filter}
					placeholder={COPY.files.filter}
				/>
				<Tree id={TREE_ID} aria-label={COPY.files.tree}>
					<Tree.Navigation labels={TREE_LABELS} />
					<TreeNodes nodes={nodes} current={current} />
				</Tree>
				<DeltaTreeSync tree={TREE_ID} pane={PANE_ID} />
			</>
		);
	};
}
