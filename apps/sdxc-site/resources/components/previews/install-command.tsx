/**
 * Live preview for `InstallCommand`: the install line for a Remix app's UI packages, then
 * its dev tooling. Both follow one package-manager choice.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { InstallCommand } from "@sdxc/ui/docs";

/** The copy strings every block carries. */
const LABELS = { copy: "Copy code", copied: "Copied" };

/** The source the page shows, matching the markup below. */
const CODE = `<InstallCommand
	packages={["@sdxc/ui", "@sdxc/u", "@sdxc/icons"]}
	title="Terminal"
	aria-label="Package manager"
	labels={{ copy: "Copy code", copied: "Copied" }}
/>

<InstallCommand
	packages={["vite-plus", "@cloudflare/vite-plugin"]}
	dev
	title="Terminal"
	aria-label="Package manager"
	labels={{ copy: "Copy code", copied: "Copied" }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 6, align: "stretch" })]}>
			<InstallCommand
				packages={["@sdxc/ui", "@sdxc/u", "@sdxc/icons"]}
				title="Terminal"
				aria-label="Package manager"
				labels={LABELS}
			/>
			<InstallCommand
				packages={["vite-plus", "@cloudflare/vite-plugin"]}
				dev
				title="Terminal"
				aria-label="Package manager"
				labels={LABELS}
			/>
		</div>
	),
};
