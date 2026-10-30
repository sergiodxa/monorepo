/**
 * Live preview for `CodeStage`: a highlighted, numbered snippet on a dark slab, a raised
 * code card for an install line and a terminal panel for a command's output, the ways a
 * landing shows code.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { CodeStage } from "@sdxc/ui/patterns";

/** The snippet the slab numbers, one string so each line gets its own counter. */
const SNIPPET = `import { createMonitor } from "@beacon/sdk";

let monitor = createMonitor({
	url: "https://api.example.com/health",
	every: "30s",
	regions: ["iad", "fra", "sin"],
});

monitor.on("down", (incident) => incident.page("on-call"));`;

/** The source the page shows, matching the markup below. */
const CODE = `<div mix={[vstack({ gap: 4, align: "stretch" })]}>
	<CodeStage variant="slab" title="monitor.ts" language="ts" lineNumbers>
		{snippet}
	</CodeStage>
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
				<CodeStage variant="slab" title="monitor.ts" language="ts" lineNumbers>
					{SNIPPET}
				</CodeStage>
				<CodeStage title="install.sh">npm add @beacon/cli</CodeStage>
				<CodeStage variant="terminal" title="~">
					$ beacon check https://api.example.com
				</CodeStage>
			</div>
		</div>
	),
};
