---
title: "Build a token pipeline: one source file"
description: Part one. Write your design tokens once, in the Design Tokens format, with primitives, semantic aliases and types a tool can read.
kind: tutorials
date: "2026-09-10"
tags: [tokens, color, css]
series: Build a token pipeline
part: 1
---

In this series we build the smallest token pipeline that still earns the name: one JSON file as the source of truth, a script that turns it into CSS custom properties, and a theme layer for dark mode. By the end of part three a colour change is one line in one file and reaches every component.

You need Node 22 or Bun and a project that already uses CSS custom properties, or wants to.

## Step 1: Pick the format

The Design Tokens Community Group format is a JSON shape where a token is an object with a `$value` and, ideally, a `$type`. Groups are plain nested objects. Using it instead of an invented shape means design tools and other scripts can read the same file.

```json {% title="tokens/source.json" %}
{
	"color": {
		"$type": "color",
		"ink": {
			"900": { "$value": "#16171d" },
			"600": { "$value": "#5b5e6b" },
			"100": { "$value": "#eef0f4" }
		},
		"signal": {
			"500": { "$value": "#e8562a" }
		}
	}
}
```

> [!NOTE]
> The format's newest draft describes a colour as an object with a colour space and components. I use hex strings here because every tool in my chain still reads them; switch when yours do.

## Step 2: Add semantic aliases

Primitives say what a colour is. Components should never use them directly. Add a second group that says what a colour is _for_, pointing at primitives with the `{group.token}` alias syntax.

```json {% title="tokens/source.json" %}
{
	"text": {
		"$type": "color",
		"default": { "$value": "{color.ink.900}" },
		"muted": { "$value": "{color.ink.600}" },
		"accent": { "$value": "{color.signal.500}" }
	},
	"surface": {
		"$type": "color",
		"page": { "$value": "{color.ink.100}" }
	}
}
```

The type is set once on the group and inherited by every token in it, which keeps the file short.

## Step 3: Check it reads

Before writing any tooling, make sure the file parses and every alias points at something real:

```bash
node -e "JSON.parse(require('fs').readFileSync('tokens/source.json', 'utf8'))" && echo ok
```

The alias check comes for free in part two, where the build fails on any reference it cannot resolve. [Part two](/showcase/plinth/demo/tutorials/token-pipeline-css) turns this file into CSS.
