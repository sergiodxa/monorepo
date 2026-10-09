/**
 * Live preview island for `Tree`. A branch's reveal is the platform's — each node is
 * a `<details>` — so the example is a real source tree several levels deep, with
 * `treeKeys(model)` supplying the WAI-ARIA keyboard pattern against a
 * `SelectionModel`: arrows move and expand, typing jumps to a name, Enter selects.
 * Expanding a branch from the keyboard settles its `aria-expanded` and its `<details>`
 * together inside the mixin, leaving the island with the markup alone.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { FileBracesIcon, FileCodeIcon, FolderIcon } from "@sdxc/icons";
import { hstack, vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { Text, Tree } from "@sdxc/ui";
import { SelectionModel } from "@sdxc/ui/behaviors";
import { treeKeys } from "@sdxc/ui/mixins";
import { clientEntry } from "remix/component";

/** Every row the tree renders, so the keyboard pattern has real depth to walk. */
const KEYS = [
	"packages",
	"packages/ui",
	"packages/ui/components",
	"packages/ui/components/tree.tsx",
	"packages/ui/components/table.tsx",
	"packages/ui/mixins",
	"packages/ui/mixins/treeKeys.ts",
	"packages/ui/package.json",
	"packages/result",
	"packages/result/index.ts",
];

/** The source the page shows, matching the markup below apart from the preview's own sizing. */
const TREE_CODE = `let model = new SelectionModel({
	mode: "multiple",
	keys,
	selectedKeys: ["packages/ui/package.json"],
});
model.addEventListener("change", () => void handle.update());

<Tree aria-label="Repository files" aria-multiselectable="true" mix={[treeKeys(model)]}>
	<Tree.Item id="packages" open>
		<Tree.ItemContent data-tree-item="packages" aria-expanded="true">
			<Tree.ExpandButton />
			<FolderIcon aria-hidden="true" />
			packages
		</Tree.ItemContent>

		<Tree.Item id="packages-ui" open>
			<Tree.ItemContent data-tree-item="packages/ui" aria-expanded="true">
				<Tree.ExpandButton />
				<FolderIcon aria-hidden="true" />
				ui
			</Tree.ItemContent>

			<Tree.Item id="packages-ui-components">
				<Tree.ItemContent data-tree-item="packages/ui/components" aria-expanded="false">
					<Tree.ExpandButton />
					<FolderIcon aria-hidden="true" />
					components
				</Tree.ItemContent>

				<Tree.Item id="packages-ui-components-tree">
					<Tree.ItemContent data-tree-item="packages/ui/components/tree.tsx">
						<FileCodeIcon aria-hidden="true" />
						tree.tsx
					</Tree.ItemContent>
				</Tree.Item>
				<Tree.Item id="packages-ui-components-table">
					<Tree.ItemContent data-tree-item="packages/ui/components/table.tsx">
						<FileCodeIcon aria-hidden="true" />
						table.tsx
					</Tree.ItemContent>
				</Tree.Item>
			</Tree.Item>

			<Tree.Item id="packages-ui-mixins">
				<Tree.ItemContent data-tree-item="packages/ui/mixins" aria-expanded="false">
					<Tree.ExpandButton />
					<FolderIcon aria-hidden="true" />
					mixins
				</Tree.ItemContent>
				<Tree.Item id="packages-ui-mixins-tree-keys">
					<Tree.ItemContent data-tree-item="packages/ui/mixins/treeKeys.ts">
						<FileCodeIcon aria-hidden="true" />
						treeKeys.ts
					</Tree.ItemContent>
				</Tree.Item>
			</Tree.Item>

			<Tree.Item id="packages-ui-package-json">
				<Tree.ItemContent data-tree-item="packages/ui/package.json">
					<FileBracesIcon aria-hidden="true" />
					package.json
				</Tree.ItemContent>
			</Tree.Item>
		</Tree.Item>

		<Tree.Item id="packages-result">
			<Tree.ItemContent data-tree-item="packages/result" aria-expanded="false">
				<Tree.ExpandButton />
				<FolderIcon aria-hidden="true" />
				result
			</Tree.ItemContent>
			<Tree.Item id="packages-result-index">
				<Tree.ItemContent data-tree-item="packages/result/index.ts">
					<FileCodeIcon aria-hidden="true" />
					index.ts
				</Tree.ItemContent>
			</Tree.Item>
		</Tree.Item>
	</Tree.Item>
</Tree>`;

/** A repository tree that opens, walks and selects, hydrated so all three work. */
export const TreePreview = clientEntry(import.meta.url, function TreePreview(handle: Handle) {
	let model = new SelectionModel({
		mode: "multiple",
		keys: KEYS,
		// The mixin narrows the model's key universe to the rows keyboard
		// navigation can reach, so a row inside a collapsed subtree cannot
		// start out selected.
		selectedKeys: ["packages/ui/package.json"],
	});

	// `handle.signal` is an inert stub during the server render, so the
	// subscription is plain: it dies with the island that owns the model.
	model.addEventListener("change", () => void handle.update());

	/**
	 * Each row is a `<summary>` and its chevron is decoration inside it, so a press
	 * anywhere along the row opens and closes the branch.
	 */
	return () => (
		<div mix={[vstack({ gap: 2, align: "stretch" }), is("24rem")]}>
			<Tree aria-label="Repository files" aria-multiselectable="true" mix={[treeKeys(model)]}>
				<Tree.Item id="packages" open>
					<Tree.ItemContent data-tree-item="packages" aria-expanded="true">
						<Tree.ExpandButton />
						<FolderIcon aria-hidden="true" />
						packages
					</Tree.ItemContent>

					<Tree.Item id="packages-ui" open>
						<Tree.ItemContent data-tree-item="packages/ui" aria-expanded="true">
							<Tree.ExpandButton />
							<FolderIcon aria-hidden="true" />
							ui
						</Tree.ItemContent>

						<Tree.Item id="packages-ui-components">
							<Tree.ItemContent data-tree-item="packages/ui/components" aria-expanded="false">
								<Tree.ExpandButton />
								<FolderIcon aria-hidden="true" />
								components
							</Tree.ItemContent>

							<Tree.Item id="packages-ui-components-tree">
								<Tree.ItemContent data-tree-item="packages/ui/components/tree.tsx">
									<FileCodeIcon aria-hidden="true" />
									tree.tsx
								</Tree.ItemContent>
							</Tree.Item>
							<Tree.Item id="packages-ui-components-table">
								<Tree.ItemContent data-tree-item="packages/ui/components/table.tsx">
									<FileCodeIcon aria-hidden="true" />
									table.tsx
								</Tree.ItemContent>
							</Tree.Item>
						</Tree.Item>

						<Tree.Item id="packages-ui-mixins">
							<Tree.ItemContent data-tree-item="packages/ui/mixins" aria-expanded="false">
								<Tree.ExpandButton />
								<FolderIcon aria-hidden="true" />
								mixins
							</Tree.ItemContent>
							<Tree.Item id="packages-ui-mixins-tree-keys">
								<Tree.ItemContent data-tree-item="packages/ui/mixins/treeKeys.ts">
									<FileCodeIcon aria-hidden="true" />
									treeKeys.ts
								</Tree.ItemContent>
							</Tree.Item>
						</Tree.Item>

						<Tree.Item id="packages-ui-package-json">
							<Tree.ItemContent data-tree-item="packages/ui/package.json">
								<FileBracesIcon aria-hidden="true" />
								package.json
							</Tree.ItemContent>
						</Tree.Item>
					</Tree.Item>

					<Tree.Item id="packages-result">
						<Tree.ItemContent data-tree-item="packages/result" aria-expanded="false">
							<Tree.ExpandButton />
							<FolderIcon aria-hidden="true" />
							result
						</Tree.ItemContent>
						<Tree.Item id="packages-result-index">
							<Tree.ItemContent data-tree-item="packages/result/index.ts">
								<FileCodeIcon aria-hidden="true" />
								index.ts
							</Tree.ItemContent>
						</Tree.Item>
					</Tree.Item>
				</Tree.Item>
			</Tree>

			<div mix={[hstack({ gap: 2, align: "center", justify: "between" })]}>
				<Text>{model.size === 0 ? "Nothing selected" : `${model.size} files selected`}</Text>
				<Text>Arrows move · type to jump · Enter selects</Text>
			</div>
		</div>
	);
});

/** What the preview registry reads: the source to show, and the island to draw. */
export default { code: TREE_CODE, render: () => <TreePreview /> };
