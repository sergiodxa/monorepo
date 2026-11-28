---
title: OPFS
description: The origin private file system, a sandboxed file system each web origin gets, with fast synchronous file access from workers.
kind: glossary
date: "2026-02-10"
tags: [browser-storage, sqlite]
---

Files in OPFS are invisible to the person's own file manager and to other origins. Its synchronous access handles, available only in workers, are what let databases such as SQLite run in a browser at close to native speed. Like the rest of browser storage, it can be evicted unless the origin has persistent storage.
