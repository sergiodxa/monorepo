---
title: Run SQLite in the browser on OPFS
description: Open a real SQLite database inside a web worker, stored in the origin private file system, so a web app gets the same local database as its native siblings.
kind: tutorials
date: "2026-02-10"
tags: [sqlite, browser-storage, offline]
---

The official SQLite WebAssembly build can store its database in the [origin private file system](/showcase/understory/demo/glossary/opfs), a sandboxed file system each origin gets for itself. That gives a web app a durable SQLite file with real transactions.

## Step 1: Serve the right headers

The fastest OPFS backend uses `SharedArrayBuffer`, which needs a cross-origin isolated page.

```text {% title="_headers" %}
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

## Step 2: Open the database in a worker

Synchronous file access is only available in workers, so the database lives in one and the page talks to it by message.

```ts {% title="db.worker.ts" %}
import sqlite3InitModule from "@sqlite.org/sqlite-wasm";

let sqlite3 = await sqlite3InitModule();
let db = new sqlite3.oo1.OpfsDb("/notes.sqlite3");
db.exec("PRAGMA journal_mode = WAL");
```

## Step 3: Ask the browser to keep it

Storage on the web is best-effort unless you ask otherwise. Request persistence once the person has shown they care, for example after their first saved note.

```ts {% title="persist.ts" %}
if (navigator.storage?.persist && !(await navigator.storage.persisted())) {
	await navigator.storage.persist();
}
```

> [!WARNING]
> Without persistence, the browser may clear the origin's storage under disk pressure, OPFS included. Show the person whether their data is persisted, so a cleared database is never a surprise.

The [SQLite Wasm documentation](/showcase/understory/demo/links/sqlite-wasm) covers the other backends, for pages that cannot be cross-origin isolated.
