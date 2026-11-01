/**
 * Tempo's "Get started" pages: installing the library and composing a first card from its
 * utilities, and the concept page on the scales and tokens every utility reads, which is
 * where a team makes the library its own.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { raw } from "@sdxc/u/general";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading, Install } from "~/resources/views/demo-docs/blocks";
import { Example, PALETTES, Ramp, swatch } from "~/resources/views/demo-docs/tempo/visuals";

/** The addresses of Tempo's pages. */
const href = demoDocsHref("tempo");

/** Installation: the install line, the stylesheet, and a first card composed from utilities. */
export const INSTALLATION: DemoDocsPage = {
	title: "Installation",
	description:
		"Add Tempo to a project, load its stylesheet once, and build a first component from utilities.",
	updated: "2026-10-30",
	toc: [
		{ id: "install", text: "Install", level: 2 },
		{ id: "load-the-stylesheet", text: "Load the stylesheet", level: 2 },
		{ id: "your-first-component", text: "Your first component", level: 2 },
	],
	next: [
		{
			title: "Spacing",
			href: href("utilities/spacing"),
			description: "Every padding, margin and gap step, drawn.",
		},
		{
			title: "Scales and tokens",
			href: href("start/scales"),
			description: "Make the scales your brand’s before you write much.",
		},
	],
	render: (request) => (
		<>
			<p>
				Tempo is a set of functions that each return a class name for one CSS declaration. The
				classes are generated as you call them, so the stylesheet holds only what your pages use.
			</p>

			<Heading id="install">Install</Heading>
			<Install packages={["@tempo/css"]} selected={request.tab("package-manager")} />

			<Heading id="load-the-stylesheet">Load the stylesheet</Heading>
			<p>
				Import the tokens once at your app’s entry. They define every scale as custom properties,
				which the generated classes read.
			</p>
			<Code title="app/entry.ts" language="ts" code={'import "@tempo/css/tokens.css";'} />

			<Heading id="your-first-component">Your first component</Heading>
			<p>
				Combine utilities with <code>tx()</code>, which joins their class names and drops any that
				are <code>false</code>, so a condition reads inline.
			</p>
			<Example
				code={
					'import { bg, fg, pad, rounded, shadow, stack, gap, text, tx } from "@tempo/css";\n\n<article class={tx(stack(), gap(2), pad(5), bg("tide.50"), rounded("lg"), shadow("md"))}>\n\t<h3 class={tx(text("lg"), fg("tide.900"))}>Weekly report</h3>\n\t<p class={tx(text("sm"), fg("tide.700"))}>12 checks passed.</p>\n</article>'
				}
			>
				<article
					mix={[
						raw({
							display: "flex",
							flexDirection: "column",
							gap: "0.5rem",
							padding: "1.25rem",
							inlineSize: "16rem",
							maxInlineSize: "100%",
							backgroundColor: swatch("tide", 50),
							borderRadius: "0.75rem",
							boxShadow: "0 4px 8px -2px oklch(0.2 0.02 250 / 0.14)",
						}),
					]}
				>
					<strong mix={[raw({ fontSize: "1.125rem", color: swatch("tide", 900) })]}>
						Weekly report
					</strong>
					<span mix={[raw({ fontSize: "0.875rem", color: swatch("tide", 700) })]}>
						12 checks passed.
					</span>
				</article>
			</Example>
			<Aside kind="tip">
				Repeating the same <code>tx()</code> call in several places? Give it a name with{" "}
				<code>let card = tx(…)</code> and use the name; the classes are generated once either way.
			</Aside>
		</>
	),
};

/** Scales and tokens: the custom properties behind every utility, and how to change them. */
export const SCALES: DemoDocsPage = {
	title: "Scales and tokens",
	description:
		"The custom properties every utility reads, and how to change a scale or a palette for the whole interface.",
	updated: "2026-10-27",
	toc: [
		{ id: "tokens", text: "Every scale is a token", level: 2 },
		{ id: "change-a-scale", text: "Change a scale", level: 2 },
		{ id: "bring-your-palette", text: "Bring your own palette", level: 2 },
		{ id: "dark-mode", text: "Dark mode", level: 2 },
	],
	next: [
		{
			title: "Colour",
			href: href("utilities/colour"),
			description: "See every palette and the utilities that paint with it.",
		},
		{
			title: "Spacing",
			href: href("utilities/spacing"),
			description: "See the scale your change just moved.",
		},
	],
	render: () => (
		<>
			<p>
				A utility never writes a raw value. <code>pad(4)</code> emits{" "}
				<code>padding: var(--tempo-space-4)</code>, so changing a token changes every element that
				uses that step, with no rebuild.
			</p>

			<Heading id="tokens">Every scale is a token</Heading>
			<Fields
				label="Token groups"
				rows={[
					{
						name: "--tempo-space-*",
						type: "length",
						default: "step × 0.25rem",
						description: "The spacing scale pad, margin and gap read.",
					},
					{
						name: "--tempo-<palette>-*",
						type: "color",
						default: "Tempo’s palettes",
						description: "Eleven shades, 50 to 950, for each of the seven palettes.",
					},
					{
						name: "--tempo-text-*",
						type: "length",
						default: "0.75rem to 2.25rem",
						description: "The type scale, each with a paired --tempo-leading-*.",
					},
					{
						name: "--tempo-radius-*",
						type: "length",
						default: "0 to 9999px",
						description: "The corner radii rounded() reads.",
					},
					{
						name: "--tempo-shadow-*",
						type: "shadow",
						default: "xs to xl",
						description: "The elevations shadow() casts.",
					},
				]}
			/>

			<Heading id="change-a-scale">Change a scale</Heading>
			<p>Override a token after the import and every call that reads it follows.</p>
			<Code
				title="app/styles/tokens.css"
				language="css"
				highlight={[2]}
				code={":root {\n\t--tempo-space-4: 1.125rem;\n\t--tempo-radius-lg: 1rem;\n}"}
			/>

			<Heading id="bring-your-palette">Bring your own palette</Heading>
			<p>
				Register a palette under a name of your own and use it like a built-in one. Give it eleven
				shades from lightest to darkest.
			</p>
			<Code
				title="app/styles/tokens.css"
				language="css"
				code={
					":root {\n\t--tempo-brand-50: oklch(0.975 0.02 320);\n\t/* … */\n\t--tempo-brand-950: oklch(0.22 0.07 320);\n}"
				}
			/>
			<div data-not-typeset="" mix={[raw({ marginBlockStart: "1rem" })]}>
				<Ramp palette={PALETTES.find((palette) => palette.name === "plum")!} />
			</div>

			<Heading id="dark-mode">Dark mode</Heading>
			<p>
				Palettes stay put in dark mode; what changes is which shade you pick. Wrap a call in{" "}
				<code>dark()</code> to apply it only when the reader prefers a dark theme.
			</p>
			<Code
				language="tsx"
				code={'<div class={tx(bg("stone.50"), dark(bg("stone.900")))}>…</div>'}
			/>
			<Aside kind="note">
				Shadows read weakly on a dark surface. Pair a shadow with a border in dark mode so a raised
				card keeps its edge.
			</Aside>
		</>
	),
};
