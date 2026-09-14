# Vendored third-party files

Everything under `docs/vendor` is third-party text, copied in as published so a
check can run against the document it was written for. Nothing here is edited:
a correction goes upstream, and the copy is replaced from the source below.

## `commonmark/spec.json`

The example set of the [CommonMark Specification](https://spec.commonmark.org/),
version **0.31.2**, taken from `https://spec.commonmark.org/0.31.2/spec.json`.

652 examples, each `{ markdown, html, example, start_line, end_line, section }`,
where `start_line` and `end_line` index the specification's own `spec.txt`.

`packages/markdown/src/conformance/spec.test.ts` runs every one of them.

## `gfm/spec.txt` and `gfm/spec.json`

The [GitHub Flavored Markdown Specification](https://github.github.com/gfm/),
version **0.29** (2019-04-06), taken from
`https://github.github.com/gfm/`. `spec.txt` is the specification as published,
prose and examples together.

`spec.json` is derived from it, and holds the six fields the CommonMark example
set does plus one more:

- Each example is the text between a line of thirty-two backticks followed by
  ` example` and the closing line of thirty-two backticks, split at the line
  holding a single `.` into the source and the expected HTML.
- Every `→` is restored to the tab character it stands for in the prose.
- `section` is the nearest ATX heading above the example.
- `example` numbers the extracted examples from one, and `start_line` /
  `end_line` index `spec.txt`.
- `extension` carries the word the specification writes after ` example` on the
  examples belonging to one of its extensions: `table`, `disabled` for task
  lists, `strikethrough`, `autolink`, and `tagfilter`.

That is **672** examples, the extension ones included, so the suite exercises
tables, task lists, strikethrough, and literal autolinks against the
specification rather than against unit tests alone.

`packages/markdown/src/conformance/spec.test.ts` runs every one of them. The
single `tagfilter` example is expected to differ: `@sdxc/markdown` renders raw
HTML as escaped text, which is a stronger guarantee than the filter the
extension describes, so nothing raw ever becomes markup for it to filter.

## `@remix-run/*` and `remix/`

The `README.md` of each Remix v3 package, at the `3.0.0-rc.2` release the
workspaces pin, so a reader finds the API a package actually ships without
reaching into `node_modules`. Refresh them whenever the pin moves.

## `openfeature/`

The [OpenFeature Specification](https://openfeature.dev/specification/), version **0.9.0**,
taken from `https://github.com/open-feature/spec` at the `v0.9.0` tag. It defines a
vendor-neutral feature flag API: an evaluation API for application authors, a provider
interface for the systems that resolve flags, and the context, hook, event and tracking
semantics tying them together.

The layout mirrors the `specification/` directory of that repository, so a path in the
published document is a path here:

| Path                               | What it is                                                                    |
| ---------------------------------- | ----------------------------------------------------------------------------- |
| `README.md`                        | The conformance clause and the document status levels                         |
| `glossary.md`                      | The terms the normative sections are written in                               |
| `types.md`                         | Evaluation details, resolution details, error codes, reasons, provider status |
| `sections/01-flag-evaluation.md`   | The evaluation API: the singleton, clients, typed evaluation, lifecycle       |
| `sections/02-providers.md`         | The provider interface, initialization, shutdown, status                      |
| `sections/03-evaluation-context.md`| Context fields, merge precedence, transaction context propagation             |
| `sections/04-hooks.md`             | The four hook stages, hook data, registration and ordering                    |
| `sections/05-events.md`            | Provider events, handlers, and the event-to-status mapping                    |
| `sections/06-tracking.md`          | The tracking API and tracking event details                                   |
| `appendix-a-included-utilities.md` | In-memory provider, multi-provider, logging hook                              |
| `appendix-b-gherkin-suites.md`     | Points at the Gherkin suites below                                            |
| `appendix-c/index.md`              | OFREP, the remote evaluation protocol                                         |
| `appendix-d-observability.md`      | The OpenTelemetry attribute mapping for evaluations                           |
| `appendix-e-migrations.md`         | Migrating providers onto event-driven status                                  |
| `LICENSE`                          | Apache 2.0, the license the specification is published under                  |

Only the statements under markdown H5 headings, inside block quotes, carrying an RFC 2119
keyword are normative. Compliance is decided by the `MUST`, `MUST NOT`, `REQUIRED`, `SHALL`
and `SHALL NOT` statements alone; a `SHOULD` may be declined with reasons, and a `Condition`
that does not hold takes its nested requirements with it.

### `openfeature/specification.json`

The same normative statements, extracted: 135 top-level rules, each
`{ id, machine_id, content, "RFC 2119 keyword", children }`, where `id` is the requirement
number as the prose writes it (`Requirement 1.1.2.1`) and `children` holds the conditional
requirements nested under a `Condition`. This is the machine-readable form of the conformance
clause, so a suite can assert that every `MUST` has a test rather than counting on a reader to
notice a missing one.

### `openfeature/assets/gherkin/`

The specification's own end-to-end suites, meant to be run against an implementation backed by
the in-memory provider of Appendix A:

- `evaluation.feature` and `evaluation_v2.feature` — flag evaluation, the `v2` suite tagging
  each scenario with the requirement ids it covers (`@spec-1.4.7`).
- `contextMerging.feature` — the precedence order of API, transaction, client, invocation and
  before-hook context.
- `hooks.feature` — stage ordering and the data passed to each stage.
- `metadata.feature` — flag metadata reaching the evaluation details.
- `test-flags.json` — the flag set every suite evaluates against, covering zero values,
  disabled flags, metadata and targeting.
- `README.md` — what each flag in that set is for.

Scenarios are tagged by capability (`@transaction`, `@hooks`), so an implementation that
declines an optional part of the specification filters those tags out rather than failing them.
