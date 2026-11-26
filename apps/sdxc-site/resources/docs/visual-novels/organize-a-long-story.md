---
title: Organize a long story
description: Group scenes into chapters and chapters into arcs, hand each chapter a clean stage, and keep the names saves depend on stable as the story grows.
section:
    title: Visual novels
    order: 4.7
order: 1.7
lastUpdated: 2026-11-25
outcomes:
    - "How chapters and arcs group scenes, and where the reader sees their titles"
    - "How to start each chapter on an empty stage, and what happens when a chapter begins"
    - "Which names saves depend on, and how to grow the story without breaking them"
---

A short story is a handful of scenes. A long one is years of them, and the reader needs a way to
find their place: chapter select, scene replay and the save slots all read how you group the
scenes. This guide grows the café from [Make your first novel](/docs/visual-novels/first-novel)
into seasons of chapters.

```bash
npm add @sdxc/novel remix
```

## Group scenes into chapters

A `chapter` holds scenes, and its `title` is what chapter select lists. A scene's own `title` is
what the save slots and scene replay show, so give one to every scene a reader would look for,
and leave it off a short beat no menu needs to list:

```typescript {% title="resources/novel/declarations.ts" %}
export const SCENES = scenes({
	prologue: chapter({
		title: "chapters.prologue",
		scenes: {
			opening: scene({ title: "scenes.opening" }),
			counter: scene({ title: "scenes.counter" }),
		},
	}),
	regulars: chapter({
		title: "chapters.regulars",
		scenes: {
			monday: scene({ title: "scenes.monday" }),
			rush: scene(),
		},
	}),
});
```

## Group chapters into arcs

`arc()` gathers chapters under one title, such as a season or a school year. Chapter select and
scene replay head each arc's chapters with its title, and an arc stays locked until the reader
reaches one of its chapters:

```typescript {% title="resources/novel/declarations.ts" %}
import { arc, chapter, scene, scenes } from "@sdxc/novel";

export const SCENES = scenes({
	spring: arc({
		title: "arcs.spring",
		chapters: {
			prologue: chapter({
				title: "chapters.prologue",
				scenes: { opening: scene({ title: "scenes.opening" }) },
			}),
			regulars: chapter({
				title: "chapters.regulars",
				scenes: { monday: scene({ title: "scenes.monday" }) },
			}),
		},
	}),
	summer: arc({
		title: "arcs.summer",
		chapters: {
			festival: chapter({
				title: "chapters.festival",
				scenes: { lanterns: scene({ title: "scenes.lanterns" }) },
			}),
		},
	}),
});
```

Every chapter in an arc carries it: `SCENES.spring.prologue.opening.chapter.arc` is
`{ name: "spring", title: "arcs.spring" }`, for a header or a title card of your own.

## Hand each chapter an empty stage

A scene leaves the stage as it found it, so the next chapter starts with whoever was standing at
the end of the last one. End a chapter's last scene with `clear()`, and the next one sets its own
stage:

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.say(CAST.mika, "counter.smile"),
ctx.clear({ transition: "fade" }),
ctx.goto(SCENES.spring.regulars.monday),
```

When a play enters a scene of another chapter, the novel emits `chapter` with the chapter and the
scene, and the player autosaves, so a reader who closes the tab can pick up from the start of the
chapter they just reached:

```typescript {% title="app/initializers/novel.ts" %}
novel.on("chapter", ({ chapter }) => {
	analytics.track("chapter", { name: chapter.name, arc: chapter.arc?.name });
});
```

## Keep the names saves depend on

A scene's name is its path through the map, `spring.prologue.opening` above, and saves, the
read-line record and replays are keyed by it. Adding scenes, chapters and arcs never touches an
existing name, so grow the story by adding. Wrapping existing chapters in a new arc, or renaming
a key, changes every name under it, and saves that stand in those scenes no longer load. Group a
story into arcs before its first release, and when a rename is unavoidable, upgrade older saves
as [Saves, settings and unlocks](/docs/visual-novels/saves-and-settings) shows.

## Check the whole story

`check()` reads every scene without playing it, so a long story keeps one test that catches a
jump to a scene nobody mapped and a scene nothing reaches:

```typescript {% title="app/initializers/novel.test.ts" %}
import { check } from "@sdxc/novel/test";
import { expect, test } from "vitest";

import { novel } from "~/app/initializers/novel";

test("every chapter is reachable", async () => {
	expect((await check(novel)).problems).toEqual([]);
});
```

## Where to go next

- [Stage the cast](/docs/visual-novels/stage-the-cast) — columns, moves and transitions for the
  characters in each scene.
- [Extras, dev tools and offline](/docs/visual-novels/extras-dev-tools-and-offline) — chapter
  select and scene replay on a title screen.
- [Test your story](/docs/visual-novels/test-your-story) — drive a play through the chapters.
