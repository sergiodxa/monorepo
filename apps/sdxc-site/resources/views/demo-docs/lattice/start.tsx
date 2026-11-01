/**
 * Lattice's "Getting started" pages: installing the library and its stylesheet, and theming
 * it with tokens, the two things a team does once before using any component.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FileTree } from "@sdxc/ui/docs";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading, Install } from "~/resources/views/demo-docs/blocks";

/** The addresses of Lattice's pages. */
const href = demoDocsHref("lattice");

/** Installation: the package, the stylesheet, and the first component. */
export const INSTALLATION: DemoDocsPage = {
	title: "Installation",
	description: "Add Lattice to an app, load its stylesheet once, and render your first component.",
	updated: "2026-10-26",
	toc: [
		{ id: "install-the-package", text: "Install the package", level: 2 },
		{ id: "load-the-stylesheet", text: "Load the stylesheet", level: 2 },
		{ id: "render-a-component", text: "Render a component", level: 2 },
	],
	next: [
		{
			title: "Theming",
			href: href("getting-started/theming"),
			description: "Swap the accent and radii for your brand.",
		},
		{
			title: "Button",
			href: href("components/button"),
			description: "The component most apps reach for first.",
		},
	],
	render: (request) => (
		<>
			<p>
				Lattice ships as one package with every component and one stylesheet. Components render on
				the server; none needs a script to look right.
			</p>

			<Heading id="install-the-package">Install the package</Heading>
			<Install packages={["@lattice/ui"]} selected={request.tab("package-manager")} />

			<Heading id="load-the-stylesheet">Load the stylesheet</Heading>
			<p>Import it once, in the file that renders your document, before your own styles.</p>
			<Code
				title="app/root.tsx"
				language="tsx"
				add={[1]}
				code={'import "@lattice/ui/styles.css";\nimport "./app.css";'}
			/>
			<FileTree
				aria-label="Where the import goes"
				nodes={[
					{
						name: "app",
						children: [
							{ name: "root.tsx", comment: "imports the stylesheet", highlight: true },
							{ name: "app.css" },
							"…",
						],
					},
					{ name: "package.json" },
				]}
			/>

			<Heading id="render-a-component">Render a component</Heading>
			<Code
				title="app/routes/home.tsx"
				language="tsx"
				code={
					'import { Button } from "@lattice/ui";\n\nexport function Home() {\n\treturn <Button>Get started</Button>;\n}'
				}
			/>
			<Aside kind="note">
				Lattice needs no provider around your app. Theme tokens are CSS custom properties, so they
				cascade like any other style.
			</Aside>
		</>
	),
};

/** Theming: the token groups, overriding them, and scoping a theme to part of a page. */
export const THEMING: DemoDocsPage = {
	title: "Theming",
	description:
		"Every colour, radius and font in Lattice is a CSS custom property. Override a few and every component follows.",
	updated: "2026-10-23",
	toc: [
		{ id: "set-your-brand", text: "Set your brand colour", level: 2 },
		{ id: "scope-a-theme", text: "Scope a theme", level: 2 },
		{ id: "dark-mode", text: "Dark mode", level: 2 },
		{ id: "token-reference", text: "Token reference", level: 2 },
	],
	next: [
		{
			title: "Button",
			href: href("components/button"),
			description: "See the brand colour on a solid button.",
		},
		{
			title: "Switch",
			href: href("components/switch"),
			description: "Size a component with its own tokens.",
		},
	],
	render: () => (
		<>
			<p>
				Override tokens in your own stylesheet, after Lattice’s. There is no theme object to build
				and nothing to recompile.
			</p>

			<Heading id="set-your-brand">Set your brand colour</Heading>
			<p>
				The brand scale has eleven steps. Components read semantic tokens built from it, so setting
				the scale is enough.
			</p>
			<Code
				title="app/app.css"
				language="css"
				code={
					":root {\n\t--ui-color-brand-500: oklch(0.6 0.2 290);\n\t--ui-color-brand-600: oklch(0.52 0.21 290);\n\t--ui-color-brand-700: oklch(0.45 0.19 290);\n\t--ui-radius-md: 0.25rem;\n}"
				}
			/>

			<Heading id="scope-a-theme">Scope a theme</Heading>
			<p>Set tokens on any element to theme only what is inside it, such as a marketing band.</p>
			<Code
				title="app/app.css"
				language="css"
				code={".promo {\n\t--ui-color-brand-600: oklch(0.55 0.17 150);\n}"}
			/>

			<Heading id="dark-mode">Dark mode</Heading>
			<p>
				Dark mode follows the reader’s system setting by default. Each semantic token re-reads the
				scale for dark, so a scale you set works in both.
			</p>

			<Heading id="token-reference">Token reference</Heading>
			<Fields
				label="Theme tokens"
				rows={[
					{
						name: "--ui-color-brand-*",
						type: "color",
						description: "The accent scale, steps 50 to 950.",
						children: [
							{ name: "--ui-color-brand-500", type: "color", description: "Focus rings." },
							{
								name: "--ui-color-brand-600",
								type: "color",
								description: "Solid fills and links.",
							},
						],
					},
					{
						name: "--ui-color-neutral-*",
						type: "color",
						description: "Text, borders and surfaces.",
					},
					{
						name: "--ui-radius-*",
						type: "length",
						description: "Corner radii.",
						children: [
							{
								name: "--ui-radius-md",
								type: "length",
								default: "0.375rem",
								description: "Controls.",
							},
							{
								name: "--ui-radius-lg",
								type: "length",
								default: "0.5rem",
								description: "Cards and dialogs.",
							},
						],
					},
					{ name: "--ui-font-sans", type: "font-family", description: "Body and controls." },
					{ name: "--ui-font-mono", type: "font-family", description: "Code." },
				]}
			/>
		</>
	),
};
