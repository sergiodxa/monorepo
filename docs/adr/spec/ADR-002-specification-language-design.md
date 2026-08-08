# ADR-002: The `.spec` Language: Tests, Commands, Fixtures, and Restraint

## Status

**Proposed** - 2026-08-08

This ADR is part of the spec-language suite introduced in
[ADR-001](./ADR-001-executable-specification-language.md), which makes the case for an
executable specification language, surveys prior art, and defines the **Decided** /
**Direction** / **Illustrative** / **Open** labels used throughout this document. This
ADR defines the language itself — what a `.spec` file may say and, just as
deliberately, what it may not. It depends on
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) for how statements resolve to
plugin tools, on [ADR-005](./ADR-005-interface-capabilities.md) for the standard
capability families those statements call, and on
[ADR-003](./ADR-003-suite-organization-and-shared-definitions.md) for where shared
commands and fixtures live and how they are loaded.

All `.spec`, CLI, and output snippets in this document are **Illustrative** unless the
surrounding text says otherwise. The _semantics_ each snippet demonstrates carry the
label of the paragraph that introduces them; the _spelling_ is the suite's canonical
teaching notation, not a frozen grammar.

## Context

ADR-001 commits this project to specifications that are human-readable first,
executable without implementation-language glue code, independent of any particular
implementation, and easy for AI agents to consume and produce. Those commitments pull
against each other. A language expressive enough to script anything is simply another
programming language, and tests written in a programming language accumulate the
machinery — branching, loops, helper hierarchies, shared mutable state — that couples
them to one implementation era and makes them unreadable as documentation. A language
too weak cannot describe real multi-interface behavior at all.

The resolution is a small language with strong opinions: a handful of constructs that
compose (tests, commands, fixtures, expectations) and a list of deliberate exclusions
that is as load-bearing as the feature list. Every construct below earns its place by
serving the same reader three times over — the developer skimming `spec/` to learn what
the product does, the runtime executing the behavioral contract, and the AI agent that
must produce or consume specifications without misreading them. Restraint is not a
missing feature of this language; it is the feature.

## Decision

### 1. The anatomy of a test

Before defining each construct, here is a complete specification — the example this
suite returns to repeatedly:

```
test "authenticated users can comment" {
  given {
    let user = fixture user
    let post = fixture post
    login user
  }

  when {
    open post.url
    fill textbox "Comment" with "Great article"
    click button "Post comment"
  }

  then {
    expect text "Great article"
    expect text user.name
  }
}
```

Read it line by line, because every construct in this ADR appears in it.

`test "authenticated users can comment" {` — a **test** is the unit of specification.
Its name is a behavioral sentence, and that sentence is part of the product
documentation surface described in
[ADR-003](./ADR-003-suite-organization-and-shared-definitions.md): a reader who never
opens the braces has already learned that authenticated users can comment.

`given { ... }` — the preconditions. Two **fixtures** produce test data (`fixture user`,
`fixture post`), and `let` binds each result to a name later lines can reference. Then
`login user` invokes a **command** — a reusable sequence defined elsewhere in the
specification language (§8). Nothing in this block is the behavior under test; it is
the world in which the behavior happens.

`when { ... }` — the behavior. `open`, `fill`, and `click` are plugin tools from the
browser capability ([ADR-005](./ADR-005-interface-capabilities.md)), written
unqualified because their namespace has been imported (§3) — assuming a `use browser`
is in effect, a line the founding example omits. `open post.url` reads a
field off the bound `post` value. `fill textbox "Comment" with "Great article"`
addresses the UI by role and accessible name — the accessibility-first interaction
model that [ADR-005](./ADR-005-interface-capabilities.md) defines. Three physical
interactions, one logical behavior: posting a comment.

`then { ... }` — the verification. Two `expect` statements check distinct aspects of
the observable result: the comment's text is visible, and so is its author's name.

Just as instructive is what the test does _not_ contain. No CSS selectors. No HTTP
client library. No import of a host-language test framework. No conditionals, no
loops, no retries. No URLs of any deployed environment
([ADR-008](./ADR-008-environments-and-compatibility.md)). The test would read the same
way — and, decisively, would _pass_ the same way — against a first implementation and
against its rewrite five years later.

### 2. Statements, `let` bindings, and literals

**Decided.** The body of every block is a linear sequence of statements. In the
statements the notation shows, a line invokes a tool or command, verifies an
expectation, binds a result to a name with `let`, or — inside a fixture — `return`s a
value to the caller (§9); that enumeration describes the notation, and the exact
statement inventory belongs to the open grammar-and-syntax question in the closing
list. Tools are typed — the runtime knows their arguments and return values
through plugin discovery ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)) — so a
statement's result can be bound to a name and consumed by later statements. That
data-flow facility must exist in the language; without it, a fixture could not hand a
created user to the login that follows.

**Illustrative.** The teaching notation for these semantics, used consistently across
this suite, looks like this:

```
let response = http.post "/posts" {
  title: "Spec-driven development"
  body: """
    A specification describes what the product does.
    An implementation describes one way to do it.
  """
}

expect response.status 201
```

The notation has six elements, each shown only as far as the brief's examples take
them:

- **Tool invocation**: a (possibly namespaced) tool name followed by its arguments —
  `http.get "/posts"`, `cli.run "node" "index.js"`.
- **`let` bindings**: `let response = ...` names a statement's result; fields are read
  with dot access — `response.json`, `user.email`, `result.exit_code`.
- **`return`**: `return response.json` yields a fixture's value to its caller (§9);
  whether commands may also use it is part of the open fixture/command boundary (§9).
- **Strings**: double-quoted, and triple-quoted (`"""`) for multiline content such as
  file bodies, where leading indentation belongs to the notation rather than the value.
- **Object literals**: `{ key: "value" }` blocks passed as arguments, with one field
  per line and no separators.
- **Durations**: compact literals such as `10s`, used by `eventually within` (§7).

Connective words like `with` in `fill textbox "Email" with user.email` exist to keep
statements readable as sentences — the human-readable-first principle applied at the
grammar level. Argument positions accept bindings as well as literals — value
positions (`with user.email`) and name/target positions (`open post.url`,
`click link post.title`) alike.

**Open.** The exact grammar — keyword set, literal syntax, escaping, argument shapes,
how connectives are defined — is undecided, and this suite deliberately avoids freezing
it. The notation above is canonical for _teaching_; a grammar specification is future
work, and this question appears in the closing list.

### 3. Namespaces and `use`

**Decided.** Plugin capabilities are namespaced by default. A tool's full name states
which capability provides it:

```
browser.open "/login"
browser.click button "Sign in"

http.get "/posts"

cli.run "node" "index.js"

fs.write "index.js" "..."
```

The namespace is not decoration. It is the visible seam between the specification and
the plugin architecture of [ADR-004](./ADR-004-runtime-and-plugin-protocol.md): a
reader of `browser.click` knows the browser capability performs it, and a reader of
`fs.write` knows the filesystem capability does — without either statement revealing
whether Playwright or a temporary directory sits behind the seam.

**Decided.** The language supports importing a namespace so that its tools can be
written unqualified. A specification that lives entirely in the browser should not
repeat `browser.` on every line:

```
use browser
```

After that, commands could be written as:

```
open "/login"
click button "Sign in"
```

**Decided.** If imported namespaces expose ambiguous names, the runtime must not
guess. Suppose two imported capabilities both expose an `open` tool: an unqualified
`open` is an error, and the specification must say `browser.open` or the other
namespace explicitly. The alternative — resolution by import order, or by some
priority rule — would make the _meaning_ of a `.spec` file depend on which plugins
happen to be installed and in what order, which is exactly the kind of hidden coupling
that breaks the survive-a-rewrite guarantee. An ambiguity error is cheap at
authoring time and catastrophic to debug if silently resolved; the diagnostics
architecture ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)) should name the
colliding candidates so the fix is mechanical.

**Direction.** `use` is file-scoped: it affects only the file that contains it and
never leaks across files. A `use` inside a shared command file affects name resolution
inside that file's definitions, not the specs that call those commands. Anything else
would create exactly the hidden cross-file dependencies
[ADR-003](./ADR-003-suite-organization-and-shared-definitions.md) rules out. The final
scoping rule is part of the open grammar question in the closing list.

**Illustrative.** The `use` spelling itself, like all syntax here, is not frozen.

### 4. Given / When / Then are structural blocks

**Decided.** Specifications use Given / When / Then semantics, and the three phases are
structural blocks — not prefixes repeated on individual lines:

- Given: what is already true
- When: what happens
- Then: what must now be true

The vocabulary is Gherkin's, and deliberately so: two decades of behavior-driven
development demonstrated that these three words carve a behavior at its natural
joints. What this language changes is their nature. In Gherkin they annotate prose
steps that a host-language step definition must interpret; here they are blocks whose
contents are directly executable statements
([ADR-001](./ADR-001-executable-specification-language.md) treats this distinction at
length). Making them blocks rather than per-line prefixes also changes what they can
express: the blocks describe behavioral _phases_, not individual operations. A `when`
may contain several physical interactions representing one logical behavior — the
three lines that post a comment in §1. A `given` may perform substantial setup. A
`then` may verify multiple aspects of the resulting observable state.

**Decided.** Ordering is fixed — Given, then When, then Then — and phases never
alternate. The language does not support sequences such as:

```
When -> Then -> When -> Then
```

A scenario such as:

```
create -> verify -> edit -> verify -> delete -> verify
```

should normally become separate specifications for creation, editing, and deletion.

The alternative deserves its hearing, because alternation is genuinely convenient: one
long test that creates a post, verifies it, edits it, verifies again, deletes it, and
verifies once more mirrors how a manual tester works. It loses three ways. First, it is
several specifications wearing one name — when the middle fails, the report cannot say
_which behavior_ is broken, only how far the script got. Second, each later step
inherits the accumulated state of every earlier one, so the specifications stop being
independently meaningful: "editing works" is only specified _after a creation performed
this exact way_. Third, the decomposed form is better documentation — three names in
`spec/`, each a capability, instead of one name describing a tour.

Decomposition is cheap because the language pays for it elsewhere. The edit test does
not replay the create test; it asks a fixture for a post that already exists:

```
test "authors can publish a post" { ... }
test "authors can edit a published post" { ... }
test "authors can delete a published post" { ... }
```

Each test states its own precondition through `given`, fixtures supply the data (§9),
commands supply the repeated behavior (§8), and every test runs in its own isolated
workspace ([ADR-006](./ADR-006-isolated-test-workspaces.md)), so nothing tempts one
test to depend on another having run first.

**Direction.** Phases may be optional when a phase would be empty, with ordering fixed
among the phases present. A behavior that needs no setup can plausibly omit `given`:

```
test "the health endpoint reports ok" {
  when {
    let response = http.get "/health"
  }

  then {
    expect response.status 200
  }
}
```

### 5. No general-purpose control flow

**Decided.** The specification language intentionally refuses to become a
general-purpose programming language. It does not include:

- if / else
- loops
- while
- switch
- match
- arbitrary branching

Specifications remain linear, deterministic, and easy for humans and AI agents to
reason about.

The argument for control flow is always the same — "some tests need it" — and the
answer is that a specification with a branch in it has stopped specifying. A `.spec`
file states what the product does. `if` says the author does not know: the file now
describes two products, and which one was verified depends on runtime state the reader
cannot see. When behavior genuinely differs by condition — an admin sees the button, a
visitor does not — each condition is its own specification with its own name, which is
precisely what the no-alternation rule (§4) already demands. Loops fail the same test
from another side: a loop describes _how to generate_ interactions rather than _which
behavior_ is expected, and every loop in a test suite eventually hides an assertion
count nobody can verify by reading.

The exclusions are also what make the language safe to hand to machines in both
directions. An AI agent implementing an application against a suite
([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)) can treat every
statement as an unconditional requirement — no path analysis, no reachability
questions. An agent _writing_ specifications cannot smuggle logic into them; the worst
it can produce is a wrong linear claim, which a human can read and reject in seconds.

When repetition pressure builds — and it will — the language answers with its own
constructs rather than with flow control: repeated interaction sequences become
commands (§8), repeated data setup becomes fixtures (§9), and a genuinely missing
low-level capability becomes a plugin tool
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)). Two escape valves exist for the
two legitimate cases that look like control flow but are not: `expect` for
verification (§6), and `eventually` for asynchronous behavior (§7) — the one place
time is allowed into the language, in a named, bounded form.

**Open.** "Deterministic" is a promise this ADR makes informally; exactly what the
runtime guarantees — about statement ordering, about repeated runs, about what may
vary between runs of the same suite — remains to be pinned down, and appears in the
closing questions.

### 6. `expect` — verification

**Decided.** `expect` is the language's verification primitive. Every claim a
specification makes about observable state is an `expect` statement, and `then` blocks
are where those claims naturally live:

```
expect text "Great article"
expect response.status 200
expect result.exit_code 0
```

The shape is consistent across every capability family: `expect`, an observable, and
the expected condition. The observable may be a bound value's field
(`response.status`), a semantic UI query — `expect heading "Dashboard"`, in the
accessibility-first vocabulary [ADR-005](./ADR-005-interface-capabilities.md)
defines — or filesystem state such as `expect file "dist/index.js" exists`, which
[ADR-006](./ADR-006-isolated-test-workspaces.md) covers. One primitive spanning every
surface is what lets a single `then` block verify an HTTP response, a rendered page,
and a generated file side by side.

**Open.** The exact semantics of `expect` are undecided, and the brief is explicit
that they must not be invented prematurely. Is `expect result.stdout "hello\n"` strict
equality, and if so, is there a containment or pattern form? How is negation written?
Does a failing `expect` stop the test, or are remaining expectations in the same
`then` evaluated so the report shows every broken aspect at once? Each answer changes
how specifications read and how diagnostics
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)) present failures.

**Open.** Related and also unresolved: what is allowed inside `then` besides
expectations? A `then` that quietly performs mutations is verifying a world it just
changed; forbidding mutating tools inside `then` would make the phase honest by
construction, but depends on whether tools declare themselves as mutations or
observations — an open question owned by
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md).

### 7. `eventually` — the one concession to time

**Decided.** `eventually` exists as a special concept for asynchronous behavior and
eventual consistency. Real systems finish work after they respond: a background job
indexes the post, a queue delivers the notification, a cache converges. A language
with no answer for this forces authors into the two classic failure modes — polling
loops (excluded by §5) or fixed sleeps, which are the canonical source of both flaky
tests and slow suites. `eventually` names the intent directly — _this expectation must
become true_ — and leaves the mechanics to the runtime:

```
then {
  eventually {
    expect text "Processing complete"
  }
}
```

**Direction.** A bounded form with an explicit window:

```
then {
  eventually within 10s {
    expect text "Processing complete"
  }
}
```

The block form matters for the same reason Given/When/Then are blocks: the boundary is
visible. Everything inside `eventually` is subject to retry semantics; everything
outside is evaluated once. An assertion-level flag could not delimit a group of
expectations that must _simultaneously_ hold, and a suite-wide implicit retry — the
approach some browser-automation tools take for all assertions — hides the
asynchronous places instead of documenting them. A reader of a `.spec` file should be
able to point at exactly where the product is allowed to take its time.

**Open.** The exact retry, timeout, and polling semantics remain to be designed: the
default window when `within` is absent, the polling cadence, whether `eventually` may
wrap anything other than expectations, whether nesting means anything, and what a
timeout reports (ideally the last observed state, so the diagnostic shows how close
the system came). Separately, timeout semantics for _plain_ statements — how long
`click` or `http.get` may take before failing, and where that is configured given that
behavioral specifications must not contain environment details
([ADR-008](./ADR-008-environments-and-compatibility.md)) — are also undesigned. Both
appear in the closing questions.

### 8. Commands — composition that never escapes

**Decided.** The language supports reusable commands composed entirely from other
specification commands and plugin tools:

```
command login(user) {
  open "/login"
  fill textbox "Email" with user.email
  fill textbox "Password" with user.password
  click button "Sign in"
}
```

Commands may call plugin tools and other commands. They must not escape into arbitrary
JavaScript, Ruby, Rust, Python, or another host language. The guiding principle:

> "Composition never escapes the specification language."

This is the load-bearing difference from Gherkin, where reuse lives in step
definitions written in a host language — so the specification's _meaning_ is defined
outside the specification, in code that dies with the implementation stack
([ADR-001](./ADR-001-executable-specification-language.md) develops the comparison).
Here, `login` is four lines of the same language the test is written in. It survives a
rewrite for the same reason the test does; it can be read by the same person, and
produced by the same AI agent, with no second language involved.

The obvious alternative — allow small host-language helpers "just for the hard
cases" — loses on its own terms. The first helper is where portability dies: the suite
now requires that language's runtime forever, the helper is invisible to `.spec`-level
tooling, and every subsequent hard case lands in helpers rather than in the language
or its plugins, because the escape hatch is always nearer than the proper fix. If a
genuinely new low-level capability is required, it should be introduced through a
plugin — typed, discoverable, permission-checked
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md),
[ADR-007](./ADR-007-deny-by-default-permissions.md)) — rather than arbitrary
host-language code embedded inside `.spec`.

**Decided.** Commands are not intrinsically Given or When operations. `login user` may
be used in `given` when authentication is a precondition — as in §1 — or in `when`
when login itself is the behavior being specified, as in an `authentication.spec` test
that fills in credentials and then expects the dashboard. The phase classifies the
_intent of this use_, not the definition: a command says what happens, and the block
it appears in says why it matters here. Defining commands as phase-bound (as
Gherkin-style frameworks that tag steps `Given`/`When` do) would force every reusable
behavior to be defined twice.

Where shared commands live in the `spec/` tree and how they are loaded before tests
run is [ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)'s subject.

### 9. Fixtures — data and state, by name

**Decided.** Fixtures exist as a construct for reusable data and state setup. A test
should say _what_ it needs — a user, a post — and not _how_ to fabricate it:

```
fixture user {
  let response = http.post "/test/users" {
    email: "sergio@example.com"
  }

  return response.json
}
```

Usage:

```
given {
  let user = fixture user
}
```

Note that this illustrative fixture hardcodes an email, so two tests both calling it
against a shared backend would collide on any uniqueness constraint — data isolation
for external state is an open question owned by
[ADR-006](./ADR-006-isolated-test-workspaces.md).

The body is ordinary specification language — this fixture happens to create its user
through an HTTP call, and the portability rules of §8 apply unchanged. The example
also shows why fixtures matter for multi-interface specifications
([ADR-005](./ADR-005-interface-capabilities.md)): data created through one interface
(HTTP) feeds behavior exercised through another (the browser in §1's test).

**Direction.** Conceptually, a fixture is similar to a command that returns a value,
and the language could plausibly get by with commands alone. Keeping `fixture` as a
distinct keyword is the current leaning, for two reasons. It communicates intent — the
distinction a reader needs is visible at the definition and at every call site:

|                   | `command`                                 | `fixture`                                    |
| ----------------- | ----------------------------------------- | -------------------------------------------- |
| Communicates      | a behavior the specification performs     | data or state a test needs                   |
| Typical call site | any phase, invoked by name (`login user`) | bound in `given` (`let user = fixture user`) |
| Returning a value | not the point                             | the point                                    |
| Runtime lifecycle | none implied                              | potentially runtime-managed (**Open**)       |

And it reserves room for runtime lifecycle behavior: a runtime that knows _this
construct produced state_ can one day clean that state up, cache it, or isolate it —
things it could never safely infer about an arbitrary command.

The boundary between the two constructs is not yet settled, and the suite's own
examples show why. Its canonical multi-interface example
([ADR-005](./ADR-005-interface-capabilities.md)) binds the result of a shared
definition invoked like a command — `let user = create_user { ... }` — rather than
using the `let user = fixture user` spelling above. So whether value-producing setup
must be spelled `fixture`, or may also take the form of a value-returning command, is
explicitly part of the open fixture/command boundary. This ADR does not resolve it.

**Open.** Possible future fixture semantics include cleanup, isolation, lifecycle
handling, and failure-safe teardown. These are documented here as design questions,
not designed: whether a fixture can declare how to destroy what it created, whether
fixture results are shared or recreated within a test or file, and what happens to
fixture-created state when a test fails mid-way all remain open, and the first of
these appears in the closing questions. Shared fixture definitions and their loading
order belong to [ADR-003](./ADR-003-suite-organization-and-shared-definitions.md).

### 10. Comments — context without authority

**Decided.** The language supports line comments using `#`:

```
# This is a comment.
```

Everything after `#` on that line is ignored by the runtime. Comments are
non-executable and must never affect specification behavior. Their purpose is to
provide additional context for humans, AI agents, editors, and documentation tooling
when that context does not belong in the executable behavioral contract:

```
# Copyright 2026 Example Corp.
# SPDX-License-Identifier: MIT

# This behavior intentionally matches the legacy implementation.
# See issue #184 before changing it.

test "empty passwords are rejected" {
  ...
}
```

Comments may also explain domain constraints that would otherwise be difficult to
infer:

```
# Posts remain editable for 15 minutes after publication because
# published content is propagated to external systems afterward.

test "authors can edit recently published posts" {
  ...
}
```

**Decided.** The language still encourages self-explanatory specifications. Comments
complement clear tests, commands, fixtures, names, and Given / When / Then structure;
they must not compensate for unclear specifications. Prefer:

```
test "anonymous users cannot comment" {
  ...
}
```

over:

```
# This tests that anonymous users cannot comment.
test "comment test" {
  ...
}
```

The useful principle:

> "The specification should explain what the application does; comments may explain why."

That division is sharper than it looks, and it is what makes comments safe in a
compatibility-testing world. Comments can provide context that is intentionally
non-normative and should not become part of compatibility guarantees:

```
# This timeout exists because the production indexing pipeline
# normally completes within a few seconds.

then {
  eventually within 10s {
    expect text "Indexed"
  }
}
```

The `10s` binds every implementation the suite runs against
([ADR-008](./ADR-008-environments-and-compatibility.md)); the sentence above it binds
nobody. A replacement implementation must satisfy the statement, not the comment. The
same line matters for AI-agent workflows
([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)): agents should
treat executable specification statements as authoritative behavioral requirements,
while comments provide supporting context unless explicitly stated otherwise. Without
that rule, an agent could read prose as requirement — or worse, requirement as prose.

**Decided.** Source-level comments must always be preserved in `.spec` files, and
tooling may preserve and surface them in editors and LSP integrations, generated
documentation, AI-oriented representations of the specification, AST or intermediate
representations where source context is retained, and diagnostics and source views.
Whether comments survive into a compiled or serialized intermediate representation
remains an implementation and tooling question — as does the existence of such a
representation at all, an open question owned by
[ADR-001](./ADR-001-executable-specification-language.md).

**Decided.** Only line comments using `#` are required initially; block comments are
not introduced unless a concrete need appears later. The alternative — adding
`/* ... */` or similar for symmetry with mainstream languages — buys convenience for
long prose at the cost of a second commenting syntax, more grammar complexity, and
genuine ambiguity hazards next to triple-quoted multiline strings and whatever other
delimited constructs the final grammar contains. One syntax that cannot nest, cannot
span lines, and cannot interact with string delimiters is one syntax that never
produces a parsing surprise.

## Consequences

The constructs and exclusions above are one trade, made deliberately. What the
language gives up is real: scenarios must be decomposed rather than scripted (§4),
conditional behavior must become multiple named tests rather than one branching one
(§5), there is no data-driven loop to stamp out fifty variants of a case, and an
author who hits a genuinely missing capability must go build or request a plugin
rather than pasting three lines of a host language.

What the trade buys is the project's entire premise. Every `.spec` file is readable
top to bottom as a linear claim about the product, which is what lets `spec/` serve as
documentation ([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)).
Nothing in any file names an implementation technology, which is what lets the same
suite outlive a rewrite
([ADR-008](./ADR-008-environments-and-compatibility.md)). Composition stays inside the
language, which is what keeps the runtime's security boundary meaningful — a `.spec`
file can request only what tools expose, and tools are permission-checked centrally
([ADR-007](./ADR-007-deny-by-default-permissions.md)). And the absence of control flow
is what makes the format tractable for AI agents in both directions: unconditional to
implement against, and too simple to hide logic in.

The pressure this design creates lands in predictable places, and the suite routes
each one somewhere better than the language core: repetition pressure lands on
commands and fixtures, capability pressure lands on plugins
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)), and organizational pressure —
many files sharing many definitions — lands on the loading model of
[ADR-003](./ADR-003-suite-organization-and-shared-definitions.md).

## Open Questions

- **What is the exact grammar and syntax?** Every snippet in this suite is canonical
  teaching notation, but no formal grammar exists: keyword set, string escaping,
  object-literal rules, argument connectives like `with`, block syntax, and the
  scoping rule for `use` (file-scoped per §3's stated direction) all remain to be
  specified, and freezing them now would contradict the suite's own conceptual
  status.
- **What are the exact semantics of `expect`?** Whether comparison is strict equality
  or admits containment and pattern forms, how negation is written, and whether a
  failed expectation halts the test or lets sibling expectations report too — all
  undecided, and all consequential for how failures read.
- **What is allowed inside `then`?** A verification phase that can also mutate is a
  weaker claim than one that can only observe; whether the language restricts `then`
  to observations depends partly on whether tools declare themselves as mutations or
  observations, an open question of
  [ADR-004](./ADR-004-runtime-and-plugin-protocol.md).
- **What are the timeout semantics for ordinary statements?** Plain tool invocations
  presumably cannot wait forever, but whether limits are per statement, per phase, or
  per run — and where they are configured, given that behavioral specifications must
  not carry environment details
  ([ADR-008](./ADR-008-environments-and-compatibility.md)) — is undesigned.
- **What are the retry and polling semantics of `eventually`?** The construct is
  decided but its mechanics are not: the default window without `within`, the polling
  cadence, what may appear inside the block besides expectations, whether nesting is
  meaningful, and what a timeout diagnostic shows about the last observed state.
- **What are the fixture lifecycle and cleanup semantics — and where is the
  fixture/command boundary?** Whether fixtures can declare teardown, whether their
  results are cached or recreated within a test or a file, and what happens to
  fixture-created state when a test fails partway through are all recorded as design
  questions rather than designed (§9). So is the boundary itself: whether
  value-producing setup must be spelled `fixture`, or may also be a value-returning
  command as in `let user = create_user { ... }`
  ([ADR-005](./ADR-005-interface-capabilities.md)), and with it whether `return` is
  available outside fixture bodies.
- **What deterministic execution guarantees does the runtime make?** The language is
  linear and branch-free, but a precise contract — what is guaranteed identical across
  runs, how `eventually`'s timing variability is bounded, and what nondeterminism
  plugins are permitted to introduce — has not been written.
