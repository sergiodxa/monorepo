---
title: "Build a token pipeline: emit CSS"
description: Part two. Flatten the token tree, resolve aliases into var() references, and write one CSS file that fails the build on a broken reference.
kind: tutorials
date: "2026-09-24"
tags: [tokens, css]
series: Build a token pipeline
part: 2
---

In [part one](/showcase/plinth/demo/tutorials/token-pipeline-source) we wrote `tokens/source.json`. Now we turn it into a stylesheet of custom properties. The whole build is one script with no dependencies.

## Step 1: Flatten the tree

Walk the JSON and collect every object that has a `$value`, naming it by its path joined with dashes. Keys starting with `$` are metadata, not groups.

```ts {% title="scripts/build-tokens.ts" %}
import { readFileSync, writeFileSync } from "node:fs";

interface Token {
	name: string;
	value: string;
}

function flatten(node: Record<string, unknown>, path: string[] = []): Token[] {
	if ("$value" in node) return [{ name: path.join("-"), value: String(node.$value) }];
	return Object.entries(node)
		.filter(([key]) => !key.startsWith("$"))
		.flatMap(([key, child]) => flatten(child as Record<string, unknown>, [...path, key]));
}
```

## Step 2: Turn aliases into var()

An alias such as `{color.ink.900}` becomes `var(--color-ink-900)`. Emitting a reference instead of copying the value is what lets part three swap a primitive per theme and have every alias follow.

```ts {% title="scripts/build-tokens.ts" %}
function resolve(value: string, names: Set<string>): string {
	return value.replace(/\{([^}]+)\}/g, (_, path: string) => {
		let name = path.replaceAll(".", "-");
		if (!names.has(name)) throw new Error(`Unknown token reference: {${path}}`);
		return `var(--${name})`;
	});
}
```

> [!WARNING]
> Let the unknown reference throw. A pipeline that writes `var(--text-acent)` silently gives you an element with no colour and no error, which is the hardest kind of bug to notice in review.

## Step 3: Write the file

```ts {% title="scripts/build-tokens.ts" %}
let source = JSON.parse(readFileSync("tokens/source.json", "utf8"));
let tokens = flatten(source);
let names = new Set(tokens.map((token) => token.name));
let lines = tokens.map((token) => `\t--${token.name}: ${resolve(token.value, names)};`);
writeFileSync("tokens/tokens.css", `:root {\n${lines.join("\n")}\n}\n`);
```

Run it and look at the output:

```css {% title="tokens/tokens.css" %}
:root {
	--color-ink-900: #16171d;
	--text-default: var(--color-ink-900);
	--text-accent: var(--color-signal-500);
}
```

Commit the generated file next to the source, so a review shows both. [Part three](/showcase/plinth/demo/tutorials/token-pipeline-themes) adds a dark theme without touching a single component.
