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
sdxc make model post title author_id  # the model, its migration and its factory
sdxc make migration add-slug-to-posts 'slug?'  # ALTER TABLE, read from the name
sdxc make migration add-slug --from-model post  # the SQL app/models/post.ts needs
sdxc scaffold post title body published_at   # types follow the names: text, timestamp
sdxc scaffold post title body --api          # JSON endpoints and their OpenAPI operations
sdxc destroy controller posts/show           # remove it, its mapping and its declaration
sdxc models post                             # the table app/models/post.ts declares, vs the migrations
sdxc ui add dialog                   # copy a component into the project to edit it
sdxc ui update --all                 # move every unedited copy to the installed @sdxc/ui
sdxc upgrade                         # move to the latest release and print a prompt for the code
sdxc doctor                          # report release drift, missing secrets and app-layout slips
sdxc routes --json                   # every route, its controller and middleware, for an agent
sdxc routes -g posts --method post   # narrow it, as rails routes does; --unused, -c, -E too
sdxc run users find ada@example.com  # run the app's own command line, bootstrap/cli.ts
sdxc deploy                          # build, then the app's db migrate --remote and deploy
```

On a terminal each command asks for what you left out; every question has a flag, so scripts and agents never wait on one.

### Releases

Every `@sdxc/*` package versions as the UTC date it was published, and a daily release republishes only the packages that changed, so a project's packages carry different dates from the same release. The kit reads a project's release as the newest date among its `@sdxc/*` pins, and pins a package "at a release" to its newest version on or before that date:

- `sdxc create` pins each package the template lists to its `latest` version.
- `sdxc make` and `sdxc ui add` add a package the written code imports at the project's release, and print the install command to run.
- `sdxc upgrade [release]` moves every `@sdxc/*` package the project lists to the target release, latest when left out, and `remix` to the version that release requires, then installs and prints a prompt for an AI agent from that release's changelog.
- `sdxc doctor` reports packages pinned behind the project's release and a `remix` pin other than the release's peer; `sdxc upgrade <release>` fixes both.

`sdxc doctor` also checks secrets, migrations and the app layout, and runs a project's own checks written with `defineCheck` from `@sdxc/kit/doctor`. The [doctor guide](https://sdxc.dev/docs/sdxc/check-a-project) lists every check.

## API

### Commands

| Command             | What it does                                                                       |
| ------------------- | ---------------------------------------------------------------------------------- |
| `sdxc create`       | Writes a new project from the built-in `app` template or a GitHub repository       |
| `sdxc init`         | Writes `.config/sdxc.jsonc` with every key at its default                          |
| `sdxc make`         | Writes a controller, job, model, migration or other file, declared and mapped      |
| `sdxc scaffold`     | Writes a resource's model, migration, pages or JSON endpoints, and tests           |
| `sdxc destroy`      | Removes what `sdxc make` wrote, its mapping and its declaration, once confirmed    |
| `sdxc routes`       | Prints every route with its controller and middleware                              |
| `sdxc models`       | Prints each model's table and whether the migrations create it                     |
| `sdxc schedule`     | Lists scheduled jobs, their next runs and the Worker triggers that fire them       |
| `sdxc middleware`   | Prints each router's global middleware and every chain in `app/http/middleware`    |
| `sdxc initializers` | Lists the initializers, their exports and the factories that build them            |
| `sdxc notes`        | Lists the `TODO`, `FIXME`, `HACK` and `OPTIMIZE` comments in the app's code        |
| `sdxc stats`        | Counts lines of code per kind of code, and the code to test ratio                  |
| `sdxc run`          | Runs the app's own command line, `bootstrap/cli.ts`, with the project's runtime    |
| `sdxc doctor`       | Lints the project: release drift, secrets, migrations, layout and its own checks   |
| `sdxc ui`           | Copies `@sdxc/ui` components into the project and points imports at the copies     |
| `sdxc upgrade`      | Moves the `@sdxc/*` packages and `remix` to a release and prints the prompt        |
| `sdxc deploy`       | Builds, then runs the app's own `db migrate --remote` and `deploy`, once confirmed |

Commands run from the project root, the nearest directory with a `package.json`. `sdxc <command> --help` prints a command's arguments and flags, and `--help --json` prints them as data for an agent. Every command that runs tasks also takes `--no-progress`.

#### `sdxc create [directory]`

Write a new project from a built-in template or a GitHub repository

| Flag                    | Does                                                                 |
| ----------------------- | -------------------------------------------------------------------- |
| `--template <template>` | A built-in template, or a GitHub repository as org/repo[/path][#ref] |
| `--git`                 | Initialize a git repository without asking, or skip it with --no-git |

#### `sdxc deploy`

Build, then run the app's db migrate --remote and deploy commands

| Flag            | Does                                                       |
| --------------- | ---------------------------------------------------------- |
| `-y, --yes`     | Deploy without asking; required without a terminal         |
| `--dry-run`     | Build and print the plan; migrate and deploy nothing       |
| `--skip <step>` | Leave out build, migrate or deploy; repeat it or list them |

#### `sdxc destroy <kind> <name>`

Remove a file sdxc make wrote, its test, its mapping and its declaration

| Flag         | Does                                                        |
| ------------ | ----------------------------------------------------------- |
| `-y, --yes`  | Remove without asking; required without a terminal          |
| `--dry-run`  | Print what would be written and change nothing              |
| `--resource` | With mcp, a resource in app/mcp/resources instead of a tool |

#### `sdxc doctor`

Lint release drift, secrets, migrations, app layout and project checks

| Flag             | Does                                  |
| ---------------- | ------------------------------------- |
| `--json`         | Print the report as JSON for an agent |
| `--only <check>` | Run only the named checks             |
| `--skip <check>` | Leave out the named checks            |

#### `sdxc init`

Write .config/sdxc.jsonc with every default spelled out

| Flag        | Does                       |
| ----------- | -------------------------- |
| `--dry-run` | Print it and write nothing |

#### `sdxc initializers`

List the initializers in app/initializers, their exports and what builds them

| Flag     | Does                                  |
| -------- | ------------------------------------- |
| `--json` | Print a JSON array instead of a table |

#### `sdxc make <kind> <name>`

Write a controller, job, model or other file where the app layout puts it

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make controller <name>`

A route handler in app/http/controllers, declared and mapped

| Flag                  | Does                                                                                                                                                                            |
| --------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--method <method>`   | get, post, put, patch, delete, form; asked on a terminal (default: get)                                                                                                         |
| `--path <path>`       | The route's pattern (default: /&lt;name&gt;)                                                                                                                                    |
| `--routes <contract>` | The route contract in routes/ (default: make.routes)                                                                                                                            |
| `--resource <name>`   | Check the resource's ability the method implies (get reads, form and post create, put and patch update, delete deletes); a read, update or delete route takes /&lt;name&gt;/:id |
| `--actions <action>`  | One controller per action under &lt;name&gt;: index, new, show, edit and destroy pages, or with --routes api index, show, create, update and destroy endpoints; all writes each |
| `--test`              | Write a test beside the file, or skip it with --no-test (default: make.tests)                                                                                                   |
| `--dry-run`           | Print what would be written and change nothing                                                                                                                                  |
| `--force`             | Replace the file and its test when they exist, keeping their declaration                                                                                                        |

#### `sdxc make middleware <name>`

A middleware in app/http/middleware

| Flag               | Does                                                                                      |
| ------------------ | ----------------------------------------------------------------------------------------- |
| `--mount <target>` | Also call it last in a chain: a router initializer (router) or a chain module (page, api) |
| `--test`           | Write a test beside the file, or skip it with --no-test (default: make.tests)             |
| `--dry-run`        | Print what would be written and change nothing                                            |
| `--force`          | Replace the file and its test when they exist, keeping their declaration                  |

#### `sdxc make validator <name>`

An input validator in app/http/validators

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make job <name>`

A background job in app/jobs, declared and mapped

| Flag                  | Does                                                                          |
| --------------------- | ----------------------------------------------------------------------------- |
| `--cron <expression>` | A scheduled job instead of one with input                                     |
| `--test`              | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run`           | Print what would be written and change nothing                                |
| `--force`             | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make model <name> [field[:type][?]...]`

A model in app/models, with the migration creating its table and its factory

| Flag              | Does                                                                          |
| ----------------- | ----------------------------------------------------------------------------- |
| `--chain <chain>` | The chain in make.migrations the migration goes in (default: default)         |
| `--skip <file>`   | Leave out the migration or the factory; repeat it or list them                |
| `--test`          | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run`       | Print what would be written and change nothing                                |
| `--force`         | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make migration <name> [field[:type][?]...]`

A numbered SQL migration in a configured chain

| Flag                   | Does                                                                         |
| ---------------------- | ---------------------------------------------------------------------------- |
| `--chain <chain>`      | The chain in make.migrations (default: default)                              |
| `--from-model <model>` | Write the SQL that brings the chain in step with app/models/&lt;model&gt;.ts |
| `--dry-run`            | Print what would be written and change nothing                               |

#### `sdxc make factory <name>`

A test factory in database/factories

| Flag        | Does                                                                     |
| ----------- | ------------------------------------------------------------------------ |
| `--dry-run` | Print what would be written and change nothing                           |
| `--force`   | Replace the file and its test when they exist, keeping their declaration |

#### `sdxc make service <name>`

A service in app/services

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make policy <name>`

A resource's create, read, update and delete abilities in app/policies, with their test

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make initializer <name>`

An initializer in app/initializers

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make email <name>`

An email template in app/emails

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make mcp <name>`

An MCP tool in app/mcp/tools, or a resource, declared and mapped

| Flag         | Does                                                                          |
| ------------ | ----------------------------------------------------------------------------- |
| `--resource` | A resource in app/mcp/resources instead of a tool                             |
| `--test`     | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run`  | Print what would be written and change nothing                                |
| `--force`    | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make command <name>`

A command-line command in app/commands, declared and mapped

| Flag        | Does                                                                          |
| ----------- | ----------------------------------------------------------------------------- |
| `--test`    | Write a test beside the file, or skip it with --no-test (default: make.tests) |
| `--dry-run` | Print what would be written and change nothing                                |
| `--force`   | Replace the file and its test when they exist, keeping their declaration      |

#### `sdxc make test <file>`

The test make writes beside a file, for an existing file without one

| Flag        | Does                                           |
| ----------- | ---------------------------------------------- |
| `--dry-run` | Print what would be written and change nothing |
| `--force`   | Replace the test when it exists                |

#### `sdxc make stubs [kind...]`

Copy the built-in stubs into make.stubs to edit

#### `sdxc middleware`

Print each router's global middleware and every chain in app/http/middleware

| Flag     | Does                     |
| -------- | ------------------------ |
| `--json` | Print the chains as JSON |

#### `sdxc models [model...]`

Print each model's table and whether the migrations create it, from app/models

| Flag     | Does                     |
| -------- | ------------------------ |
| `--json` | Print the models as JSON |

#### `sdxc notes`

List the TODO, FIXME, HACK and OPTIMIZE comments in the app's code

| Flag          | Does                                                                            |
| ------------- | ------------------------------------------------------------------------------- |
| `--tag <tag>` | The tags to list instead of TODO, FIXME, HACK, OPTIMIZE; repeat it or list them |
| `--json`      | Print a JSON array instead of a list                                            |

#### `sdxc routes`

Print every route with its controller and the middleware that runs for it

| Flag                      | Does                                                                           |
| ------------------------- | ------------------------------------------------------------------------------ |
| `--json`                  | Print a JSON array instead of a table                                          |
| `-E, --expanded`          | Print one block per route with every field, for a narrow terminal              |
| `-g, --grep <pattern>`    | Keep routes whose name, pattern, method or controller matches                  |
| `-c, --controller <path>` | Keep routes of a controller file or folder, as posts or posts/show             |
| `--method <method>`       | Keep routes answering a method; ANY routes answer every one                    |
| `--contract <contract>`   | Keep routes declared in a contract in routes/, as web                          |
| `--unused`                | Keep routes no router maps, and report controllers no route maps               |
| `--except-path <path>`    | Leave out routes under a path, as /api or /mcp; repeat it or list them         |
| `--sort <field>`          | Order routes by name, pattern, method, controller instead of declaration order |

#### `sdxc run [command...]`

Run the project's own command line, bootstrap/cli.ts, with its runtime

#### `sdxc scaffold <name> [field[:type][?]...]`

Write a resource's model, migration, pages, tests and more, declared and mapped

| Flag              | Does                                                                                                                  |
| ----------------- | --------------------------------------------------------------------------------------------------------------------- |
| `--plural <word>` | The plural the table, URLs and folders take (default: &lt;name&gt;s)                                                  |
| `--mcp`           | Also write MCP tools to list, get, create, update and delete                                                          |
| `--command`       | Also write app commands to list, show, create and delete                                                              |
| `--api`           | JSON endpoints in routes/api.ts with their OpenAPI operations, instead of pages                                       |
| `--skip <piece>`  | Leave out pieces the project already has: model, migration, factory, validator, policy, pages; repeat it or list them |
| `--test`          | Write a test beside the file, or skip it with --no-test (default: make.tests)                                         |
| `--dry-run`       | Print what would be written and change nothing                                                                        |

#### `sdxc schedule`

List the scheduled jobs, their next runs and the Worker triggers that fire them

| Flag     | Does                       |
| -------- | -------------------------- |
| `--json` | Print the schedule as JSON |

#### `sdxc stats`

Count lines of code per kind of code the app layout names, and the test ratio

| Flag     | Does                     |
| -------- | ------------------------ |
| `--json` | Print the counts as JSON |

#### `sdxc ui list`

Every component, marking copies that are edited or behind

#### `sdxc ui add [component...]`

Copy components and point the project's imports at the copies

| Flag          | Does                                                |
| ------------- | --------------------------------------------------- |
| `--with-deps` | Also copy every component they reach through others |
| `--dry-run`   | Print what would be written and change nothing      |

#### `sdxc ui diff <component>`

Show how a copy differs from the installed version

#### `sdxc ui update [component...]`

Replace copied files with the installed version

| Flag          | Does                                                              |
| ------------- | ----------------------------------------------------------------- |
| `--all`       | Update every copy, leaving edited files unless --force            |
| `--with-deps` | Also copy components the new versions reach and the project lacks |
| `--force`     | Replace edited files without asking                               |
| `--dry-run`   | Print what would be written and change nothing                    |

#### `sdxc ui remove [component...]`

Delete copies and point imports back at @sdxc/ui/&lt;name&gt;

| Flag        | Does                                           |
| ----------- | ---------------------------------------------- |
| `--dry-run` | Print what would be written and change nothing |

#### `sdxc upgrade [version]`

Move the @sdxc packages to another release and print the prompt for the code

| Flag                        | Does                                                                                   |
| --------------------------- | -------------------------------------------------------------------------------------- |
| `--no-install`              | Change package.json only and print the commands to run next                            |
| `--output <file>`           | Write the prompt to a file instead of stdout                                           |
| `--prompt`                  | Print the prompt for this release of @sdxc/kit only; needs --from                      |
| `--from <version>`          | The release the project moved from, with --prompt                                      |
| `--since <package@version>` | A package's own pinned release when it lagged behind --from, with --prompt; repeatable |
| `--remix-from <version>`    | The remix version the project moved from, with --prompt                                |

### Configuration

The CLI reads `.config/sdxc.jsonc` (or `sdxc.jsonc` at the project root). Every key is optional.

| Key                        | Default                                | Meaning                                                                      |
| -------------------------- | -------------------------------------- | ---------------------------------------------------------------------------- |
| `ui.directory`             | `resources/components/ui`              | Where `sdxc ui add` writes components                                        |
| `ui.alias`                 | inferred from tsconfig `paths`         | Import prefix for the copies                                                 |
| `ui.tests`                 | `false`                                | Copy a component's tests beside it                                           |
| `make.routes`              | `web`                                  | Route contract `sdxc make controller` adds to, a module in `routes/`         |
| `make.migrations`          | `{ "default": "database/migrations" }` | Migration chains by name                                                     |
| `make.tests`               | `true`                                 | Write a test beside every generated file except migrations and factories     |
| `make.stubs`               | `.config/sdxc/stubs`                   | Stubs that replace the built-in ones                                         |
| `doctor.checks`            | `.config/sdxc/checks`                  | The project's own `sdxc doctor` checks, one module each                      |
| `doctor.migrations.accept` | `[]`                                   | Migration errors `sdxc doctor` steps past, each `{ "file", "column" }`       |
| `format`                   | none                                   | Command run once on every file a command wrote or edited, the paths appended |
| `lock`                     | `.config/sdxc.lock.jsonl`              | Where the CLI keeps its state                                                |

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
