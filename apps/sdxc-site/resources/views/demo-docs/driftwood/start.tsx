/**
 * Driftwood's "Get started" pages: the tutorial that puts a first site on a public URL, and
 * the reference for how a project is laid out, which the tutorial's project grows into.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FileTree, Steps } from "@sdxc/ui/docs";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Heading, Install } from "~/resources/views/demo-docs/blocks";

/** The addresses of Driftwood's pages. */
const href = demoDocsHref("driftwood");

/** The tutorial: install, log in, create, deploy, each a numbered step the rail lists. */
export const QUICKSTART: DemoDocsPage = {
	title: "Deploy your first site",
	description:
		"Install the Driftwood CLI, log in, and put a folder of HTML on a public URL in about five minutes.",
	updated: "2026-10-27",
	toc: [
		{ id: "before-you-start", text: "Before you start", level: 2 },
		{ id: "install-the-cli", text: "Install the CLI", level: 2 },
		{ id: "log-in", text: "Log in", level: 2 },
		{ id: "create-a-project", text: "Create a project", level: 2 },
		{ id: "deploy-it", text: "Deploy it", level: 2 },
		{ id: "what-you-built", text: "What you built", level: 2 },
	],
	next: [
		{
			title: "Add a custom domain",
			href: href("guides/custom-domains"),
			description: "Serve the site from your own domain, with a certificate issued for it.",
		},
		{
			title: "Preview every pull request",
			href: href("guides/preview-deployments"),
			description: "Get a private URL for each branch before it reaches production.",
		},
		{
			title: "How a deploy works",
			href: href("concepts/how-deploys-work"),
			description: "What the command you just ran did, step by step.",
		},
	],
	render: (request) => (
		<>
			<p>
				By the end of this tutorial you’ll have a site at <code>your-name.driftwood.app</code>,
				served from 300 cities, and a command that redeploys it whenever you change a file.
			</p>

			<Heading id="before-you-start">Before you start</Heading>
			<p>
				You need Node.js 20 or later and a folder with an <code>index.html</code> in it. Any static
				site generator’s output folder works too.
			</p>

			<Steps>
				<Steps.Item id="install-the-cli" title="Install the CLI">
					<p>Install Driftwood globally, so the command is on your path in every project.</p>
					<Install packages={["@driftwood/cli"]} selected={request.tab("package-manager")} />
				</Steps.Item>
				<Steps.Item id="log-in" title="Log in">
					<p>
						Log in once per machine. The command opens your browser to approve the session and
						stores a token in your home folder.
					</p>
					<Code
						title="Terminal"
						language="sh"
						code={"driftwood login\n# ✓ Logged in as ada@example.com"}
					/>
				</Steps.Item>
				<Steps.Item id="create-a-project" title="Create a project">
					<p>
						Run <code>init</code> in your site’s folder. It asks for a name and writes a{" "}
						<code>driftwood.toml</code> beside your files.
					</p>
					<Code title="Terminal" language="sh" code={"cd my-site\ndriftwood init"} />
					<FileTree
						aria-label="The project after init"
						title="my-site"
						nodes={[
							{ name: "driftwood.toml", comment: "written by init", highlight: true },
							{ name: "index.html" },
							{ name: "about.html" },
							{ name: "assets", children: [{ name: "site.css" }, "…"] },
						]}
					/>
				</Steps.Item>
				<Steps.Item id="deploy-it" title="Deploy it">
					<p>
						Deploy the folder. Driftwood uploads every file the first time, and only the changed
						ones after that.
					</p>
					<Code
						title="Terminal"
						language="sh"
						highlight={[4]}
						code={
							"driftwood deploy\n# Uploading 14 files (182 KB)\n# ✓ Deployed in 3.1s\n# https://my-site.driftwood.app"
						}
					/>
					<Aside kind="tip">
						Add <code>--open</code> to open the URL in your browser as soon as the deploy finishes.
					</Aside>
				</Steps.Item>
			</Steps>

			<Heading id="what-you-built">What you built</Heading>
			<p>
				Your site is live, cached at the edge and served over HTTPS. Every later{" "}
				<code>driftwood deploy</code> makes a new immutable version and switches traffic to it at
				once, so a visitor never sees half of one version and half of another.
			</p>
		</>
	),
};

/** The project layout: one tree, then a section per entry saying what it holds. */
export const PROJECT_LAYOUT: DemoDocsPage = {
	title: "Project layout",
	description:
		"Which files Driftwood reads in a project, what each one is for, and which ones you can leave out.",
	updated: "2026-10-21",
	toc: [
		{ id: "the-tree", text: "The tree", level: 2 },
		{ id: "driftwood-toml", text: "driftwood.toml", level: 2 },
		{ id: "public", text: "public/", level: 2 },
		{ id: "functions", text: "functions/", level: 2 },
		{ id: "ignored-files", text: "Ignored files", level: 2 },
	],
	next: [
		{
			title: "Use environment variables",
			href: href("guides/environment-variables"),
			description: "Give your functions secrets without committing them.",
		},
		{
			title: "Caching and invalidation",
			href: href("concepts/caching"),
			description: "How long each file in public/ stays cached, and how to change it.",
		},
	],
	render: () => (
		<>
			<p>
				A Driftwood project is a folder with a <code>driftwood.toml</code> at its root. Everything
				else is optional: a site with no functions is just its <code>public/</code> folder.
			</p>

			<Heading id="the-tree">The tree</Heading>
			<FileTree
				aria-label="A Driftwood project"
				title="my-site"
				moreLabel="More files"
				nodes={[
					{ name: "driftwood.toml", comment: "project settings", highlight: true },
					{
						name: "public",
						comment: "served as is",
						children: [{ name: "index.html" }, { name: "assets", children: ["…"] }],
					},
					{
						name: "functions",
						comment: "run on request",
						children: [{ name: "api", children: [{ name: "subscribe.ts" }] }],
					},
					{
						name: ".driftwood",
						comment: "local cache, never deployed",
						collapsed: true,
						children: [],
					},
					{ name: ".driftwoodignore" },
				]}
			/>

			<Heading id="driftwood-toml">driftwood.toml</Heading>
			<p>
				The project’s settings. <code>name</code> decides the default URL; everything else has a
				default you can leave alone.
			</p>
			<Code
				title="driftwood.toml"
				language="toml"
				highlight={[1]}
				code={
					'name = "my-site"\npublic = "public"\n\n[build]\ncommand = "npm run build"\n\n[headers]\n"/assets/*" = { cache = "1y" }'
				}
			/>

			<Heading id="public">public/</Heading>
			<p>
				Every file in <code>public/</code> is served at its path: <code>public/about.html</code>{" "}
				answers <code>/about.html</code> and <code>/about</code>. Point <code>public</code> in the
				settings at your generator’s output folder instead, such as <code>dist</code>.
			</p>

			<Heading id="functions">functions/</Heading>
			<p>
				A file in <code>functions/</code> answers the path it sits at, so{" "}
				<code>functions/api/subscribe.ts</code> handles <code>/api/subscribe</code>. A function wins
				over a static file at the same path.
			</p>

			<Heading id="ignored-files">Ignored files</Heading>
			<p>
				Driftwood never uploads <code>.git</code>, <code>node_modules</code> or{" "}
				<code>.driftwood</code>. List more in <code>.driftwoodignore</code>, one pattern a line, in
				the same syntax as <code>.gitignore</code>.
			</p>
			<Aside kind="note">
				An ignored file still deploys when a <code>[build]</code> command writes it into{" "}
				<code>public/</code>, since the build runs before the upload.
			</Aside>
		</>
	),
};
