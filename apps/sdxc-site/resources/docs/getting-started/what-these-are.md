---
title: What these are
description: A collection of small TypeScript packages that agree with each other, built on what the web platform already provides.
section:
    title: Getting started
    order: 1
order: 1
lastUpdated: 2026-09-21
---

`@sdxc` is {% $packageCount %} packages published under one npm scope. They were written for
the same author's applications and kept in one repository, which is why they agree with each
other: the same idea of what a failure is, the same idea of what validation looks like, the
same idea of where the framework goes.

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

## What they are not

They are not a framework. There is no CLI that scaffolds a project, no plugin system, no
convention about where your files live. Each package solves one problem and composes with the
others because they share vocabulary, not because they share a runtime.

They are not a compatibility promise. Versions are dates, and a later date says only that it is
later — see [Install and pin](/docs/getting-started/install-and-pin) before you write a range
into a manifest.

## Where to go next

- [Install and pin](/docs/getting-started/install-and-pin) — the versioning scheme, and the one
  rule it carries.
- [Your first handler](/docs/getting-started/your-first-handler) — three packages composed into
  something that runs.
- [Every package](/api) — the whole list, filterable.
