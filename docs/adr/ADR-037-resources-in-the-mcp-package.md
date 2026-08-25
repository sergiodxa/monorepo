# ADR-037: Resources In The MCP Package

## Status

**Accepted** - 2026-08-25

## Background

[ADR-036](./ADR-036-model-context-protocol-server-package.md) built `@pkg/mcp` with tools only, on the reasoning that resources could be added later at no structural cost. Two of that reasoning's premises were wrong.

The first is that it treated resources as one of a list of optional extras alongside sampling, roots and logging. Those three are **deprecated** in revision `2026-07-28`; resources are active, and their omission was a scope decision dressed up as following the specification.

The second is the claim that adding them would change nothing in the transport. It does: `Mcp-Name` mirrors `params.name` for `tools/call` and `params.uri` for `resources/read`, and the original header check handled only the first.

The reason to fix this now rather than later is that resources answer a question tools cannot. `get_post` needs the _model_ to know a slug, which is why `search_posts` has to exist. A person who wants to hand one specific post to their agent has no slug to give either tool, and nothing to browse.

## Context

### Three Control Models, Not One

The specification separates its server features by who decides to use them, and this is the distinction ADR-036 missed:

| Feature   | Who decides                                             | Consequence                                                              |
| --------- | ------------------------------------------------------- | ------------------------------------------------------------------------ |
| Tools     | The **model**, from its own reading of the conversation | Needs a description good enough to choose by, and arguments it can guess |
| Resources | The **application** or the person, through a picker     | Needs to be enumerable and addressable; needs no prompt at all           |
| Prompts   | The **user**, explicitly, usually as a slash command    | Needs a workflow worth curating                                          |

A corpus of writing is the archetypal resource: enumerable, individually addressable, and useful without the model deciding anything.

### The Blog Already Serves What A Resource Needs

`apps/blog` content-negotiates Markdown from both a `.md` extension and `Accept: text/markdown`, and returns `403` for unpublished posts. That matters because the specification says to use the `https://` scheme **only** when the client can fetch and load the resource itself — and here it can. So resource URIs are the blog's own URLs, and the capability is about _enumeration_, not about moving bytes.

### Current State

| Situation                                                                                               | Consequence                                                                      |
| ------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `@pkg/mcp` serves tools only                                                                            | A person cannot pick a post; only the model can ask for one                      |
| `remix/route-pattern` matches full URLs, with typed `createHref` and a specificity-ranked multi-matcher | A resource's URI pattern needs no new machinery                                  |
| MCP publishes RFC 6570 templates                                                                        | The wire format is not the pattern language, so one has to derive from the other |
| `map()` took a tool or a group                                                                          | A second kind of mappable thing makes one overload ambiguous                     |

## Decision

Add resources to `@pkg/mcp`, declared as `remix/route-pattern` sources, with the RFC 6570 template derived from the pattern. Split `map()` into `mcp.tools.map` and `mcp.resources.map`.

### 1. A Resource Is Declared As A Route Pattern

```typescript
export default resources({
	article: resource("https://sergiodxa.com/articles/:slug.md", {
		name: "Article",
		title: "Blog article",
		description: "A published article, as Markdown.",
		mimeType: "text/markdown",
	}),
});
```

`:slug` rather than RFC 6570's `{slug}`, because a resource URI is a URL and `remix/route-pattern` already matches URLs — protocol, hostname, port, pathname and search. Reusing it removes four things this package would otherwise own: a template parser, a matcher, a type-level variable extractor, and a URI builder. The RFC 6570 form is derived for the wire, which is the same trade as deriving a tool's argument type from its JSON Schema — one declaration, and the wire format is whichever end of it the protocol asks for.

`resource.href({ slug })` is `createHref` for the declared pattern, typed. A listing therefore never concatenates a URI and cannot drift from the template it advertises.

### 2. The Pattern Subset Is Validated At Declaration

`:name` becomes `{name}`; `*name` becomes `{+name}`, whose reserved expansion is what allows the `/` a wildcard matches. Everything else in the pattern language has no RFC 6570 equivalent — optionals, protocol alternation, search constraints, unnamed wildcards, repeated capture names — and `resource()` throws on it.

Refusing at declaration rather than converting lossily, because a lossy conversion publishes a template a client expands into a URI this server never matches: the failure lands in someone else's client, on one transport, with nothing pointing back here. A resource that needs an optional segment is two resources.

### 3. Which List A Declaration Lands In Is Derived

| Declaration                    | `resources/list`         | `resources/templates/list` |
| ------------------------------ | ------------------------ | -------------------------- |
| Captures variables, has `list` | the enumerated instances | yes                        |
| Captures variables, no `list`  | —                        | yes                        |
| Captures nothing               | itself                   | —                          |

Derived rather than configured, because every combination is already implied by the declaration: a pattern with no variables is a single concrete URI and cannot need an enumerator, and a pattern with variables and no enumerator is exactly the case templates exist for — a corpus too large to list.

### 4. `ctx.variables`, Not `ctx.params`

`RequestContext.params` already holds the _route's_ params. Installing URI captures there would shadow them — harmless today only because the MCP route happens to take none, and a silent bug the moment it is mounted at `/:tenant/mcp`. RFC 6570 calls them variables.

### 5. `available` Carries Over; Middleware Does Not

A resource may declare `available(ctx)`, with the same contract as a tool's: absent from every list, and reported as not found on read. It feeds the same rule that flips `cacheScope` to `private`, since a list that varies by credential must not be held by a shared intermediary.

There is no `ResourceMiddleware`. Ask what it would wrap: authentication is the route's remix middleware, visibility is `available`, and a read has nothing billable or meterable about it — which is the one thing `ToolMiddleware` exists for. A third middleware type added on symmetry alone is the incidental complexity this package has been keeping out, and adding it later is purely additive.

### 6. A Read Has No `isError` Channel

The sharpest asymmetry with tools. A tool can hand the model a recoverable message through `isError`; MCP gives a resource read only JSON-RPC errors, so there is nothing a resource can say to the model and no `ToolError` equivalent.

- `read` returning `null` → `-32602`, carrying the URI in `data`, which is the not-found the specification mandates
- Any exception → `-32603` plus `onError`, with the message withheld

`null` rather than an empty array because the specification explicitly forbids an empty `contents` for a resource that does not exist: it cannot be told apart from one that exists and is empty.

### 7. Matching Is Specificity-Ranked, Not Registration-Ordered

One `createMultiMatcher` holds every mapped pattern, so an ambiguous URI resolves to the most specific declaration rather than to whichever happened to be mapped first. Free, from reusing `route-pattern`, and the alternative — trying each pattern in order — would have made correctness depend on the order of lines in `bootstrap`.

### 8. `map` Is Namespaced Per Kind

`mcp.tools.map` and `mcp.resources.map`, rather than one `map` overloaded on what it was handed. `remix/router` gets away with a single `map` because it has one kind of thing to map; a tool action and a resource action share nothing but the word, and one function taking either was the analogy stretched past where it held.

## Consequences

### Positive

- A person can browse and attach a post, which no tool can offer, because a tool cannot be browsed.
- No new machinery for patterns: matching, typed variables, typed URI building and specificity ranking all come from `route-pattern`.
- A URI is built in exactly one place — the resource's own `href()` — so a listing cannot advertise a URI the reader cannot resolve.
- Because the blog serves Markdown at its own URLs, a client may fetch a resource directly and never call `resources/read` at all.
- An unconvertible pattern fails at declaration, in this repository, rather than inside somebody's client.

### Negative

- The pattern language is narrower for resources than for routes, and the restriction is discovered by hitting it. An optional segment means two declarations.
- `ctx.variables` and `ctx.input` are two names for "what this handler was given", differing by which kind of handler it is.
- Resources and tools now differ in three ways a reader has to hold: no middleware, no `isError`, and `variables` instead of `input`.
- A read handler must re-apply the publish rule. It goes through the repository rather than the HTTP route that already returns `403`, so the check exists in one more place.

### Neutral

- No pagination on any list. The blog is a few hundred posts; `nextCursor` is added when it hurts.
- `resources/read` stays implemented even though `https://` URIs let a client bypass it, since nothing requires a client to fetch directly.
- Resources are mapped one at a time. With no shared middleware, a controller form would group without doing anything.

## Implementation Plan

### Phase 1: Declaration

1. `resources.ts` — `resource()`, `resources()`, the RFC 6570 conversion and its refusals, `createResource`.
2. `context.ts` — `ResourceContext`, and the keys behind `ctx.uri`, `ctx.variables` and `ctx.resource`.

### Phase 2: Dispatch

1. `resources/list`, `resources/templates/list`, `resources/read` in `handler.ts`.
2. `Mcp-Name` validation per method, via a source-field lookup instead of one hardcoded branch.
3. `capabilities` advertising only what is mapped.

### Phase 3: Adoption

1. The blog's articles, tutorials and glossary as resources ([blog ADR-003](./blog/ADR-003-mcp-server-for-the-blog.md)).

## Alternatives Considered

### 1. Declare RFC 6570 Templates Directly

Write `{slug}` and match it ourselves.

**Rejected because**: it means writing a template parser, a matcher, and a type-level variable extractor that `remix/route-pattern` already has, tested, with specificity ranking and a typed href builder attached. The wire format being RFC 6570 does not oblige the declaration to be — the same reasoning that lets a tool's TypeScript argument type come from its JSON Schema rather than beside it.

### 2. Convert Unsupported Pattern Syntax Lossily

Accept optionals and search constraints, and emit the closest RFC 6570 template.

**Rejected because**: the closest template is one a client expands into URIs this server does not match, and the failure surfaces in the client with nothing pointing back at the declaration that caused it. Throwing at declaration puts the error where the mistake is.

### 3. Skip `resources/templates/list`

Serve only the enumerated list, and never publish a template.

**Rejected because**: it works for the blog and fails for the next consumer. A corpus too large to enumerate is exactly what templates are for, and the conversion is the same code either way once patterns are declared.

### 4. Give Resources Middleware For Symmetry

Add `ResourceMiddleware` alongside `ToolMiddleware`.

**Rejected because**: nothing was found for it to do. Authentication is the route's remix middleware, visibility is `available`, and the case that justifies `ToolMiddleware` — seeing a result in order to meter it — has no resource equivalent. Symmetry is not a use case.

### 5. Use A Custom URI Scheme

Address resources as `blog:///articles/{slug}`.

**Rejected because**: the specification says to prefer `https://` when the client can fetch the resource itself, and the blog serves Markdown from its own URLs on both a `.md` extension and `Accept: text/markdown`. A custom scheme would force every read through this server for no benefit, and would make the URI unusable anywhere outside an MCP client.

### 6. Put Resource Params On `ctx.params`

Match `route-pattern`'s own vocabulary.

**Rejected because**: `RequestContext.params` is already the route's params. The collision is invisible while the MCP route takes none and silent when it does not.

### 7. One `map` For Both Kinds

Keep a single overloaded `map`.

**Rejected because**: a tool action and a resource action have no shape in common, so the overload is two unrelated functions sharing a name — and the error message when the wrong shape is passed points at neither.

## References

- [MCP resources](https://modelcontextprotocol.io/specification/2026-07-28/server/resources)
- [MCP prompts](https://modelcontextprotocol.io/specification/2026-07-28/server/prompts)
- [Key changes in `2026-07-28`](https://modelcontextprotocol.io/specification/2026-07-28/changelog)
- [RFC 6570 - URI Template](https://datatracker.ietf.org/doc/html/rfc6570)
- [ADR-036: Model Context Protocol Server Package](./ADR-036-model-context-protocol-server-package.md)
- [blog ADR-003: MCP Server For The Blog](./blog/ADR-003-mcp-server-for-the-blog.md)

## Current Progress

- [x] Phase 1: Declaration
- [x] Phase 2: Dispatch
- [ ] Phase 3: Adoption

## Notes

- The pattern-to-template conversion is the one place a resource's two representations meet. Every refusal in it exists because the alternative is a template that expands into a URI the matcher rejects, which is a failure with no local symptom.
- `route-pattern` treats `.` as a structural delimiter, so `:slug.md` captures up to the dot. A slug containing a dot would split; the blog's are hyphenated, and a corpus where that is not true needs a different pattern.
- A read handler re-applies the publish rule. The HTTP route for the same content returns `403` for a draft, but a resource read goes through the repository and inherits none of that.
- `available` runs on both lists and again on read, so it must stay cheap and free of side effects — the same constraint as a tool's.
- `resources/read` is still worth implementing even though `https://` URIs mean a client may never call it. Nothing obliges a client to fetch directly, and a switch to a custom scheme later would make it the only path.
- Resource `name` is the programmatic identifier and `title` is what a picker shows. Getting them the wrong way round produces a picker full of slugs, which is not a failure any test catches.
