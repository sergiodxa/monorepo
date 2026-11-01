/**
 * Live preview for `CodeTabs`: the same server entry written for two frameworks. Two sets
 * share the `framework` key, so choosing Hono in one switches the other.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { Handle } from "remix/component";

import { vstack } from "@sdxc/u/layout";
import { is } from "@sdxc/u/size";
import { CodeBlock, CodeTabs } from "@sdxc/ui/docs";

/** The copy strings every block carries. */
const LABELS = { copy: "Copy code", copied: "Copied" };

/** The source the page shows, matching the markup below. */
const CODE = `<CodeTabs
	syncKey="framework"
	aria-label="Framework"
	tabs={[
		{ label: "Remix", value: "remix", children: <CodeBlock title="app/routes.ts" language="ts" code={remixRoutes} labels={labels} /> },
		{ label: "Hono", value: "hono", children: <CodeBlock title="src/index.ts" language="ts" code={honoApp} labels={labels} /> },
	]}
/>`;

/** One set of tabs; the preview draws two to show them switching together. */
function FrameworkTabs(handle: Handle<{ routes: string; app: string }>) {
	return () => (
		<CodeTabs
			syncKey="framework"
			aria-label="Framework"
			tabs={[
				{
					label: "Remix",
					value: "remix",
					children: (
						<CodeBlock
							title="app/routes.ts"
							language="ts"
							code={handle.props.routes}
							labels={LABELS}
						/>
					),
				},
				{
					label: "Hono",
					value: "hono",
					children: (
						<CodeBlock title="src/index.ts" language="ts" code={handle.props.app} labels={LABELS} />
					),
				},
			]}
		/>
	);
}

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<div mix={[is("full"), vstack({ gap: 6, align: "stretch" })]}>
			<FrameworkTabs
				routes={`import { route } from "remix/fetch-router";\n\nexport const routes = route({\n\thome: "/",\n\tmonitors: "/monitors/:id",\n});`}
				app={`import { Hono } from "hono";\n\nlet app = new Hono();\napp.get("/", (c) => c.text("Up"));\n\nexport default app;`}
			/>
			<FrameworkTabs
				routes={`import { createRouter } from "remix/fetch-router";\n\nexport default createRouter();`}
				app={`import app from "./app";\n\nexport default { fetch: app.fetch };`}
			/>
		</div>
	),
};
