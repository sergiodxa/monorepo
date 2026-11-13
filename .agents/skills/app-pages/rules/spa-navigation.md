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
  carries. The fragment also carries the action's toast as a marker with a fresh id, which the
  page's toast region raises once.
- **Shell state that an action changes** (unread or failing counts) lives in its own named frame,
  reloaded after the action.

With script off, every address renders the full page and every form is an ordinary post with a
redirect back.

## Checks

- **Mark links when they are used, not once on load.** A component that re-renders on hydration
  (an app shell's nav, for one) drops attributes the client added. Set `data-rmx-target` from
  capture listeners for pointer, focus, click and submit instead, which also lets prefetch see
  the target.
- **Re-apply the title after the navigation settles.** The runtime restores the top document's
  title when a targeted navigation finishes, so set it again on `navigatesuccess`.
- **Use timers, not `requestAnimationFrame`, for post-swap work.** Animation frames pause in a
  background tab, so an announcement or a focus move queued on one never happens.
- **Restore scroll for the panel that scrolls.** The browser restores window scroll only. When
  the main area scrolls inside a panel, save its `scrollTop` per history entry on `navigate` and
  put it back on Back and Forward.
- **A post aimed at an inner frame reloads that frame.** Keep a form's own `data-rmx-target`
  when it names a mounted frame, so it redraws only its part.
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

The demo apps on sdxc.dev share this plumbing in `apps/sdxc-site/resources/views/demo-apps/`;
read it before building your own:

- `main-frame.tsx`: `MainFrame` mounts the blocking `main` frame, and `MainScreen` wraps a
  screen's content with its manifest (title, nav key, crumb, address, toast).
- `main-frame-sync.tsx`: `MainFrameSync`, one island per shell. It claims in-app links and GET
  forms for `main`, sends posts through a frame reload, and syncs the shell, focus,
  announcement, toast and scroll after each swap.
