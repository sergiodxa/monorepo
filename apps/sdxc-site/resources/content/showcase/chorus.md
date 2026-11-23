---
title: Chorus
headline: A social network where likes, votes and new posts answer at once and still work as plain HTML
summary: An invented social network with a live timeline, polls, threads, quotes, grouped notifications and messages, where every like, vote and post works without script.
tagline: A social network that works without script
cover: home
shots:
  - id: home
    page: ""
    alt: Chorus's home timeline between the left nav and a right rail of trends and people to follow.
  - id: composer
    page: ""
    highlight: "[data-slot='chorus-composer']"
    alt: The timeline's composer, with the writer's avatar, a text field and the Post button beside a character ring.
  - id: poll
    page: ""
    highlight: "#post-p-friday-poll"
    alt: A poll post asking what solo founders ship on a Friday afternoon, with its choices and vote counts.
  - id: new-posts
    page: "?arrived=1"
    highlight: "[data-slot='chorus-new-posts']"
    wait: 9000
    alt: The Show new posts pill floating over the top of the timeline.
  - id: rail
    page: ""
    highlight: "aside[aria-label='Trends and people']"
    wait: 2500
    alt: The right rail with a search box, trending topics and people to follow.
  - id: compose-dialog
    page: ""
    click: "[data-slot='chorus'] > header button[commandfor='chorus-compose']"
    highlight: "#chorus-compose"
    wait: 1500
    alt: The New post dialog open over the timeline with the text field focused.
  - id: notifications
    page: "notifications"
    alt: Noor's notifications, with likes and reposts grouped under one line and the faces of who acted.
  - id: phone-home
    page: ""
    viewport: phone
    alt: Chorus's timeline on a phone, with a top bar, a bottom tab bar and a floating compose button.
---

Chorus is an invented social network in coral on warm stone, with a humanist sans, round
initials avatars and pill buttons. Its dozen people are fictional, and the visitor is signed in
as Noor Haddad. It has For you and Following timelines, posts with pictures, link cards, quotes,
polls and threads, profiles with their tabs, grouped notifications, Explore, saved posts and
direct messages.

The demo sets out to show how much of a social app can feel instant while staying plain HTML
underneath. Likes, reposts and saves flip before the server answers, a vote redraws only its
poll, new posts rise into the timeline, and writing a post opens a dialog over the page you are
on. Turn script off and every one of those is still a link or a form that loads a whole page.

The part worth a developer's time is where each behavior lives: the new-posts pill is CSS, the
toggles are forms with an optimistic island, the rail streams in frames over placeholders made
from its own markup, and the compose dialog is one native `<dialog>` whose body is a frame.

## The brief

A timeline app is judged on its small interactions. A like has to register the moment it is
pressed, even on a slow network, and pressing three things quickly must not lose two of them.
Reading should never be interrupted by new content shoving the page down. Composing should not
take you away from what you were reading. Notifications need to collapse a crowd of likes into
one line. And the page around the column — navigation, trends, people to follow — should stay
put as you move.

Chorus takes on each of these, and keeps a version of each that works before script loads.
What the visitor posts, likes, reposts, saves, follows and votes lives in their own cookies, so
the demo remembers them across reloads, and "Reset the demo" in the account menu clears them.

## Toggles that answer before the server does

Every post carries a row of reply, repost, like, views, save and share. Like, repost and save
are [OptimisticToggle](/api/ui/optimistic-toggle) forms: pressing one flips its icon and count
at once and posts in the background, keeping the scroll position and focus where they were. Without script, each
toggle is still a form that posts and returns to the same page.

```tsx
<OptimisticToggle
	action={actionHref(`post/${post.id}`)}
	name="on"
	pressed={on}
	fields={fields(kind)}
	labels={labels}
	pressedContent={
		<Reaction icon={icon(true)} count={counted ? base + 1 : -1} large={large} />
	}
```

Each toggle is kept in a cookie of its own, so three quick presses on three posts never
overwrite each other. Follow works the same way, and its pill is as wide as "Following" in both
states, so pressing it never reflows the row.

Polls are their own frames. A vote posts and redraws only that poll, landing back with the post
in view, so the timeline keeps its place.

![A poll post asking what solo founders ship on a Friday afternoon, with its choices](/showcase/chorus/poll.webp "Each poll is its own frame, so a vote redraws just the poll and leaves the timeline where it was.")

## New posts without moving the page

On home, a "Show N new posts" pill rises over the timeline after a pause, with the faces of who
posted. It is an ordinary link to the timeline with one more arrival, and its entrance is a CSS
animation with a six-second delay, so it appears with or without script. Under reduced motion
the animation shortens to a millisecond, so the pill simply appears.

![The Show 2 new posts pill floating over the top of the timeline](/showcase/chorus/new-posts.webp "The pill is a link with a delayed CSS animation, so it rises on time even with script off.")

```tsx
animation: `chorus-pill-in 420ms cubic-bezier(0.2, 0.8, 0.2, 1) ${PILL_DELAY} both`,
"@keyframes chorus-pill-in": {
	from: { opacity: "0", translate: "0 -1rem", visibility: "hidden" },
	to: { opacity: "1", translate: "0 0", visibility: "visible" },
},
```

With script, the pill's link loads into the column's frame, so only the timeline redraws and
the nav and rail stay as they are.

On every feed, `j` and `k` move a ring between posts through the
[rowNavigation](/api/ui/mixins/row-navigation) mixin, Enter or `o` opens the focused post, and
`?` lists the keys in [KeyboardHelp](/api/ui/keyboard-help). Without script every post's link
stays reachable by Tab.

## Writing without leaving the page

The timeline's composer shows the writer's avatar, a field that grows with its text, and a
footer with the Post button beside a [CharacterCount](/api/ui/character-count) ring. The ring
counts as you type, and Post waits until there is something within the limit to send. Typing a
colon and two letters suggests emoji from [@sdxc/emoji](/api/emoji), and shortcodes expand when
a post renders.

![The timeline's composer with a text field, a character ring and the Post button](/showcase/chorus/composer.webp "The ring counts as you type, and Post stays disabled until the text fits.")

New post, Reply, Quote and the `n` key all open one native `<dialog>` that lives in the shell,
with the field focused. Its body is a frame loaded from the compose address of the control that
opened it, so a reply shows the post it answers with a "Replying to" line, a quote shows the
quoted post under the field, and New post after a reply opens a blank composer again. On a
tablet or desktop it floats near the top of the screen; on a phone it fills it.

![The New post dialog open over the timeline with the text field focused](/showcase/chorus/compose-dialog.webp "One dialog in the shell serves New post, Reply and Quote, its body a frame chosen by the opener.")

Where a post lands depends on what it is. A reply lands back on the page it was written on, at
the same scroll position, with its toast and the updated reply count, and adds no history
entry. A new post opens its own page in the main frame as one step in history, so Back returns
to where it was written. A post the server refuses, or one sent while offline, falls back to the
form's own whole-page submit. Without script, New post still opens the dialog through the
browser's Invoker Commands (`commandfor` and `command`), and Reply and Quote are links to the
compose page.

A link to a Chorus post is drawn as the post itself: inside a post it becomes a quote, and in a
message it becomes a card under the bubble that opens the post.

## A shell that stays mounted

Every screen's column loads into the shared `main` frame, so the left nav, the right rail and
the phone's [TabBar](/api/ui/tab-bar) stay mounted as the visitor moves between Home, Explore,
Notifications, Messages, Bookmarks, Profile and a post. The page title, the current nav item,
focus on the screen's heading and a screen-reader announcement follow each swap, and Back and
Forward restore the column and the timeline's scroll.

The rail's trends and people cards stream in as frames. Each draws its own
[Skeleton](/api/ui/skeleton) from the same markup with the text hidden under bars, so a card
lands at exactly the height it reserved and nothing below it moves. A browser test holds the
cards to their placeholders' height.

![The right rail with a search box, trending topics and people to follow](/showcase/chorus/rail.webp "Trends and people stream in over placeholders drawn from their own markup, so they land without a shift.")

Notifications group likes, reposts and follows under one line — "Ana Sousa and 3 others liked
your post" — with the faces of who acted, while replies and mentions are drawn as posts you can
answer. The newest unread ones carry a tint until they are seen.

![Noor's notifications, with likes and reposts grouped under one line](/showcase/chorus/notifications.webp "A crowd of likes collapses into one line with the faces of who acted.")

## A phone layout of its own

The nav becomes an icon rail on tablets. On a phone it becomes a top bar, a bottom tab bar with
an unread count on notifications, and a floating compose button, while the timeline keeps the
same posts and actions.

![Chorus's timeline on a phone, with a top bar, a bottom tab bar and a floating compose button](/showcase/chorus/phone-home.webp "On a phone the nav becomes a tab bar and a floating compose button over the timeline.")

## Takes after

- [X](https://x.com) — the three-column layout of nav, timeline and rail, and a linked post drawn
  as a quote card; Chorus says "post" and "repost" and keeps every action a form.
- [Bluesky](https://bsky.app) — For you and Following tabs and a new-posts pill that rises over a
  timeline being read; Chorus's pill is CSS and a link.
- [Mastodon](https://joinmastodon.org) — grouped notifications that collapse many likes into one
  line with the faces of who acted.

## Where to start reading

- [`compose-dialog.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/chorus/compose-dialog.tsx)
  — one dialog in the shell whose body is a frame chosen by the control that opened it.
- [`home.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/chorus/home.tsx)
  — the timelines and the CSS-only new-posts pill.
- [`rail.tsx`](https://github.com/sergiodxa/monorepo/blob/main/apps/sdxc-site/resources/views/demo-apps/chorus/rail.tsx)
  — cards that stream in over placeholders drawn from their own markup.
