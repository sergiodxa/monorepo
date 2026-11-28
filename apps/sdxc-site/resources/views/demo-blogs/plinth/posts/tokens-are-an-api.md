---
title: Tokens are an API, not a palette
description: The moment a second team reads your tokens, renaming one is a breaking change. Version them, deprecate them, and name them for the job.
kind: articles
date: "2026-08-19"
tags: [tokens, components]
featured: true
---

A palette is something you look at. An API is something other people's code depends on. Design tokens start as the first and become the second the day a team you do not sit with imports them, and most token sets never notice the change.

## Three tiers, three promises

I split tokens into three tiers, and each tier makes a different promise:

- **Primitives** such as `--color-ink-900` describe a value. They can be added freely and are never used by components directly, so changing one is safe.
- **Semantic tokens** such as `--text-muted` describe a job. Components and product teams read these, so their names are public API.
- **Component tokens** such as `--button-padding-inline` describe one component's knobs. They exist only where a team genuinely needs to tune that component.

The rule that makes this work: a component may read semantic and component tokens, never primitives. Then a rebrand is a change to the arrows between tiers, and no component file moves.

## Renaming is a breaking change

If `--text-subtle` becomes `--text-muted`, every stylesheet that reads the old name now gets nothing, and CSS does not warn. Treat it the way a library treats a renamed function:

```css {% title="tokens/deprecated.css" %}
:root {
	/* Deprecated in 4.2, removed in 5.0: use --text-muted. */
	--text-subtle: var(--text-muted);
}
```

Keep the old name as an alias for a major version, list it in the changelog, and remove it on schedule. A lint rule that flags deprecated names in product code turns the schedule from a hope into a checklist.

> [!TIP]
> Publish tokens as a versioned package even inside one company. A version number is the cheapest way to tell a team that something changed and whether they need to act.

## Name for the job

The hardest part is naming. `--color-red` is a primitive pretending to be semantic: the day errors become orange, the name lies. `--text-critical` survives that change. A good test is whether the name still makes sense in the dark theme and after a rebrand. If it does, it is a semantic token. If it does not, it belongs a tier lower.

None of this needs tooling to start. It needs one decision written down: which names are public, and what happens when one changes. The [token pipeline series](/showcase/plinth/demo/tutorials/token-pipeline-source) is the tooling, once you want it.
