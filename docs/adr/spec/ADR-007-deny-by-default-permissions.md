# ADR-007: Deny-by-Default Permissions

## Status

**Proposed** - 2026-08-08

This ADR is part of the spec-language suite introduced in
[ADR-001](./ADR-001-executable-specification-language.md), which also defines the
**Decided** / **Direction** / **Illustrative** / **Open** labels used throughout. It defines the
permission model of the `spec` runtime, and it leans on two siblings: the plugin protocol of
[ADR-004](./ADR-004-runtime-and-plugin-protocol.md), because every privileged operation reaches
the outside world through a plugin tool, and the isolated workspace of
[ADR-006](./ADR-006-isolated-test-workspaces.md), which gives specifications a safe interior that
makes strictness on the outside affordable.

All `.spec` snippets, CLI invocations, flag spellings, and diagnostic output in this document are
**Illustrative** unless the surrounding text says otherwise: the semantics carry the label of the
paragraph that introduces them; the exact spelling is not frozen.

## Context

A `.spec` file is a program somebody else may have written. The rest of this suite guarantees it:
AI coding agents generate specifications and run them in a loop
([ADR-003](./ADR-003-suite-organization-and-shared-definitions.md)); CI systems execute suites
unattended; editors and tooling may run a file the moment it is saved; and compatibility testing
([ADR-008](./ADR-008-environments-and-compatibility.md)) explicitly invites running a
specification suite you did not author against an implementation you are replacing. Every one of
those callers executes specification content without a human reading it first.

Conventional test runners assume the opposite. A test written for a language-native framework is
host-language code, and it runs with the full authority of the user who invoked it: it can read
the user's SSH keys, walk the entire environment, open a socket to any host, and spawn any
process, because the process it lives in can. That is tolerable when tests are first-party code
reviewed like the rest of the repository. It is not tolerable for a format whose stated purpose
includes being produced by AI agents and exchanged between independent implementations.

Two decisions made elsewhere in this suite are what turn a permission model from aspiration into
architecture. First, the language has no general-purpose control flow and no host-language escape
hatch — composition never escapes the specification language
([ADR-002](./ADR-002-specification-language-design.md)) — so a spec cannot smuggle in arbitrary
code. Second, every externally observable operation travels the
`.spec -> runtime -> plugin protocol -> actual automation technology` path (ADR-004), so there is
exactly one chokepoint through which every privileged request must pass. The runtime sits at that
chokepoint. This ADR decides what it does there.

The overall posture is not novel, and does not need to be: it leans strongly toward
deny-by-default, explicit grants, capability-based permissions, and least privilege — the shape
familiar from Deno's permission flags and from capability-based security systems generally, both
surveyed as prior art in ADR-001.

## Decision

### 1. `spec run` grants nothing

**Decided.** The runtime follows a strict deny-by-default permission model. Running

```
spec run
```

grants no privileged external capabilities. A spec is allowed to execute only operations that are
intrinsically contained within the safe sandbox/runtime environment. Throughout this document,
the _sandbox_ is the contained execution envelope the runtime guarantees: the isolated workspace
of [ADR-006](./ADR-006-isolated-test-workspaces.md) plus whatever contained execution the runtime
provides around it. Any capability that can interact with the host machine, the external network,
local processes, devices, secrets, or other privileged resources must require explicit
permission.

**Decided.** It is acceptable and expected for specifications to fail when run with a plain
`spec run` because they require capabilities that have not been explicitly granted. This failure
is a security feature, not a usability bug. The alternatives all break in the same place: any
scheme in which the runtime infers grants from what the specification asks for — auto-approving
requests that look safe, trusting a suite's own declarations, widening access because a tool
insists it needs it — hands authority to the author of the spec, who is precisely the party this
model refuses to trust. Interactive prompting is friendlier but unavailable to the callers that
matter most, since CI systems and coding agents run headless. What remains is the honest option:
deny, and say so well.

That last clause is a real obligation, not a pleasantry. The runtime must report clearly which
permission was denied and what explicit permission would be required; section 9 makes that a
design requirement in its own right.

### 2. No ambient authority: the caller grants capabilities

**Decided.** The organizing principle of the whole model fits in three words:

> no ambient authority

A specification holds no capability merely by existing, being well-formed, or being present in a
repository. Authority is granted explicitly, by the caller, at invocation time, and permissions
follow least privilege: narrower scopes should be preferred where practical. Note also what does
_not_ grant authority: environment configuration. Knowing that a browser target is
`http://localhost:3000` does not automatically grant permission to access it — targets and
permissions are deliberately separate concerns, and the split is ADR-008's subject.

**Direction.** Grants are expressed as CLI flags using an `--allow-*` model. The exact names
remain subject to design, but illustrative examples include:

```
spec run --allow-run
spec run --allow-net
spec run --allow-host-fs
spec run --allow-env
spec run --allow-device
```

Potentially narrower permissions should be preferred where practical. For example:

```
spec run --allow-net=localhost:3000
spec run --allow-net=api.example.com
spec run --allow-run=node
spec run --allow-run=node,npm
spec run --allow-env=API_TOKEN
```

Likewise, host filesystem permissions could potentially be scoped to specific directories:

```
spec run --allow-host-fs=/tmp/example
```

Do not assume these exact flag names or syntax are final; the principle is decided, and the right
granularity per family is under investigation (**Open** — the exact taxonomy, the granularity of
each family, and whether `--allow-*` is even the final CLI model all appear in the Open Questions
below). The useful mental model survives any spelling: an invocation is a manifest. A line such
as

```
spec run --allow-net=localhost:3000 --allow-run=node
```

is a complete, reviewable statement of everything the suite may touch beyond its own sandbox —
one local port and one executable, nothing else.

### 3. The workspace is inside the sandbox; the host is not

**Decided.** Operations against the isolated test workspace are treated differently from host
filesystem access. For example:

```
fs.write "index.js" "..."
```

inside the ephemeral test workspace may be allowed without `--allow-host-fs`. But accessing
something outside that workspace must require explicit permission.

**Decided.** This holds regardless of how the workspace is implemented. ADR-006 permits the
runtime to materialize the workspace as a real temporary directory on the host, and creating
files that are visible only to a sandboxed process can be considered safe even then. The runtime
must preserve the abstraction so the spec does not gain arbitrary filesystem access simply
because the implementation uses a real temporary directory. The permission boundary follows the
_semantic_ workspace, not the storage mechanism behind it.

This section is the reason deny-by-default survives contact with practice. The suite's core use
cases include specifying compilers, package managers, runtimes, and CLI tools — specifications
that create files, run builds, and inspect artifacts constantly. If every one of those operations
needed a host-filesystem grant, grants would become routine, and routine grants train people to
type flags without reading them, which is how a permission model rots. The workspace gives
specifications a place where they are maximally capable at zero risk, so the flags stay reserved
for the requests that genuinely deserve scrutiny. Workspace path safety — relative paths by
default, absolute paths invalid or requiring elevation, traversal prevention — is specified in
ADR-006 and not repeated here.

### 4. Process execution is a grant, not a given

**Decided.** The same deny-by-default principle applies to process execution. A CLI specification
might need:

```
spec run --allow-run=node
```

before:

```
cli.run "node" "index.js"
```

can execute. The runtime should not assume arbitrary process execution is safe — and it never
could be, because a spawned process is ordinary host code with whatever authority the operating
system gives it. Process execution is the sharpest capability in the taxonomy: granted
carelessly, it subsumes every other family.

**Direction.** The shape of the grant should be investigated across a spectrum: any process, a
named executable, an exact executable path, a set of executables. Prefer least privilege. What
identity a grant actually pins — a name resolved through the environment, a resolved path, a
content hash — is **Open**, as is how executables _generated inside the workspace_ interact with
`--allow-run`, and whether a granted process's own subprocesses inherit anything.

**Decided.** The relationship between plugin execution and application process execution must be
kept distinct, and this suite documents the distinction as follows. Starting an explicitly
configured trusted plugin is different from allowing a spec to arbitrarily execute host commands.
Plugins are chosen, installed, and configured by the person operating the runtime (ADR-004);
using the runtime at all means trusting the plugins one has configured, so plugin startup belongs
to the runtime's trusted computing base. Spec-requested execution — `cli.run` and its kin — is
authored by the specification, which may have been written by the very party the model distrusts.
Collapsing the two into a single switch would ruin both: if plugin startup consumed `--allow-run`,
the flag would appear on every invocation and mean nothing; if configuring a plugin implied
`--allow-run`, specifications would inherit exactly the ambient authority this ADR forbids. How
the distinction manifests mechanically — how a plugin is marked trusted, whether its startup is
subject to any permission at all — remains **Open**.

### 5. Network access is denied by default

**Decided.** Specifications that interact with HTTP APIs, remote websites, package registries, or
external services must receive explicit network permission. Prefer scoped permissions where
possible: a local web application test might require only

```
spec run --allow-net=localhost:3000
```

rather than unrestricted network access.

This is especially important when executing untrusted or AI-generated specifications, and not
only because of what a spec might reach: the network is also the exfiltration channel for
anything else a spec was granted. A suite with a broad network grant plus any readable secret is
one HTTP request away from disclosure, which is why the narrow form — one host, one port — should
be the reflex and the broad form the exception. What scoping dimensions `--allow-net` ultimately
supports (hosts, ports, protocols, URL patterns) is **Open**.

### 6. Environment variables and secrets

**Decided.** Specs should not automatically inherit arbitrary host environment variables.
Environment access requires explicit permission, and preferably explicit variable names:

```
spec run --allow-env=API_TOKEN
```

This avoids accidentally exposing cloud credentials, database credentials, SSH information, CI
secrets, or unrelated API keys to a specification or plugin. The environment deserves its own
permission family because it is where ambient secrets accumulate — nowhere more densely than in
CI, which is also exactly where suites run unattended. Per-name grants bound the damage: paired
with section 5, a specification that can read one named token and reach one named host has a
blast radius a reviewer can actually reason about.

**Open.** How secrets are referenced inside `.spec` files remains an open design question.
Behavioral specifications are portable documents meant to outlive implementations and move
between environments (ADR-008), so secret _values_ plainly do not belong in them; whatever
construct emerges must let a spec name a secret without containing it.

### 7. Devices and simulators

**Decided, at the level of principle only.** Mobile, desktop, browser, camera, microphone,
simulator, emulator, or device-level integrations may require their own permissions. These are
deliberately not designed yet — the device surfaces themselves are still being enumerated in
[ADR-005](./ADR-005-interface-capabilities.md) — and designing their permissions before their
capabilities would invert the dependency. What this ADR fixes now is the broader principle that
makes late design safe: plugins declare the privileges their tools require, and the runtime
enforces them centrally (section 8). A device permission added later slots into the same
declaration-and-enforcement machinery as every existing family, rather than needing a parallel
mechanism. How device and simulator access is ultimately authorized is **Open** here and in
ADR-005.

### 8. Plugins declare; the runtime enforces

**Decided.** Plugins declare the permissions their tools require, as metadata carried by the
plugin protocol, and the runtime is the sole enforcement authority. Conceptually:

```
browser.open
requires: net
```

```
cli.run
requires: run
```

```
host.read
requires: host-fs
```

```
env.get
requires: env
```

Declarations of this kind are useful long before any enforcement question arises: the runtime
could refuse a suite up front instead of failing it halfway, diagnostics can name the missing
grant precisely (section 9), and documentation tooling can show what a plugin's tools will ask
for before anyone installs it. What is decided here is that declarations exist and that
enforcement belongs to the runtime; the declaration _format_ — the `requires:` spelling above,
where the metadata lives in tool discovery, whether it attaches per tool or per plugin — and the
enforcement mechanics both remain **Open**, and the Open Questions below already carry them.

**Decided.** The runtime, not the plugin, is the ultimate authority enforcing granted
permissions. Sandbox security must never rely solely on plugin self-restraint. The reason is
structural: a plugin is an external program in an arbitrary language (ADR-004), and a malicious
or compromised plugin can misdeclare as easily as it can declare. Metadata is honest advertising;
the security boundary is the runtime's, and it must hold even against a plugin that lies about
itself.

Holding that line is easier to state than to build, and this suite does not pretend otherwise.
Refusing to dispatch a denied tool call is straightforward; constraining what a plugin process
does _without being asked_ is a different problem whose answer depends on how plugins are hosted.
How enforcement works for different plugin/process architectures remains an **Open** question, as
does whether plugin processes themselves run sandboxed.

### 9. A denial is a teaching diagnostic

**Decided.** Permission failures must produce structured, actionable diagnostics. Conceptually:

```sh
Permission denied: process execution

The spec attempted to run:
> node

Re-run with an appropriate permission, for example:
> spec run --allow-run=node
```

This exact output is not committed to; the requirement is. Because failing under a plain
`spec run` is expected behavior (section 1), the denial message is the permission model's primary
user interface — most people will meet this system for the first time by being told no. The
message must therefore carry the whole workflow on its back: run, read which permission was
denied and against which concrete operation, judge whether the request is legitimate, re-run with
the narrowest grant that satisfies it. Read that way, a denial is a permission request addressed
to a human, and it should be written with the care a request deserves: the capability family, the
specific thing attempted, and a candidate grant, stated exactly.

One boundary is worth making explicit because it follows from section 2: the diagnostic may
_propose_ a flag, but nothing in the runtime ever applies one. Suggesting is the mechanism's
outer limit; supplying the grant is always the caller's act. Structurally, permission denials are
one kind of rich diagnostic among the several the architecture must eventually support — failing
statements, expected-versus-observed values, traces — and they ride the general diagnostics
design sketched in ADR-004.

### 10. AI-generated specifications cannot grant themselves anything

**Decided.** No syntax inside a `.spec` file grants, expands, or self-approves a permission. An
AI agent must not be able to gain filesystem, process, network, device, environment, or secret
access simply by generating a `.spec` file that requests it. The person or execution environment
running `spec` remains responsible for explicitly granting those privileges.

This is not a corollary tacked onto the model; it is one of the model's load-bearing walls, and
the AI-agent workflow of ADR-003 stands on it. In that workflow an architect writes the
specification suite, fixes the permission budget once when wiring up the loop, and the agent then
iterates freely inside it — implementing, running the suite, reading failures, trying again. The
agent may author and rewrite specifications at will, and none of that authorship can widen what
those specifications may touch, because the grant vocabulary exists only at the invocation
boundary the agent does not control. The trust decision is made once, by a person, at the edge;
everything inside the loop is untrusted by construction, and stays safe not because the agent is
well behaved but because there is nothing for misbehavior to reach.

**Open.** Whether a suite may _declare_ the permissions it requires — machine-readable
requirements that would sharpen setup and diagnostics — while explicit approval still rests with
the caller. Declaration must never shade into self-granting; the question appears below.

## Consequences

- Specifications may legitimately fail under a plain `spec run`. This is the intended default
  experience for any suite that touches the network, host processes, the host filesystem, the
  environment, or devices — and it makes every CI invocation a reviewable record of what the
  suite is allowed to do.
- The friction is real and deliberate. Someone must decide, per execution environment, which
  grants a suite receives, and that decision recurs as suites grow. Section 9 exists to keep the
  cost low: every denial must state its own remedy.
- Executing specifications you did not write stops being reckless. Agent-generated suites,
  suites pulled from an external repository for compatibility testing, and editor-triggered runs
  all execute inside the same envelope: nothing beyond what the caller granted.
- The permission model constrains the plugin protocol. Tool discovery must leave room for
  permission metadata (section 8), tools must be attributable to permission families, and the
  open enforcement questions below are as much protocol questions for ADR-004 as they are
  security questions for this document.
- Trust concentrates where it can be inspected: in the operator's choice to install and
  configure a plugin, and in the caller's explicit grants. Specification content — the one input
  this system expects to receive from untrusted and machine authors — carries no authority at
  all.

## Open Questions

- **What is the exact permission taxonomy?** The families used throughout this document — `run`,
  `net`, `host-fs`, `env`, `device` — are illustrative partitions inherited from the examples,
  not a settled classification; whether they are the right number and the right cut has to be
  established before any flag can be frozen.
- **Is `--allow-*` the final CLI model?** Flags capture the decided principle — explicit grants
  by the caller — in the most familiar spelling available, but configuration profiles or other
  grant-carrying mechanisms could express the same principle; only the principle itself is
  decided.
- **What granularity should each permission support?** Narrow scopes are preferred where
  practical, but every family has its own spectrum from a whole capability down to a single named
  target, and the right resting point likely differs per family.
- **How are permissions scoped to individual plugins or tools?** A network grant might be
  intended for one plugin's HTTP calls but not another's; whether a grant attaches to the whole
  run, to a plugin, or to a specific tool is undecided.
- **How do plugins declare required permissions?** The `requires:` metadata in section 8 is
  illustrative; where declarations live in tool discovery and whether they attach per tool or per
  plugin belongs to the protocol design of ADR-004 and is unresolved.
- **How does the runtime technically enforce permissions on external plugin processes?** Refusing
  to dispatch a denied tool call is easy, but a plugin process could attempt side effects it was
  never asked for, so real enforcement may need mechanisms that differ across plugin and process
  architectures.
- **Do plugins themselves run sandboxed?** Central enforcement bounds what specifications can
  request, not what a compromised plugin does on its own initiative; whether the runtime should
  confine plugin processes, and with what, is open.
- **How exactly does trusted plugin execution differ from spec-requested process execution?**
  Section 4 fixes the distinction in principle — the operator configures plugins, specs request
  processes — but the mechanics of marking a plugin trusted and deciding what, if anything, its
  startup consumes are not designed.
- **What shapes can network permissions take?** Hosts, ports, protocols, and URL patterns are all
  candidate scoping dimensions for a network grant, each trading safety against ergonomics
  differently, and none has been chosen.
- **How is a process identified for permission purposes?** A grant could match an executable
  name, a resolved path, a content hash, or some other identity; names are convenient but
  ambiguous, hashes are precise but brittle across versions, and the trade-off is unresolved.
- **How is environment variable access scoped?** Explicit per-name grants are the preferred
  direction, but whether patterns, named sets, or plugin-scoped environment access are also
  needed is open.
- **How is device and simulator access authorized?** Section 7 deliberately stops at the
  principle; concrete permissions for simulators, emulators, cameras, microphones, and physical
  devices remain to be designed alongside the capability families of ADR-005.
- **How are executables generated inside the workspace treated by `--allow-run`?** A compiler
  specification legitimately builds a binary into its workspace and then runs it; whether that
  binary falls under an existing grant, requires its own, or deserves a workspace-specific rule
  is unresolved.
- **Do subprocesses inherit permissions?** A granted executable can spawn anything the operating
  system allows unless the runtime constrains it; whether grants propagate to child processes,
  and how such propagation could even be enforced, is open.
- **How do package managers behave when both `run` and `net` permissions are required?**
  Installing dependencies is a single logical operation that crosses two permission families;
  whether it remains two explicit grants or earns a better-shaped answer is open.
- **Can some safe capabilities be considered permissionless?** Workspace filesystem operations
  already are (section 3); whether other capabilities are intrinsically contained enough to join
  them — and by what criterion containment is judged — is open.
- **Can a suite declare the permissions it requires while approval still rests with the caller?**
  A machine-readable requirements declaration would improve setup and diagnostics, but it must
  remain a request the caller approves, never a grant the suite performs on its own behalf.
- **How are secrets referenced inside `.spec` files?** Environment grants gate access to secret
  values, but the language-level construct that lets a portable specification name a secret
  without containing it is an open design question.
