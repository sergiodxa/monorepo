# ADR-002: A Page per Book

## Status

**Accepted** - 2026-10-31

## Background

The books site sold one book from root paths: `/release` was its landing, `/sample` its free
chapter and `/upgrade` its upgrade form. The domain is books.sergiodxa.com because more books
will follow, and each needs pages of its own without a new controller per book.

## Context

- `/release`, `/sample` and `/upgrade` are linked from newsletters and social posts, often
  with campaign query strings that attribution reads on landing.
- A reader may submit a cached `/sample` or `/upgrade` form after the move, as a `POST`.
- The checkout (`/api/checkout/:type`) and the Polar webhook are addressed by package slug
  and registered outside the codebase; they cannot move.
- The free chapter, the upgrade path and the landing copy all belong to one book.

## Decision

1. Every book is a record in `config/books.ts`, keyed by the slug its pages live under, with
   its packages, upgrade path and sample chapter. Its copy is the matching entry in
   `resources/content/books/`, typed so a catalogue slug without copy fails typechecking.
2. A book's pages are `/:book`, `/:book/sample` and `/:book/upgrade`. One controller serves
   each for every slug and answers 404 for a slug the catalogue does not list.
3. `/release`, `/sample` and `/upgrade` answer any method with a 308 to the same page under the
   featured book, keeping the query string, so old links still attribute and a cached form
   still posts.
4. `/` stays the newsletter sign-up and sends a new subscriber to the featured book.
5. The checkout, the webhook, and the signed `/sample/download` link stay where they are:
   they are addressed by package or by signature, not by book.

## Consequences

### Positive

- A second book is a record, its copy and a cover, with no route or controller change.
- Every published URL keeps working, permanently redirected to the page it meant.

### Negative

- The sample-chapter service still reads one chapter; a second book with a free chapter needs
  the service to take the book.

### Neutral

- Static paths outrank `/:book`, so `/health` and `/sample/download` are never read as slugs.
