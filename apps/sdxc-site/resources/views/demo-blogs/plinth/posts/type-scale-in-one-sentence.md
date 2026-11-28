---
title: A type scale you can explain in one sentence
description: Every step is the base size times the ratio, and both grow between a phone and a wide screen. Here is how to build that with clamp(), keep it zoomable, and hand it to a team as six tokens.
kind: articles
date: "2026-11-04"
tags: [typography, css, tokens]
featured: true
---

Most type scales I inherit cannot be explained by the people who use them. There is a `--font-size-lg` that is 1.1875rem, a `--font-size-xl` that is 1.375rem on mobile and 1.5rem from a breakpoint nobody remembers choosing, and a heading component that overrides both. Every number was right once, for one screen, and nobody can tell you what the next step should be.

The scale I ship now fits in one sentence: **every step is the base size times the ratio, and both the base and the ratio grow between a 20rem viewport and an 80rem one.** If a designer asks why the third heading is the size it is, that sentence is the answer, and the code below is a direct translation of it.

## Why one sentence matters

A scale is an API. Designers pick from it in their tool, engineers pick from it in code, and both need to predict what a step looks like before they see it. A list of hand-tuned sizes forces everyone to memorise the list. A rule lets them derive it.

A rule also survives change. When the brand moves from a 1.2 ratio to a 1.25 ratio, a hand-tuned list means editing every size and every breakpoint override. A rule means editing one number and regenerating.

There are three properties I want from the result:

- **Fluid between bounds.** Sizes grow smoothly with the viewport instead of jumping at breakpoints, and stop growing outside the range I designed for.
- **Zoomable.** A reader who zooms to 200% gets bigger text. That sounds obvious, and a lot of fluid type breaks it.
- **Few tokens.** Six steps cover a reading site. Every extra step is a choice someone has to make, and most of them make it badly.

## The two bounds

Everything starts from two descriptions of the scale, one for the smallest screen I design for and one for the largest:

```ts {% title="type-scale.ts" %}
interface Bound {
	/** The viewport width this bound describes, in rem. */
	viewport: number;
	/** The body size at that width, in rem. */
	base: number;
	/** How much bigger each step is than the one below it. */
	ratio: number;
}

const MIN: Bound = { viewport: 20, base: 1, ratio: 1.2 };
const MAX: Bound = { viewport: 80, base: 1.125, ratio: 1.25 };
```

At 20rem (320px with default settings) body text is 16px and each step is a minor third bigger than the last. At 80rem (1280px) body text is 18px and each step is a major third bigger. The ratio growing matters as much as the base growing: on a wide screen there is room for headings to pull away from the body, and on a phone a big ratio makes a level-one heading wrap into four lines.

### Deriving a step

For step `n`, the size at each bound is `base × ratioⁿ`. Between the bounds the size should follow a straight line, which CSS can express as a length plus a fraction of the viewport. Two points define a line, so the slope and intercept fall out directly:

```ts {% title="type-scale.ts" %}
function round(value: number): number {
	return Math.round(value * 10_000) / 10_000;
}

export function step(n: number): string {
	let min = MIN.base * MIN.ratio ** n;
	let max = MAX.base * MAX.ratio ** n;
	let slope = (max - min) / (MAX.viewport - MIN.viewport);
	let intercept = min - slope * MIN.viewport;
	return `clamp(${round(min)}rem, ${round(intercept)}rem + ${round(slope * 100)}vw, ${round(max)}rem)`;
}
```

The slope is in rem per rem of viewport. Multiplying it by 100 turns it into `vw`, since `1vw` is one hundredth of the viewport width. `clamp()` holds the result between the two sizes, so a 2560px monitor gets the 80rem size rather than a heading the height of a fist.

> [!NOTE]
> The bounds are written in rem and the function assumes `1rem` is the same at both ends. If a reader changes their browser's default font size, every size here moves with it, which is exactly what they asked for.

## The generated tokens

Running `step()` from −1 to 4 gives six custom properties. I commit the output rather than generating it at build time, so a reviewer sees the numbers change when the rule changes:

```css {% title="tokens/type.css" %}
:root {
	--step--1: clamp(0.8333rem, 0.8111rem + 0.1111vw, 0.9rem);
	--step-0: clamp(1rem, 0.9583rem + 0.2083vw, 1.125rem);
	--step-1: clamp(1.2rem, 1.1313rem + 0.3438vw, 1.4063rem);
	--step-2: clamp(1.44rem, 1.3341rem + 0.5297vw, 1.7578rem);
	--step-3: clamp(1.728rem, 1.5716rem + 0.7821vw, 2.1973rem);
	--step-4: clamp(2.0736rem, 1.8493rem + 1.1216vw, 2.7466rem);
}
```

Read one line aloud and it describes itself: step 2 is 1.44rem on a phone, 1.7578rem on a laptop, and moves in a straight line between them. Nothing here needs a comment.

> [!WARNING]
> Never write the preferred value as `vw` alone, such as `clamp(1rem, 2.5vw, 2rem)`. Browser zoom changes the size of a rem but leaves the viewport-relative part almost where it was, so zooming to 200% barely grows the text. That fails WCAG's resize text criterion, and the rem intercept above is what keeps it passing.

## Line height that follows the size

A fixed unitless line height such as `1.5` is comfortable for body text and far too loose for a 44px heading. Rather than a line height per step, I let the leading shrink as the size grows:

```css {% title="base.css" %}
:where(h1, h2, h3, p, li) {
	line-height: calc(1em + 0.5rem);
}
```

At 16px that is 24px of line, a ratio of 1.5. At 44px it is 52px, a ratio of about 1.18. One declaration covers every step, and it keeps working when someone puts a step-3 size on a paragraph for a pull quote.

### Measure

The other half of readable type is line length. I set prose at `max-inline-size: 65ch`, which keeps lines between roughly 60 and 75 characters whatever step the body sits on. Because `ch` is relative to the element's own font, a component that bumps its text to step 1 gets a proportionally wider column without anyone touching the measure.

## Handing it to a team

The tokens are only half of the API. The other half is guidance on which step means what, so that two engineers building two pages pick the same size for the same job:

1. `--step--1` for metadata: dates, captions, the line under a title.
2. `--step-0` for body text, and for nothing else by default.
3. `--step-1` for subheadings inside prose and for card titles.
4. `--step-2` for section headings.
5. `--step-3` for the page title on most pages.
6. `--step-4` for the one headline a landing page leads with.

Components consume the steps by role, never by number, so a `Card` asks for its title size rather than for "step 1". When the rule changes, the roles stay put.

> [!TIP]
> Test the result at 320px wide and at 200% zoom on a 1280px window. Those two cases are the same width in CSS pixels, and if the page holds up in both, it holds up for nearly everyone between.

## What I gave up

A rule cannot express a one-off. The marketing team once wanted a headline that was a little bigger than step 4 on wide screens only. The answer was a step 5, generated by the same function, used in exactly one place and documented as such. That is a small cost for a scale where every size can be derived, reviewed and changed with one number.

The other thing I gave up is pixel-perfect matching with a mockup drawn at one width. A fluid scale is right at every width and exactly equal to a static mockup at only one. Teams adjust to that faster than I expected once they can see the sentence at the top of the tokens file.

If you want to see where the idea comes from, the [modular scale](/showcase/plinth/demo/glossary/modular-scale) entry in the glossary covers the ratio half, and the [token pipeline series](/showcase/plinth/demo/tutorials/token-pipeline-source) shows how files like `type.css` get generated and shipped.
