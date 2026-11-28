---
title: "Sync from scratch: merging changes"
description: Part three. Exchange missing changes with a peer and apply them with a per-field last-writer-wins merge that every replica runs identically.
kind: tutorials
date: "2026-09-16"
tags: [sync, crdts, sqlite]
series: Sync from scratch
part: 3
---

We have a change log and a clock that sorts. The last piece is merging what a peer sends us, so that every replica that has seen the same changes shows the same notes.

## Step 1: Ask for what is missing

Send your summary from part one; the peer answers with every change newer than what you hold from each replica.

```ts {% title="sync.ts" %}
let response = await fetch("/sync", {
	method: "POST",
	body: JSON.stringify({ summary: summary(db), changes: unsent(db) }),
});
let { changes } = (await response.json()) as { changes: Change[] };
```

## Step 2: Keep the winner per field

For each incoming change, compare it with the newest change already stored for that record and field. The higher clock wins; a tie goes to the higher replica id, so every replica picks the same one.

```ts {% title="merge.ts" %}
export function apply(db: Database, change: Change) {
	let current = newest(db, change.record, change.field);
	db.run("INSERT OR IGNORE INTO changes VALUES (?, ?, ?, ?, ?)", row(change));
	if (current !== null && wins(current, change) === current) return;
	db.run(`UPDATE notes SET ${column(change.field)} = ? WHERE id = ?`, [
		change.value,
		change.record,
	]);
}
```

Storing the losing change too matters: a replica that syncs with us later still needs to receive it, and history is how we show "edited elsewhere" when we want to.

## Step 3: Run the same code on the server

The server's `/sync` handler calls the same `apply` for every change it receives, then answers with what the client is missing. It adds authorisation and validation, and nothing else.

> [!NOTE]
> Because the merge only depends on the set of changes, not the order they arrive in, two replicas that have seen the same changes always agree. That property is what makes this a [CRDT](/showcase/understory/demo/glossary/crdt), and it is worth a test that shuffles changes and compares the result.

That is the series: a log, a clock and a merge, about two hundred lines in all. The essay [The server is just another peer](/showcase/understory/demo/articles/the-server-is-a-peer) explains why the server's part is so small.
