---
title: "Sync from scratch: an append-only change log"
description: Part one. Record every write as a change row in SQLite, so a replica can later tell another exactly what it has.
kind: tutorials
date: "2026-08-05"
tags: [sync, sqlite, local-first]
series: Sync from scratch
part: 1
---

In this series we build a small sync engine for a notes app: SQLite on every replica, a change log, a hybrid clock and a merge that every peer runs the same way. Part one is the foundation, a log that records every write.

## Step 1: Create the tables

Keep the data you query and the changes you sync in separate tables. The `notes` table is what the interface reads; the `changes` table is what sync ships.

```sql {% title="schema.sql" %}
CREATE TABLE notes (
	id TEXT PRIMARY KEY,
	title TEXT NOT NULL DEFAULT '',
	body TEXT NOT NULL DEFAULT ''
);

CREATE TABLE changes (
	replica TEXT NOT NULL,
	clock TEXT NOT NULL,
	record TEXT NOT NULL,
	field TEXT NOT NULL,
	value TEXT,
	PRIMARY KEY (replica, clock, field)
);
```

## Step 2: Write through the log

Every write goes through one function that records the change and applies it, in one transaction, so the two tables never disagree.

```ts {% title="write.ts" %}
export function setField(db: Database, record: string, field: string, value: string) {
	let clock = tick();
	db.transaction(() => {
		db.run("INSERT INTO changes VALUES (?, ?, ?, ?, ?)", [REPLICA, clock, record, field, value]);
		db.run(`UPDATE notes SET ${column(field)} = ? WHERE id = ?`, [value, record]);
	})();
}
```

> [!WARNING]
> Never interpolate a field name from user input into SQL. `column()` maps the field to a known column or throws, so a bad change can never become a bad query.

## Step 3: Answer "what do you have?"

A replica's summary is the newest clock it holds per replica. One query builds it:

```sql {% title="summary.sql" %}
SELECT replica, MAX(clock) AS clock FROM changes GROUP BY replica;
```

That is all part one needs. `tick()` is a placeholder for now; in [part two](/showcase/understory/demo/tutorials/sync-from-scratch-hybrid-clocks) we replace it with a hybrid logical clock that every replica can compare.
