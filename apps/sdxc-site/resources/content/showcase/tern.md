---
title: Tern
headline: A chat assistant whose streamed replies are server HTML, and whose send button is a form that works with script off
summary: An invented AI chat assistant with replies that stream in word by word, a thinking trace, code and tables, a canvas beside the chat, projects and sharing, and sending that works without JavaScript.
tagline: An AI chat that streams word by word
cover: chat
shots:
  - id: chat
    page: "c/debounce-search"
    wait: 1200
    alt: A Tern conversation with a "Thought for" disclosure above a reply that holds headings, a code block with a copy button and a table, and the pill composer below.
  - id: activity
    page: "c/debounce-search"
    click: "[data-slot='activity-summary']"
    highlight: "[data-slot='activity']"
    alt: The open thinking trace, a plan note above steps for a file read, a test run, a planning step and two commands, the commands expandable.
  - id: code
    page: "c/debounce-search"
    highlight: "[data-slot='code-block']"
    alt: A code block inside a reply, headed by its file name debounce.ts, with a copy button.
  - id: composer
    page: "c/debounce-search"
    highlight: "[data-slot='composer']"
    alt: The pill-shaped composer, a text field above an attach button, a hint reading Enter to send and Shift Enter for a new line, and a round send button.
  - id: canvas
    page: "c/debounce-search?canvas=open"
    highlight: "[data-slot='tern-canvas']"
    wait: 1200
    alt: The canvas beside the chat, a document of code with its own title bar and close link.
  - id: models
    page: "c/debounce-search"
    click: "button[commandfor='tern-model-menu']"
    highlight: "#tern-model-menu"
    alt: The model menu open, listing Tern Glide, Soar and Dive, each with a one-line description.
  - id: share
    page: "c/debounce-search"
    click: "button[commandfor='tern-share'][data-variant='ghost']"
    highlight: "#tern-share"
    alt: The share dialog, with the chat's public link in a box beside a copy button.
  - id: phone
    page: ""
    viewport: phone
    alt: Tern's new-chat screen on a phone, a greeting above four suggestion cards and the pill composer.
---

Tern is an invented chat assistant with three fictional models: Tern Glide for quick answers, Tern Soar for writing and code, and Tern Dive for hard problems. It has conversations, a history grouped by day with pinned chats, projects with instructions and files, a canvas beside the chat, read-only shared links, search and settings. The art direction is dusk violet on lavender greys, with a rounded face and a pill-shaped composer. Replies are canned: four topics with two variants each, chosen by the words a message uses.

What makes Tern worth reading is that a streamed reply is not a client-side stream at all. A send is an ordinary form post that works with JavaScript off. The server answers with the whole reply already rendered as HTML, and an island replays it word by word, with Stop, a thinking trace, and focus kept in the composer. Every screen renders on the server, and the app still moves like a single-page app.

## The brief

Chat assistants have a recognisable shape, and several of their parts are hard to build well. The composer has to grow with its text, send on Enter, take a new line on Shift+Enter, and turn into Stop while a reply arrives. The reply has to appear progressively, with rich content (headings, lists, tables, code with copy) settling into place without layout jumps. The conversation has to scroll so that a new question sits at the top while its answer fills in below. And the shell around it, history, projects, a model picker, sharing, has to stay put while you move between chats.

Tern takes all of that on, with two constraints. The demo stores nothing on the server, so a conversation's state has to travel with the page. And everything has to work before script loads. The chat components it needs, [Composer](/api/ui/composer), [ComposerSubmit](/api/ui/composer-submit), [MessageScroller](/api/ui/message-scroller), [Activity](/api/ui/activity) and the [streamTarget](/api/ui/mixins/stream-target) mixin, live in `@sdxc/ui/chat`, and Tern is where they are proven.

## A reply that streams from server HTML

When a visitor sends a message, the form posts the thread to the server, which picks a reply and renders it in full: headings, lists, tables, quotes and code blocks, set with [Typeset](/api/ui/typeset)'s chat preset. The [streamTarget](/api/ui/mixins/stream-target) mixin on the reply then replays that HTML word by word, revealing each block as it is reached. Stop freezes the reply where it is. Under reduced motion the reply appears at once, and with script off it simply arrives whole. A short CSS fallback paints the reply even if the script never runs.

Because the reply is real markup from the start, its code blocks are complete components. Each one is a [CodeBlock](/api/ui/code-block) headed by its file name, with syntax highlighting and a copy button, and nothing about it depends on the stream finishing.

![A code block inside a reply, headed by its file name debounce.ts, with a copy button](/showcase/tern/code.webp "Code in a reply is a full CodeBlock with copy, since the reply arrives as finished HTML.")

Each turn sits in a [MessageScroller](/api/ui/message-scroller). User turns are scroll anchors, so a new question lands at the top of the viewport and its answer fills the space below it, the way people expect from a chat app. User turns can carry attached files, and each turn offers copy, edit, regenerate and feedback. Copy is a [CopyButton](/api/ui/copy-button), and edit opens a [Dialog](/api/ui/dialog) with the message in a text area.

## A thinking trace above each reply

Above each reply sits an [Activity](/api/ui/activity) disclosure labelled "Thought for" and the number of seconds. Inside it are Tern's plan, then the files it read, the web searches it ran and the commands it ran. A command step opens onto its output.

![The open thinking trace, a plan note above steps for a file read, a test run, a planning step and two commands, the commands expandable](/showcase/tern/activity.webp "The trace lists the plan and every step, and a command step opens onto its output.")

The disclosure is a native `<details>` element, so it opens and closes without script. A newly sent message's reply opens it and replays the steps one at a time under a shimmering "Thinking", with the current step showing moving dots. Replies loaded from history keep it closed, so a long conversation reads as answers rather than process.

## A composer that sends and stops

The input is a [Composer](/api/ui/composer): a text field that grows up to twelve lines with `field-sizing`, a toolbar, and a hint line that truncates on narrow screens and hides on touch. [ComposerSubmit](/api/ui/composer-submit) is the island behind the send button. Enter sends, Shift+Enter adds a new line, the field clears after a send, and Send turns into Stop while a reply streams. Escape stops too. Typing a colon suggests emoji shortcodes through [@sdxc/emoji](/api/emoji), and message text expands shortcodes such as `:tada:` when it is displayed.

![The pill-shaped composer, a text field above an attach button, a hint reading Enter to send and Shift Enter for a new line, and a round send button](/showcase/tern/composer.webp "The composer grows with its text, and its send button turns into Stop while a reply streams.")

A new chat opens on a greeting with four suggestions. Each suggestion is a button that submits itself, so tapping one starts a conversation with no extra step.

## A conversation that carries its own state

The demo keeps nothing on the server. Every form on a chat page carries the thread back in one hidden field: the saved conversation, how many of its turns are kept, and the messages sent on top of it since. Sending, regenerating and editing all post that field. The server rebuilds the conversation from it, adds the new turn, and renders the next state. `thread.ts` describes the shape. It is a small idea that makes a multi-turn chat possible on top of stateless, cacheable pages.

The model picker in the top bar is a [Menu](/api/ui/menu) opened through the Command Invoker API. On a saved chat each model is a `?model=` link, so the choice is part of the address and survives a reload. A chat with unsaved turns posts the choice with its thread instead, so nothing typed is lost.

![The model menu open, listing Tern Glide, Soar and Dive, each with a one-line description](/showcase/tern/models.webp "Each model is a link that sets ?model=, so the choice lives in the address.")

## A canvas and a shell that stay in place

`?canvas=open` puts a canvas beside the chat in a [SplitView](/api/ui/split-view), with a handle to resize the two. The canvas streams in as its own frame over a placeholder whose bars follow lines of code, so it lands at its final size. A project's files and the settings usage panel stream in the same way.

![The canvas beside the chat, a document of code with its own title bar and close link](/showcase/tern/canvas.webp "The canvas opens from ?canvas=open beside the chat, and streams in at its final size.")

The sidebar stays mounted while only the main pane swaps between chats, projects, search and settings. Focus moves to the new screen's heading so a screen reader hears its name, and Back and Forward restore the pane and its scroll. Sending, regenerating and editing reload the pane in place without adding history entries. Pin, Delete with Undo, and every settings form post the same way and raise their [Toasts](/api/ui/toasts) message in place. ⌘K opens a [CommandPalette](/api/ui/command-palette) that finds any chat or project. History and list links prefetch on intent, and every page is cached at the edge and kept out of search engines.

Share opens a dialog with the chat's public link and a [CopyButton](/api/ui/copy-button), plus a way to open the read-only view in a new tab. The shared view at `share/<id>` renders the conversation without the shell.

![The share dialog, with the chat's public link in a box beside a copy button](/showcase/tern/share.webp "Share shows the public link with a copy button, and the read-only view opens in a new tab.")

On a phone the sidebar becomes a drawer, and the new-chat screen stacks its suggestions above the composer. A browser test checks that no Tern screen scrolls sideways at 375 pixels.

![Tern's new-chat screen on a phone, a greeting above four suggestion cards and the pill composer](/showcase/tern/phone.webp "On a phone, the suggestions stack above the composer and nothing scrolls sideways.")

## Takes after

- [ChatGPT](https://chatgpt.com) — a model picker in the top bar, a canvas beside the chat, projects, and shared read-only links. In Tern the model and the canvas are both part of the address.
- [Claude](https://claude.ai) — a reasoning disclosure above each reply, and copy, edit and regenerate on every turn.

## Where to start reading

- [`tern/conversation.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tern/conversation.tsx) — the thread, the composer and the streamed reply.
- [`tern/thread.ts`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tern/thread.ts) — the hidden field that carries a conversation's state through every form.
- [`tern/activity.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/tern/activity.tsx) — the thinking trace built on `Activity`.
