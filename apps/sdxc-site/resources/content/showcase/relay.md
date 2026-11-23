---
title: Relay
headline: A three-pane support inbox where the open conversation is the address and triage never leaves the page
summary: An invented support inbox and light CRM with mailboxes, the conversation list and the open conversation on one Mail-like screen, triaged from the keyboard, with each conversation at its own address.
tagline: A support inbox run from the keyboard
cover: inbox
shots:
  - id: inbox
    page: "inbox/2048"
    wait: 1200
    alt: Relay's inbox in three panes, the mailbox sidebar, a list of two-line conversation rows with unread dots, and the open conversation with its reply form.
  - id: list
    page: "inbox/2048"
    highlight: "ul[aria-label='Inbox']"
    alt: The conversation list, two-line rows with sender, subject, snippet and time, unread rows in bold with a blue dot and the open one selected.
  - id: assign
    page: "inbox/2048"
    click: "button[commandfor='relay-assign-menu']"
    highlight: "#relay-assign-menu"
    wait: 1200
    alt: The Assign to menu open over the conversation, listing teammates with the current assignee marked.
  - id: palette
    page: "inbox/2048"
    click: "button[commandfor='relay-palette'][command='show-modal']"
    highlight: "#relay-palette"
    alt: The command menu open, a search field above Recent and Navigation groups, each row showing its g-key sequence.
  - id: keys
    page: "inbox/2048"
    click: "button[aria-label='Show keyboard shortcuts']"
    highlight: "#relay-keys"
    alt: The keyboard shortcuts sheet, listing j and k, r, a, s and e for triage, and Command K, slash and question mark.
  - id: contact
    page: "contacts?contact=priya-nair"
    highlight: "[data-slot='detail-sheet-panel']"
    wait: 1200
    alt: A contact's detail sheet beside the contacts table, with properties and an activity timeline.
  - id: phone
    page: "inbox/2048"
    viewport: phone
    wait: 1200
    alt: One conversation filling a phone screen, with a back link to the list and the reply form below the messages.
---

Relay is an invented support inbox and light CRM for the support team of Fernway, an invented project tool. It has mailboxes and saved views, conversations, contacts, reports and settings. The art direction is Mail-like: white panes on pale grey, system blue for the selected row and the unread dots, and the system font throughout.

The build shows a three-pane layout, sidebar, list and reading pane, made entirely of server-rendered addresses. The open conversation is part of the URL, so `j` and `k`, a reload and a shared link all land on the same row. Triage happens in place: archiving, snoozing, assigning and replying change only what they touch, and none of them adds a history entry. With scripts off, every one of those actions is still a form that posts and redirects back.

## The brief

A support inbox is a tool people live in for a whole shift. It needs to show a lot at once without becoming a wall of text. It has to move through dozens of conversations quickly, mostly from the keyboard. It has to make unread state obvious. And it has to let a person act, archive, snooze, assign, reply, without losing their place in the list. A layout that opens each conversation on its own page fails the last point. A client-side app that keeps the selection in memory fails reloads and shared links.

Relay keeps the selection in the URL, as `inbox/2048` or `billing/2047`, and treats every screen as a server render. It gets the single-page feel from frames: the shell stays mounted, the main area swaps, and the conversation pane reloads on its own when a reply or an assignment changes it. Phones fall back to one pane per route, as a native mail app does.

## Three panes from one SplitView

The inbox is a [SplitView](/api/ui/split-view) with the conversation list on one side and the open conversation on the other. The [AppShell](/api/ui/app-shell) sidebar beside it holds the mailboxes (Inbox, Assigned to me, Unassigned, Starred, Snoozed, Archived) and the saved views Billing, Bug reports and Enterprise, each with its unread count.

```tsx
<SplitView
	cookiePath={demoAppCookiePath("relay")}
	id="relay-inbox"
	list={<ConversationList view={view} selected={selected} archived={archived} />}
	detail={selected ? <DemoAppFrame name={CONVERSATION_FRAME} app="relay" … /> : null}
	empty={<NoSelection view={view} />}
	active={selected ? "detail" : "list"}
	layout={layout}
	cookie={SPLIT_COOKIE}
/>
```

The split's width is kept in the `relay-split` cookie under Relay's own path, and the server reads it before rendering. A visitor who drags the divider gets the same layout on the next load, with no jump after hydration. The shell's collapsed state has a cookie of its own. Because both cookies change the markup, the edge cache keeps one copy per combination of their values. Below 64rem the sidebar turns into a sheet, so a laptop-width window still shows the list beside the conversation.

The list rows are two lines each: the sender and time, then the subject and a snippet. Unread rows are bold with a blue dot, and the open row takes the accent colour. Each row is a link to its conversation's address, and it starts loading that page when the pointer or focus rests on it.

![The conversation list, two-line rows with sender, subject, snippet and time, unread rows in bold with a blue dot and the open one selected](/showcase/relay/list.webp "Unread rows are bold with a dot, and the open conversation takes the accent colour.")

## Triage in place

The conversation pane is its own frame. Opening a conversation is an ordinary navigation, so the selected row, the unread counts and the phone layout follow it. Acting on a conversation reloads only what changed. A reply or an assignment redraws the pane alone. Snooze and mark unread update the list. Star and read are [OptimisticToggle](/api/ui/optimistic-toggle)s that flip as soon as they are pressed and post in the background.

Archiving moves to the next conversation and raises a [Toasts](/api/ui/toasts) message with Undo. The redirect names the archived conversation in its own `archived` parameter, so the list hides it however the page is loaded. Undo posts the restore and lands on the conversation it brought back.

Assigning uses a [Menu](/api/ui/menu) opened through the Command Invoker API: a button with `commandfor="relay-assign-menu"`. Each teammate is a menu item that posts, and the current assignee is marked with `aria-current`.

![The Assign to menu open over the conversation, listing teammates with the current assignee marked](/showcase/relay/assign.webp "Assigning is a native popover menu whose items post, with the current assignee marked.")

After a post through the main area, every form returns to what the server rendered: empty after a send, and still holding the typed text when it comes back with a problem. Focus stays on the control that was used, or on its replacement when the post redrew it.

## A keyboard layer with a visible map

Triage is fastest from the keyboard. `j` and `k` (or the arrow keys) move to the next and previous conversation, and each move is a navigation to that conversation's address. `r` replies, `a` assigns, `s` snoozes, `e` archives and `u` marks unread, and `g` sequences such as `g c`, `g r` and `g s` jump to contacts, reports and settings. `/` searches contacts.

Most of these keys are declared in the server's HTML, as a `data-shortcut` attribute on the very button or link they press: `data-shortcut="e"` sits on the Archive button. The shortcuts behavior in `@sdxc/ui` reads those attributes, resolves a key by layer so an open dialog answers before the page, and skips single keys while the visitor is typing in a field. The key and the control can never drift apart, because they are the same element.

⌘K opens a [CommandPalette](/api/ui/command-palette) in a native `<dialog>`, with a Recent group, then groups for navigation, conversations and contacts. It jumps to any screen, any conversation or any contact, and each navigation row shows its `g` sequence, so the palette also teaches the keys.

![The command menu open, a search field above Recent and Navigation groups, each row showing its g-key sequence](/showcase/relay/palette.webp "⌘K finds any screen, conversation or contact from one field.")

`?` opens a [KeyboardHelp](/api/ui/keyboard-help) sheet that lists every shortcut by group. The server renders it like any other island, titled at `h2`, so it is in the page before script loads, and the user menu's Keyboard shortcuts item opens the same sheet.

![The keyboard shortcuts sheet, listing j and k, r, a, s and e for triage, and Command K, slash and question mark](/showcase/relay/keys.webp "Every key the inbox answers to is listed in one sheet, rendered on the server.")

## Contacts with their whole view in the URL

Contacts is a [Table](/api/ui/table) of everyone who has written in. Search, plan and company filters, sort, density and the visible columns all live in the query, so `contacts?plan=Enterprise&sort=-ltv` or `contacts?density=comfortable&props=email&props=conversations` is a view a teammate can open. A [FilterBar](/api/ui/filter-bar) holds the controls, and [ViewOptions](/api/ui/view-options) picks density and columns. Lifetime value renders as currency, and last seen as a [RelativeTime](/api/ui/relative-time). The filter and sort links are built from the address without its one-time toast, so following one never shows a toast again.

A `?contact=` parameter opens a [DetailSheet](/api/ui/detail-sheet) beside the table, with the contact's properties in a [PropertyList](/api/ui/property-list) and their activity in a [Timeline](/api/ui/timeline). The table keeps its place behind the sheet. The sheet's body, the contact's activity and their conversations each stream in as cached frames over [Skeleton](/api/ui/skeleton) placeholders of the same size.

![A contact's detail sheet beside the contacts table, with properties and an activity timeline](/showcase/relay/contact.webp "A contact opens in a sheet from ?contact=, and the table stays put behind it.")

Reports reuse the same pieces in a second context: [StatCard](/api/ui/stat-card)s for the last two weeks of volume and response times, each with its change from the two weeks before, and a [Chart](/api/ui/chart) of daily volume against the same days one period earlier. Loading, first-run and error states are each one link away, at `contacts?state=loading`, `contacts?state=first-run` and `reports?state=error`.

## One pane per route on a phone

On a phone the split shows one pane at a time, chosen by the address. The list route shows the list. A conversation route shows the conversation with a back link to its mailbox, which is the split view's own back link pointing at the view's address.

![One conversation filling a phone screen, with a back link to the list and the reply form below the messages](/showcase/relay/phone.webp "On a phone the conversation route shows the conversation alone, with a back link to its mailbox.")

## Takes after

- [Apple Mail](https://www.apple.com/macos/) — sidebar, list and reading pane on one screen, blue unread dots, and a selected row in the accent colour. Relay keeps the selection in the URL.
- [Linear](https://linear.app) — `j`/`k` triage, single-letter actions, ⌘K, and a peek sheet beside a list.
- [Slack](https://slack.com) — unread counts in the sidebar, and bold rows with a dot for anything you have not read.

## Where to start reading

- [`relay/inbox.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/relay/inbox.tsx) — the three-pane screen, with the selection taken from the URL.
- [`relay/conversation.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/relay/conversation.tsx) — the conversation pane, the frame a reply or an assignment reloads.
- [`relay/contacts.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/relay/contacts.tsx) — a table whose whole view lives in the query.
