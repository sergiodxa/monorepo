---
title: Copy UI components
description: Copy an @sdxc/ui component into your project to edit it, see how a copy differs, and take a new release's version where your copy is untouched.
section:
    title: The sdxc command
    order: 2
order: 4
lastUpdated: 2026-10-19
---

[`@sdxc/ui`](/api/ui) components are imported from the package, so a release updates them for
you. When a design needs a component changed, copy it into the project:

```bash
sdxc ui add dialog
```

The copy is yours to edit, and `sdxc ui` keeps track of it: which release it came from, whether
you changed it, and whether a newer release changed the original.

| Command                 | What it does                                                 |
| ----------------------- | ------------------------------------------------------------ |
| `sdxc ui add <name>`    | copy a component and point the project's imports at the copy |
| `sdxc ui list`          | every component, marking copies that are edited or behind    |
| `sdxc ui diff <name>`   | how a copy differs from the installed version                |
| `sdxc ui update <name>` | take the installed version where the copy is untouched       |
| `sdxc ui remove <name>` | delete the copy and point imports back at `@sdxc/ui/<name>`  |

## Add a copy

```bash
sdxc ui add dialog
sdxc ui add dialog popover --with-deps
sdxc ui add dialog --dry-run
```

The copy lands in `ui.directory`, `resources/components/ui` unless you set it, and every file in
the project that imported `@sdxc/ui/dialog`, or `Dialog` from `@sdxc/ui`, now imports the copy:

```text
Copied dialog to resources/components/ui/dialog.tsx
```

The imports use the prefix your `tsconfig.json` `paths` give that folder, or a relative path
in a project without one; set `ui.alias` when you want another prefix. A component's
tests stay in the package unless `ui.tests` is `true`.

A component that reaches others keeps importing them from the package; `--with-deps` copies
those as well. When the copy imports a package your `package.json` lacks, `add` adds it at your
release and prints the install command to run.

With no name, a terminal searches the components for you to pick. A component already copied is
reported and left alone, since `ui update` is what replaces it, and a file already at the copy's
path that the lock does not list stops the command until you move it. `--dry-run` prints every
file and edit as a diff, the lock file's included, and writes nothing.

## The lock file

The command records each copy, the release it came from and a hash of each file in
`.config/sdxc.lock.jsonl`, the `lock` key of your configuration. Commit that file and leave it
to the command line, which reads it to tell an edited copy from an untouched one. A copy is
edited when one of its recorded files is missing or hashes differently.

## See what changed

`list` prints one line per component the installed release ships, and per copy it no longer
does:

```text
button  copied from 2026.10.10, behind, changed in 2026.10.20
dialog  copied from 2026.10.10, edited, behind, changed in 2026.10.20
popover
```

A copy is behind when the installed `@sdxc/ui` changed the component after the release the copy
came from. `diff` prints a copy against the installed version as a unified diff, from the
package's file to yours, or says it matches:

```bash
sdxc ui diff dialog
```

## Update copies

```bash
sdxc ui update dialog
```

`update` replaces only the files you have not edited and names the rest:

```text
Updated 1 file of button
resources/components/ui/dialog.tsx is edited; left as it is (--force replaces it)
Updated 0 files of dialog
```

On a terminal it asks before replacing an edited file of a copy you named; `--force` replaces
it without asking, and without a terminal an edited file is left as it is. After upgrading
`@sdxc/ui`, `--all` updates every copy at once and leaves edited files without asking, so it is
safe in a script:

```bash
sdxc ui update --all --dry-run   # print what would change
sdxc ui update --all             # replace every untouched copy
```

Name the copies or pass `--all`, not both. When a new version of a copy imports a component you
have not copied, `update` names it and the copy imports it from the package; `--with-deps`
copies it as well, as `add` does.

When `add`, `update --with-deps` or `remove` points an untouched copy's imports somewhere new,
the copy stays untouched: the lock records its new hash, so `ui update` keeps replacing it.

To keep an edited copy current, read `ui diff`, carry your change onto the new version by hand
or with your agent, and run `ui update <name> --force` first when the new version is the better
starting point. [`sdxc upgrade`](/docs/sdxc/upgrade) lists the copies whose source changed in
the prompt it prints.

## Remove a copy

```bash
sdxc ui remove dialog
```

`remove` deletes the copy's files, drops it from the lock file, and points every import back at
`@sdxc/ui/dialog`. With no name, a terminal picks from the copies the lock lists.

## Configuration

```jsonc {% title=".config/sdxc.jsonc" %}
{
	"ui": {
		// Where `sdxc ui add` writes components
		"directory": "resources/components/ui",
		// Import prefix for the copies; inferred from tsconfig `paths` when omitted
		"alias": "~/components/ui",
		// Copy a component's tests beside it
		"tests": false,
	},
	// Command run on every file the CLI writes or edits, paths appended
	"format": ["bunx", "vp", "fmt", "--no-error-on-unmatched-pattern"],
}
```

`format` runs once over the copies and the files whose imports changed, so they land in your
project's style.

## Where to go next

- [Build the interface with remix/component](/docs/building-remix-apps/interface-with-remix-ui) — the
  components before you copy one.
- [Upgrade](/docs/sdxc/upgrade) — the prompt names the copies whose source changed.
