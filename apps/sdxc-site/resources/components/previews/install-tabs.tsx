/**
 * Live preview for `InstallTabs`: one install line per package manager behind radio tabs,
 * which switch with CSS alone so the strip works before any script loads.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { is } from "@sdxc/u/size";
import { InstallTabs } from "@sdxc/ui/patterns";

/** The source the page shows, matching the markup below. */
const CODE = `<InstallTabs name="preview-install" aria-label="Package manager">
	<InstallTabs.Option value="npm" label="npm" defaultChecked>
		npm add @beacon/cli
	</InstallTabs.Option>
	<InstallTabs.Option value="bun" label="bun">
		bun add @beacon/cli
	</InstallTabs.Option>
	<InstallTabs.Option value="pnpm" label="pnpm">
		pnpm add @beacon/cli
	</InstallTabs.Option>
</InstallTabs>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full")]}>
			<InstallTabs name="preview-install" aria-label="Package manager">
				<InstallTabs.Option value="npm" label="npm" defaultChecked>
					npm add @beacon/cli
				</InstallTabs.Option>
				<InstallTabs.Option value="bun" label="bun">
					bun add @beacon/cli
				</InstallTabs.Option>
				<InstallTabs.Option value="pnpm" label="pnpm">
					pnpm add @beacon/cli
				</InstallTabs.Option>
			</InstallTabs>
		</div>
	),
};
