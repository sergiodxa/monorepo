---
title: "Build a token pipeline: themes"
description: Part three. Add a dark theme by overriding semantic tokens only, honour the reader's system setting, and let them pick.
kind: tutorials
date: "2026-10-08"
tags: [tokens, color, css, accessibility]
series: Build a token pipeline
part: 3
---

After [part two](/showcase/plinth/demo/tutorials/token-pipeline-css), every component reads semantic tokens such as `--text-default`, and those point at primitives. A theme is now just a second set of pointers.

## Step 1: Override semantic tokens, not primitives

Add a `themes` section to the source with only the semantic tokens that change. The primitives stay the same in every theme; dark mode picks different ones.

```json {% title="tokens/source.json" %}
{
	"$themes": {
		"dark": {
			"text": { "default": "{color.ink.100}", "muted": "{color.ink.400}" },
			"surface": { "page": "{color.ink.900}" }
		}
	}
}
```

Because it starts with `$`, the flattening from part two skips it, so the light theme is unchanged.

## Step 2: Emit the theme twice

The build writes the dark overrides under two selectors: the reader's system preference, and an explicit attribute that wins over it.

```css {% title="tokens/tokens.css" %}
@media (prefers-color-scheme: dark) {
	:root:not([data-theme="light"]) {
		--text-default: var(--color-ink-100);
		--surface-page: var(--color-ink-900);
	}
}

:root[data-theme="dark"] {
	--text-default: var(--color-ink-100);
	--surface-page: var(--color-ink-900);
}
```

The `:not([data-theme="light"])` guard is what lets a reader on a dark system choose light for your site alone.

## Step 3: Tell the browser too

Form controls, scrollbars and the default canvas follow `color-scheme`, not your tokens. Declare it next to them:

```css {% title="tokens/tokens.css" %}
:root {
	color-scheme: light dark;
}
:root[data-theme="light"] {
	color-scheme: light;
}
:root[data-theme="dark"] {
	color-scheme: dark;
}
```

> [!TIP]
> With `color-scheme` set, `light-dark(#16171d, #eef0f4)` picks a value per scheme inline. It is a good fit for one-off values that are not worth a token.

Check every pair of text and surface tokens for contrast in both themes before shipping: a token pipeline makes it easy to generate that report from the same source file. Dark themes have their own rules, which I wrote about in [Dark mode is a second palette](/showcase/plinth/demo/articles/dark-mode-second-palette).
