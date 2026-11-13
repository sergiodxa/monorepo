/**
 * Live demo for `treeFilter()`: a pull request's changed files, narrowed to the paths that match
 * as the reader types in the field above them.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import preview from "~/resources/components/previews/tree/01-changed-files";

/** What the preview registry reads: the component carrying the mixin, and its source. */
export default {
	code: `// Tree.Filter's field carries treeFilter({ tree }), which narrows the tree on every keystroke.\n${preview.code}`,
	render: preview.render,
};
