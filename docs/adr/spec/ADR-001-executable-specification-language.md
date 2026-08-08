# ADR-001: An Executable Specification Language for Application Behavior

## Status

**Proposed** - 2026-08-08

This is the first ADR in an eight-part suite describing a conceptual project: a
language-independent, executable specification language for application
behavior, written in `.spec` files and executed by a dedicated runtime. Nothing
described in this suite is implemented. This document establishes what the
project is, why it exists, what it deliberately is not, and how to read the
rest of the suite. The remaining seven ADRs elaborate the parts:
[ADR-002](./ADR-002-specification-language-design.md) defines the language,
[ADR-003](./ADR-003-suite-organization-and-shared-definitions.md) the
organization of a specification suite,
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) the runtime and plugin
protocol, [ADR-005](./ADR-005-interface-capabilities.md) the standard interface
capabilities, [ADR-006](./ADR-006-isolated-test-workspaces.md) the isolated
test workspace, [ADR-007](./ADR-007-deny-by-default-permissions.md) the
permission model, and
[ADR-008](./ADR-008-environments-and-compatibility.md) environments and
compatibility testing.

## Background

### How to read this suite

The suite has two jobs that pull in opposite directions. A reader must be able
to learn the whole system from these documents alone — how to write a
specification, how to organize a suite, how to run it, what to expect when it
fails. At the same time, the project is conceptual: no runtime exists, and
freezing a grammar before anything has been built would repeat a classic
design mistake. The suite resolves the tension by labeling every substantive
claim with one of four dispositions, written as a bold lead-in on the
paragraph or section that introduces it:

- **Decided.** A real decision of this suite. Changing it later requires a new
  ADR. Readers — including AI agents — may rely on it.
- **Direction.** The current leaning. It is expected to survive, but a better
  argument can still displace it without ceremony.
- **Illustrative.** Concrete syntax, flag names, tool names, or output shown
  to make a decided or directional idea teachable. The semantics carry the
  label of their own paragraph; the spelling is not frozen.
- **Open.** Genuinely unresolved. Every Open item also appears in its ADR's
  closing Open Questions section, and no ADR in this suite invents an answer
  to one merely to look finished.

Unless the surrounding text says otherwise, **every code block in this suite
that shows `.spec` syntax, CLI invocations, or runtime output is
Illustrative.** It is the canonical teaching notation — consistent across all
eight documents, and precise enough to learn from — but it is notation, not a
frozen grammar. When a snippet's spelling is itself a decision, the text says
so explicitly.

One term, defined once here for the whole suite: several ADRs cite **the
brief**, sometimes normatively. The brief is the founding product description
from which this suite was distilled. It is a historical input, not a ninth
normative document: wherever an ADR quotes or cites it, authority rests with
the disposition label on the surrounding paragraph, not with the brief itself.
Readers do not need the brief — the suite is self-contained.

One naming note, made once here for the whole suite: the project has no final
name. `spec` — as in `.spec` files, the `spec` runtime, and the `spec` CLI —
is a working name, and finding a real one is an open question at the end of
this document.

### A reading map

Each ADR owns one part of the system and links to the others rather than
repeating them:

| ADR                                                               | What it covers                                                                           |
| ----------------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| ADR-001 (this document)                                           | The core idea, motivation, prior art, non-goals, design principles                       |
| [ADR-002](./ADR-002-specification-language-design.md)             | The `.spec` language: tests, Given/When/Then, commands, fixtures, `expect`, `eventually` |
| [ADR-003](./ADR-003-suite-organization-and-shared-definitions.md) | The `spec/` directory, shared definitions, and the AI-agent workflow                     |
| [ADR-004](./ADR-004-runtime-and-plugin-protocol.md)               | The runtime, the plugin protocol, tool discovery, diagnostics                            |
| [ADR-005](./ADR-005-interface-capabilities.md)                    | Standard capabilities (browser, HTTP, CLI, mobile) and accessibility-first interaction   |
| [ADR-006](./ADR-006-isolated-test-workspaces.md)                  | The isolated ephemeral workspace every test receives                                     |
| [ADR-007](./ADR-007-deny-by-default-permissions.md)               | Deny-by-default permissions and explicit grants                                          |
| [ADR-008](./ADR-008-environments-and-compatibility.md)            | Environment configuration and compatibility testing across implementations               |

To learn the system, read in numeric order with one permitted detour: a reader
who only writes specifications can read ADR-002 and ADR-003 to learn the
language and how suites are organized, ADR-005 and ADR-006 for the
capabilities specifications call and the workspace they run in, and ADR-007
before running anything, because the permission model shapes what a first
`spec run` does. ADR-004 matters most to readers who will build plugins or the
runtime itself, and ADR-008 to readers who will point one suite at several
implementations. This document supplies the vocabulary all of them assume.

## Context

### Tests are coupled to the implementation they verify

Almost every test written today is written in the implementation's own
ecosystem: Vitest, Jest, or bun:test for JavaScript/TypeScript; Minitest or
RSpec for Ruby; pytest for Python; XCTest for Swift; and so on. For unit
tests this coupling is not a defect — a unit test exercises a function or a
class directly, so it must live where that function lives, speak its language,
and share its tooling. Unit tests are explicitly not the target of this
project.

The problem appears one level up. Acceptance, integration, system, and
end-to-end tests describe what an application does for its users: sign in,
publish a post, reject an anonymous comment. Nothing about those sentences is
specific to Ruby or TypeScript, yet the tests that verify them are written in
Ruby or TypeScript, against framework APIs, glued to the implementation's
ecosystem. The description of the product's behavior — the most durable
knowledge a team owns — is stored in the least durable container available.

The consequence is familiar to anyone who has rewritten a system: the old
implementation's behavioral tests do not carry over. They are rewritten
alongside the code, which means the rewrite is verified against a fresh test
suite rather than against the accumulated, battle-tested description of what
the old system actually did. Every behavior the new suite forgets to restate
is a behavior the rewrite is free to silently change.

### What a rewrite should not invalidate

The important property this project pursues is that specifications survive
implementation rewrites. Concretely, the same specification files should keep
passing, without modification, across changes such as:

- a Rails API rewritten as a Rust API
- a React web app replaced by another frontend implementation
- a Zig CLI rewritten in Rust
- an Electron desktop app replaced by a native desktop app
- one JavaScript runtime replaced by an independently implemented runtime

If externally observable behavior remains equivalent, the same `.spec` files
continue passing without modification. That sentence is the project's test for
itself: any design choice that would let an implementation detail leak into a
specification — a framework API, a CSS class name, a host-language callback —
fails it.

A core use case follows directly: compatibility testing, where one
specification suite runs against an old implementation and its replacement,
and the diff between the two runs is the behavioral diff between the two
systems. [ADR-008](./ADR-008-environments-and-compatibility.md) develops this
use case, including a worked example of specifying a programming runtime.

### Prior art

None of this project's ingredients is new, and this suite makes no claim of
novelty. Given/When/Then comes from the Gherkin tradition; semantic UI
locators from Playwright; deny-by-default permissions from Deno and the
capability-security literature; protocol-mediated tools from MCP. What
follows is an honest account of what each neighbor already does well and where
this proposal departs. If the proposal contributes anything, it is the
combination, and that remains to be proven by an implementation.

#### Cucumber and Gherkin

Gherkin demonstrated, at scale and across two decades, that business-readable
scenarios written in Given/When/Then structure work: product owners can read
them, teams organize features around them, and the `.feature` files double as
living documentation. This project adopts that structural vocabulary directly
(as blocks, with stricter ordering rules — see
[ADR-002](./ADR-002-specification-language-design.md)).

The departure is executability. A Gherkin step such as:

```
Given I am logged in
```

ultimately maps to code written in JavaScript, Ruby, Java, etc. — a step
definition. Gherkin itself has no semantics; the glue code has all of them.
That has two consequences. First, the portability of the `.feature` text is
partly an illusion: rewrite the application from Rails to Rust and the
`.feature` files survive, but every step definition — the part that actually
does anything — must be rewritten in the new ecosystem. Second, every project
accumulates a private, implementation-language vocabulary of steps, so two
teams' suites are mutually unintelligible even when both are "Gherkin."

In this proposal, operations such as:

```
open "/login"
fill textbox "Email" with user.email
click button "Sign in"
```

have executable semantics supplied through standard/plugin capabilities.
Reusable composition remains inside `.spec`, rather than requiring
implementation-language glue code: a `command` is built from other
specification statements, never from host-language functions
([ADR-002](./ADR-002-specification-language-design.md)). The step-definition
layer — Gherkin's escape hatch and its coupling point — is deliberately
absent.

#### Playwright and Cypress

Playwright and Cypress are excellent browser automation systems, and
Playwright in particular deserves credit for making semantic locators —
`getByRole`, `getByLabel` — the recommended way to address a page. That model,
where tests speak in roles and accessible names instead of CSS selectors, is
the direct conceptual ancestor of this project's accessibility-first browser
interaction ([ADR-005](./ADR-005-interface-capabilities.md)).

The differences are level and surface. A Playwright test is a TypeScript or
JavaScript program with the full power of the host language, which is a
strength — arbitrary logic, arbitrary libraries — and precisely the coupling
this project excludes from the specification layer. And both tools are
primarily browser automation; this project treats the browser as one
capability among several equals. The relationship is complementary rather
than competitive: a browser plugin might internally use Playwright as its
automation technology, while `.spec` files never depend on it
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)).

#### Language-native testing frameworks

Vitest, Jest, bun:test, RSpec, Minitest, pytest, XCTest and their peers are
the right tool for unit testing, and nothing in this suite competes with them.
Their coupling to one ecosystem is what makes them good: direct access to the
code under test, fast in-process execution, rich mocking. The mistake this
project addresses is not that these frameworks exist but that, for lack of an
alternative, they are also where system-level behavioral knowledge ends up
stored. A project using the spec language is expected to keep a conventional
unit-test suite alongside `spec/`.

#### Deno's permission model

Deno mainstreamed a runtime that grants nothing by default: code cannot touch
the network, the filesystem, subprocesses, or environment variables unless the
invoker passes `--allow-net`, `--allow-run`, `--allow-env`, and so on, often
with narrow scopes. This project adopts the same posture and a similar
surface-level grammar for grants
([ADR-007](./ADR-007-deny-by-default-permissions.md)). The difference is what
sits inside the sandbox: Deno secures a general-purpose language, so the
permission boundary is the only line of defense against arbitrary code. Here
the specification language is itself deliberately limited — no control flow,
no host-language escape — and privileged operations reach the outside world
only through plugins, so enforcement must span external plugin processes as
well, which raises questions Deno does not face
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md),
[ADR-007](./ADR-007-deny-by-default-permissions.md)).

#### Capability-based security

The principle this suite states as "no ambient authority" comes from the
object-capability literature: a program should hold only the authority
explicitly handed to it, rather than inheriting whatever its environment
ambiently offers. Capability systems have decades of design work on
delegation, attenuation, and revocation that the permission model in
[ADR-007](./ADR-007-deny-by-default-permissions.md) draws on. This project is
capability-flavored rather than a full object-capability system: authority is
granted per invocation by the caller at the CLI boundary and enforced
centrally by the runtime, not passed as first-class references through the
language.

#### Protocol-based tool systems such as MCP

MCP demonstrated a pattern this project's plugin architecture is conceptually
modeled on: a runtime discovers tools over a language-neutral protocol, each
tool described by a typed schema, with the tool's implementation living in a
separate process written in any language. That is exactly the boundary wanted
between `.spec` files and automation technologies. Whether the plugin
protocol should be MCP, JSON-RPC, or something purpose-built is deliberately
not decided; [ADR-004](./ADR-004-runtime-and-plugin-protocol.md) compares the
candidates and records what information is missing to choose.

## Decision

Define an executable specification language for application behavior: `.spec`
files, written in a deliberately limited language, executed by a runtime that
reaches applications only through typed plugin capabilities. This section
records the project-level decisions — what the thing is, its scope, its
non-goals, and the principles the rest of the suite elaborates.

### 1. Behavior lives in `.spec` files

**Decided.** The project defines an executable specification language using
`.spec` files. A repository adopting it gains a `spec/` directory:

```
spec/
  authentication.spec
  posts.spec
  comments.spec
  moderation.spec
```

The division of labor is exact. The specification describes the observable
behavior of an application independently of how that application is
implemented. The source code describes how the application is built. The
`.spec` files describe what the application is expected to do. A developer or
architect should be able to inspect `spec/` and understand the major
capabilities and behavior of the product without reading its implementation.

The guiding principle for the whole project:

> "The test suite is the executable specification of the product. The source
> code is one possible implementation of it."

This inverts the usual hierarchy. Tests are normally subordinate artifacts —
written after the code, deleted with the code, trusted less than the code.
Here the specification is the durable artifact and the implementation is the
replaceable one. To make the idea concrete, a small specification in the
suite's teaching notation (the language itself is
[ADR-002](./ADR-002-specification-language-design.md)):

```
test "anonymous users cannot comment" {
  given {
    let post = fixture post
  }

  when {
    open post.url
  }

  then {
    expect text "Sign in to comment"
  }
}
```

Nothing in it names a framework, a database, a selector, or a language. It
would read identically — and, decisively, would _execute_ identically —
whether the application behind it is Rails or Rust.

### 2. The scope is black-box system behavior

**Decided.** This project focuses on black-box behavioral, acceptance,
integration, system, and end-to-end specifications. It does not address unit
testing, which remains the job of language-native frameworks. The dividing
line is observability: a specification may state anything a user, a client, or
a neighboring system could observe — a rendered page, an HTTP response, a
process's stdout and exit code, a file an application produced — and may state
nothing about the private structure that produced it. A specification that
could only be written by reading the implementation is describing the wrong
thing.

Black-box scope is what makes the survival property of the Context section
achievable at all: internals are guaranteed to change across a rewrite, so any
specification touching them is guaranteed to break. It is also what makes
`spec/` readable as a product description rather than as a second copy of the
code ([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)).

### 3. One language for every application surface

**Decided.** The specification language must not be designed specifically for
web applications. It must be capable of interacting with browsers and web
applications, HTTP APIs, CLI applications, filesystems and workspaces, desktop
applications, iOS applications and simulators, Android applications and
emulators, and application interfaces that do not exist yet. Each surface is
reached through a capability plugin
([ADR-005](./ADR-005-interface-capabilities.md) catalogs the standard
families; [ADR-004](./ADR-004-runtime-and-plugin-protocol.md) explains how
plugins work).

**Decided.** A particularly important requirement: one specification can
interact with multiple interfaces. A specification may create a resource
through an API and verify it through a browser; create something through a CLI
and verify it appears in a web application; perform an action on a website and
verify its result in a mobile application; create source files, execute a
compiler or runtime against them, and inspect the generated files; or create a
project tree, invoke a package manager, and inspect its filesystem and CLI
behavior. The specification describes behavior across the application as a
system rather than being tied to one interface. Worked multi-interface
examples live in [ADR-005](./ADR-005-interface-capabilities.md); the
filesystem-centered ones depend on the isolated workspace of
[ADR-006](./ADR-006-isolated-test-workspaces.md).

The alternative — a web-first language with other surfaces bolted on — loses
because the most valuable specifications in the motivating use cases are
exactly the cross-surface ones, and a bolted-on surface never composes
cleanly with the primary one. Designing for the general case first is the
cheaper order.

### 4. Non-goals

**Decided.** The following are explicitly not goals of this project. Each has
tempted a predecessor system into scope creep, and each is refused here on
purpose:

- **Replacing unit tests.** Unit tests stay in language-native frameworks,
  next to the code they exercise.
- **Becoming a general-purpose programming language.** The language omits
  control flow deliberately
  ([ADR-002](./ADR-002-specification-language-design.md)); pressure to add it
  is pressure to reinvent the problem this project exists to escape.
- **Testing private classes or functions directly.** That is unit testing,
  and it is coupled to internals by definition.
- **Exposing implementation internals.** No capability should let a
  specification observe what a user could not.
- **Tying specs to Playwright or another particular automation technology.**
  Automation technologies live behind the plugin protocol and are
  substitutable ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)).
- **Tying plugins to the runtime implementation language.** The plugin
  protocol is language-neutral; a plugin author never needs the runtime's
  language.
- **Arbitrary host-language code inside `.spec`.** Composition never escapes
  the specification language
  ([ADR-002](./ADR-002-specification-language-design.md)); new low-level
  capability comes from plugins, not embedded code.
- **Giving specs ambient access to the host machine.** All privileged access
  is denied by default and explicitly granted
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)).
- **Giving AI-generated specs implicit permissions.** A generated `.spec`
  file requesting a capability changes nothing; only the caller grants
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)).
- **Requiring a true in-memory filesystem.** The workspace contract is
  observable isolation, not a mandated mechanism
  ([ADR-006](./ADR-006-isolated-test-workspaces.md)).
- **Proving two implementations completely equivalent.** A passing suite
  proves equivalence only for the behaviors the specifications cover
  ([ADR-008](./ADR-008-environments-and-compatibility.md)).

### 5. Design principles

**Decided.** Twenty-four principles govern the suite. When a later design
question has no explicit answer, the answer consistent with these principles
wins. The table names where each is elaborated; principles marked "this ADR"
are fully stated by this document.

| #   | Principle                                                                                         | Elaborated in     |
| --- | ------------------------------------------------------------------------------------------------- | ----------------- |
| 1   | Human-readable first.                                                                             | ADR-002           |
| 2   | Executable without implementation-specific glue code.                                             | ADR-002, ADR-004  |
| 3   | Implementation-language independent.                                                              | this ADR, ADR-008 |
| 4   | Framework independent.                                                                            | this ADR, ADR-004 |
| 5   | Plugin-language independent.                                                                      | ADR-004           |
| 6   | Black-box by default.                                                                             | this ADR          |
| 7   | Multi-interface.                                                                                  | ADR-005           |
| 8   | Accessibility-first for browser interaction.                                                      | ADR-005           |
| 9   | Deterministic and intentionally limited.                                                          | ADR-002           |
| 10  | Specifications should survive rewrites.                                                           | ADR-008           |
| 11  | Specifications should function as product documentation.                                          | ADR-003           |
| 12  | Specifications should be easy for AI agents to consume and produce.                               | ADR-003           |
| 13  | Composition stays inside the specification language.                                              | ADR-002           |
| 14  | Environment configuration stays outside behavioral specifications.                                | ADR-008           |
| 15  | Failures should produce excellent diagnostics.                                                    | ADR-004, ADR-007  |
| 16  | Every test runs in an isolated ephemeral workspace.                                               | ADR-006           |
| 17  | Workspace filesystem access is safe by default and distinct from host filesystem access.          | ADR-006, ADR-007  |
| 18  | No ambient authority.                                                                             | ADR-007           |
| 19  | Privileged capabilities are denied by default.                                                    | ADR-007           |
| 20  | Permissions must be explicitly granted by the caller.                                             | ADR-007           |
| 21  | Permissions should follow least privilege and support narrow scopes where practical.              | ADR-007           |
| 22  | Specs may legitimately fail under plain `spec run` because a required permission was not granted. | ADR-007           |
| 23  | Plugins declare capabilities, but the runtime centrally enforces permissions.                     | ADR-004, ADR-007  |
| 24  | AI-generated specifications must not be able to grant themselves additional privileges.           | ADR-003, ADR-007  |

Two of these deserve a sentence here because they shape every other document.
Principle 12 is why the language stays small and linear: an AI agent asked to
implement an application from its `spec/` directory
([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)) must be
able to read the specification as an unambiguous contract, and an agent asked
to write specifications must not be able to hide complexity in them.
Principles 18-24 exist because that same workflow means `.spec` files will
routinely be machine-generated and executed automatically; a specification is
therefore treated as untrusted input, and the security model assumes it
([ADR-007](./ADR-007-deny-by-default-permissions.md)).

## Consequences

- This suite is the project's source of truth until an implementation exists.
  Items labeled **Decided** may be relied on by readers and by future design
  work; revisiting one requires a new ADR. Items labeled **Direction** or
  **Open** may shift without ceremony, and the illustrative notation may be
  respelled wholesale without invalidating any decision.
- Committing to black-box scope means some things genuinely cannot be
  specified — private algorithms, internal state transitions, performance of
  inner layers. Teams needing those guarantees keep unit tests; the suite
  refuses to grow toward them.
- Committing to rewrite-survival disciplines every later design decision: any
  proposed language or capability feature can be tested by asking whether a
  specification using it would still pass after an honest reimplementation.
- Committing to multi-surface generality means the browser is never allowed
  to become a privileged special case, even though web applications will
  likely dominate early usage. The cost is that surface-specific conveniences
  must be expressed as plugin capabilities rather than language features.
- Because the permission model is deny-by-default, a newcomer's first
  `spec run` may fail with permission errors. The suite accepts this as a
  security feature, not a usability bug, and invests in diagnostics instead
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)).

## Open Questions

- **Should specifications compile to a stable intermediate representation?**
  A stable IR could decouple the source grammar from runtime execution, allow
  independent runtime implementations to share compiled suites, and give
  compatibility testing a precise artifact to version — but it also creates a
  second format to specify and keep stable before the first format has
  settled. Whether an IR is part of the architecture or an internal detail of
  one runtime is unresolved.
- **Should the AST or IR be exposed for tooling and AI agents?** Editors,
  documentation generators, and AI agents could consume a structured
  representation of a suite rather than re-parsing `.spec` text, and comments
  are already required to be preservable in such representations
  ([ADR-002](./ADR-002-specification-language-design.md)) — but exposing a
  structured form makes it public API, with all the stability obligations
  that implies. How much structure to expose, and with what guarantees, is
  open.
- **What editor and LSP support should exist?** A language whose value rests
  on being written and read by humans and agents likely needs completion for
  plugin tools, diagnostics for unknown or ambiguous names, and hover
  documentation sourced from plugin metadata — but none of that is designed,
  and whether it demands a full language server or something smaller is
  open.
- **What is the project actually called?** `spec` is a working name used
  throughout this suite for the file extension, the runtime, and the CLI. It
  is generic, collides with existing tools and vocabulary, and was chosen
  only so these documents could be written; the real name — and with it the
  final file extension and CLI binary name — is undecided.
