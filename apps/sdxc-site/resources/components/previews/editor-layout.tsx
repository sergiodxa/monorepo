/**
 * Live preview for `EditorLayout`: a blog post open in a CMS. The bar carries the quiet
 * save status and the loud Publish; the properties sit beside the writing column, and on
 * a narrow pane they move into a full-screen sheet behind "Settings".
 *
 * @author [Sergio Xalambrí](https://sergiodxa.com)
 * @copyright Sergio Xalambrí 2026
 */

import { fg } from "@sdxc/u/color";
import { vstack } from "@sdxc/u/layout";
import { is, m } from "@sdxc/u/size";
import { leading, text, weight } from "@sdxc/u/typography";
import { Button, Input, Label, LinkButton, Select } from "@sdxc/ui";
import { EditorLayout } from "@sdxc/ui/app/editor-layout";
import { SaveStatus } from "@sdxc/ui/app/save-status";

/** The source the page shows, matching the markup below apart from element ids. */
const CODE = `<EditorLayout
	back={{ href: "/posts", label: "Posts" }}
	title="Designing a calmer editor"
	status={
		<SaveStatus
			id="post-status"
			editedAt={post.updatedAt}
			form="post-form"
			labels={{ saving: "Saving…", saved: "Saved", failed: "Failed", retry: "Retry", edited: "Edited {time}" }}
		/>
	}
	preview={<LinkButton href={previewUrl} variant="ghost" color="neutral" size="sm">Preview</LinkButton>}
	primary={<Button type="submit" form="post-form" size="sm">Publish</Button>}
	sidebar={
		<>
			<Label htmlFor="post-visibility">Visibility</Label>
			<Select id="post-visibility" name="visibility" form="post-form">…</Select>
			<Label htmlFor="post-slug">Slug</Label>
			<Input id="post-slug" name="slug" form="post-form" defaultValue="designing-a-calmer-editor" />
			<Label htmlFor="post-tags">Tags</Label>
			<Input id="post-tags" name="tags" form="post-form" defaultValue="design, writing" />
		</>
	}
	labels={{ settings: "Settings", closeSettings: "Close settings", sidebar: "Post settings" }}
>
	<form id="post-form" method="post">…</form>
</EditorLayout>`;

/** What the preview registry reads: the source to show, and the markup to draw. */
export default {
	code: CODE,
	flush: true,
	viewports: true,
	render: () => (
		<EditorLayout
			back={{ href: "#posts", label: "Posts" }}
			title="Designing a calmer editor"
			status={
				<SaveStatus
					id="preview-editor-status"
					editedAt={new Date(Date.now() - 2 * 60 * 1000).toISOString()}
					form="preview-editor-form"
					labels={{
						saving: "Saving…",
						saved: "Saved",
						failed: "Failed",
						retry: "Retry",
						edited: "Edited {time}",
					}}
				/>
			}
			preview={
				<LinkButton href="#preview" variant="ghost" color="neutral" size="sm">
					Preview
				</LinkButton>
			}
			primary={
				<Button type="submit" form="preview-editor-form" size="sm">
					Publish
				</Button>
			}
			sidebar={
				<>
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Label htmlFor="preview-editor-visibility">Visibility</Label>
						<Select id="preview-editor-visibility" name="visibility" form="preview-editor-form">
							<Select.Option value="public" selected>
								Public
							</Select.Option>
							<Select.Option value="members">Members only</Select.Option>
							<Select.Option value="private">Private</Select.Option>
						</Select>
					</div>
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Label htmlFor="preview-editor-slug">Slug</Label>
						<Input
							id="preview-editor-slug"
							name="slug"
							form="preview-editor-form"
							defaultValue="designing-a-calmer-editor"
						/>
					</div>
					<div mix={[vstack({ gap: 2, align: "stretch" })]}>
						<Label htmlFor="preview-editor-tags">Tags</Label>
						<Input
							id="preview-editor-tags"
							name="tags"
							form="preview-editor-form"
							defaultValue="design, writing"
						/>
					</div>
				</>
			}
			labels={{ settings: "Settings", closeSettings: "Close settings", sidebar: "Post settings" }}
			mix={[is("100%")]}
		>
			<form
				id="preview-editor-form"
				method="post"
				action="/examples/posts/calmer-editor"
				mix={[vstack({ gap: 4, align: "stretch" })]}
			>
				<h2 mix={[m(0), text("2xl"), weight("semibold"), fg("neutral.emphasis")]}>
					Designing a calmer editor
				</h2>
				<p mix={[m(0), leading("relaxed"), fg("neutral")]}>
					An editor earns trust by saying less. Saving happens on its own and says so quietly in the
					corner; publishing is the one loud button, and it stays disabled until there is something
					new to publish.
				</p>
				<p mix={[m(0), leading("relaxed"), fg("neutral")]}>
					Everything about the post that is not the post — its slug, its tags, who can read it —
					lives in the sidebar, out of the way of the words.
				</p>
			</form>
		</EditorLayout>
	),
};
