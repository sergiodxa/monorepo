---
title: Read configuration files
description: Parse JSON with comments and trailing commas, point a mistake at its line and column, validate the result, and hand it to every command of a command line.
section:
    title: Operations & testing
    order: 9
order: 10
lastUpdated: 2026-10-15
outcomes:
    - "How to parse JSONC with comments and trailing commas"
    - "How to point a mistake at its line and column and validate the shape"
    - "How to hand the parsed config to every command of a command line"
---

A configuration file is written by people, so it wants comments that say why a setting is set,
and it forgives the trailing comma left behind when a line is deleted. That is JSONC, the
format of `tsconfig.json`, editor settings and many tools' own files: JSON plus `//` and
`/* */` comments and trailing commas in objects and arrays.

This guide reads a `deploy.jsonc` for a deploy tool with [`@sdxc/jsonc`](/api/jsonc), which
parses JSONC into exactly what `JSON.parse` would produce and answers a mistake with its line
and column, in a `Result`.

```bash
npm add @sdxc/cli @sdxc/jsonc @sdxc/result remix
```

## The file

```jsonc {% title="deploy.jsonc" %}
{
	// The bucket the site is uploaded to
	"bucket": "assets-production",
	"regions": [
		"eu-west",
		"us-east", // added for the launch
	],
	/* Seconds a CDN may keep a page */
	"maxAge": 300,
}
```

Everything else follows JSON exactly. Unquoted keys, single-quoted strings and hexadecimal
numbers, which JSON5 allows, are mistakes here, so a file that parses is one any JSONC reader
agrees on.

## Parse it and point at the mistake

`parse` answers the value, or a `JSONCParseError` whose message ends with the position:

```typescript {% title="src/config.ts" %}
import { readFile } from "node:fs/promises";

import { parse } from "@sdxc/jsonc";
import { failure, isFailure, success, wrap } from "@sdxc/result";

export async function readConfigText(path: string) {
	let text = await wrap(() => readFile(path, "utf8"));
	if (isFailure(text)) return failure(new Error(`${path} could not be read`));

	let parsed = parse(text.data);
	if (isFailure(parsed)) {
		let { reason, line, column } = parsed.error;
		return failure(new Error(`${path}:${line}:${column}: ${reason}`));
	}
	return success(parsed.data);
}
```

Written as `path:line:column`, the position is one an editor or a terminal opens straight at the
character. `reason` is the message without the position, `line` and `column` count from one, and
`offset` is the character's index in the text, for drawing the line with a marker under it:

```typescript {% title="src/config.ts" %}
import type { JSONCParseError } from "@sdxc/jsonc";

export function frame(text: string, error: JSONCParseError): string {
	let source = text.split(/\r\n|\r|\n/)[error.line - 1] ?? "";
	return `${source}\n${" ".repeat(error.column - 1)}^ ${error.reason}`;
}
```

The position comes from the parser rather than from the engine's `JSON.parse` message, so the
same file reports the same position and wording on Node, Bun, Deno and Cloudflare Workers. A
block comment that never closes is a failure too, at the place it opened.

## Validate the shape

A file that parses can still hold the wrong thing: a missing bucket, a string where a number
goes. Check the value with a schema once it parses, and report both kinds of mistake with the
file's name:

```typescript {% title="src/config.ts" %}
import * as s from "remix/data-schema";
import { min } from "remix/data-schema/checks";

const DEPLOY_CONFIG = s.object({
	bucket: s.string(),
	regions: s.array(s.string()),
	maxAge: s.defaulted(s.number().pipe(min(0)), 300),
});

export type DeployConfig = s.InferOutput<typeof DEPLOY_CONFIG>;

export async function loadConfig(path: string) {
	let value = await readConfigText(path);
	if (isFailure(value)) return value;

	let checked = s.parseSafe(DEPLOY_CONFIG, value.data);
	if (!checked.success) {
		let messages = checked.issues.map((issue) => issue.message).join("; ");
		return failure(new Error(`${path}: ${messages}`));
	}
	return success(checked.value);
}
```

`defaulted` fills `maxAge` when the file leaves it out, so the rest of the tool reads a number
and never checks for absence.

## Hand it to every command

A command line reads its configuration once per run, in middleware, and every handler receives
it typed:

```typescript {% title="src/middleware/config.ts" %}
import type { CommandMiddleware } from "@sdxc/cli";

import { join } from "node:path";

import { isFailure } from "@sdxc/result";
import { createContextKey } from "remix/router";

import type { DeployConfig } from "../config.js";

import { loadConfig } from "../config.js";

export const Config = createContextKey<DeployConfig>();

export function config(): CommandMiddleware<{
	key: typeof Config;
	value: DeployConfig;
	property: "config";
}> {
	return async (ctx, next) => {
		let loaded = await loadConfig(join(ctx.cwd, "deploy.jsonc"));
		if (isFailure(loaded)) return loaded;
		ctx.set(Config, loaded.data, { property: "config" });
		await next();
	};
}
```

A failure returned from the middleware ends the run with its message, before any handler, so
`deploy.jsonc:10:1: Unexpected character '}'` is the whole output of a run against a broken file.
[Build a command line](/docs/operations-and-testing/build-a-command-line) writes the rest of the
tool.

## Strip it for another reader

`strip` turns JSONC into plain JSON of the same length: comments and trailing commas become
spaces, and line breaks inside block comments stay. A tool that only reads JSON can then read
the file, and any offset it reports is an offset into the original:

```typescript {% title="src/config.ts" %}
import { strip } from "@sdxc/jsonc";

let json = strip('{ "bucket": "assets", /* staging */ }');
// '{ "bucket": "assets"                }'
```

`parse` strips before it parses, so reach for `strip` only when something other than `parse`
reads the text.

## Where to go next

- [Build a command line](/docs/operations-and-testing/build-a-command-line) — the commands this
  configuration is handed to.
- [`Result` everywhere](/docs/conventions/result-everywhere) — the shape `parse` and
  `loadConfig` answer.
- [Standard Schema validation](/docs/conventions/standard-schema-validation) — the schemas
  that check the parsed value.
- [`@sdxc/jsonc`](/api/jsonc) — every field of the parse error.
