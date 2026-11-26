---
title: Stage the cast
description: Place characters in columns of any width, move and change them with transitions, draw them in layers, and tune how the speaker stands out.
section:
    title: Visual novels
    order: 4.7
order: 1.5
lastUpdated: 2026-11-25
outcomes:
    - "How columns place characters, and how to stand two or four side by side"
    - "How to enter, change, move and clear characters with built-in or your own transitions"
    - "How speaker focus works, and the variables that size and dim the cast"
---

The stage is a row of columns. Every character stands in one, bottom aligned and never wider
than it, and the scene says which. This guide stages the café from
[Make your first novel](/docs/visual-novels/first-novel) with a second character, Ren.

```bash
npm add @sdxc/novel remix
```

## Place characters in columns

`enter` takes a column as `at`. `left`, `center` and `right` are the thirds of the stage, and a
fraction `n/d` is column `n` of `d`, so `1/2` and `2/2` are the two halves:

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.enter(CAST.mika, { at: "1/2", expression: "smile" }),
ctx.enter(CAST.ren, { at: "2/2", layers: { body: "apron", face: "neutral" } }),
```

A character is centered in its column and scaled to fit it. Fewer columns leave more room, and
more columns stand characters closer together:

| `at`                      | Use it for                                   |
| ------------------------- | -------------------------------------------- |
| `center`, or `1/1`        | One character alone                          |
| `1/2`, `2/2`              | Two characters with space between them       |
| `2/4`, `3/4`              | Two characters side by side, as a pair walks |
| `left`, `center`, `right` | Three characters, or one off to the side     |
| `1/4` to `4/4`            | A crowd of four, each drawn narrower         |

A wide sprite in a narrow column is drawn smaller to fit, so test a crowd with your widest art.
`check()` warns when a scene puts two characters in the same column at once.

To move the aliases for every scene, redefine them where the novel is created. Here `left` and
`right` stand closer to the middle:

```typescript {% title="app/initializers/novel.ts" %}
export const novel = createNovel({
	// …
	positions: { left: "2/5", right: "4/5" },
});
```

## Change and move them

`express` swaps a character's sprite, `move` walks them to another column, and `exit` and
`clear` take one or everyone off stage. Each takes a `transition`:

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.express(CAST.mika, { expression: "laugh" }),
ctx.move(CAST.mika, { at: "center", transition: "slide" }),
ctx.exit(CAST.ren, { transition: "fade" }),
ctx.clear({ transition: "fade" }),
```

`fade` and `slide` are built in: a character slides in from, and out toward, the nearer edge of
the stage, and `slide` on a `move` walks them across. Any other name is a class the player puts
on the character on the stop where it changes, so your stylesheet draws it:

```css {% title="resources/styles/novel.css" %}
[data-novel-character].hop {
	animation: hop 300ms ease-out;
}

@keyframes hop {
	50% {
		translate: 0 -4%;
	}
}
```

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.express(CAST.mika, { expression: "laugh", transition: "hop" }),
```

A reader who asked for reduced motion, or who is skipping, sees every change finish at once.

## Draw a character in layers

A character with `layers` instead of `sprites` stacks one image per layer, bottom to top, so a
few outfits and faces combine without drawing every pair:

```typescript {% title="resources/novel/declarations.ts" %}
ren: character({
	name: "cast.ren",
	layers: {
		body: { apron: renApron, coat: renCoat },
		face: { neutral: renNeutral, grin: renGrin },
	},
}),
```

`enter` names a variant for every layer, and `express` changes any of them, keeping the rest:

```typescript {% title="resources/novel/scenes/counter.ts" %}
ctx.express(CAST.ren, { layers: { face: "grin" } }),
```

Every layer's images share one canvas size, so each lines up over the one below it.

## Tune the speaker focus

While a character on stage speaks, the player enlarges them and dims everyone else. The
variables set by how much:

```tsx {% title="resources/components/game.tsx" %}
<NovelPlayer.Default
	novel={novel}
	mix={css({
		"--novel-character-height": "90%",
		"--novel-focus-scale": "1.03",
		"--novel-focus-lift": "1%",
		"--novel-dim-brightness": "0.75",
	})}
/>
```

`--novel-character-height` is how much of the stage's height a character fills, and
`--novel-focus-duration` how fast the focus changes hands. In a composed player,
`<NovelPlayer.Stage focus={false}>` leaves every character as drawn. Each character carries
`data-novel-character`, `data-id` and `data-speaking`, for a rule the variables leave out.

## Where to go next

- [Organize a long story](/docs/visual-novels/organize-a-long-story) — chapters and arcs, and
  a clean stage between them.
- [Compose your own player](/docs/visual-novels/compose-your-own-player) — every part and
  theme variable of the player.
- [`@sdxc/novel`](/api/novel) — every directive and its options.
