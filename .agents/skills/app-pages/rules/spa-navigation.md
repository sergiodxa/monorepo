---
title: SPA Navigation with Server Rendering
impact: CRITICAL
tags: [navigation, frames, spa, progressive-enhancement, history, focus]
---

# SPA Navigation with Server Rendering

An app is used all day, so it must feel like a SPA: a click on a tab, a filter or a like changes
what it changes and nothing else. It must also render whole on the server and keep working with
script off. Remix frames give both from the same markup.

## The baseline

Once script has loaded:

- **The shell stays mounted.** The sidebar, top bar and tab bar never re-render on navigation.
  Each screen wraps its main area in a blocking `<Frame name="main" src={its own address}>`, so
  the server inlines it into the document and a request carrying `X-Remix-Target: main` answers
  only that fragment.
- **GET links and forms** (nav items, tabs, rows, filters, sort, density, pagination) carry
  `data-rmx-target="main"`. The address and history follow, and Back and Forward restore the
  view and its scroll position.
- **Actions never move history.** A POST form reloads its frame in place through the frame's
  `reload({ src, method, body })`, following the 303 with the target kept. A form that targets
  a frame by attribute alone moves the address bar to its `action`. A toggle that needs no new
  markup (like, save, follow) flips at once and posts in the background, answering 204.
- **The shell catches up after each swap.** It updates the document title, the current nav item,
  the breadcrumbs, focus (the new `h1`) and a polite announcement from a manifest the fragment
  carries. Toasts render inside the swapped fragment, so an action's toast appears.
- **Shell state that an action changes** (unread or failing counts) lives in its own named frame,
  reloaded after the action.

With script off, every address renders the full page and every form is an ordinary post with a
redirect back.

## Checks

- A target with no mounted frame navigates the top frame without any error, so confirm each
  target's frame exists on every screen that links to it.
- Attributes the client sets on morphed markup belong in `data-rmx-preserve-attrs`.
- Prefetched targeted links are stored under their address and target.

## Tests

Every app has browser tests that fail on a page load:

- a marker set on a shell element survives every navigation and action, and
  `performance.getEntriesByType("navigation")` stays at one entry;
- `navigation.entries()` grows on GET navigations and stays the same on actions;
- Back and Forward restore the address, the main area and the scroll position.

The demo apps on sdxc.dev (`apps/sdxc-site/resources/views/demo-apps/`) share this plumbing; read
it before building your own.
