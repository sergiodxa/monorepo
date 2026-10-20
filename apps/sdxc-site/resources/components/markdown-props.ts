/**
 * The shape a component rendering a markdown node is handed: the node's own content
 * fields, the attributes its tag or annotation wrote, and its already-rendered
 * children, flattened into one bag.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/component";

export interface MarkdownProps {
	[key: string]: unknown;
	children: RemixNode;
}
