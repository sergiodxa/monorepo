---
title: Parley
headline: A team chat where teammates type and post live over a stream, and every action is still a plain form
summary: An invented team chat with channels, DMs, threads, reactions and search, where teammates type and post live over a stream and every action is still a plain form.
cover: thread
shots:
  - id: thread
    page: "c/launch-v3?thread=l3"
    alt: Parley's launch-v3 channel with the sidebar of channels and DMs, a log grouped by day and author, and a thread open in a panel beside it.
  - id: sidebar
    page: "c/launch-v3"
    highlight: "[data-slot='app-shell-sidebar']"
    alt: The sidebar with Home, search, the channels and the direct messages, each with its unread count and mention badge.
  - id: message-group
    page: "c/launch-v3"
    highlight: "#msg-l3"
    alt: A message with a numbered list and its thread summary showing two replies and who wrote them.
  - id: reactions
    page: "c/launch-v3"
    highlight: "#msg-l2"
    alt: A message with two image attachments and its reaction pills, one of them the visitor's own.
  - id: composer
    page: "c/launch-v3"
    highlight: "[data-slot='composer']"
    alt: The composer with formatting buttons, attach, emoji and a send button.
  - id: palette
    page: "c/launch-v3"
    click: "button[aria-label='Jump to a conversation']"
    highlight: "dialog[open]"
    alt: The quick switcher open, listing channels, direct messages and people.
  - id: search
    page: "search?q=launch"
    alt: Message search results for launch, each with its channel, author and the matching line.
  - id: phone-list
    page: ""
    viewport: phone
    alt: Parley on a phone, opening on the stacked list of channels and direct messages with unread counts.
---

Parley is an invented team chat for Fernhill, a made-up eight-person studio shipping version 3
of its garden-planning app. The visitor joins as Sam Rivera and finds the channels and direct
messages mid-launch: a checklist pinned in `#launch-v3`, release notes behind a flag, a canary
alert in `#deploys`. Raspberry on oat, a neo-grotesque face, and faces on rounded-square tiles
wearing presence dots.

The demo sets out to show a chat app that feels alive without giving up plain HTML. While a
conversation is open, teammates type and post through a stream of JSON lines from the server,
presence dots flip, and a teammate answers what the visitor sends. Underneath, every action —
sending, reacting, editing, deleting, pinning, marking read — is a form that posts without
script, and what the visitor does lives in their own cookies so a reload keeps it.

## The brief

Team chat is a dense genre. The sidebar has to say at a glance where something new is and where
someone named you, without making every channel shout. A conversation must open on the newest
line and mark where you stopped reading. Messages from one person should read as a run, with
days separated. Reactions have to answer on the tap, threads must open without losing the
channel, and search and a quick switcher have to reach anything. On top of that, the app is
live: other people type and post while you watch.

Parley takes on all of these. It also takes on the parts a static demo would skip: a teammate
who answers the visitor, a "seen" report so a reload does not replay the live lines, Undo after
a delete, and a phone layout where the list, the conversation and the thread are stacked
screens.

## A sidebar that knows what is new

The [AppShell](/api/ui/app-shell) sidebar holds Home, Search, the channels and the direct
messages. A channel with unread lines turns bold and carries its count; a solid badge marks a
conversation where someone mentioned the visitor; a teammate's tile wears a presence dot. Home
is the catch-up: every conversation with unread lines, those lines and a way to mark them read.

![The sidebar with the channels and direct messages, unread counts and mention badges](/showcase/parley/sidebar.webp "Bold rows mean unread, solid badges mean someone named you, and dots show who is around.")

Each conversation is folded together in `model.ts`: the workspace's history with the visitor's
own messages, edits, deletions, reactions, pins and the live lines they watched arrive, grouped
by day and author, with what is unread and where the "New" divider sits. The cookies in
`state.ts` hold where the visitor last read each conversation, so the counts survive a reload.

## A log that reads like chat

A conversation opens on its newest line inside a [MessageScroller](/api/ui/message-scroller).
Days sit under sticky separators, a [Marker](/api/ui/marker) draws the "New" divider at the
last read, and each run of one person's lines is a [MessageGroup](/api/ui/message-group) with
its avatar, time, reactions, thread summary and an action bar. Message text is Markdown rendered
with [@sdxc/markdown](/api/markdown), so code, links, lists, mentions and channel links render
as they would in a real workspace, and attached files show as
[Attachment](/api/ui/attachment) previews.

![A message with a numbered list and its thread summary showing two replies](/showcase/parley/message-group.webp "A thread summary under a message shows who replied and when, and opens the thread beside the channel.")

A thread opens at `?thread=<id>` in a panel beside the conversation, inside a
[SplitView](/api/ui/split-view), with the message, its replies and a reply box. The same panel
shows `?details=about`, `members` with their presence, or `pins`, each with a close link back
to the conversation alone. Because each of these is an address, the panel works without script
and a link to a thread opens it.

## Reactions that answer on the tap

Every message has quick reactions and an Add reaction button. A
[ReactionBar](/api/ui/reaction-bar) pill highlights the visitor's own, lists who reacted on
hover, and toggles on a tap. The [reactionSync](/api/ui/mixins/reaction-sync) mixin updates the
pill at once while its form posts in the background. One emoji picker, an island in
`emoji-panel.tsx`, serves the composer and every message: it opens beside whichever button
asked, inserts a pick at the composer's caret or adds it as a reaction in place.

![A message with two image attachments and its reaction pills, one of them the visitor's own](/showcase/parley/reactions.webp "The outlined pill is the visitor's own reaction; a tap toggles it before the post returns.")

Emoji come from [@sdxc/emoji](/api/emoji), with four Fernhill custom emoji overlaid on the
built-in catalog, so the composer's `:name:` suggestions, rendered messages and reactions all
agree on what a shortcode means and draw custom ones as images. Without script every pill is
still a form, and Add reaction opens a page where each emoji is a submit button.

## Teammates who type and post live

While a conversation is open, a small island in `live.tsx` follows the server's stream. The
server side, `live-stream.tsx`, first answers whatever the visitor last posted, then plays the
conversation's scripted lines one by one, each with a typing pause, and flips a teammate's
presence along the way:

```tsx
if (line.typing > 0 && person !== undefined && !person.bot) {
	emit({ type: "typing", person: line.author, name: person.name.split(" ")[0] ?? "" });
	await wait(line.typing, signal);
	if (signal.aborted) return;
}
let entry = liveEntry(key, index, Date.now(), state);
if (entry === null) continue;
emit({
	type: "message",
	person: line.author,
	target: "log",
	html: await lineHtml(entry, page, false),
	seen: { live: String(index) },
});
```

Each event is a JSON line. The island shows a [TypingIndicator](/api/ui/typing-indicator) for
`typing`, inserts the server-rendered HTML of each `message` into the log, and flips presence
dots for `presence`. It posts each event's `seen` field back, so the visitor's cookies record
how many live lines they have watched and a reload shows them as history. Bots post without a
typing pause.

## Composing, searching and jumping

The [Composer](/api/ui/composer) carries [ComposerFormat](/api/ui/composer-format) buttons for
bold, italic, strikethrough, code, links and lists, a [MentionMenu](/api/ui/mention-menu) for
`@` names, an emoji button and a [FileTrigger](/api/ui/file-trigger) for attachments. Enter
sends and Shift+Enter adds a line. Posting works without script as a plain form that redirects
to the new message's anchor. An edit opens inline at `?edit=<id>`, and a delete's toast offers
Undo, which restores the message and returns to it.

![The composer with formatting buttons, attach, emoji and a send button](/showcase/parley/composer.webp "The composer formats Markdown, suggests mentions and emoji, and sends as a plain form without script.")

Search reads `search?q=&in=`, with a channel facet in the address that counts matches per
channel, and highlights the matching words in each result.

![Message search results for launch, with a channel facet](/showcase/parley/search.webp "The channel facet lives in the address, so a narrowed search is a link.")

⌘K opens a [CommandPalette](/api/ui/command-palette) of recent places, channels with their
topics, and people, and `?` lists every key in [KeyboardHelp](/api/ui/keyboard-help).

![The quick switcher open, listing recent places, channels and people](/showcase/parley/palette.webp "The quick switcher reaches any channel, person or command from the keyboard.")

## A phone layout of stacked screens

On a phone, Home opens on the list of channels and direct messages with their last line, time
and unread count, the parent screen each conversation stacks on. A conversation has a back link
up to the list, and a thread becomes its own stacked screen.

![Parley on a phone, opening on the stacked list of channels and direct messages](/showcase/parley/phone-list.webp "On a phone the conversation list is a screen of its own, and each conversation stacks on it.")

## Takes after

- [Slack](https://slack.com) — the sidebar that bolds unread channels and badges mentions,
  threads in a panel beside the channel, and the ⌘K quick switcher; Parley keeps each panel an
  address that works without script.
- [Discord](https://discord.com) — messages grouped by author under day separators, with
  reaction pills that list who reacted.

## Where to start reading

- [`live-stream.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/parley/live-stream.tsx)
  and [`live.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/parley/live.tsx)
  — the server's stream of JSON lines and the island that follows it.
- [`model.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/parley/model.ts)
  — the workspace's history with one visitor's cookies folded in.
- [`emoji-panel.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/parley/emoji-panel.tsx)
  — one picker for the composer and every message, with instant reactions.
