/**
 * The `runtime-showcase` tag: one request handler written against `Request` and
 * `Response`, shown as the entry file of each runtime it serves unchanged. Only the lines
 * that hand the handler to the runtime differ from tab to tab, which is the whole point.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { raw } from "@sdxc/u/general";
import { CodeStage } from "@sdxc/ui/patterns";

import type { MarkdownProps } from "~/resources/components/markdown-props";

/** The handler every tab serves: three packages, and nothing that belongs to a runtime. */
const HANDLER = `async function handle(request: Request) {
	let parsed = Markdown.parse(await request.text());
	if (isFailure(parsed)) {
		let line = parsed.error.position?.start.line;
		return badRequest({ error: parsed.error.message, line });
	}

	return ok({ frontmatter: parsed.data.frontmatter });
}`;

/** The imports every tab opens with. */
const IMPORTS = `import { Markdown } from "@sdxc/markdown";
import { badRequest, ok } from "@sdxc/response";
import { isFailure } from "@sdxc/result";`;

/** Each runtime's entry file: the shared handler, then the line that serves it. */
const RUNTIMES: CodeStage.Tab[] = [
	{
		label: "Workers",
		content: `${IMPORTS}\n\n${HANDLER}\n\nexport default { fetch: handle };`,
	},
	{
		label: "Bun",
		content: `${IMPORTS}\n\n${HANDLER}\n\nBun.serve({ port: 3000, fetch: handle });`,
	},
	{
		label: "Deno",
		content: `${IMPORTS}\n\n${HANDLER}\n\nDeno.serve({ port: 3000 }, handle);`,
	},
	{
		label: "Node",
		content: `import { createRequestListener } from "@remix-run/node-fetch-server";\nimport { createServer } from "node:http";\n${IMPORTS}\n\n${HANDLER}\n\ncreateServer(createRequestListener(handle)).listen(3000);`,
	},
];

/**
 * Renders the stage in a thin brand-tinted frame, so the window reads as one object when
 * a split bleeds it past the column and the viewport cuts its far edge.
 */
export default function RuntimeShowcase(_handle: Handle<MarkdownProps>) {
	return () => (
		<div
			mix={[
				raw({
					padding: "0.25rem",
					borderRadius: "calc(var(--ui-marketing-radius-frame, 0.75rem) + 0.25rem)",
					backgroundColor: "color-mix(in oklch, var(--ui-brand-bg-solid) 7%, transparent)",
					boxShadow:
						"inset 0 0 0 1px color-mix(in oklch, var(--ui-brand-bg-solid) 12%, transparent)",
				}),
			]}
		>
			<CodeStage
				name="runtime-showcase"
				aria-label="One handler on four runtimes"
				language="ts"
				lineNumbers
				tabs={RUNTIMES}
			/>
		</div>
	);
}
