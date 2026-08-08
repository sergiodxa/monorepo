# ADR-006: Isolated Test Workspaces

## Status

**Proposed** - 2026-08-08

This ADR is part of the spec-language suite introduced in
[ADR-001](./ADR-001-executable-specification-language.md), which also defines the
**Decided / Direction / Illustrative / Open** labels used throughout. It assumes the
language constructs of [ADR-002](./ADR-002-specification-language-design.md) (`use`,
blocks, `let`, `expect`), the runtime/plugin boundary of
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md), and the capability families of
[ADR-005](./ADR-005-interface-capabilities.md). The permission model that governs
everything _outside_ the workspace is
[ADR-007](./ADR-007-deny-by-default-permissions.md).

All `.spec`, CLI, and output snippets in this ADR are **Illustrative** unless stated
otherwise. They are the suite's canonical teaching notation — a reader can and should
learn the system from them — but the exact spelling is not frozen. The _semantics_ a
snippet demonstrates carry the label of the paragraph that introduces it.

## Context

Most testing tools treat the filesystem as a nuisance: something to mock away, or a
place where fixtures accidentally accumulate. This project cannot afford that stance,
because a large part of what it wants to specify is software whose observable
interface _is_ the filesystem. Specifications of programming languages, runtimes,
compilers, bundlers, package managers, build systems, developer tools, and CLI
applications all share the same shape: put files in, run something, observe files,
streams, and exit codes coming out. For these targets, filesystem behavior is a
first-class requirement of the specification language, not an incidental capability.

Consider what a specification for a JavaScript runtime such as Node.js must be able
to say — create a source file, execute the runtime against it, and observe the
result:

```
use fs
use cli

test "executes a JavaScript file" {
  given {
    write "index.js" """
      console.log("hello")
    """
  }

  when {
    let result = run "node" "index.js"
  }

  then {
    expect result.stdout "hello\n"
    expect result.exit_code 0
  }
}
```

A longer, deliberately similar pair of runtime-specification examples appears in
[ADR-008](./ADR-008-environments-and-compatibility.md) — the resemblance between the
founding variants is intentional, not accidental drift.

Every phase of that test touches the filesystem. The `given` writes a file. The
`when` starts a process that must find that file in its working directory. The
`then` reads what the process produced. Which raises the question this ADR answers:
_where does `index.js` actually go?_

The naive answer — the directory the user happened to run `spec run` from — fails in
every way that matters. It pollutes a real checkout with test debris. It lets one
test observe files a previous test left behind, so the suite passes or fails
depending on execution order. It makes two tests that both write `index.js` fight
over the same path. And because `.spec` files may be written by AI agents and
executed automatically ([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)
treats this as a primary workflow), it hands every generated specification write
access to the user's working tree. The specification should not normally write into
the user's actual working directory at all.

The rest of this ADR establishes the alternative: an isolated, ephemeral workspace
per test, owned by the runtime, shared by every plugin, with virtual semantics that
deliberately do not dictate how the isolation is implemented.

## Decision

### 1. Every test receives an isolated, ephemeral workspace

**Decided.** The runtime provisions a fresh workspace for each test before it runs,
isolates workspaces between tests, and cleans them up automatically afterwards. This
is the default and only behavior, not an opt-in mode. Design principle 16 in
[ADR-001](./ADR-001-executable-specification-language.md) — every test runs in an
isolated ephemeral workspace — is this decision.

The alternatives each fail on the property the language cares most about:
determinism. A shared scratch directory per suite makes every test's outcome a
function of which tests ran before it. A workspace per _file_ rather than per test
merely shrinks the interference radius — the two Node.js tests above and below both
write `index.js`, and they must not be able to see each other's version. Opt-in
isolation fails for the usual reason unsafe defaults fail: the one author who
forgets the flag is exactly the one whose spec silently depends on leftover state.
Per-test isolation is the only granularity under which a test's result depends on
nothing but the test itself, which is also what makes specifications
order-independent and, eventually, parallelizable (an open question below).

"Ephemeral" is as important as "isolated". A test cannot rely on anything surviving
into the next test, and nothing a test creates outlives the run by default. How
cleanup interacts with failure diagnostics — the diagnostics architecture in
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) contemplates filesystem diffs
and generated artifacts as evidence — is a reporting design question deferred there;
the contract here is only that no test ever _observes_ another test's leftovers.

### 2. The workspace is a runtime primitive, not a filesystem-plugin detail

**Decided.** The workspace belongs to the runtime, not to the `fs` plugin. This
matters because multiple plugins need to share it. Conceptually:

```
test
  -> isolated workspace
  -> files created by fs tools
  -> CLI process working directory
  -> generated build artifacts
  -> downloads or other plugin artifacts where appropriate
```

Walk through one bundler-shaped flow to see why no single plugin can own this:

- `fs.write` creates `index.js`
- `cli.run` starts with that workspace as its working directory
- a compiler writes `dist/index.js`
- filesystem assertions inspect `dist/index.js`

Four actors touch the same directory tree: the filesystem plugin, the CLI plugin,
an external process the runtime did not implement, and the assertion machinery. If
the workspace were an internal detail of the filesystem plugin, the CLI plugin
could not learn its process's working directory without plugin-to-plugin coupling —
precisely the kind of side channel the plugin architecture of
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) exists to prevent. Plugins are
substitutable and mutually ignorant; the only thing they share is the protocol. So
the workspace must live one level up: the runtime creates it, associates it with the
running test, and communicates it to each plugin through the protocol. A browser
plugin that downloads a file, a mobile plugin that exports a build artifact — each
lands its output in the same workspace where appropriate, without knowing any other
plugin exists.

The alternative reading — "the `fs` plugin owns a sandbox and `cli` happens to agree
on it by convention" — reintroduces order dependence at the plugin level (which
plugin creates the directory? what if a test uses `cli` but never `fs`?) and breaks
the moment a second filesystem plugin, or a remote one, appears. A primitive that
everything shares must be owned by the one component everything already talks to.

### 3. Virtual workspace semantics, decoupled from the implementation mechanism

**Decided.** The specification perceives its workspace as isolated and virtual — but
the runtime is _not_ required to implement a true in-memory virtual filesystem.
These are two different claims, and the architecture deliberately separates them:

- "virtual workspace semantics" — what the spec observes: a private, empty, writable
  tree that exists for the duration of one test and then vanishes;
- "in-memory filesystem implementation" — one possible mechanism, and a poor one to
  mandate.

The reason an in-memory mandate loses is the second actor in the flow above.
Arbitrary external processes — Node, Rust compilers, package managers, system
binaries — generally expect normal filesystem paths. A specification language whose
core use case is running real toolchains against generated files cannot require a
filesystem those toolchains cannot see. Requiring a true in-memory filesystem is
accordingly an explicit non-goal
([ADR-001](./ADR-001-executable-specification-language.md)).

A practical implementation may therefore materialize the workspace as a temporary
directory on the host while still guaranteeing isolation and cleanup. More
sophisticated implementations could later use containers, sandbox filesystems, FUSE,
VM-backed filesystems, or other mechanisms. The architectural contract focuses on
observable isolation rather than dictating the internal mechanism: a conforming
workspace is one where the test starts empty, sees only its own writes and the
writes of processes it ran, affects nothing a workspace-relative operation cannot
name, and leaves nothing behind that a later test can observe. Any mechanism meeting
that contract is a valid workspace; which mechanisms an implementation may choose,
and whether a suite can demand a stronger one, is an open question below.

One consequence of materializing on the host deserves emphasis, because it is easy
to get wrong: the implementation must not leak authority. The fact that the runtime
internally backs the workspace with a real temporary directory does not mean the
spec has gained host filesystem access — creating files that are visible only to a
sandboxed process is safe even though those files physically exist on the host.
[ADR-007](./ADR-007-deny-by-default-permissions.md) builds its safe-by-default /
host-access distinction directly on this abstraction, and the runtime must preserve
it: the workspace is what makes filesystem specification possible _without_ any
permission grant.

### 4. Filesystem interaction is a dedicated capability

**Decided.** Filesystem interaction is exposed through a dedicated
capability/plugin — it is not implicitly part of `cli`. Two arguments, either of
which would suffice.

First, the two capabilities have opposite security postures. Writing a file inside
the ephemeral workspace is intrinsically contained and safe by default; executing a
process is privileged and denied by default
([ADR-007](./ADR-007-deny-by-default-permissions.md)). Fusing them would force the
permission model to reason about one capability with two trust levels, and would
mean a spec that only wants to arrange files must hold — or at least name — the
capability that runs processes.

Second, they occur independently. A specification that drives a browser download
and then asserts on the downloaded file needs `fs` and never touches `cli`; a
specification that pipes data through a process's stdin might use `cli` and never
touch `fs`. Independent capabilities that were merged for convenience would be the
first incompatible seam when someone substitutes one plugin but not the other —
substitutability per capability is the point of the plugin architecture.

**Illustrative.** Possible tools of the filesystem capability, in the namespaced
notation of [ADR-002](./ADR-002-specification-language-design.md):

```
fs.write
fs.read
fs.mkdir
fs.remove
fs.copy
fs.exists
```

With:

```
use fs
```

these may become:

```
write
read
mkdir
remove
copy
exists
```

The `use` import, and the rule that ambiguous imported names must error rather than
guess, are specified in [ADR-002](./ADR-002-specification-language-design.md); the
exact tool roster above is illustrative, not a frozen surface.

Here is a complete specification in this notation — a test that a JavaScript runtime
supports ES modules, assuming `use fs` is in effect:

```
test "supports ES modules" {
  given {
    write "package.json" {
      type: "module"
    }

    write "math.js" """
      export const add = (a, b) => a + b
    """

    write "index.js" """
      import { add } from "./math.js"
      console.log(add(2, 3))
    """
  }

  when {
    let result = cli.run "node" "index.js"
  }

  then {
    expect result.stdout "5\n"
    expect result.exit_code 0
  }
}
```

The example is worth reading closely, because it exercises most of what this ADR
establishes. The three `write` calls land in the test's own workspace — no path
says so, because workspace-relative is the default (§6). `write` takes either an
object literal (serialized for `package.json`) or a triple-quoted multiline string,
both notations from [ADR-002](./ADR-002-specification-language-design.md) — though
the notation does not yet define what triggers serialization (the argument's type,
the filename, or a tool option), a detail belonging to ADR-002's open exact-grammar
question. The
relative import `./math.js` inside the generated source works because all three
files share one directory tree — the workspace is a real tree as far as `node` is
concerned (§3). `cli.run` appears fully qualified because only `fs` was imported;
its process starts with the workspace as its working directory (§2), which is how
`node` finds `index.js` at all — and running it at all requires an explicit process
grant such as `--allow-run=node`
([ADR-007](./ADR-007-deny-by-default-permissions.md)). And nothing cleans up,
because nothing needs to: the workspace evaporates with the test (§1).

Note also what the test does _not_ say: no temporary paths, no machine names,
nothing about where `node` is installed. That is what lets the same specification
run against the current Node.js, an experimental rewrite, or an independent
compatibility runtime — the compatibility story told in
[ADR-008](./ADR-008-environments-and-compatibility.md).

### 5. Filesystem state is observable in assertions

**Decided.** Filesystem state is also observable in assertions — not only writable
in `given` and consumed by processes in `when`. For compilers, bundlers, and build
systems the _primary output_ is files; a specification language that could arrange
inputs but only observe stdout would have to shell out to `cat` just to check that
`dist/index.js` exists, turning every build assertion into a process execution (with
the permission grant that implies). Direct filesystem assertions keep the common
case cheap, declarative, and safe.

**Illustrative.** Possibilities:

```
expect file "dist/index.js" exists
expect file "dist/index.js" contains "console.log"
expect directory "dist" exists
```

The exact syntax remains undecided — it is part of the exact-grammar open question
owned by [ADR-002](./ADR-002-specification-language-design.md). What is decided here
is the capability: `then` blocks can assert on files and directories inside the
workspace, including artifacts written by external processes the spec never named
file-by-file.

### 6. Paths are workspace-relative by default, and the workspace is not the host

**Decided.** By default, filesystem paths are relative to the test workspace, and
specifications cannot accidentally reach outside it. So:

```
write "src/index.js" "..."
```

refers to a file within the test workspace — always, with no configuration and no
way to be surprised. Whereas absolute paths such as:

```
write "/etc/example"
```

must either be invalid by default or require an explicit elevated host-filesystem
capability. The choice between those two treatments is deliberately left open (it is
folded into the open questions below); what is decided is the property they share — an absolute path never silently addresses the host. The runtime must
clearly distinguish the isolated workspace filesystem from the host filesystem, and
crossing from the first to the second is never a side effect of spelling a path
differently. Host filesystem access, when it exists at all, is an explicitly granted
permission with its own scoping — that model, including grants like
`--allow-host-fs`, is [ADR-007](./ADR-007-deny-by-default-permissions.md)'s.

The default matters for the same reason deny-by-default matters: the author who
never thinks about it must get the safe behavior. It also matters for portability —
a workspace-relative spec carries no assumptions about where it runs, which is a
precondition for the environment separation in
[ADR-008](./ADR-008-environments-and-compatibility.md).

Two escape vectors keep this decision honest, and both are flagged rather than
solved here. Relative paths can traverse (`"../outside"` is lexically relative and
semantically an escape), and symlinks created inside the workspace — by the spec or
by an external process such as a package manager — can point anywhere. Whatever the
enforcement mechanism turns out to be, it must sit with the runtime as the central
authority rather than relying on each plugin's self-restraint, consistent with the
enforcement principle in [ADR-007](./ADR-007-deny-by-default-permissions.md). The
concrete prevention design is preserved as open questions below.

## Consequences

The workspace is what turns "specifications of developer tools" from an aspiration
into a mechanically ordinary case. A compiler spec is just `write` → `run` →
`expect file`, with no setup or teardown code, no temp-dir management, and no way
for one test to contaminate another — the properties that make a suite honest
evidence in the compatibility workflow of
[ADR-008](./ADR-008-environments-and-compatibility.md).

It also carries obligations outward. The plugin protocol of
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md) must convey workspace identity
and location to every plugin, and the story for plugins that do not share the host
is genuinely unresolved (below). The permission model of
[ADR-007](./ADR-007-deny-by-default-permissions.md) inherits both a gift and a duty:
workspace writes need no grant, which keeps plain `spec run` useful, but only so
long as the runtime keeps the workspace/host boundary tight against traversal and
symlink escapes. And per-test isolation makes parallel execution _plausible_ at the
filesystem level while deciding nothing about it — disjoint trees remove one class
of interference, not the shared-backend classes.

## Open Questions

- **Should workspace size be limited?** A package-manager install or a real build
  can write gigabytes into what is nominally an ephemeral directory, so an unbounded
  workspace is a resource-exhaustion vector in CI and on shared machines — but any
  limit is also a way for a legitimate large build to fail spuriously.
- **Are workspace paths always relative?** Absolute paths could be rejected outright
  or could become meaningful only under an elevated host-filesystem grant; the
  choice decides whether workspace tools are _definitionally_ relative-only, with
  host access living in a separate capability, or one tool family spans both worlds.
- **Can symlinks escape the workspace?** A symlink created inside the workspace — by
  the spec, or by an external process such as a package manager — can target a path
  outside it, and it is unresolved whether workspace tools refuse to follow such
  links, dereference them under the workspace/host permission rules, or something
  subtler for the processes the runtime does not control.
- **How is path traversal prevented?** `"../"` segments make a lexically relative
  path an escape, and the design must choose between lexical normalization,
  resolution-time containment checks, or mechanism-level confinement — and settle
  where the check runs, given that the runtime is the enforcement authority
  ([ADR-007](./ADR-007-deny-by-default-permissions.md)) while a plugin performs the
  actual I/O ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)).
- **How is workspace state exposed to remote plugins?** The plugin protocol does not
  require plugins to share the runtime's host
  ([ADR-004](./ADR-004-runtime-and-plugin-protocol.md)), and a remote plugin cannot
  open a host temporary directory by path — so the workspace may need to be synced,
  streamed, or served through protocol-level filesystem operations, and "the CLI
  process working directory" needs a meaning when the process runs elsewhere.
- **May the workspace implementation vary between temporary directories, containers,
  VMs, and other sandboxes?** The contract is observable isolation rather than a
  mechanism, which implies variation is permitted — but it remains open what
  conformance any mechanism must demonstrate, how an implementation chooses, and
  whether a suite or execution environment can require a stronger mechanism than a
  plain temporary directory.
- **How does parallel execution interact with isolation?** Disjoint workspaces make
  filesystem-level parallelism safe by construction, but it is undecided whether the
  runtime parallelizes by default, at what granularity, and how non-filesystem
  resources — ports, browser sessions, devices
  ([ADR-005](./ADR-005-interface-capabilities.md)) — are kept from colliding.
- **How is test data isolation achieved for state outside the workspace?** A fixture
  that creates a user through a real HTTP API mutates a backend the workspace
  neither contains nor cleans up, so the isolation story for shared external state —
  unique data per test, transactional resets, per-test targets — is still to be
  designed, alongside the fixture lifecycle questions in
  [ADR-002](./ADR-002-specification-language-design.md).
