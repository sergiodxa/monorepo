---
title: Build the interface with remix/component
description: Compose pages from @sdxc/ui components, lay them out with @sdxc/u mixins, and hydrate only the island that needs script.
section:
    title: Building Remix apps
    order: 3
order: 3
lastUpdated: 2026-10-08
---

A page in a Remix v3 app is `remix/component` JSX rendered on the server. This guide builds a
projects page from [`@sdxc/ui`](/api/ui) components: a header, a grid of cards, and a dialog
holding a form. It lays them out with [`@sdxc/u`](/api/u) mixins, adds glyphs from
[`@sdxc/icons`](/api/icons), and hydrates exactly one small island, a copy-link button, since
that is the only part of the page the platform cannot do on its own.

```bash
npm add remix @sdxc/ui @sdxc/u @sdxc/icons
```

The page works with no client JavaScript at all. The dialog opens, the form submits and the
errors render through HTML the browser already understands, and script is an addition you
make where it earns its place.

## The stylesheets

Components read semantic `--ui-*` variables, and those derive from five palette scales you
define: `brand`, `neutral`, `danger`, `warning` and `success`, each from 50 to 950. Import the
reset, your palette, then the theme, in that order, from the document layout: the build keeps
the import order as the cascade order.

```css {% title="resources/css/colors.css" %}
:root {
	--ui-color-brand-50: oklch(0.97 0.02 250);
	--ui-color-brand-500: oklch(0.6 0.18 250);
	--ui-color-brand-950: oklch(0.22 0.08 250);
	/* the same 50–950 shape for neutral, danger, warning and success */
}
```

```tsx {% title="resources/layouts/document.tsx" %}
import type { Handle, RemixNode } from "remix/component";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

interface Props {
	title: string;
	stylesheets: string[];
	children: RemixNode;
}

export default function DocumentLayout(handle: Handle<Props>) {
	return () => (
		<html lang="en" class="system">
			<head>
				<meta charSet="utf-8" />
				<title>{handle.props.title}</title>
				{handle.props.stylesheets.map((href) => (
					<link key={href} rel="stylesheet" href={href} />
				))}
			</head>
			<body>{handle.props.children}</body>
		</html>
	);
}
```

A build renames those files whenever their contents change, so the document links the names
the build reports. With [Pitlane's Vite plugin](https://pitlane.tools/guides/assets), they come
from its asset manifest:

```typescript {% title="app/assets.ts" %}
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

const ASSETS = createAssetResolver(manifest);

export function documentStylesheets() {
	return ASSETS.getStylesheets("resources/layouts/document.tsx");
}
```

Await it where the request renders the document and pass the list as `stylesheets`: a Worker
runs no async work at module scope, so the lookup belongs to the request. Put the class
`system` on `<html>` and the theme follows the visitor's `prefers-color-scheme`, with no
script deciding the scheme and nothing flashing on first paint.

## Compose a card

Every `@sdxc/ui` component is a `remix/component` component used as JSX, and compound parts such as
`Card.Header` hang off the root. A component of your own composes them:

```tsx {% title="resources/components/project-card.tsx" %}
import type { Handle } from "remix/component";

import { Badge, Card, LinkButton } from "@sdxc/ui";

export interface Project {
	name: string;
	summary: string;
	href: string;
	archived: boolean;
}

interface Props {
	project: Project;
}

export function ProjectCard(handle: Handle<Props>) {
	return () => {
		let { project } = handle.props;

		return (
			<Card>
				<Card.Header>
					<Card.Title>{project.name}</Card.Title>
					<Card.Description>{project.summary}</Card.Description>
				</Card.Header>
				<Card.Footer>
					{project.archived ? (
						<Badge color="neutral">Archived</Badge>
					) : null}
					<LinkButton
						href={project.href}
						variant="outline"
						color="neutral"
						size="sm"
					>
						Open
					</LinkButton>
				</Card.Footer>
			</Card>
		);
	};
}
```

Props such as `color`, `variant` and `size` become `data-*` attributes and a stylesheet rule
paints the rest, so this renders as static HTML. `color` takes one of the five semantic
roles, never a raw color, which is what lets two apps with different palettes share the
components.

## Layout with mixins

`@sdxc/u` covers what a component does not: the space between components, page width, and
responsive behavior. Every export is a mixin, and a `mix` array composes them.

```tsx {% title="resources/components/project-grid.tsx" %}
import type { Handle } from "remix/component";

import { container, gap, grid, gridTemplate, vstack } from "@sdxc/u/layout";
import { at } from "@sdxc/u/responsive";

import type { Project } from "~/resources/components/project-card";

import { ProjectCard } from "~/resources/components/project-card";

export function ProjectGrid(handle: Handle<{ projects: Project[] }>) {
	return () => (
		<section mix={[vstack({ gap: 6 }), container("projects")]}>
			<ul
				mix={[
					grid(),
					gap(4),
					gridTemplate({ columns: "1fr" }),
					at("md", gridTemplate({ columns: "repeat(2, minmax(0, 1fr))" })),
				]}
			>
				{handle.props.projects.map((project) => (
					<li key={project.href}>
						<ProjectCard project={project} />
					</li>
				))}
			</ul>
		</section>
	);
}
```

`at()` is a container query, not a media query. `container("projects")` on the section makes
it the thing the grid measures, so the same list shows two columns in a wide main area and
one inside a narrow sidebar, whatever the viewport. Narrow is the unwrapped case, and each
`at()` layers on above its breakpoint.

Reach for a component before a pile of mixins. When `@sdxc/ui` has the element, the
component already carries its spacing, focus ring and states. When it is close but not
exact, pass a small `css({...})` from `remix/component` in its `mix` rather than rebuilding it.

## A dialog with no script

The native `<dialog>` element and Invoker Commands open and close a modal declaratively. A
button names its target with `commandfor` and the verb with `command`, and there is no
open-state for you to track.

```tsx {% title="resources/components/new-project-dialog.tsx" %}
import type { Handle } from "remix/component";

import { PlusIcon } from "@sdxc/icons";
import { Button, Dialog, Form, TextField } from "@sdxc/ui";

import routes from "~/routes/web";

export function NewProjectDialog(
	handle: Handle<{ issues?: ReadonlyArray<Form.Issue> }>,
) {
	return () => (
		<>
			<Button commandfor="new-project" command="show-modal">
				<PlusIcon size={16} />
				New project
			</Button>
			<Dialog
				id="new-project"
				aria-labelledby="new-project-title"
				open={handle.props.issues !== undefined}
			>
				<Dialog.Header>
					<Dialog.Title id="new-project-title">New project</Dialog.Title>
				</Dialog.Header>
				<Form
					method="post"
					action={routes.projects.action.href()}
					issues={handle.props.issues}
				>
					<TextField name="name" label="Name" required />
					<Dialog.Footer>
						<Button
							type="button"
							commandfor="new-project"
							command="close"
							variant="outline"
						>
							Cancel
						</Button>
						<Button type="submit">Create</Button>
					</Dialog.Footer>
				</Form>
				<Dialog.Close commandfor="new-project" aria-label="Close" />
			</Dialog>
		</>
	);
}
```

The icon renders with `aria-hidden="true"` beside the visible label, and its stroke is
`currentColor`, so it takes the button's text color in every state. An icon-only button,
such as `Dialog.Close`, needs an `aria-label` instead.

When the action refuses the submission and re-renders the page with `issues`, the `open`
attribute shows the dialog again with each field's error beside it. A dialog opened by the
attribute is non-modal and sits in the page's flow with no `::backdrop`, so give that state a
fixed position through `mix` if it should look like the modal the visitor submitted from.
That is the whole loop:
see [Validate forms and route params](/docs/building-remix-apps/forms-and-params) for the
action side.

## An island, only where it's needed

Copying a URL to the clipboard is behavior the platform has no declarative form for, so that
one button becomes a `remix/component` client entry. The `@sdxc/ui` side of it is small: a `Button`
takes a behavior mixin such as `on("click", …)` through `mix` like any element does, and the
icons swap on the next render.

```tsx {% title="resources/components/copy-link.tsx" %}
import type { Handle } from "remix/component";

import { CheckIcon, CopyIcon } from "@sdxc/icons";
import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

export type CopyLinkProps = { href: string; label: string };

export const CopyLink = clientEntry(
	"/resources/components/copy-link.tsx#CopyLink",
	function CopyLink(handle: Handle<CopyLinkProps>) {
		let copied = false;

		let copy = on<HTMLButtonElement>("click", async () => {
			await navigator.clipboard.writeText(handle.props.href);
			copied = true;
			handle.update();
		});

		return () => (
			<Button
				type="button"
				variant="ghost"
				color="neutral"
				size="sm"
				mix={[copy]}
			>
				{copied ? <CheckIcon size={16} /> : <CopyIcon size={16} />}
				{handle.props.label}
			</Button>
		);
	},
);
```

Everything else about islands, from the client bootstrap that loads them to which props can
cross to the browser, is `remix/component`'s own; see Remix's
[hydration guide](https://github.com/remix-run/remix/blob/main/packages/ui/docs/hydration.md).
Link the client script only from pages that render an island, and every other page ships no
script at all.

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the action
  that fills `issues`.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — replacing the literal
  copy above with messages.
- [Keyboard shortcuts](/docs/building-remix-apps/keyboard-shortcuts) — page-wide keys, a
  shortcuts panel, and announcing what a key did.
- [`@sdxc/ui`](/api/ui) — the full component catalog and its mixins.
- [`@sdxc/u`](/api/u) — every utility, with the CSS each one emits.
