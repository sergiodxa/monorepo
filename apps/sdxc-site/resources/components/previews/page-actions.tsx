/**
 * Live preview for `PageActions`: the "Copy page" split button with the menu a docs page
 * offers, from its Markdown twin to the assistants a reader hands the page to.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { PageActions } from "@sdxc/ui/docs";

/** The source the page shows, matching the markup below. */
const CODE = `<PageActions
	markdownHref="/docs/install.md"
	labels={{
		copy: "Copy page",
		copied: "Copied",
		failed: "Could not copy the page",
		more: "More ways to use this page",
	}}
	links={[
		{ label: "View as Markdown", description: "Read this page as plain text", href: "/docs/install.md" },
		{ label: "Open in Claude", description: "Ask questions about this page", href: claudeUrl, external: true },
		{ label: "Open in ChatGPT", description: "Ask questions about this page", href: chatGptUrl, external: true },
		{ label: "Edit on GitHub", description: "Suggest a change to this page", href: sourceUrl, external: true },
	]}
/>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	render: () => (
		<PageActions
			menuId="preview-page-actions"
			markdownHref="#install.md"
			labels={{
				copy: "Copy page",
				copied: "Copied",
				failed: "Could not copy the page",
				more: "More ways to use this page",
			}}
			links={[
				{
					label: "View as Markdown",
					description: "Read this page as plain text",
					href: "#install.md",
				},
				{ label: "Open in Claude", description: "Ask questions about this page", href: "#claude" },
				{
					label: "Open in ChatGPT",
					description: "Ask questions about this page",
					href: "#chatgpt",
				},
				{ label: "Edit on GitHub", description: "Suggest a change to this page", href: "#github" },
			]}
		/>
	),
};
