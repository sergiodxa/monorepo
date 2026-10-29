/**
 * Live preview for `CodeStage`: a titled code panel for an install line and a terminal
 * panel for a command's output, the two ways a landing shows code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { CodeStage } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 4, align: "stretch" })]}>
	<CodeStage title="install.sh">npm add @beacon/cli</CodeStage>
	<CodeStage variant="terminal" title="~">
		$ beacon check https://api.example.com
	</CodeStage>
</div>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<div mix={[vstack({ gap: 4, align: "stretch" })]}>
				<CodeStage title="install.sh">npm add @beacon/cli</CodeStage>
				<CodeStage variant="terminal" title="~">
					$ beacon check https://api.example.com
				</CodeStage>
			</div>
		</div>
	),
};
