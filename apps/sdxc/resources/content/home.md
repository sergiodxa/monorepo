<hero cta-href="/docs" cta-label="Read the docs" alt-href="/api" alt-label="Browse the packages">
# Small TypeScript packages built on web standards.

Take one, or take the set. There are {% $packageCount %} of them, written for Remix on
Cloudflare Workers: `Request` and `Response` in, typed values out. {% $frameworkFreeCount %} of
them need neither.

<install-command command="npm add @sdxc/result" />
</hero>

<section-block id="thesis" title="Failure is a value, not a control flow" tone="tinted">

A handler that composes three of them, and never throws.

```typescript
import { Markdown } from "@sdxc/markdown";
import { badRequest, ok } from "@sdxc/response";
import { isFailure } from "@sdxc/result";

export async function handler(request: Request) {
	let result = Markdown.parse(await request.text(), { frontmatter: Frontmatter });
	if (isFailure(result)) return badRequest({ line: result.error.position?.start.line });
	return ok(result.data.frontmatter);
}
```

<note kind="info">
Three things to read off it: failure arrives as a value, a `Request` goes in and a `Response`
comes out, and every package agrees on both.
</note>
</section-block>

<section-block id="properties" title="What holds the set together">

<feature-grid columns="2">
<feature title="Web standards first" icon="globe">
`Request`, `Response`, Web Crypto, `Intl` and Standard Schema — the platform, not a shim over it.
</feature>

<feature title="Errors are values" icon="shield">
Every fallible entry point answers with a **`Result`**, so nothing throws past you and the
failure carries where it happened.
</feature>

<feature title="Nothing you didn't ask for" icon="package">
Subpath exports keep what you skip out of your bundle, and {% $standaloneCount %} packages pull
in nothing from outside the collection at all.
</feature>

<feature title="Built for Remix, not bound to it" icon="zap">
{% $remixCount %} target Remix directly, because that is what they are written for. The other
{% $frameworkFreeCount %} depend on no framework and run anywhere `fetch` does.
</feature>
</feature-grid>
</section-block>

<section-block id="packages" title="The packages, by the problem they solve" tone="tinted">

<package-groups source="registry" />
</section-block>

<section-block id="detour" title="Three worth the detour">

Each of these does something you cannot get by reaching for another package.

<code-tabs>
<code-tab label="@sdxc/spec" selected>

Executable specifications, written in a language with no `if` and no loops, run in a fresh
workspace under permissions you grant by name.

```text
grant fs.write to "build/"
run "bun run build"
expect file "build/index.js" to exist
```

</code-tab>

<code-tab label="@sdxc/u + @sdxc/ui">

Accessible components built on `<dialog>`, the Popover API and Invoker Commands, rendered as
server HTML that works before any JavaScript loads.

```tsx
<Dialog>
	<Dialog.Trigger>Open</Dialog.Trigger>
	<Dialog.Content>
		<Dialog.Title>Delete this monitor?</Dialog.Title>
	</Dialog.Content>
</Dialog>
```

</code-tab>

<code-tab label="@sdxc/markdown">

GitHub Flavored Markdown to a typed AST you can walk, transform and write back. This page is
one: the copy you are reading is a markdown file, and the sections are tags with attribute
schemas.

```typescript
let painted = Markdown.walk(document, highlight);
```

</code-tab>
</code-tabs>
</section-block>

<section-block id="install" title="Install and pin" tone="tinted">

Versions are dates. A release published on the 21st of September 2026 is `2026.9.21`, there is
at most one a day, and a later date means a later release and nothing more — it promises no
compatibility with the one before it.

So pin exactly, and move when you are ready to read what changed.

```json
{
	"dependencies": {
		"@sdxc/result": "2026.9.21"
	}
}
```

<note kind="caution">
A range such as `^2026.9.21` reads as "any release this year", which is not what you want from a
scheme where the number carries no compatibility meaning.
</note>
</section-block>

<section-block id="start" title="Where to go next">

<feature-grid columns="3">
<feature title="Learning" icon="book">
[Start with the guides](/docs) — what these are, how to install them, and your first handler.
</feature>

<feature title="Browsing" icon="compass">
[Every package](/api), filterable by name and by what it does.
</feature>

<feature title="Watching" icon="zap">
[What shipped, and when](https://github.com/sergiodxa/monorepo/releases), one entry per release
date, with the commits that went into it.
</feature>
</feature-grid>

MIT licensed, and written by [Sergio Xalambrí](https://sergiodxa.com).
</section-block>
