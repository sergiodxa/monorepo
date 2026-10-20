---
title: What these are
description: A collection of small TypeScript packages that agree with each other, built on what the web platform already provides.
section:
    title: Getting started
    order: 1
order: 1
lastUpdated: 2026-10-19
outcomes:
    - "What the `@sdxc` packages have in common, and why they agree with each other"
    - "Which packages need Remix and which run anywhere `fetch` does"
    - "Which of the two ways in fits what you are building"
---

`@sdxc` is {% $packageCount %} packages published under one npm scope. They were written for
the same author's applications and kept in one repository, which is why they agree with each
other: the same idea of what a failure is, the same idea of what validation looks like, the
same idea of where the framework goes. This page covers what they share, and which of the two
ways in fits what you are building.

## What they have in common

**The platform is the baseline.** A package takes a `Request` and answers with a `Response`,
hashes through Web Crypto, formats through `Intl`, and describes a schema through Standard
Schema. Where the platform has an answer, that answer is the API; a shim exists only where it
does not.

**Failure is a value.** Every fallible entry point returns a `Result` rather than throwing, so
a failure is something the type system makes you look at. A parse failure also carries the
position it happened at, which is what turns "invalid input" into a line number.

**Nothing arrives that you did not ask for.** {% $standaloneCount %} of the {% $packageCount %}
have no dependency outside the collection at all, and the ones that do name it in their README.
Subpath exports keep the parts of a package you never import out of your bundle.

**They are written for Remix, and most work without it.** {% $remixCount %} target Remix
directly — that is the framework these are built for and the one they are proven in, across the
applications listed on the showcase. The other {% $frameworkFreeCount %} depend on no framework
and run anywhere `fetch` does. Where a package needs both, the framework binding sits under its
own subpath, so the core stays importable on its own.

## Packages, each with one job

Each package solves one problem and composes with the others because they share vocabulary,
and each one runs on its own. The [`sdxc` command](/docs/getting-started/the-sdxc-command)
starts a project in one folder layout and generates files where that layout puts them, and every
package works the same in a project laid out any other way.

Versions are dates, and a later date says only that it is later.

<note>
A dated version carries no compatibility promise, so a caret range accepts breaking changes.
Read [Install and pin](/docs/getting-started/install-and-pin) before you write a version into a
manifest.
</note>

## Two ways in

**Build an app with `sdxc`.** You start from a template that already has a router, a database,
jobs, email, an MCP endpoint and tests wired together, and `sdxc` writes each new controller,
model or job where it belongs. Pick this when you are starting an app on Cloudflare Workers and
want the decisions made:

- [The sdxc command](/docs/getting-started/the-sdxc-command) — what each command does, and
  where it is covered.

**Use the packages à la carte.** You add one package to the app you already have, whatever its
layout, and import it by its own name. Pick this when you need one problem solved, such as
signing a JWT or parsing markdown, and want nothing else to change:

- [Install and pin](/docs/getting-started/install-and-pin) — the versioning scheme, and the one
  rule it carries.
- [Your first handler](/docs/getting-started/your-first-handler) — three packages composed into
  something that runs.

## Where to go next

- [Build an app](/docs/getting-started/build-an-app) — start a project with `sdxc` and ship a
  small app end to end.
- [Your first handler](/docs/getting-started/your-first-handler) — three packages composed into
  a handler, with no project template.
- [`Result` everywhere](/docs/conventions/result-everywhere) — the convention every package's
  API is built around.
