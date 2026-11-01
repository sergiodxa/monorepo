/**
 * Inkwell's two screens that are mostly an empty state: Pages before the publication has
 * any, which welcomes the editor and offers the one action, and the app's own 404, which
 * keeps the visitor inside the shell with a way home.
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { FilesIcon, MapIcon } from "@sdxc/icons";
import { vstack } from "@sdxc/u/layout";
import { LinkButton } from "@sdxc/ui";
import { Empty } from "@sdxc/ui/app/empty";
import { PageHeader } from "@sdxc/ui/app/page-header";
import { HeadingScope } from "@sdxc/ui/heading-scope";

import { href, SerifTitle } from "~/resources/views/demo-apps/inkwell/shell";

/** Pages before there are any: what the list will hold and the one action that starts it. */
export function PagesScreen() {
	return () => (
		<div mix={[vstack({ gap: 6, align: "stretch" })]}>
			<PageHeader
				title={<SerifTitle>Pages</SerifTitle>}
				description="Pages stay put: About, Submissions, the masthead. Posts are for the issue."
			/>
			<HeadingScope level={2}>
				<Empty kind="first-run" icon={<FilesIcon />}>
					<Empty.Title>No pages yet</Empty.Title>
					<Empty.Description>
						Pages hold what readers look for outside the issue, such as how to submit or who edits
						the Review. They never appear in the feed.
					</Empty.Description>
					<Empty.Action>
						<LinkButton href={href("pages/new")} color="brand" size="sm">
							Create page
						</LinkButton>
					</Empty.Action>
				</Empty>
			</HeadingScope>
		</div>
	);
}

/** The app's own not-found screen; its empty state's title is the screen's one heading. */
export function NotFoundScreen() {
	return () => (
		<Empty icon={<MapIcon />}>
			<Empty.Title>This page isn't in the archive</Empty.Title>
			<Empty.Description>
				The address may be mistyped, or the post was moved. Everything Lantern Review has published
				is under Posts.
			</Empty.Description>
			<Empty.Action>
				<LinkButton href={href("posts")} color="brand" size="sm">
					Go to posts
				</LinkButton>
			</Empty.Action>
		</Empty>
	);
}
