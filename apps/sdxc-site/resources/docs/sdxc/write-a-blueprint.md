---
title: Write a blueprint
description: Generate the files your app repeats, such as a feature flag, a landing section or a fixture, from stubs of your own with sdxc pkg blueprint.
section:
    title: Generate files
    order: 2.5
order: 20
lastUpdated: 2026-11-09
outcomes:
    - "How to write a blueprint from one or more stubs"
    - "How a blueprint's placeholders become its flags and its help"
    - "How to check what a run writes before it writes it"
---

`sdxc make` writes the kinds of files every app has. For the files only your app repeats, write a
blueprint: one or more stubs in `.config/blueprint/`, run with `sdxc pkg blueprint`.
It works in any project, with or without `@sdxc/kit`, through `bunx @sdxc/blueprint`.

## Write the stubs

A blueprint is a folder of `.stub` files, or a single `<name>.stub`. Each stub's front matter names
the file it writes in `to`, so the stub's own file name is only a label:

```text
.config/blueprint/flag/
  index.stub
  test.stub
```

```text
---
to: app/flags/{{name | kebab}}.ts
description: A feature flag with its variants
---
export const {{name | snake | upper}} = flag("{{name | kebab}}");
{{#if beta}}
export const BETA = true;
{{/if}}
{{#each variants}}
export const {{item | snake | upper}} = "{{item}}";
{{/each}}
```

`{{name | kebab}}` pipes a value through filters (`camel`, `pascal`, `kebab`, `snake`, `plural`,
`singular`, `humanize`, `title`, `upper`, `lower` and more). `{{#if}}` writes its body for a true
or non-empty value, and `{{#each}}` once per item, as `{{item}}`. The `description` of
`index.stub` is what `--list` shows.

## Run it

Every placeholder is a flag in kebab case. A value only `{{#if}}` tests is a boolean flag, and one
`{{#each}}` walks is repeated:

```bash
sdxc pkg blueprint flag --name checkout-v2 --beta --variants control --variants new-flow
```

```text
created   app/flags/checkout-v2.ts
created   app/flags/checkout-v2.test.ts
```

Run a blueprint without its values, or with `--help`, to see what it takes, read from its stubs:

```bash
sdxc pkg blueprint flag --help
```

## Check before writing

`--dry-run` reports each file as `create`, `replace` or `conflict` and writes nothing. A file that
already exists stops a real run with exit 1, naming every one, and nothing is written; remove them,
or pass `--force` to replace them. Add `--json` for a report a script or an agent reads:

```bash
sdxc pkg blueprint flag --name checkout-v2 --dry-run --json
```

## Where to go next

- [Generate files](/docs/sdxc/generate-files) — change what `sdxc make` writes for one of its
  kinds by overriding that kind's stub in `make.stubs`.
- [Generate files from stubs](/docs/operations-and-testing/generate-files-from-stubs) — render
  and write stubs from your own tool.
- [`@sdxc/blueprint`](/api/blueprint) — every filter, option and error.
