---
title: The server is just another peer
description: Local-first stops feeling exotic once you treat the server as one more replica with good uptime. Here is the model I build sync on now, and the three rules that keep it honest.
kind: articles
date: "2026-11-04"
updated: "2026-11-20"
tags: [local-first, sync, crdts]
featured: true
---

For most of my career the server was the truth and every client was a cache of it. A screen asked the server what was true, drew the answer, and asked again when it needed to. When the network went away, the screen went blank, and that felt like the natural order of things.

[Local-first](/showcase/understory/demo/links/local-first-software) software turns that around. The data lives on the device first. The app reads and writes a local database, the interface never waits for a round trip, and sync happens behind it, whenever there is a connection. I have been building apps this way for three years, and the idea that made it click for me was small: **the server is just another peer**. It is a replica like the laptop and the phone, one that happens to be always on, well backed up and reachable by everyone.

This essay is the model I use now, written down so I stop re-explaining it in code review.

## Replicas, not caches

A cache is allowed to be wrong. It holds a copy of something that lives elsewhere, and when the copy and the original disagree, the original wins and the cache is thrown away. That is fine for a CDN and a disaster for someone's notes.

A replica holds a full copy that is allowed to change on its own. Two replicas can both accept writes while they cannot reach each other, and when they meet again they merge. Nobody's edits are thrown away just because they were made on the wrong side of a tunnel.

The shift sounds philosophical, but it changes where every line of code goes:

- Reads go to the local database, always. There is no loading spinner for data the device already has.
- Writes go to the local database first and become _changes_ that will be shipped later.
- The network layer stops being request and response. It becomes an exchange of changes between replicas, in both directions.

> [!NOTE]
> "Local-first" is not "offline-only". The server still matters: it relays changes between devices, keeps the durable backup and enforces who may read what. It just stops being in the path between a tap and a redraw.

## What a change looks like

If replicas exchange changes, the change is the unit you design. I keep mine deliberately boring: one row in an append-only log, describing one field set on one record.

```ts {% title="change.ts" %}
export interface Change {
	/** The replica that made the change, stable for the life of the install. */
	replica: string;
	/** A hybrid logical clock reading, comparable across replicas. */
	clock: string;
	table: string;
	record: string;
	field: string;
	value: unknown;
}
```

Field-level changes are a choice, and they buy a lot. If I rename a card on my phone while you move the same card to another column on your laptop, those are two changes to two fields. They merge without either of us noticing there was anything to merge.

The `clock` is a [hybrid logical clock](/showcase/understory/demo/glossary/hybrid-logical-clock) reading: wall time when the clocks agree, a counter when they do not. It gives every change a position that every replica agrees on, which is what lets the merge be deterministic. I walk through building one in [part two of Sync from scratch](/showcase/understory/demo/tutorials/sync-from-scratch-hybrid-clocks).

## Sync is a conversation about what you have

Once changes are rows with a clock, sync becomes two replicas telling each other what they have seen and sending what is missing. Each replica keeps a small summary: for every other replica it has heard from, the newest clock it holds from that replica.

```ts {% title="sync.ts" %}
export type Summary = Record<string, string>;

export function missingFrom(local: Change[], theirs: Summary): Change[] {
	return local.filter((change) => {
		let seen = theirs[change.replica];
		return seen === undefined || change.clock > seen;
	});
}
```

The laptop sends its summary to the server, the server answers with every change the laptop is missing, and the laptop sends back every change the server is missing. Phone and server do the same. Nobody ever talks to anybody directly except through the peer that happens to be online.

That is the moment the title of this essay stops being a slogan. The code the server runs to sync with a laptop is _the same code_ the laptop would run to sync with another laptop. The server is not special in the protocol. It is special in its uptime.

### Why the server still needs its own rules

Being a peer does not mean being naive. The server is the one replica every other replica trusts to relay, so it is the right place for the things no client can be trusted with:

1. **Authorisation.** The server checks that a replica may write to a record before it accepts the change, and never sends a replica changes for records it may not read.
2. **Validation.** A change that breaks a schema rule is rejected at the server, and the rejection is sent back as a change of its own, so the author's replica can undo it.
3. **Retention.** The server decides when old history can be compacted, because it is the only peer that knows when every other peer has caught up.

> [!WARNING]
> Never trust a client's clock for anything that matters to security. A hybrid clock orders edits; it does not prove when they happened. Expiry, rate limits and audit timestamps come from the server's own clock.

## Merging without a referee

When two changes touch the same field, something has to decide. For most fields in most apps I use _last writer wins_, ordered by the hybrid clock and broken by replica id when two clocks tie. It is simple, deterministic and, for a title or a due date, exactly what people expect.

```ts {% title="merge.ts" %}
export function wins(a: Change, b: Change): Change {
	if (a.clock !== b.clock) return a.clock > b.clock ? a : b;
	return a.replica > b.replica ? a : b;
}
```

Some fields need more than that. Text that two people type into at once wants a sequence [CRDT](/showcase/understory/demo/glossary/crdt), so both insertions survive. A counter of likes wants increments that add up rather than overwrite. A set of tags wants additions and removals that commute. The point is that you choose per field, and most fields are fine with the simplest choice. I wrote more about that choice in [Conflicts are a product decision](/showcase/understory/demo/articles/conflicts-are-a-product-decision).

> [!TIP]
> Start every field on last writer wins and promote it only when a real person loses work. You will promote far fewer fields than you expect, and every promotion will come with a story that explains it.

## What it costs

I would be lying if I said this was free.

- **Storage on the device.** Every replica keeps its data and some history. On the web that means [OPFS](/showcase/understory/demo/glossary/opfs) or IndexedDB, quotas, and a browser that may evict you if you do not ask for persistence.
- **Deletes are harder.** A deleted record has to be remembered as a [tombstone](/showcase/understory/demo/glossary/tombstone), or a replica that was offline will bring it back from the dead.
- **Migrations are distributed.** A schema change has to cope with replicas that are a version behind and still sending changes in the old shape.
- **Debugging is a timeline.** "What is the state?" becomes "what did each replica see, and when?", so I log every change with its clock and replica from day one.

None of these are reasons not to do it. They are the work, and they are the same work every time, which is why it is worth writing down.

## Three rules I keep

After three years, these are the rules that have survived:

1. **The interface only ever reads local state.** If a screen awaits the network before drawing, it is not local-first, whatever the architecture diagram says.
2. **Every write is a change with a clock.** No write path skips the log, not even "just this admin tool".
3. **The server runs the same merge as everyone else.** The day the server has its own merge logic, two replicas can disagree forever, and nobody will notice until a user does.

If you want to try it, the [Sync from scratch](/showcase/understory/demo/tutorials/sync-from-scratch-change-log) series builds the whole thing in three parts with SQLite and about two hundred lines of TypeScript. The server in it is, of course, just another peer.
