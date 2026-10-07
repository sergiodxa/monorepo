# ADR-117: Search Query Syntax

## Status

**Accepted** - 2026-10-07

## Background

`parseQuery` in `@sdxc/search` (ADR-109) reads a small syntax: whitespace-separated words that
must all match, `"quoted phrases"`, a leading `-` to exclude and a trailing `*` for a prefix.
Everything else is text, which keeps any input safe in FTS5 and `LIKE`.

The blog's search needs more: narrowing to a tutorial's technology (`tag:"react router"`), to a
kind of post (`kind:tutorial`), to a title (`title:remix`), and either of two words
(`remix OR react`). People already know a syntax for this from Lucene, the query language of
Elasticsearch, Solr and OpenSearch, which GitHub's and Gmail's search operators also follow.

## Context

### Lucene's syntax against today's parser

| Lucene                             | Meaning                                    | Today                 |
| ---------------------------------- | ------------------------------------------ | --------------------- |
| `remix router`                     | Both terms, joined by the default operator | ✅ AND                |
| `"route pattern"`                  | Exact phrase                               | ✅                    |
| `-legacy`, `NOT legacy`            | Exclude                                    | ✅ `-` only           |
| `+remix`                           | Required                                   | ❌ (`+` is text)      |
| `field:value`, `field:"two words"` | Scoped to a field                          | ❌ (`field:` is text) |
| `remix OR react`, `AND`            | Boolean operators                          | ❌ (words)            |
| `(remix OR react) router`          | Grouping                                   | ❌                    |
| `rout*`                            | Prefix                                     | ✅                    |
| `date:[2025 TO 2026]`, `^2`, `~`   | Range, boost, fuzzy                        | ❌                    |

### Two kinds of qualifier

A qualifier means one of two things, and they compile to different SQL:

- **A text field**, such as `title:remix`: the words match, but only in one column. FTS5 has
  column filters for this (`{"title"} : "remix"`), and `LIKE` tests that column alone.
- **An exact filter**, such as `tag:"react router"` or `kind:tutorial`: the value must equal one
  of the row's values. FTS5 matches words, so `{"tags"} : "react"` also matches a post tagged
  `react router`; exact membership is a `where` on the app's own schema (`json_each`, an enum
  column, a join), which the package cannot know.

### FTS5 behaviour checked for this design

On SQLite 3.53: `{"title"} : "remix"*` filters by column; `("remix" OR {"title"} : "react")`
groups alternatives; a parenthesized group followed by an implicit AND is a syntax error, while
`(…) AND (…) NOT (…)` parses; `NOT ("a" OR "b")` excludes either.

## Decision

`parseQuery` reads a Lucene-compatible subset, leniently, with AND as the default operator.

### The syntax

| Typed                                   | Meaning                                                     |
| --------------------------------------- | ----------------------------------------------------------- |
| `remix router`                          | Both words (AND)                                            |
| `"route pattern"`                       | The exact phrase                                            |
| `rout*`                                 | A prefix (every word is one by default; see `prefix`)       |
| `-legacy`, `NOT legacy`                 | Leave out results holding it                                |
| `+remix`, `remix AND router`            | Required; the same as the default, accepted for familiarity |
| `remix OR react`                        | Either word; `OR` joins the terms on each side of it        |
| `title:remix`, `title:"route pattern"`  | A word or phrase in one declared field                      |
| `tag:"react router"`, `kind:tutorial`   | An exact value for a declared filter                        |
| `-tag:legacy`, `tag:remix OR tag:react` | Filters exclude and alternate like terms                    |

- **`OR` binds the terms next to it**, the way Gmail and GitHub read it: `remix OR react router`
  is `(remix OR react) AND router`. A chain `a OR b OR c` is one group.
- **Operators are uppercase.** `OR`, `AND` and `NOT` are operators only in capitals; lowercase
  they are words, and `"OR"` quoted is always the word.
- **Only declared names qualify.** `parseQuery(input, { fields, filters })` names the fields and
  filters it recognizes; any other `name:value` is an ordinary word, so `a:b`, `c++:x` and pasted
  URLs keep matching as text.
- **Leniency over errors.** Input never fails for its syntax: a dangling `OR`, an `OR` next to an
  excluded term, an empty `tag:`, and an `OR` joining a filter to a text term all fall back to
  plain AND, so a search box never answers `400` for what somebody typed. The `400`s stay the
  ones that exist today: too long, too many terms, nothing to find.
- **Out of scope:** parentheses (they stay text), ranges, boosts, fuzzy matching and escaping
  with `\`. Parentheses are the one a later ADR may add, as explicit grouping of `OR` chains.

### The parsed shape

```typescript
interface ParsedQuery {
	text: string;
	/** Every clause must match; a clause matches when any of its terms does. */
	clauses: SearchClause[];
	/** Exact-value filters, for the caller to apply as `where`. */
	filters: SearchFilter[];
}

interface SearchClause {
	terms: SearchTerm[]; // OR alternatives; an excluded clause holds one term
	exclude: boolean;
}

interface SearchTerm {
	text: string;
	phrase: boolean;
	prefix: boolean;
	field: string | null; // a declared text field, or null for every column
}

interface SearchFilter {
	name: string; // a declared filter, lowercased
	values: string[]; // OR alternatives, NFKC-normalized, never tokenized
	exclude: boolean;
}
```

The flat `terms` array is replaced; the change is breaking and lands without a compatibility
path. `maxTerms` counts every term and every filter value.

A query is searchable when it has at least one positive clause **or** one positive filter, so
`tag:remix` alone is valid. Only-exclusions stays refused.

### Fields in `defineSearch`

A searched column opts into a field name: `{ name: "title", weight: 10, field: "title" }`.
`search.fields` lists them, so a caller parses with the definition's own names:

```typescript
let parsed = parseQuery(q, { fields: POST_SEARCH.fields, filters: ["tag", "kind"] });
```

A term scoped to a field the definition does not map is a `SearchError` when the query runs,
since parsing and the definition disagree, which is a programming error.

### Compilation

- **FTS5:** each clause is parenthesized, its terms joined with `OR`, a scoped term written as
  `{"column"} : "text"`; positive clauses join with `AND`, and each exclusion follows as
  `NOT (…)`. The whole expression is still one bound value.
- **`LIKE`:** a clause is an `or` of its terms, each term an `or` over its columns (one column
  when scoped); positive clauses join with `and`, exclusions as `not coalesce(…, 0)`. `rank` sums
  the weighted hits of every positive term, so an OR group ranks a row by the alternatives it
  holds.
- **No positive clause** (a filter-only query): no `MATCH`, every row's `rank` is `0`, exclusions
  still apply (`not in (select rowid … match ?)` with FTS5), and the default order is the key, so
  a caller orders such a page by its own column, by date for instance.
- **Filters** never reach the package's SQL. The caller maps each `SearchFilter` to a `where`.

### Highlighting

`highlight(text, query, { field })` marks unscoped terms everywhere and a scoped term only when
`field` names its field; every alternative of an OR group highlights; filters never highlight.

### In the blog

- `title` is a field. `tag` filters tutorials whose tag list holds the value, compared
  case-insensitively; `kind` accepts `article`, `tutorial` and `glossary` (plural tolerated),
  and an unknown kind matches nothing. `lang` (with `locale` and `language` as aliases) matches
  a post's language by whole subtags, an article's `locale` or English for the rest.
- A filter-only search orders by publish date, newest first.
- The `/search` page explains the syntax in a `<details>` disclosure under the form; the
  Spotlight panel stays bare.
- The MCP `search_posts` tool reads the same syntax in its `query`, beside its `kind` and `tag`
  arguments.

### In the reader

The reader parses with no fields or filters, so the only change it sees is `OR`, `AND` and `NOT`
becoming operators in capitals.

## Consequences

### Positive

- **A syntax people know.** Quotes, `-`, `OR` and `field:value` behave as on GitHub and Gmail.
- **Exact filters are exact.** `tag:react` never matches `react router`, because filters are the
  app's `where`, not word matching.
- **Still safe.** No input reaches FTS5 as syntax: the compiler writes every operator, and the
  parser's leniency means no input is a syntax error.

### Negative

- **A breaking shape.** `terms` becomes `clauses` and `filters`; both apps and their tests change.
- **Capitalized words change meaning.** A search for the words `OR`, `AND` or `NOT` needs quotes.
- **Filters are the caller's work.** Each app maps its filter names to SQL.

### Neutral

- Lucene's default operator is OR, ranked by how much matches; ours stays AND, which is what a
  site search box is expected to do.

## Implementation Plan

### Phase 1: The package

**Priority:** High
**Estimated Effort:** 4 hours

1. `parseQuery` reads clauses, operators, fields and filters, with tests for every row of the
   syntax table and every lenient fallback.
2. `defineSearch` takes `field` on columns and exposes `search.fields`; FTS5 and `LIKE` compile
   clauses, scoped terms and filter-only queries; the parameter budget counts the new shapes.
3. `highlight` and `excerpt` take `field`.
4. README: the syntax, fields and filters.

### Phase 2: The reader

**Priority:** High
**Estimated Effort:** 1 hour

1. Read `clauses` where it read `terms`; tests for `OR` and `NOT`.

### Phase 3: The blog

**Priority:** High
**Estimated Effort:** 3 hours

1. Parse with `fields: POST_SEARCH.fields` and `filters: ["tag", "kind"]`, apply both filters, and
   order filter-only searches by date.
2. Highlight titles with `{ field: "title" }`.
3. The syntax disclosure on `/search`, and the MCP tool description.

## Alternatives Considered

### 1. Full Lucene

Parentheses, ranges, boosts, fuzzy matching and escaping.

**Rejected because**: ranges and boosts have no mapping onto FTS5 and `LIKE` worth their parser,
and Lucene's strictness (`c++` and `a:b` need escaping, malformed input is an error) is wrong for
a search box.

### 2. Filters as FTS5 column filters

`tag:react` as `{"tags"} : "react"`, keeping everything inside the package.

**Rejected because**: it matches words, so `tag:react` finds `react router`, and `kind` is not a
text column at all.

### 3. OR as Lucene's lowest-precedence operator

`remix OR react router` as `remix OR (react AND router)`.

**Rejected because**: with AND as the default operator, the reading people expect from GitHub
and Gmail is the adjacent one, and it keeps every query an AND of OR groups, which compiles to
both strategies directly.

## References

- [ADR-109: Search Package](./ADR-109-search-package.md)
- [Apache Lucene query parser syntax](https://lucene.apache.org/core/9_0_0/queryparser/org/apache/lucene/queryparser/classic/package-summary.html)
- [SQLite FTS5 query syntax](https://www.sqlite.org/fts5.html#full_text_query_syntax)

## Current Progress

- [x] Phase 1: The package
- [x] Phase 2: The reader (deploy pending)
- [x] Phase 3: The blog (deployed 2026-10-07)
