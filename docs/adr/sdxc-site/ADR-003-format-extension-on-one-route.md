# ADR-003: One Route Serves a Resource in Every Format

## Status

**Accepted** - 2026-10-31

## Background

`/stats` gained a JSON and a markdown version for agents to analyse. The first cut declared
them as sibling routes (`statsJson: get("/stats.json")`, `statsMarkdown: get("/stats.md")`),
each with its own controller loading the same snapshots.

## Decision

A resource whose formats differ only in how one set of data is serialized is one route with
an optional extension, `stats: get("/stats(.:format)")`, mapped to one controller. The
controller validates `format` with `remix/data-schema` against the formats it serves, loads
the data once, and answers HTML, JSON or markdown from it; an extension it does not know
answers 404 instead of the page.

## Consequences

- The data is loaded and refreshed in one place, so the page and its twins can never
  disagree about which snapshot they describe.
- `routes.stats.href()` still builds `/stats`, since an optional group with a param is left
  out of the href when the param is omitted; `routes.stats.href({ format: "json" })` builds
  the twin.
- The existing markdown twins under `markdown.*` stay as they are: their sources are files in
  the bundle rather than one loaded data set, and their addresses are already published.
