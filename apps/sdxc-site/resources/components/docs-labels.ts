/**
 * The strings the shared docs blocks print on this site. `@sdxc/ui` ships no copy of its
 * own, so every code block, props table and section link reads its words from here and
 * the site says each thing one way.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { CodeBlock, PropsTable } from "@sdxc/ui/docs";

/** The copy button every code block carries. */
export const CODE_LABELS: CodeBlock.Labels = { copy: "Copy code", copied: "Copied" };

/** The columns and cell values of every props table. */
export const PROPS_LABELS: PropsTable.Labels = {
	name: "Name",
	type: "Type",
	default: "Default",
	required: "Required",
	description: "Description",
	yes: "Yes",
	no: "No",
	showChildren: "Show child fields",
	hideChildren: "Hide child fields",
};

/** The accessible name of the `#` link beside every section heading. */
export const SECTION_LINK_LABEL = "Link to this section";

/** The header a block of shell commands reads as. */
export const TERMINAL_TITLE = "Terminal";
