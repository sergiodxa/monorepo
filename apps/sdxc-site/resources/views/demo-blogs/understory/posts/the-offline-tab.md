---
title: Designing for the offline tab
description: The most common offline state on the web is not a plane. It is a tab left open for three days. Design for that, and the plane takes care of itself.
kind: articles
date: "2025-08-14"
tags: [offline, browser-storage, local-first]
---

When people talk about offline support they picture a plane: no network, a long flight, a heroic app that keeps working. That happens, but it is rare. The offline state I see most in our logs is far more boring: a tab that was left open on Friday and is clicked again on Monday.

## What the tab has been through

In those three days the laptop slept, changed networks twice and woke up behind a captive portal. The server deployed six times. The schema moved on by a migration. Someone else edited half the records the tab is showing.

The tab knows none of this. If its first action is to send a write built on Friday's state, against Monday's server, you get the classic bugs: a stale form overwriting fresh data, a request that fails with a schema error, a session that expired silently.

## Wake up like a replica

The fix is to treat a waking tab like a replica rejoining, not like a client resuming:

1. Listen for `visibilitychange` and `online`, and run a sync before anything else.
2. Apply incoming changes to local state first, so the screen updates under the reader's eyes.
3. Only then flush the writes queued since the tab last synced, merged against what just arrived.

> [!WARNING]
> `navigator.onLine` only tells you whether there is a network interface. Behind a captive portal it is `true` and every request still fails. Treat a failed sync as offline, whatever the flag says.

## The plane comes for free

A tab that wakes up correctly after three days is also a tab that survives a flight, a tunnel and a flaky café. The work is the same; only the length of the gap changes. If you design for the gap, offline stops being a mode and becomes an ordinary Monday.
