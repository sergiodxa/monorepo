/**
 * Live preview for `DocsLayout`: a help docs page with its sidebar docked, the guide in a
 * reading measure and its headings in the rail. On a phone frame the sidebar moves into a
 * drawer and the headings into the sticky bar under the menu button.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import type { DocsTree } from "@sdxc/ui/utils";

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { m } from "@sdxc/u/size";
import { text, weight } from "@sdxc/u/typography";
import { DocsNav } from "@sdxc/ui";
import { DocsLayout } from "@sdxc/ui/patterns";

/** The sidebar the shell draws docked and in the drawer. */
const TREE: DocsTree = {
	label: "Documentation",
	sections: [
		{
			title: "Get started",
			items: [
				{ title: "Quickstart", href: "#quickstart" },
				{ title: "Install the CLI", href: "#cli" },
			],
		},
		{
			title: "Alerts",
			items: [
				{ title: "How alerts work", href: "#alerts" },
				{ title: "Escalation policies", href: "#escalation" },
			],
		},
	],
};

/** The guide's sections, each a heading the rail links to and a paragraph under it. */
const SECTIONS = [
	{
		id: "layout-preview-install",
		title: "Install",
		body: "Install the command line with your package manager. It runs on macOS, Linux and Windows.",
	},
	{
		id: "layout-preview-login",
		title: "Log in",
		body: "Run the login command and approve the request in your browser. The session stays on this machine.",
	},
	{
		id: "layout-preview-ci",
		title: "Use it in CI",
		body: "Create an access token in Settings and expose it to the runner as an environment variable.",
	},
];

/** The source the page shows, matching the markup below. */
const CODE = `<DocsLayout
	sidebar={<DocsNav tree={tree} activePath={url.pathname} />}
	toc={anchors}
	tocLabel="On this page"
	menuLabel="Menu"
	drawerLabel="Documentation"
	closeLabel="Close menu"
	header={<SiteHeader … />}
	stickyTop="4rem"
>
	<h1>Install the CLI</h1>
	…
</DocsLayout>`;

/** What the preview registry reads: the source to show, and the shell to draw. */
export default {
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<DocsLayout
			sidebar={<DocsNav tree={TREE} activePath="#cli" />}
			toc={SECTIONS.map((section) => ({ id: section.id, text: section.title, level: 2 }))}
			tocLabel="On this page"
			menuLabel="Menu"
			drawerLabel="Documentation"
			closeLabel="Close menu"
			drawerId="docs-layout-preview-drawer"
			main={false}
		>
			<div mix={[vstack({ gap: 6 })]}>
				<h1 mix={[m(0), text("3xl"), weight("bold"), fg("neutral.emphasis")]}>Install the CLI</h1>
				{SECTIONS.map((section) => (
					<section key={section.id} mix={[vstack({ gap: 2 })]}>
						<h2 id={section.id} mix={[m(0), text("xl"), weight("semibold")]}>
							{section.title}
						</h2>
						<p mix={[m(0), fg("neutral")]}>{section.body}</p>
					</section>
				))}
			</div>
		</DocsLayout>
	),
};
