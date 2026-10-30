---
title: Build the interface with remix/component
description: Compose pages from @sdxc/ui components, lay them out with @sdxc/u mixins, and hydrate only the island that needs script.
section:
    title: Building Remix apps
    order: 4
order: 3
lastUpdated: 2026-10-25
outcomes:
    - "How to compose a page from `@sdxc/ui` components and lay it out with `@sdxc/u` mixins"
    - "How to build a dialog with no script using native platform features"
    - "How to hydrate only the island that needs script"
---

A page in a Remix v3 app is `remix/component` JSX rendered on the server. This guide builds a
projects page from [`@sdxc/ui`](/api/ui) components: a header, a grid of cards, and a dialog
holding a form. It lays them out with [`@sdxc/u`](/api/u) mixins, adds glyphs from
[`@sdxc/icons`](/api/icons), and hydrates exactly one small island, a copy-link button. The
rest of the page works with no client JavaScript at all.

```bash
npm add @pitlane/assets @sdxc/assets-middleware @sdxc/icons @sdxc/u @sdxc/ui remix
```

## The stylesheets

Components read semantic `--ui-*` variables, and those derive from five palette scales you
define: `brand`, `neutral`, `danger`, `warning` and `success`, each from 50 to 950.

> [!NOTE]
> Import the reset, your palette, then the theme, in that order, from the document layout. The
> build keeps the import order as the cascade order, so a palette imported after the theme
> leaves the components on the theme's fallbacks.

```css {% title="resources/css/colors.css" %}
:root {
	--ui-color-brand-50: oklch(0.97 0.02 250);
	--ui-color-brand-500: oklch(0.6 0.18 250);
	--ui-color-brand-950: oklch(0.22 0.08 250);
	/* the same 50–950 shape for neutral, danger, warning and success */
}
```

```tsx {% title="resources/layouts/document.tsx" %}
import type { DocumentAssets } from "@sdxc/assets-middleware";
import type { Handle, RemixNode } from "remix/component";

import "@sdxc/ui/reset.css";
import "~/resources/css/colors.css";
import "@sdxc/ui/theme.css";

interface Props {
	title: string;
	assets: DocumentAssets;
	children: RemixNode;
}

export default function DocumentLayout(handle: Handle<Props>) {
	return () => (
		<html lang="en" class="system">
			<head>
				<meta charSet="utf-8" />
				<title>{handle.props.title}</title>
				{handle.props.assets.stylesheets.map((href) => (
					<link key={href} rel="stylesheet" href={href} />
				))}
			</head>
			<body>{handle.props.children}</body>
		</html>
	);
}
```

A build renames those files whenever their contents change, so the document links the names
from [Pitlane's](https://pitlane.tools/guides/assets) asset manifest, through one resolver:

```typescript {% title="app/initializers/assets.ts" %}
import { createAssetResolver } from "@pitlane/assets";
import manifest from "@pitlane/assets/manifest";

export const assetResolver = createAssetResolver(manifest);
```

`assets()` from [`@sdxc/assets-middleware`](/api/assets-middleware) resolves them per request
and publishes them as `ctx.assets`. List it in the middleware every page runs, ahead of
`render()`:

```typescript {% title="app/http/middleware/page.ts" %}
import { assets } from "@sdxc/assets-middleware";
import { render } from "remix/middleware/render";
import { createMiddleware } from "remix/router";

import { assetResolver } from "~/app/initializers/assets";

export default createMiddleware(
	assets(assetResolver, {
		stylesheets: "resources/layouts/document.tsx",
		script: "bootstrap/browser.ts",
	}),
	render({ assets: assetResolver }),
);
```

A page passes them on as `<DocumentLayout assets={ctx.assets} title="Projects">`, and the
class `system` on `<html>` makes the theme follow the visitor's `prefers-color-scheme`.

> [!WARNING]
> A Worker runs no async work at module scope, and a deploy fails validation when the module
> tries. Resolve the assets in the middleware, per request, as above.

## Compose a card

Every `@sdxc/ui` component is used as JSX, and compound parts such as `Card.Header` hang off the
root. A component of your own composes them:

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

Props such as `color`, `variant` and `size` become `data-*` attributes a stylesheet paints, so
this renders as static HTML. `color` takes one of the five semantic roles, so two apps with
different palettes share the components.

## Lay out the page with mixins

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

`at()` is a container query against `container("projects")`, so the same list shows two
columns in a wide main area and one inside a narrow sidebar, whatever the viewport.

## Open a dialog with no script

The native `<dialog>` element and Invoker Commands open and close a modal declaratively: a
button names its target with `commandfor` and the verb with `command`.

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

The icon renders `aria-hidden` beside the visible label; an icon-only button, such as
`Dialog.Close`, needs an `aria-label`. When the action refuses the submission and re-renders
the page with `issues`, the `open` attribute shows the dialog again with each field's error,
as [Validate forms and route params](/docs/building-remix-apps/forms-and-params) shows.

> [!NOTE]
> A dialog opened by the `open` attribute is non-modal and sits in the page's flow with no
> `::backdrop`. Give that state a fixed position through `mix` if it should look like the modal
> the visitor submitted from.

## Hydrate an island only where it's needed

Copying a URL to the clipboard has no declarative form, so that one button becomes a client
entry. A `Button` takes `on("click", …)` through `mix` like any element does:

```tsx {% title="resources/components/copy-link.tsx" %}
import type { Handle } from "remix/component";

import { CheckIcon, CopyIcon } from "@sdxc/icons";
import { Button } from "@sdxc/ui";
import { clientEntry, on } from "remix/component";

export interface CopyLinkProps {
	href: string;
	label: string;
}

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

The client bootstrap that loads islands is `remix/component`'s own; see Remix's
[hydration guide](https://github.com/remix-run/remix/blob/main/packages/ui/docs/hydration.md).

## Test what the server renders

A test renders the dialog with `renderToString` from `remix/component/server` and checks that
it opens itself when the action refused a submission:

```tsx {% title="resources/components/new-project-dialog.test.tsx" %}
import { renderToString } from "remix/component/server";
import { expect, test } from "vitest";

import { NewProjectDialog } from "~/resources/components/new-project-dialog";

test("opens itself when the action returned issues", async () => {
	let refused = await renderToString(
		<NewProjectDialog issues={[{ path: ["name"], message: "Pick a name" }]} />,
	);
	let fresh = await renderToString(<NewProjectDialog />);

	expect(refused).toMatch(/<dialog[^>]*\sopen\b/);
	expect(fresh).not.toMatch(/<dialog[^>]*\sopen\b/);
});
```

## Where to go next

- [Validate forms and route params](/docs/building-remix-apps/forms-and-params) — the action
  that fills `issues`.
- [Translate your app](/docs/building-remix-apps/translate-your-app) — replacing the literal
  copy above with messages.
- [`@sdxc/ui`](/api/ui) — the full component catalog and its mixins.
