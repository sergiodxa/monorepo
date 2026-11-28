---
title: Best-effort means deletable
description: A reminder that browser storage is evictable until you ask for persistence.
kind: notes
date: "2026-10-22"
tags: [browser-storage, offline]
---

A tester lost a week of drafts in our web app. Nothing was broken: their disk filled up, and the browser evicted our origin's storage because it was only ever "best-effort". One call to `navigator.storage.persist()` after the first saved draft would have kept it. We now ask for persistence on first save, show a small "stored on this device" badge when it is granted, and nag gently about syncing when it is not.
