/**
 * Live preview for `CodeBlock`: a config file with the two lines a setup step adds,
 * then the terminal session that runs it, whose copy button leaves the prompts and the
 * output behind.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { CodeBlock } from "@sdxc/ui";

/** The file the first block shows. */
const CONFIG = `import { defineConfig } from "vite";
import { remix } from "remix/vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
	plugins: [remix(), cloudflare()],
});`;

/** The session the second block shows: two commands and the output between them. */
const SESSION = `$ bun add @cloudflare/vite-plugin
installed @cloudflare/vite-plugin@1.14.0
$ bun run dev`;

/** The copy strings both blocks carry. */
const LABELS = { copy: "Copy code", copied: "Copied" };

/** The source the page shows, matching the markup below. */
const CODE = `<CodeBlock
	title="vite.config.ts"
	language="ts"
	code={config}
	add={[3, 6]}
	labels={{ copy: "Copy code", copied: "Copied" }}
/>

<CodeBlock
	title="Terminal"
	language="sh"
	code={"$ bun add @cloudflare/vite-plugin\\ninstalled @cloudflare/vite-plugin@1.14.0\\n$ bun run dev"}
	labels={{ copy: "Copy code", copied: "Copied" }}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 6, align: "stretch" })]}>
			<CodeBlock title="vite.config.ts" language="ts" code={CONFIG} add={[3, 6]} labels={LABELS} />
			<CodeBlock title="Terminal" language="sh" code={SESSION} labels={LABELS} />
		</div>
	),
};
