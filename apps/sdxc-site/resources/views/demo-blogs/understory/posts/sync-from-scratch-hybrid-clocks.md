---
title: "Sync from scratch: hybrid logical clocks"
description: Part two. Give every change a timestamp that sorts the same on every replica, even when their wall clocks disagree.
kind: tutorials
date: "2026-08-26"
tags: [sync, local-first]
series: Sync from scratch
part: 2
---

Our change log needs an order every replica agrees on. Wall clocks drift, and counters alone lose the useful fact of _when_. A [hybrid logical clock](/showcase/understory/demo/glossary/hybrid-logical-clock) keeps both.

## Step 1: Hold the clock's state

The clock is a wall time in milliseconds and a counter for events within the same millisecond.

```ts {% title="clock.ts" %}
let last = { time: 0, count: 0 };

export function tick(now = Date.now()): string {
	if (now > last.time) last = { time: now, count: 0 };
	else last = { time: last.time, count: last.count + 1 };
	return encode(last);
}
```

## Step 2: Move forward when a change arrives

When a replica receives a change from a peer whose clock is ahead, it moves its own clock forward, so its next change sorts after everything it has seen.

```ts {% title="clock.ts" %}
export function receive(remote: { time: number; count: number }, now = Date.now()) {
	let time = Math.max(now, last.time, remote.time);
	let count =
		time === last.time && time === remote.time
			? Math.max(last.count, remote.count) + 1
			: time === last.time
				? last.count + 1
				: time === remote.time
					? remote.count + 1
					: 0;
	last = { time, count };
}
```

## Step 3: Encode it to sort as text

Pad both parts so a plain string comparison sorts clocks correctly, which lets SQLite's `MAX(clock)` from part one keep working.

```ts {% title="clock.ts" %}
function encode({ time, count }: { time: number; count: number }): string {
	return `${time.toString().padStart(15, "0")}-${count.toString(36).padStart(5, "0")}`;
}
```

> [!TIP]
> Reject a remote clock more than a few minutes ahead of your own wall time. One replica with a broken clock should not drag every peer into the future.

Next, in [part three](/showcase/understory/demo/tutorials/sync-from-scratch-merging), we use these clocks to merge changes.
