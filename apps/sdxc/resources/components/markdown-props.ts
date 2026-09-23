/**
 * The shape a component rendering a markdown node is handed: the node's own content
 * fields, the attributes its tag or annotation wrote, and its already-rendered
 * children, flattened into one bag. A component names the props it reads and the
 * attribute schema registered for the tag is what guarantees they arrived.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { RemixNode } from "remix/ui";

export interface MarkdownProps {
	[key: string]: unknown;
	children: RemixNode;
}
