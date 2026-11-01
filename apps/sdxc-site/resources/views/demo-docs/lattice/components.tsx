/**
 * Lattice's component pages: each opens on a live example, walks its variants, sizes and
 * states with a preview apiece, then lists every prop and what a screen reader hears, the
 * order a reader picking a component asks in.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { CheckIcon, DownloadIcon, PlusIcon } from "@sdxc/icons";
import { raw } from "@sdxc/u/general";
import { Badge, Button, Card, Switch } from "@sdxc/ui";

import type { DemoDocsPage } from "~/resources/views/demo-docs";

import { demoDocsHref } from "~/resources/views/demo-docs";
import { Aside, Code, Fields, Heading } from "~/resources/views/demo-docs/blocks";
import { Example } from "~/resources/views/demo-docs/lattice/preview";

/** The addresses of Lattice's pages. */
const href = demoDocsHref("lattice");

/** The semantic colours every coloured component takes, as a prop's type reads. */
const COLOR_TYPE = '"brand" | "neutral" | "success" | "warning" | "danger"';

/** Button: variants, sizes, icons, the pending state, and its props. */
export const BUTTON: DemoDocsPage = {
	title: "Button",
	mono: true,
	description:
		"Starts an action: submits a form, opens a dialog, saves a change. Four variants rank how loudly it asks.",
	updated: "2026-10-28",
	toc: [
		{ id: "usage", text: "Usage", level: 2 },
		{ id: "variants", text: "Variants", level: 2 },
		{ id: "colors", text: "Colors", level: 2 },
		{ id: "sizes", text: "Sizes", level: 2 },
		{ id: "with-an-icon", text: "With an icon", level: 2 },
		{ id: "pending", text: "Pending", level: 2 },
		{ id: "api-reference", text: "API reference", level: 2 },
		{ id: "accessibility", text: "Accessibility", level: 2 },
	],
	next: [
		{
			title: "Badge",
			href: href("components/badge"),
			description: "Label a status beside a button instead of in it.",
		},
		{
			title: "Theming",
			href: href("getting-started/theming"),
			description: "Change the brand colour every solid button fills with.",
		},
	],
	render: () => (
		<>
			<Example
				label="Button example"
				code={'import { Button } from "@lattice/ui";\n\n<Button>Save changes</Button>'}
			>
				<Button>Save changes</Button>
			</Example>

			<Heading id="usage">Usage</Heading>
			<p>
				Use one solid button per view for the action you expect next, and quieter variants for the
				rest. A link that goes somewhere is a link, not a button.
			</p>
			<Code
				title="settings.tsx"
				language="tsx"
				code={
					'import { Button } from "@lattice/ui";\n\nexport function SaveBar() {\n\treturn <Button type="submit">Save changes</Button>;\n}'
				}
			/>

			<Heading id="variants">Variants</Heading>
			<p>
				<code>solid</code> is the primary action, <code>surface</code> and <code>outline</code>{" "}
				secondary ones, and <code>ghost</code> an action inside a dense row.
			</p>
			<Example
				label="Button variants example"
				code={
					'<Button variant="solid">Solid</Button>\n<Button variant="surface">Surface</Button>\n<Button variant="outline">Outline</Button>\n<Button variant="ghost">Ghost</Button>'
				}
			>
				<Button variant="solid">Solid</Button>
				<Button variant="surface">Surface</Button>
				<Button variant="outline">Outline</Button>
				<Button variant="ghost">Ghost</Button>
			</Example>

			<Heading id="colors">Colors</Heading>
			<p>
				Buttons are ink by default. Use <code>brand</code> for the one action a view is built
				around, and <code>danger</code> for one that destroys data.
			</p>
			<Example
				label="Button colors example"
				code={
					'<Button>Neutral</Button>\n<Button color="brand">Brand</Button>\n<Button color="danger" variant="outline">Delete</Button>'
				}
			>
				<Button>Neutral</Button>
				<Button color="brand">Brand</Button>
				<Button color="danger" variant="outline">
					Delete
				</Button>
			</Example>

			<Heading id="sizes">Sizes</Heading>
			<Example
				label="Button sizes example"
				code={
					'<Button size="sm">Small</Button>\n<Button size="md">Medium</Button>\n<Button size="lg">Large</Button>'
				}
			>
				<Button size="sm">Small</Button>
				<Button size="md">Medium</Button>
				<Button size="lg">Large</Button>
			</Example>

			<Heading id="with-an-icon">With an icon</Heading>
			<p>Put the icon before the label. An icon alone needs an accessible name.</p>
			<Example
				label="Button with an icon example"
				code={
					'<Button variant="outline">\n\t<DownloadIcon size={16} aria-hidden="true" />\n\tExport CSV\n</Button>\n<Button variant="ghost" aria-label="Add member">\n\t<PlusIcon size={16} aria-hidden="true" />\n</Button>'
				}
			>
				<Button variant="outline">
					<DownloadIcon size={16} aria-hidden="true" />
					Export CSV
				</Button>
				<Button variant="ghost" aria-label="Add member">
					<PlusIcon size={16} aria-hidden="true" />
				</Button>
			</Example>

			<Heading id="pending">Pending</Heading>
			<p>
				<code>isPending</code> draws a spinner over the label and keeps the button’s width, so the
				row doesn’t jump while a form submits.
			</p>
			<Example label="Pending button example" code={"<Button isPending>Saving…</Button>"}>
				<Button isPending>Saving…</Button>
			</Example>

			<Heading id="api-reference">API reference</Heading>
			<p>
				Every native <code>&lt;button&gt;</code> attribute is passed through, plus:
			</p>
			<Fields
				label="Button props"
				rows={[
					{
						name: "variant",
						type: '"solid" | "outline" | "ghost" | "surface"',
						default: '"solid"',
						description: "How loudly the button asks.",
					},
					{
						name: "color",
						type: COLOR_TYPE,
						default: '"neutral"',
						description: "The tone it fills or rings with.",
					},
					{ name: "size", type: '"sm" | "md" | "lg"', default: '"md"' },
					{
						name: "isPending",
						type: "boolean",
						default: "false",
						description: "Shows a spinner and sets aria-busy, keeping the width.",
					},
					{
						name: "parts",
						type: "object",
						description: "Styles for the button’s inner parts.",
						children: [
							{ name: "spinner", type: "Mix", description: "The pending spinner." },
							{ name: "content", type: "Mix", description: "The label and icon wrapper." },
						],
					},
				]}
			/>

			<Heading id="accessibility">Accessibility</Heading>
			<ul>
				<li>
					Renders a native <code>&lt;button&gt;</code>, so Enter and Space activate it.
				</li>
				<li>
					A pending button sets <code>aria-busy</code> and stays focusable, so focus isn’t lost
					mid-submit.
				</li>
				<li>
					An icon-only button needs <code>aria-label</code>.
				</li>
			</ul>
		</>
	),
};

/** Badge: variants, colours, an icon, and its props. */
export const BADGE: DemoDocsPage = {
	title: "Badge",
	mono: true,
	description: "A short status or count beside the thing it describes: Active, Failed, 3 new.",
	updated: "2026-10-22",
	toc: [
		{ id: "variants", text: "Variants", level: 2 },
		{ id: "colors", text: "Colors", level: 2 },
		{ id: "with-an-icon", text: "With an icon", level: 2 },
		{ id: "api-reference", text: "API reference", level: 2 },
		{ id: "accessibility", text: "Accessibility", level: 2 },
	],
	next: [
		{
			title: "Card",
			href: href("components/card"),
			description: "Group a badge with the record it labels.",
		},
		{
			title: "Button",
			href: href("components/button"),
			description: "When the status should also be an action.",
		},
	],
	render: () => (
		<>
			<Example label="Badge example" code={"<Badge>New</Badge>"}>
				<Badge>New</Badge>
			</Example>

			<Heading id="variants">Variants</Heading>
			<Example
				label="Badge variants example"
				code={
					'<Badge variant="default">Default</Badge>\n<Badge variant="secondary">Secondary</Badge>\n<Badge variant="outline">Outline</Badge>'
				}
			>
				<Badge variant="default">Default</Badge>
				<Badge variant="secondary">Secondary</Badge>
				<Badge variant="outline">Outline</Badge>
			</Example>

			<Heading id="colors">Colors</Heading>
			<p>Pick the colour by meaning, not by look, so the same status reads the same everywhere.</p>
			<Example
				label="Badge colors example"
				code={
					'<Badge color="neutral" variant="secondary">Draft</Badge>\n<Badge color="success" variant="secondary">Active</Badge>\n<Badge color="warning" variant="secondary">Expiring</Badge>\n<Badge color="danger" variant="secondary">Failed</Badge>'
				}
			>
				<Badge color="neutral" variant="secondary">
					Draft
				</Badge>
				<Badge color="success" variant="secondary">
					Active
				</Badge>
				<Badge color="warning" variant="secondary">
					Expiring
				</Badge>
				<Badge color="danger" variant="secondary">
					Failed
				</Badge>
			</Example>

			<Heading id="with-an-icon">With an icon</Heading>
			<Example
				label="Badge with an icon example"
				code={
					'<Badge color="success" variant="secondary">\n\t<Badge.Icon><CheckIcon /></Badge.Icon>\n\t<Badge.Text>Verified</Badge.Text>\n</Badge>'
				}
			>
				<Badge color="success" variant="secondary">
					<Badge.Icon>
						<CheckIcon />
					</Badge.Icon>
					<Badge.Text>Verified</Badge.Text>
				</Badge>
			</Example>

			<Heading id="api-reference">API reference</Heading>
			<Fields
				label="Badge props"
				rows={[
					{
						name: "variant",
						type: '"default" | "secondary" | "outline"',
						default: '"default"',
						description: "Solid, tinted or outlined.",
					},
					{ name: "color", type: COLOR_TYPE, default: '"neutral"' },
					{
						name: "Badge.Icon",
						type: "component",
						description: "A decorative glyph before the text, hidden from screen readers.",
					},
					{ name: "Badge.Text", type: "component", description: "The words the badge says." },
				]}
			/>

			<Heading id="accessibility">Accessibility</Heading>
			<p>
				A badge is plain text in a <code>&lt;span&gt;</code>. Its colour is never the only signal:
				the words say the status, so it reads the same in forced colours and to a screen reader.
			</p>
		</>
	),
};

/** Switch: label, default and disabled states, form use, and its props. */
export const SWITCH: DemoDocsPage = {
	title: "Switch",
	mono: true,
	description:
		"Turns one setting on or off and applies it at once. Use a checkbox when the change waits for a Save button.",
	updated: "2026-10-19",
	toc: [
		{ id: "with-a-label", text: "With a label", level: 2 },
		{ id: "states", text: "States", level: 2 },
		{ id: "in-a-form", text: "In a form", level: 2 },
		{ id: "api-reference", text: "API reference", level: 2 },
		{ id: "accessibility", text: "Accessibility", level: 2 },
	],
	next: [
		{
			title: "Card",
			href: href("components/card"),
			description: "Lay a list of settings out in a card.",
		},
		{
			title: "Theming",
			href: href("getting-started/theming"),
			description: "Size the track and thumb with tokens.",
		},
	],
	render: () => (
		<>
			<Example label="Switch example" code={'<Switch name="notifications" defaultChecked />'}>
				<Switch name="notifications" aria-label="Notifications" defaultChecked />
			</Example>

			<Heading id="with-a-label">With a label</Heading>
			<p>Pass the label as children; clicking the text toggles the switch too.</p>
			<Example
				label="Switch with a label example"
				code={'<Switch name="digest">Email me a weekly digest</Switch>'}
			>
				<Switch name="digest">Email me a weekly digest</Switch>
			</Example>

			<Heading id="states">States</Heading>
			<Example
				label="Switch states example"
				code={
					"<Switch>Off</Switch>\n<Switch defaultChecked>On</Switch>\n<Switch disabled>Disabled</Switch>\n<Switch disabled defaultChecked>Locked on</Switch>"
				}
			>
				<Switch>Off</Switch>
				<Switch defaultChecked>On</Switch>
				<Switch disabled>Disabled</Switch>
				<Switch disabled defaultChecked>
					Locked on
				</Switch>
			</Example>

			<Heading id="in-a-form">In a form</Heading>
			<p>
				A switch is a checkbox underneath, so a form posts its <code>name</code> with{" "}
				<code>on</code> when it is on and nothing when it is off.
			</p>
			<Code
				title="preferences.tsx"
				language="tsx"
				highlight={[3]}
				code={
					'<form method="post">\n\t<Switch name="digest" defaultChecked={user.digest}>Weekly digest</Switch>\n\t<Button type="submit">Save</Button>\n</form>'
				}
			/>

			<Heading id="api-reference">API reference</Heading>
			<p>Every native checkbox attribute is passed through, plus:</p>
			<Fields
				label="Switch props"
				rows={[
					{ name: "children", type: "RemixNode", description: "The label, drawn after the track." },
					{ name: "defaultChecked", type: "boolean", default: "false" },
					{ name: "disabled", type: "boolean", default: "false" },
					{
						name: "--ui-switch-*",
						type: "CSS custom properties",
						description: "Sizes of the track and thumb.",
						children: [
							{ name: "--ui-switch-track-inline-size", type: "length", default: "2.75rem" },
							{ name: "--ui-switch-track-block-size", type: "length", default: "1.5rem" },
							{ name: "--ui-switch-thumb-size", type: "length", default: "1.25rem" },
						],
					},
				]}
			/>

			<Heading id="accessibility">Accessibility</Heading>
			<ul>
				<li>
					Renders <code>&lt;input type="checkbox" role="switch"&gt;</code>, announced as “switch,
					on” or “switch, off”.
				</li>
				<li>
					Space toggles it; a switch without children needs <code>aria-label</code>.
				</li>
			</ul>
		</>
	),
};

/** Card: anatomy, a colored card, and its parts. */
export const CARD: DemoDocsPage = {
	title: "Card",
	mono: true,
	description:
		"Groups one record or one task: a plan, a member, a setting, with its actions at the foot.",
	updated: "2026-10-15",
	toc: [
		{ id: "anatomy", text: "Anatomy", level: 2 },
		{ id: "with-a-color", text: "With a color", level: 2 },
		{ id: "api-reference", text: "API reference", level: 2 },
		{ id: "accessibility", text: "Accessibility", level: 2 },
	],
	next: [
		{
			title: "Button",
			href: href("components/button"),
			description: "Pick the variant for a card’s footer action.",
		},
		{
			title: "Badge",
			href: href("components/badge"),
			description: "Mark a card’s status beside its title.",
		},
	],
	render: () => (
		<>
			<Example
				label="Card example"
				code={
					"<Card>\n\t<Card.Header>\n\t\t<Card.Title>Team plan</Card.Title>\n\t\t<Card.Description>For up to 20 people.</Card.Description>\n\t</Card.Header>\n\t<Card.Content>$24 per month, billed yearly.</Card.Content>\n\t<Card.Footer>\n\t\t<Button>Upgrade</Button>\n\t</Card.Footer>\n</Card>"
				}
			>
				<Card mix={[raw({ inlineSize: "min(100%, 20rem)" })]}>
					<Card.Header>
						<Card.Title>Team plan</Card.Title>
						<Card.Description>For up to 20 people.</Card.Description>
					</Card.Header>
					<Card.Content>$24 per month, billed yearly.</Card.Content>
					<Card.Footer>
						<Button>Upgrade</Button>
					</Card.Footer>
				</Card>
			</Example>

			<Heading id="anatomy">Anatomy</Heading>
			<p>
				A card has up to four parts, in this order. Leave out any you don’t need; the spacing
				between the rest stays even.
			</p>
			<Code
				title="anatomy.tsx"
				language="tsx"
				code={
					"<Card>\n\t<Card.Header>\n\t\t<Card.Title />\n\t\t<Card.Description />\n\t</Card.Header>\n\t<Card.Content />\n\t<Card.Footer />\n</Card>"
				}
			/>

			<Heading id="with-a-color">With a color</Heading>
			<p>A colored card is for one state the reader must act on, such as a failed payment.</p>
			<Example
				label="Colored card example"
				code={
					'<Card color="danger">\n\t<Card.Header>\n\t\t<Card.Title>Payment failed</Card.Title>\n\t\t<Card.Description>Update your card to keep your plan.</Card.Description>\n\t</Card.Header>\n</Card>'
				}
			>
				<Card color="danger" mix={[raw({ inlineSize: "min(100%, 20rem)" })]}>
					<Card.Header>
						<Card.Title>Payment failed</Card.Title>
						<Card.Description>Update your card to keep your plan.</Card.Description>
					</Card.Header>
				</Card>
			</Example>

			<Heading id="api-reference">API reference</Heading>
			<Fields
				label="Card props"
				rows={[
					{
						name: "color",
						type: COLOR_TYPE,
						description: "Tints the card for a state. Plain when unset.",
					},
					{
						name: "Card.Header",
						type: "component",
						description: "Holds the title and description.",
						children: [
							{
								name: "Card.Title",
								type: "component",
								description: "A heading at the level the surrounding outline sets.",
							},
							{
								name: "Card.Description",
								type: "component",
								description: "Muted supporting copy.",
							},
						],
					},
					{ name: "Card.Content", type: "component", description: "The card’s body." },
					{ name: "Card.Footer", type: "component", description: "Actions, aligned to the end." },
				]}
			/>

			<Heading id="accessibility">Accessibility</Heading>
			<Aside kind="tip">
				<code>Card.Title</code> picks its heading level from the page around it, so a card in a
				section titled with an <code>h2</code> gets an <code>h3</code> without you counting.
			</Aside>
		</>
	),
};
