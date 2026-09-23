/**
 * The pages this site offers as resources, declared as the URLs they already answer on.
 *
 * A resource is what a person attaches before they start, and `resources/list` is what
 * puts a corpus in their client's picker — so both declarations enumerate, and the sixty
 * package references and every guide show up there by name. The URIs are the `.md` twins
 * a client can fetch for itself, so attaching one and fetching it give the same text.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { resource, resources } from "@sdxc/mcp";

import { SITE_URL } from "~/app/services/site";

export default resources({
	package: resource(`${SITE_URL}/docs/packages/:name.md`, {
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
});
