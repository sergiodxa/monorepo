# ADR-003: The `spec/` Directory: Organization, Shared Definitions, and AI Workflow

## Status

**Proposed** - 2026-08-08

Part of the spec-language ADR suite. This ADR assumes the case for the language
made in [ADR-001](./ADR-001-executable-specification-language.md) and the
constructs — `test`, `command`, `fixture`, the Given/When/Then blocks — defined
in [ADR-002](./ADR-002-specification-language-design.md). Its AI-workflow
section leans on the deny-by-default permission model of
[ADR-007](./ADR-007-deny-by-default-permissions.md), and the
multi-implementation story it opens is developed in
[ADR-008](./ADR-008-environments-and-compatibility.md).

Every substantive claim in this suite carries one of four dispositions —
**Decided**, **Direction**, **Illustrative**, or **Open** — as defined in
[ADR-001](./ADR-001-executable-specification-language.md). All `.spec`
snippets, directory listings, CLI invocations, and diagnostic output in this
ADR are illustrative notation unless the surrounding text says otherwise: the
semantics they demonstrate carry the label of the paragraph that introduces
them, while the spelling is the suite's canonical teaching notation, not a
frozen grammar.

## Context

[ADR-002](./ADR-002-specification-language-design.md) defines what a single
`.spec` file can say. A product, though, is specified by many files, and the
moment there is more than one file, three questions appear that no per-file
design answers:

1. **What does the directory itself communicate?** The language exists so that
   a reader can learn what an application does without reading its
   implementation. If that promise holds for one file but the suite as a whole
   is an unstructured heap, the reader has traded one archaeology problem for
   another.
2. **How do definitions cross file boundaries?** Most tests of the same product
   share preconditions — a signed-in user, a published post, a provisioned
   workspace. Every mainstream test ecosystem answers this with helper code in
   the implementation language, and that answer is exactly what this project
   rules out.
3. **What is the suite for, beyond regression?** The language was designed so
   that the specification can precede the implementation. That inverts the
   usual workflow — tests written after code, by the people who wrote the
   code — and the inversion deserves to be stated as a first-class use case
   rather than left implicit.

This ADR settles all three: the layout of `spec/`, the model for shared
fixtures and commands, and the AI-driven implementation workflow the suite
enables.

## Decision

### 1. `spec/` is the product's functional documentation

**Decided.** The `spec/` directory should function as a readable functional
description of the product. This is not a by-product of having tests; it is a
design goal that constrains how the suite is organized and named.

For example:

```
spec/
  authentication.spec
  posts.spec
  comments.spec
  moderation.spec
```

Reading `comments.spec` should make behaviors such as these apparent:

- authenticated users can comment
- anonymous users cannot comment
- comment authors can delete their comments
- moderators have moderation capabilities

Notice what carries the information. The file listing is the product's table of
contents: four filenames name four capabilities, before a single file is
opened. Inside a file, the test names are the statements of behavior — which is
why [ADR-002](./ADR-002-specification-language-design.md) insists on
self-explanatory test names and reserves comments for _why_, never _what_. A
reader who opens `comments.spec` and skims only the `test "…"` lines should
come away with the list above.

The conventional alternative is a suite organized around the implementation:
one test file per module, mirroring the source tree, so that
`comment_test` exists because `comment.rb` does. That layout answers "is this
class covered?" and nothing else. It cannot answer "what does commenting do
here?" without reading every file, and it dissolves the moment the source tree
is reorganized — which contradicts the property
[ADR-001](./ADR-001-executable-specification-language.md) decided first:
specifications survive rewrites. A suite organized around behavior has no
implementation tree to mirror, so a rewrite gives it nothing to reorganize
around. The layout is behavioral because the contract is.

### 2. Directories scale the table of contents

**Direction.** Larger applications use filesystem structure itself as the
functional hierarchy:

```
spec/
  authentication/
    login.spec
    logout.spec
    password-reset.spec

  posts/
    reading.spec
    publishing.spec
    editing.spec

  comments/
    commenting.spec
    moderation.spec
```

The same reading discipline applies at every level: directory names name
feature areas, filenames name capabilities within them, test names state
behaviors. Nothing about this requires new grammar — a directory is visible to
every tool that can list files, needs no parser support, and cannot embed
surprises the way a nested language construct could.

**Open.** Whether that is the whole answer is deliberately unresolved. An
explicit `feature` construct inside the language could carry things a directory
cannot — a prose description, shared context, metadata for reporting — at the
cost of a second hierarchy mechanism that can disagree with the first. The
brief's position, preserved here, is that files and directories may prove
sufficient; the question is recorded in [Open Questions](#open-questions)
rather than answered by fiat.

### 3. Shared fixtures and commands are `.spec` content in conventional directories

**Decided.** The `spec/` directory may contain dedicated shared definitions for
reusable fixtures and commands, and those definitions are written in the
specification language itself.

Illustrative structure:

```
spec/
  fixtures/
    users.spec
    posts.spec

  commands/
    authentication.spec
    navigation.spec

  authentication.spec
  posts.spec
  comments.spec
```

Files under `spec/fixtures/` and `spec/commands/` are ordinary `.spec` files in
the same grammar as everything else; what distinguishes them is what they
contain — definitions rather than tests. Their purpose is to provide shared
building blocks that can be reused across multiple specification files without
requiring implementation-language helper code.

For example, `spec/fixtures/users.spec` could define:

```
fixture user {
  ...
}

fixture admin {
  ...
}
```

And `spec/commands/authentication.spec` could define:

```
command login(user) {
  ...
}

command logout {
  ...
}
```

Executable specs can then use them directly:

```
test "authenticated users can comment" {
  given {
    let user = fixture user
    let post = fixture post
    login user
  }

  when {
    ...
  }

  then {
    ...
  }
}
```

Walk through what the test file does _not_ contain. There is no import
statement. `fixture user` resolves to the definition in
`spec/fixtures/users.spec`, `fixture post` to one in `spec/fixtures/posts.spec`,
and `login user` to the shared command in `spec/commands/authentication.spec` —
yet the test names none of those files. The suite's shared vocabulary is
ambient: definitions under the conventional directories are loaded before any
executable spec file runs, so by the time a test executes, every shared name is
already known.

**Decided.** This is the initial sharing model: `spec/fixtures/` and
`spec/commands/` are conventional, automatically loaded directories, not
targets of per-file imports. The alternative — explicit imports in every spec
file — buys precision that small and medium suites do not need, and charges for
it twice: every behavioral file grows a header of plumbing, and that header
couples the file to the suite's internal layout, so reorganizing
`spec/commands/` means editing tests whose behavior never changed. Whether
larger projects eventually outgrow the convention is a real question, and it is
kept open below rather than pre-answered.

**Open.** The placement rule itself is only half-settled. `spec/fixtures/` and
`spec/commands/` are the only places the initial model guarantees shared
definitions are loaded from; whether an executable spec file may also define
fixtures or commands alongside its tests — and if so, whether such definitions
would be file-local or join the suite-wide vocabulary — is undecided and
recorded in [Open Questions](#open-questions).

**Decided.** Shared fixtures and commands remain part of the specification
language and must follow the same portability rules as any other `.spec`
content. They must not become an escape hatch for host-language helper code.
[ADR-002](./ADR-002-specification-language-design.md) establishes the general
rule — composition never escapes the specification language — and this ADR
applies it where it is under the most pressure. Shared code is what a suite
accumulates most of, so it is where portability is defended or lost. The
history of Gherkin makes the failure mode concrete: its reusable steps are
implemented as step definitions in JavaScript, Ruby, or Java, so a Gherkin
suite is portable in its prose and captive in its glue
([ADR-001](./ADR-001-executable-specification-language.md) treats the prior art
fully). If `login` here were a JavaScript helper, the suite would no longer
survive a rewrite of the application into Rust — the founding property would
die in the helpers first. Instead, a shared command composes plugin tools and
other commands, a shared fixture produces a value the same way, and a genuinely
new low-level capability arrives as a plugin
([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)), never as embedded host
code.

Shared definitions are also where multi-interface specification becomes
routine: a shared fixture that provisions a user through an HTTP API, consumed
by tests that verify behavior through a browser, is the cross-interface pattern
[ADR-005](./ADR-005-interface-capabilities.md) develops.

### 4. Loading is deterministic and resolution never depends on traversal order

**Decided.** The runtime establishes a deterministic loading model: all shared
definitions are known before tests begin executing. At minimum, the
architecture accounts for loading shared fixtures and shared commands before
executable specs, making definitions reusable across spec files, detecting
duplicate or conflicting names, resolving names deterministically and
independently of filesystem traversal order, producing clear diagnostics for
missing or ambiguous definitions, and avoiding hidden dependencies caused by
execution order.

Those requirements are one decision viewed from six sides, and each forecloses
a specific failure the convenience of section 3 would otherwise invite.

Because there are no import statements, "which definitions exist" is a
whole-suite property — there is no per-file import list for either the runtime
or the reader to consult. That convenience is only honest if the whole-suite
property is unambiguous, which is why duplicate detection is mandatory rather
than nice-to-have. If two files both define `command login`, no precedence rule
is acceptable: last-file-wins would let the operating system's directory
enumeration order — which is not a contract, and differs between filesystems —
choose which authentication procedure every test in the suite performs. The
runtime refuses, exactly as it refuses to guess between ambiguous namespace
imports in [ADR-002](./ADR-002-specification-language-design.md). An
illustrative diagnostic:

```
Duplicate definition: command "login"

Defined in:
> spec/commands/authentication.spec
> spec/commands/navigation.spec

The runtime never chooses between duplicate definitions.
Rename or remove one of them.
```

The load-before-run phase is likewise what makes hidden execution-order
dependencies impossible. Suppose instead that definitions became available as
files executed: whether `login` resolved in `comments.spec` would then depend
on whether `spec/commands/authentication.spec` happened to be processed first,
and running one file alone, filtering the suite, or parallelizing it would
change what specifications _mean_. A suite where `spec run comments.spec`
behaves differently from the full run has quietly given up determinism — one of
the language's stated design principles — without any spec author writing a
line of control flow. Loading everything first makes the set of known names a
constant of the suite, indifferent to which tests run, in what order, on which
machine.

Missing and ambiguous names get the same diagnostic care the rest of the
architecture demands ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)
covers structured diagnostics generally): the report names what was called,
where, and where the runtime looked, so the difference between a typo, a
missing shared file, and a genuine gap is visible from the failure alone.
Illustratively:

```
Unknown command: login

comments.spec called:
> login user

No command named "login" was loaded from spec/commands/.
```

**Open.** Whether such failures surface during loading or at the first call is
a runtime design detail this ADR does not fix; what is decided is that
resolution is deterministic and its failures are explained. The question is
recorded in [Open Questions](#open-questions).

**Decided.** The important initial principle, stated once more because
everything above serves it: shared behavioral composition belongs inside
`spec/` and is loaded as part of the specification suite before tests begin
executing.

### 5. The suite is an executable contract for AI-driven implementation

**Decided.** AI-driven implementation is a first-class motivation for this
project, not a side effect. The suite is designed to be handed to an agent as
the authoritative statement of what to build.

A repository could begin with:

```
spec/
  authentication.spec
  posts.spec
  comments.spec

src/
  <empty>
```

An architect writes the executable product specification. An AI coding agent
receives the specification and is told:

> "Implement this application. The specification under `/spec` is
> authoritative. You may choose the implementation architecture and
> technologies. The implementation is complete when all specifications pass."

The agent can iterate by:

1. inspecting the specification
2. implementing behavior
3. running the specification suite
4. inspecting failures
5. changing the implementation
6. repeating until the behavioral contract passes

Every earlier decision in this suite is load-bearing in that loop. Step 1 works
because the suite is documentation-shaped (section 1): the agent reads the same
directory a human architect reviews, and the deliberately limited language of
[ADR-002](./ADR-002-specification-language-design.md) — no branching, no loops,
linear blocks — means reading it requires no simulation, only reading. Step 3
works without glue code because execution semantics come from the runtime and
its plugins ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)), not from
helper files the agent would first have to write in some language of its own
choosing. Step 4 depends on the diagnostics requirement — failures that name
the failing statement and the expected versus observed values, rather than a
stack trace into an implementation the spec knows nothing about. And the
black-box principle is what makes the instruction's middle sentence honest: the
agent may choose any architecture and any technology because nothing in `spec/`
can see the difference.

The same architecture supports migrations:

```
old implementation
↑
.spec
↓
new implementation
```

Both implementations can be evaluated against the same behavioral contract. The
suite that was written to drive the first implementation is, unchanged, the
acceptance gate for its replacement — how one suite is pointed at two targets,
and what passing does and does not prove about their equivalence, is
[ADR-008](./ADR-008-environments-and-compatibility.md)'s subject.

### 6. A generated spec cannot grant itself anything

**Decided.** The workflow in section 5 makes `.spec` files the most
automatically executed artifacts in a repository: written by agents, run by CI
systems, run by editors, run from external repositories. The deny-by-default
permission model of
[ADR-007](./ADR-007-deny-by-default-permissions.md) is what makes that
tolerable, and this section exists to say why in the workflow's own terms.

That a generated spec cannot grant itself anything is
[ADR-007](./ADR-007-deny-by-default-permissions.md)'s decision, and the
argument for it lives there. What this section adds is the workflow-specific
consequence: the agent iterates freely inside the sandboxed suite while the
caller's grant set stays fixed, so the blast radius of a malicious or merely
confused generated spec is the sandbox — the contained execution envelope
[ADR-007](./ADR-007-deny-by-default-permissions.md) defines — it already lives
in. A spec that needs an ungranted capability fails — and per that same ADR,
the failure is a security feature, reported with a diagnostic that names the
missing grant. In the iteration loop this is simply another failure the agent
inspects at step 4; the one thing the loop can never do is escalate itself
past it.

## Consequences

- A change under `spec/` is a change to the product's behavioral contract, and
  it reads like one: the diff is legible to reviewers who never touch the
  implementation. Review of `spec/` becomes review of behavior — which is
  precisely the artifact an architect signs off on before an agent starts
  implementing.
- The runtime reads the whole suite before running any test. Duplicate
  detection is therefore a whole-suite property, and adding one shared command
  can fail a previously green suite by colliding with an existing name. That is
  intended: the collision was a latent ambiguity, and surfacing it at load time
  is cheaper than letting enumeration order decide it silently.
- Shared names become an API within the suite. Renaming `login` touches every
  file that calls it, and because resolution is global and deterministic,
  tooling can know exactly which files those are — the editor and LSP questions
  [ADR-001](./ADR-001-executable-specification-language.md) keeps open have a
  well-defined job here.
- Small suites pay zero ceremony — two conventional directories and no
  imports — while the cost of that convenience is carried as explicit open
  questions about scale rather than as an improvised module system designed
  before anyone needs it.
- The AI workflow adds no mechanism of its own: its safety is entirely
  [ADR-007](./ADR-007-deny-by-default-permissions.md)'s permission model and
  its feedback quality entirely the diagnostics architecture of
  [ADR-004](./ADR-004-runtime-and-plugin-protocol.md). This ADR deliberately
  keeps it that way — a workflow that required special runtime privileges for
  agents would contradict the section that makes it safe.

## Open Questions

- **Does the language need an explicit `feature` construct, or do files and
  directories provide sufficient functional hierarchy?** Directories need no
  grammar and are visible to every tool, but an in-language construct could
  carry a description, shared context, or reporting metadata that a directory
  name cannot; nothing in the initial model depends on the answer, so the
  question stays open.
- **May an executable spec file define fixtures or commands of its own?** The
  conventional directories are the only places the initial model guarantees
  shared definitions are loaded from; whether definitions may also appear in a
  file that contains tests — and whether they would then be file-local or join
  the suite-wide vocabulary — is undecided.
- **How should shared definitions evolve beyond the two conventional
  directories?** Larger projects may eventually want explicit modules,
  namespaces for spec-defined names, selective imports, nested fixture and
  command directories, or package-level sharing — each buys scale by adding
  the ceremony the initial model deliberately avoids, and none should be
  adopted before a real suite demonstrates the need.
- **Is a module or package system necessary at all?** Reusable fixtures and
  commands currently stop at the suite boundary; whether suites should be able
  to publish, version, and depend on shared spec-language building blocks the
  way implementations depend on libraries — and what that would mean for
  portability and the permission model — is unresolved.
- **Do resolution failures surface at load time or at the first call?**
  Duplicate detection is necessarily a load-time, whole-suite check, but
  whether a missing or ambiguous name aborts loading or fails the first test
  that calls it is a runtime design detail this ADR leaves to the runtime's
  design.
