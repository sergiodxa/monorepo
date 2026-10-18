# @sdxc/kit

The sdxc command line: start a Remix v3 app, generate its files, copy UI components into it and upgrade it.

## Installation

```sh
npm add -g @sdxc/kit
```

The package installs a command named `sdxc`. It works on projects that depend on the `@sdxc/*` packages, and every command that writes code lists the packages that code imports in `package.json`.

## Usage

```sh
sdxc create my-app                   # a Remix v3 app, or --template org/repo from GitHub
sdxc make controller posts/show      # a file where the app layout puts it, with its test
sdxc make controller api/keys --routes api  # a JSON endpoint in the API contract
sdxc make middleware require-user --mount page  # called last in the page chain
sdxc make migration add-slug --from-model posts  # the SQL app/models/posts.ts needs
sdxc scaffold post title body:text published:boolean  # model, migration, pages and tests
sdxc ui add dialog                   # copy a component into the project to edit it
sdxc ui update --all                 # move every unedited copy to the installed @sdxc/ui
sdxc upgrade                         # move to the latest release and print a prompt for the code
sdxc doctor                          # report release drift and secrets .env.example leaves out
sdxc routes --json                   # every route, its controller and middleware, for an agent
sdxc run users find ada@example.com  # run the app's own command line, bootstrap/cli.ts
sdxc deploy                          # build, apply production migrations, then deploy
```

On a terminal each command asks for what you left out; every question has a flag, so scripts and agents never wait on one.

### Releases

Every `@sdxc/*` package versions as the UTC date it was published, and a daily release republishes only the packages that changed, so a project's packages carry different dates from the same release. The kit reads a project's release as the newest date among its `@sdxc/*` pins, and pins a package "at a release" to its newest version on or before that date:

- `sdxc create` pins each package the template lists to its `latest` version.
- `sdxc make` and `sdxc ui add` add a package the written code imports at the project's release, and print the install command to run.
- `sdxc upgrade [release]` moves every `@sdxc/*` package the project lists to the target release, latest when left out, and `remix` to the version that release requires, then installs and prints a prompt for an AI agent from that release's changelog. It also rewrites the sdxc section of the project's `AGENTS.md`, between `<!-- sdxc:start … -->` and `<!-- sdxc:end -->`, from that release's template; the rest of the file stays as the project wrote it.
- `sdxc doctor [--json]` reports, one line per check, any `@sdxc/*` pin behind its version at the project's release, an install that differs from `package.json`, a `remix` pin other than the release's peer, and a secret `cloudflare.config.ts` declares that `.env.example` leaves out, each with the command that fixes it. It exits 1 when a check fails; without the npm registry, the checks that need it report `skip`.

## API

### Commands

| Command         | What it does                                                                       |
| --------------- | ---------------------------------------------------------------------------------- |
| `sdxc create`   | Writes a new project from the built-in `app` template or a GitHub repository       |
| `sdxc init`     | Writes `.config/sdxc.jsonc` with every key at its default                          |
| `sdxc routes`   | Prints every route with its controller and middleware; `--json` for an agent       |
| `sdxc run`      | Runs the app's own command line, `bootstrap/cli.ts`, with the project's runtime    |
| `sdxc deploy`   | Builds, applies pending production migrations, then deploys with `cf`, after a yes |
| `sdxc make`     | Writes a controller, job, model, migration or other file, declared and mapped      |
| `sdxc scaffold` | Writes a resource's model, migration, CRUD pages and tests; `--mcp`, `--command`   |
| `sdxc ui`       | Copies `@sdxc/ui` components into the project and points imports at the copies     |
| `sdxc upgrade`  | Moves the `@sdxc/*` packages and `remix` to a release and prints the prompt        |
| `sdxc doctor`   | Reports release drift, a stale install, a wrong `remix` and `.env.example` gaps    |

`sdxc <command> --help` lists each command's arguments and flags. Commands run from the project root, the nearest directory with a `package.json`.

### Configuration

The CLI reads `.config/sdxc.jsonc` (or `sdxc.jsonc` at the project root). Every key is optional.

| Key               | Default                                | Meaning                                                                      |
| ----------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `ui.directory`    | `resources/components/ui`              | Where `sdxc ui add` writes components                                        |
| `ui.alias`        | inferred from tsconfig `paths`         | Import prefix for the copies                                                 |
| `ui.tests`        | `false`                                | Copy a component's tests beside it                                           |
| `make.routes`     | `web`                                  | Route contract `sdxc make controller` adds to, a module in `routes/`         |
| `make.migrations` | `{ "default": "database/migrations" }` | Migration chains by name                                                     |
| `make.tests`      | `true`                                 | Write a test beside every generated file except migrations and factories     |
| `make.stubs`      | `.config/sdxc/stubs`                   | Stubs that replace the built-in ones                                         |
| `format`          | none                                   | Command run once on every file a command wrote or edited, the paths appended |
| `lock`            | `.config/sdxc.lock.jsonl`              | Where the CLI keeps its state                                                |

`format` is an argument list, such as `["bunx", "vp", "fmt"]`.

### `@sdxc/kit/config.schema.json`

The JSON Schema 2020-12 document for `.config/sdxc.jsonc`. `sdxc init` points the file's `$schema` at `https://unpkg.com/@sdxc/kit/config.schema.json`.

### `@sdxc/kit/lock.schema.json`

The JSON Schema 2020-12 document for one line of the lock file, where the CLI records state such as copied components. Commit the lock file and leave it to the CLI.

### `createSDXC(options?)` and `kitVersion()`

Builds the command line the `sdxc` binary runs, for a program that embeds it: `await createSDXC({ version: kitVersion() }).run(argv)` answers the exit code.

## Versioning

Releases are dated rather than semantic. A version is the UTC date it was published,
written `YYYY.M.D`, so `2026.9.4` is the release from 4 September 2026. At most one
release goes out per day, and every release ships `@sdxc/kit`.

Those numbers say when, not what: a later date means a later release and carries no
compatibility promise. Any release may change or remove a command or flag.

## License

MIT

## Author

[Sergio Xalambrí](https://sergiodxa.com)
