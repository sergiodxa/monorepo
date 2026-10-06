/**
 * The pages this site offers as resources, declared as the URLs they already answer on.
 *
 * A resource is what a person attaches before they start, and `resources/list` is what
 * puts a corpus in their client's picker — so every declaration enumerates, and the package
 * references, every guide and every page of the two catalogues show up there by name. The URIs are the `.md` twins
 * a client can fetch for itself, so attaching one and fetching it give the same text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resource, resources } from "@sdxc/mcp";

import { SITE_URL } from "~/app/services/site";

export default resources({
	package: resource(`${SITE_URL}/api/:name.md`, {
		name: "package",
		title: "Package reference",
		description: "One published package's README, as Markdown.",
		mimeType: "text/markdown",
	}),

	guide: resource(`${SITE_URL}/docs/*slug.md`, {
		name: "guide",
		title: "Guide",
		description: "One handwritten guide about the collection, as Markdown.",
		mimeType: "text/markdown",
	}),

	utility: resource(`${SITE_URL}/api/u/:utility.md`, {
		name: "utility",
		title: "@sdxc/u utility",
		description:
			"One @sdxc/u styling utility: the CSS each call emits, how to scope it to a state or a width, and the theme variables it reads, as Markdown.",
		mimeType: "text/markdown",
	}),

	component: resource(`${SITE_URL}/api/ui/:component.md`, {
		name: "component",
		title: "@sdxc/ui component",
		description: "One @sdxc/ui component's reference, or the theme contract, as Markdown.",
		mimeType: "text/markdown",
	}),

	uiExport: resource(`${SITE_URL}/api/ui/:subpath/:slug.md`, {
		name: "ui-export",
		title: "@sdxc/ui mixin, behavior, animation or style",
		description:
			"One export of @sdxc/ui/mixins, /behaviors, /animations or /styles, with the events, constants and types used with it, as Markdown.",
		mimeType: "text/markdown",
	}),
});
