---
title: Security
description: Which releases get fixes, and how to report something privately.
lastUpdated: 2026-09-21
---

There is one line of releases, published from `main`, and the fix for a security problem
goes out on the next release date. That is the whole policy, and the rest of this page is
what it means for a version you have pinned.

## Which releases get fixes

The next one. A fix lands on `main` and ships with the dated release published after it,
together with every public package that depends on the one it changed — those republish
the same day so their pins move with it, so a fix reaches the package you installed
directly and the packages underneath it on one date.

Nothing is backported. There are no maintenance branches, so an earlier date is never
republished with a fix in it: an older version keeps working exactly as it was published,
and taking the fix means moving your pin forward.

<note kind="caution">
Read the release notes before you move. A later date carries no compatibility promise, so
the release that carries a fix may also change or remove an export — that is what
[dated versions](/docs/releases/versioning) mean, and it is the trade the
[maintenance policy](/maintenance) states in full.
</note>

## Reporting something privately

Report it privately rather than in the open. Issues are closed on the repository, so
there is nowhere public to file it in any case.

Two ways to reach me, both from the repository's own
[security policy](https://github.com/sergiodxa/monorepo/blob/main/.github/SECURITY.md):

- Email **hello+security@sergiodxa.com**
- A Discord DM to **@sergiodxa**

Say which package or app is affected, how to reproduce it, and what you think the impact
is. Logs and screenshots help.

## What happens next

Reports are reviewed as soon as I can get to them, and a valid one is fixed privately
before anything about it is published. There is no stated response time, and no paid
bounty or compensation program — one person maintains this, and promising a window I
cannot hold to would be worse than saying so.
