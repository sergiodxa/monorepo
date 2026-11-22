---
title: Inkwell
headline: A CMS whose save status stays quiet while one button says what publishing will do
summary: An invented CMS for a quarterly magazine, with a posts list that filters from the address, an editor whose save status stays quiet beside one loud Publish, media and settings.
cover: posts
shots:
  - id: posts
    page: "posts"
    alt: Inkwell's posts list, with status tabs, an author filter and search above a table of posts with status dots, authors and edit times.
  - id: filter-bar
    page: "posts"
    highlight: "[data-slot='filter-bar']"
    alt: The posts list's filter bar, with status tabs that count their posts, the author facet, search and the sort.
  - id: editor-bar
    page: "posts/the-letterpress-year"
    highlight: "[data-slot='editor-bar']"
    alt: The editor's sticky bar, with the back link, the post's title, a quiet Edited 39m ago status, Preview and an ink-blue Update button.
  - id: property
    page: "posts/the-letterpress-year"
    click: "[data-slot='property-edit']"
    highlight: "[data-slot='property-popover']:popover-open"
    alt: A property popover open beside the editor, listing the post's status choices with a line describing each.
  - id: quick-edit
    page: "posts?quick=the-letterpress-year"
    highlight: "[data-slot='detail-sheet-panel']"
    wait: 2000
    alt: The quick edit sheet open over the posts list, with the post's title, slug, status and author fields.
  - id: home-stats
    page: ""
    highlight: "[data-slot='stat-group']"
    wait: 2000
    alt: Home's four counts — drafts, scheduled, published this month and changed since publishing — each with a line of context.
  - id: drop-zone
    page: "media"
    highlight: "[data-slot='zone']"
    alt: The media library's drop zone, asking for PNG, JPEG or WebP images, with an Upload files button under it.
  - id: phone-posts
    page: "posts"
    viewport: phone
    alt: The posts list on a phone, with each post as a stacked row.
---

Inkwell is an invented content management system: the editor behind Lantern Review, a made-up
quarterly of essays on reading slowly, making things and the craft of attention. The visitor
works as Maya Okafor, the editor-in-chief, across a home overview of the week, a posts list,
an editor, pages, a media library and settings. Warm paper, an ink-blue accent, serif titles
and soft corners.

The demo sets out to get one thing right that most admin templates get wrong: the save model.
The editor keeps the answer to "is my draft safe?" quiet, and gives the one primary button the
answer to "what will publishing do?". Around it, the posts list is a query you can link to,
quick edit happens in a sheet over the list, and the home panels stream in over placeholders
that hold their exact size.

Nothing a visitor submits is kept. Every form is read with `remix/data-schema` only to pick the
screen and the toast a real CMS would answer with, and a form that fails validation comes back
holding every character typed, with the issue on its field.

## The brief

Publishing tools converge on a few hard rules. Saving and publishing are different acts and
must look different. A save status should be readable but never compete with the content, and
a live post with unsaved edits should say so wherever it appears. Lists of posts need status
tabs with honest counts, facets and search, bulk actions, and a way to fix a title without
opening the editor. Media needs an upload that works as a plain form. Settings need to save the
right amount at a time: one section, or one long form with an explicit save.

Inkwell takes on each of these, built from [@sdxc/ui](/api/ui)'s app components, and renders
every screen on the server so links and forms work with script turned off.

## A quiet status beside one loud button

The editor puts a serif writing column under a sticky bar. The bar holds the back link, the
post's title, a [SaveStatus](/api/ui/save-status) and Preview, then one ink-blue button. The
status says "Saving…", then "Saved", then decays to "Edited 39m ago": present, readable, and
quiet. The button carries the publishing state:

```tsx
function primaryFor(post: Post | null): { label: string; intent: string; disabled: boolean } {
	if (post === null || post.status === "draft") {
		return { label: "Publish", intent: "publish", disabled: false };
	}
	if (post.status === "published" && !post.changed) {
		return { label: "Published", intent: "update", disabled: true };
	}
	return { label: "Update", intent: "update", disabled: false };
}
```

A draft publishes, a queued or edited live post updates, and a live post with nothing new says
so on a disabled button.

![The editor's sticky bar with a quiet Edited 39m ago status, Preview and an ink-blue Update button](/showcase/inkwell/editor-bar.webp "The status reports quietly that the draft is safe, while the one primary button names what publishing will do.")

The post's properties sit beside the column in an [EditorLayout](/api/ui/editor-layout)
sidebar, as rows that open small popovers. Each choice in a popover carries a line saying what
it means — "Only the masthead can read it", "Live on lanternreview.example" — and a live
post whose draft is newer than its published copy shows a Changed badge beside its status.

![A property popover listing Draft, Published and Scheduled, each with a line describing it](/showcase/inkwell/property.webp "Each status explains itself inside its popover, so a choice never needs a help page.")

The post's history streams into the sidebar as a [Timeline](/api/ui/timeline) in a frame of
its own. A failed save keeps every character typed, and the post preview opens as a page that
draws the article in the publication's serif at a reading measure, with a thin bar leading back.

## A posts list that is a query

The posts list is a [Table](/api/ui/table) under a [FilterBar](/api/ui/filter-bar). The status
tabs count what each would show under the current facets, so "Drafts 3" is the number you get
when you click it. An author facet, a tag facet, search and the sort all live in the address,
read with `remix/data-schema` in `posts-query.ts` and applied to the fixtures, so
`posts?status=draft&author=tomas` is a link that opens the same view.

![The posts list's filter bar with status tabs and their counts, search, the author and tag facets, and View](/showcase/inkwell/filter-bar.webp "Each tab counts what it would show under the facets already applied.")

A live post whose draft is newer than its published copy wears a Changed badge in the list, the
same word the editor uses. Selecting rows turns the footer into a
[SelectionBar](/api/ui/selection-bar) for Publish, Unpublish and Delete, which post with their
toast and redraw the list in place.

`?quick=<id>` opens a post's quick edit in a [DetailSheet](/api/ui/detail-sheet) over the list:
title, slug with its live address, status and author, with Previous and Next through the list
and Open editor for everything else. The sheet streams in as its own frame over a placeholder,
and a failed quick edit comes back in the sheet with everything typed.

![The quick edit sheet over the posts list, with title, slug, status and author](/showcase/inkwell/quick-edit.webp "Quick edit fixes a title or a status without leaving the list, and steps to the next post.")

## A home page that streams in without shifting

Home is a light overview of the publication's week. Four [StatCard](/api/ui/stat-card) counts
open their lists: drafts, scheduled posts, published this month with its change, and posts
changed since publishing. Below them sit the drafts in progress, what is queued to go out, the
masthead's recent activity and the reader comments.

![Home's four counts, each with a line of context](/showcase/inkwell/home-stats.webp "Each count opens its list, and its footer says what the number means this week.")

The shell and the page's primary content arrive first. The stats, drafts, schedule, activity
and comments each stream in as their own cached frame over a placeholder of the same height.
The placeholders in `placeholders.tsx` keep a text bar at its line's real height and give a
region the minimum height of its content, and a browser test checks each part against its
placeholder at a phone's and a desktop's column width, so a frame landing never moves what
follows it. The comments panel shows one failing region keeping to its own box, and its Retry
link reloads only that panel.

## Media and settings

The media library opens with a [DropZone](/api/ui/drop-zone) that uploads through a plain form,
then the files as a [GridList](/api/ui/grid-list) or a list, chosen in the address with
`media?view=list`. `?item=<id>` opens an attachment sheet with the file's facts, its alt text
and its caption.

![The media library's drop zone, asking for PNG, JPEG or WebP images](/showcase/inkwell/drop-zone.webp "The drop zone is a real file input inside a form, so an upload works before script loads.")

Settings has a section nav that is the parent page on phones. General is a set of
[SettingsSection](/api/ui/settings-section) blocks that each save on their own; Publishing is
one long form with a sticky [SaveBar](/api/ui/save-bar) that appears with unsaved changes; Team
is the masthead with an invite form.

The [AppShell](/api/ui/app-shell) sidebar groups the nav by task, with the drafts and scheduled
queues as saved views carrying their counts. It mounts once while `main` swaps between Home,
Posts, Pages, Media, Settings and the editor. Tabs, sort, search and saved views push one history
entry each; bulk actions, quick edit, editor saves, media details and settings forms post into
`main` with their toast and add none. On a phone the table keeps title and status and folds the
author into the row.

![The posts list on a phone, with status tabs wrapping and each post as a compact row](/showcase/inkwell/phone-posts.webp "On a phone the list keeps title and status, and the facets fold into one Filters menu.")

## Takes after

- [WordPress](https://wordpress.org) — the posts list with status count tabs, quick edit and bulk
  actions, and properties edited in popovers beside the writing column.
- [Ghost](https://ghost.org) — a calm serif editor where the status line says the draft is saved
  and Publish is the one primary action.
- [Sanity](https://www.sanity.io) — a save status that decays from "Saved" to an edit time, and a
  document history beside the editor.

## Where to start reading

- [`editor.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/inkwell/editor.tsx)
  — the sticky bar's quiet status and loud button, and the popover properties.
- [`posts-query.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/inkwell/posts-query.ts)
  — the posts list read from the address with `remix/data-schema`.
- [`submit.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/inkwell/submit.tsx)
  — where each form sends the visitor, and how a refused form comes back as typed.
