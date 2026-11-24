# ADR-203: Novel Arcs Are Declared With `arc()`

## Status

**Implemented** - 2026-11-24

## Background

A long visual novel groups its chapters into arcs ("First Year" holding chapters 1–12), and
`@sdxc/novel`'s library screens (`ChapterSelect`, `SceneReplay`, `Memories`) head each arc's
chapters with its title. The first version of arcs (recorded in
[ADR-200](./ADR-200-novel-package.md)) had no declaration of its own: a `chapter()` declared
inside another `chapter()` made the outer one an arc.

That design was rejected. A story author reading `chapter({ scenes: { ch01: chapter(…) } })`
cannot tell an arc from a chapter, and the rules it needed ("only the nearest enclosing chapter
counts", "scenes an arc declares outside its chapters keep the arc as their chapter") are rules a
reader has to learn rather than structure they can see.

## Decision

Arcs get their own declaration, and a chapter means one thing.

```ts
export default scenes({
	arc1: arc({
		title: "arcs.first",
		chapters: {
			ch1: chapter({ title: "chapters.one", scenes: { s1: scene(), s2: scene() } }),
		},
	}),
});
```

- `arc({ title?, chapters })` holds chapters and nothing else; its key is part of every scene
  name under it (`arc1.ch1.s1`).
- `chapter({ title?, scenes })` holds scenes and plain groups of scenes. A chapter inside a
  chapter, or a scene directly inside an arc, is a type error.
- The data the screens read is unchanged: every chapter in an arc carries `arc` (`ArcInfo`, its
  name and title) on its `ChapterInfo`, and `readLibrary` groups chapters by it.

## Consequences

- The structure of a story is visible in its declaration: scene, chapter, arc, one level each.
- Arcs nest exactly one way, so the "nearest enclosing chapter" rule and the arc-as-chapter case
  for loose scenes are gone.
- A story written with chapter-in-chapter arcs must move its outer chapters to `arc()` and rename
  `scenes` to `chapters`; scene names stay the same, so saves keep working.
