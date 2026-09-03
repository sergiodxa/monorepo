# ADR-045: Icons Package Rename

## Status

**Proposed** - 2026-09-03

## Background

`@pkg/lucide-remix` generates Remix UI icon components from `lucide-static`'s SVG source and exports them as `Icon`, `IconName`, and one named component per icon (`ChevronDownIcon`, `PlusIcon`, and so on). It is consumed by `@pkg/ui` (its only runtime dependency besides `remix`, per [ADR-014](./ADR-014-r3-ui-component-library-on-remix-ui.md)) and directly by `apps/uptime` and `apps/r3-gallery`.

## Context

Lucide is where the SVG source comes from, not what the package is for. Every consumer imports it to get an icon component, never to reach anything Lucide-specific, so the name ties the package to a swappable implementation detail rather than the role it plays.

## Decision

Rename `@pkg/lucide-remix` to `@pkg/icons`. The directory moves to `packages/icons`, and the public API is unchanged: `Icon`, `IconName`, and every generated `*Icon` component keep their names.

### Files to update

**Package identity**

- `packages/lucide-remix/` → `packages/icons/` (directory move)
- `packages/lucide-remix/package.json` - `name` field
- `packages/lucide-remix/src/index.ts:2` - header comment referencing `@pkg/lucide-remix`
- `packages/lucide-remix/scripts/generate-icons.ts:184` - generated header comment referencing `@pkg/lucide-remix`
- `packages/lucide-remix/README.md` - package README

**`package.json` dependency declarations** (`"@pkg/lucide-remix": "workspace:*"` → `"@pkg/icons": "workspace:*"`)

- [apps/r3-gallery/package.json](../../apps/r3-gallery/package.json)
- [apps/uptime/package.json](../../apps/uptime/package.json)
- [packages/ui/package.json](../../packages/ui/package.json)
- `bun.lock` regenerates from these once the rename lands

**Import specifiers** (`from "@pkg/lucide-remix"` → `from "@pkg/icons"`)

- [apps/r3-gallery/src/views/album.tsx:14](../../apps/r3-gallery/src/views/album.tsx) - `ChevronLeftIcon, ChevronRightIcon`
- [apps/uptime/app/http/controllers/home.tsx](../../apps/uptime/app/http/controllers/home.tsx) - `ActivityIcon, ArrowRightIcon, BellIcon, CheckIcon, CirclePauseIcon, ClockIcon, CodeIcon, CreditCardIcon, FileTextIcon, GlobeIcon, KeyIcon, LayersIcon, LinkIcon, LockIcon, MessageSquareIcon, RefreshCwIcon, ShieldCheckIcon, TimerIcon, UsersIcon, WorkflowIcon`
- [apps/uptime/app/http/controllers/marketing-comparison.tsx:14](../../apps/uptime/app/http/controllers/marketing-comparison.tsx) - `CheckIcon, TriangleAlertIcon`
- [apps/uptime/app/http/controllers/status-page.tsx:17-23](../../apps/uptime/app/http/controllers/status-page.tsx) - `CircleCheckBigIcon, CircleMinusIcon, CircleXIcon, ClockIcon, TriangleAlertIcon`
- [apps/uptime/app/http/controllers/trial/index.tsx](../../apps/uptime/app/http/controllers/trial/index.tsx) - `ActivityIcon, ArrowRightIcon, BellIcon, CheckIcon, ClockIcon, CreditCardIcon, GlobeIcon, MailIcon, NetworkIcon`
- [apps/uptime/app/http/controllers/app/team/account.tsx:11](../../apps/uptime/app/http/controllers/app/team/account.tsx) - `DownloadIcon, LogOutIcon, PlusIcon, Trash2Icon`
- [apps/uptime/app/http/controllers/app/team/alert-history.tsx:8](../../apps/uptime/app/http/controllers/app/team/alert-history.tsx) - `BellIcon, HistoryIcon`
- [apps/uptime/app/http/controllers/app/team/alerts.tsx:8](../../apps/uptime/app/http/controllers/app/team/alerts.tsx) - `BellIcon, BellPlusIcon, HistoryIcon, PlusIcon`
- [apps/uptime/app/http/controllers/app/team/api-keys.tsx:14](../../apps/uptime/app/http/controllers/app/team/api-keys.tsx) - `KeyIcon, PlusIcon`
- [apps/uptime/app/http/controllers/app/team/cron-job-show.tsx:16](../../apps/uptime/app/http/controllers/app/team/cron-job-show.tsx) - `PencilIcon`
- [apps/uptime/app/http/controllers/app/team/cron-jobs.tsx:8](../../apps/uptime/app/http/controllers/app/team/cron-jobs.tsx) - `ClockIcon, PlusIcon`
- [apps/uptime/app/http/controllers/app/team/dashboard-panel.tsx:14](../../apps/uptime/app/http/controllers/app/team/dashboard-panel.tsx) - `ActivityIcon, ClockIcon, GlobeIcon, NetworkIcon, PlusIcon`
- [apps/uptime/app/http/controllers/app/team/dashboard-quick-ping.tsx:12](../../apps/uptime/app/http/controllers/app/team/dashboard-quick-ping.tsx) - `ZapIcon`
- [apps/uptime/app/http/controllers/app/team/dns-monitor-show.tsx:14](../../apps/uptime/app/http/controllers/app/team/dns-monitor-show.tsx) - `PencilIcon, PlayIcon, RefreshCwIcon`
- [apps/uptime/app/http/controllers/app/team/dns-monitors.tsx:13](../../apps/uptime/app/http/controllers/app/team/dns-monitors.tsx) - `GlobeIcon, PlusIcon`
- [apps/uptime/app/http/controllers/app/team/flow-monitor-show.tsx:19](../../apps/uptime/app/http/controllers/app/team/flow-monitor-show.tsx) - `PencilIcon`
- [apps/uptime/app/http/controllers/app/team/flow-monitors.tsx:17](../../apps/uptime/app/http/controllers/app/team/flow-monitors.tsx) - `EyeIcon, PencilIcon, PlusIcon, TrashIcon, WorkflowIcon`
- [apps/uptime/app/http/controllers/app/team/http-monitors.tsx](../../apps/uptime/app/http/controllers/app/team/http-monitors.tsx) - `EyeIcon, MonitorIcon, PencilIcon, PlusIcon, TrashIcon, UploadIcon`
- [apps/uptime/app/http/controllers/app/team/maintenance-windows.tsx:8](../../apps/uptime/app/http/controllers/app/team/maintenance-windows.tsx) - `PlusIcon, WrenchIcon`
- [apps/uptime/app/http/controllers/app/team/monitor-show.tsx](../../apps/uptime/app/http/controllers/app/team/monitor-show.tsx) - `LockIcon, PencilIcon, RefreshCwIcon, ShieldAlertIcon, ShieldCheckIcon, ShieldXIcon`
- [apps/uptime/app/http/controllers/app/team/settings.tsx](../../apps/uptime/app/http/controllers/app/team/settings.tsx) - `BadgeMinusIcon, ExternalLinkIcon, HandshakeIcon, RefreshCcwIcon, UserCogIcon, UserMinusIcon, UserPlusIcon`
- [apps/uptime/app/http/controllers/app/team/status-pages.tsx:8](../../apps/uptime/app/http/controllers/app/team/status-pages.tsx) - `FileTextIcon, PlusIcon`
- [apps/uptime/app/http/controllers/app/team/tcp-monitor-show.tsx:17](../../apps/uptime/app/http/controllers/app/team/tcp-monitor-show.tsx) - `PencilIcon`
- [apps/uptime/app/http/controllers/app/team/tcp-monitors.tsx:10](../../apps/uptime/app/http/controllers/app/team/tcp-monitors.tsx) - `NetworkIcon, PlusIcon`
- [apps/uptime/resources/components/marketing/card.tsx:14](../../apps/uptime/resources/components/marketing/card.tsx) - `ArrowRightIcon`
- [apps/uptime/resources/components/marketing/faq-accordion.tsx:14](../../apps/uptime/resources/components/marketing/faq-accordion.tsx) - `ChevronDownIcon`
- [apps/uptime/resources/components/pricing-calculator.tsx:19](../../apps/uptime/resources/components/pricing-calculator.tsx) - `PlusIcon, XIcon`
- [apps/uptime/resources/components/refresh-frame-button.tsx:19](../../apps/uptime/resources/components/refresh-frame-button.tsx) - `RefreshCwIcon`
- [apps/uptime/resources/components/row-menu.tsx:18](../../apps/uptime/resources/components/row-menu.tsx) - `EllipsisVerticalIcon`
- [apps/uptime/resources/components/run-flow-button.tsx:20](../../apps/uptime/resources/components/run-flow-button.tsx) - `PlayIcon`
- [apps/uptime/resources/components/run-monitor-button.tsx:20](../../apps/uptime/resources/components/run-monitor-button.tsx) - `PlayIcon`
- [apps/uptime/resources/components/stat-card.tsx:12](../../apps/uptime/resources/components/stat-card.tsx) - `PlusIcon`
- [apps/uptime/resources/content/marketing.ts:17,39](../../apps/uptime/resources/content/marketing.ts) - `import type { IconName }`, plus a prose reference to `` `@pkg/lucide-remix`'s `<Icon name>` `` in a comment
- [apps/uptime/resources/layouts/app-shell.tsx](../../apps/uptime/resources/layouts/app-shell.tsx) - `ActivityIcon, BellIcon, BookOpenIcon, CheckIcon, ChevronsUpDownIcon, ClockIcon, FileTextIcon, GlobeIcon, KeyIcon, MonitorCogIcon, NetworkIcon, PanelLeftIcon, SettingsIcon, WorkflowIcon, WrenchIcon`
- [apps/uptime/resources/layouts/docs.tsx:14](../../apps/uptime/resources/layouts/docs.tsx) - `ArrowRightIcon, MenuIcon`
- [apps/uptime/resources/views/marketing/page.tsx:16](../../apps/uptime/resources/views/marketing/page.tsx) - `ArrowRightIcon, CheckIcon, Icon`
- [packages/ui/src/components/button.tsx:13](../../packages/ui/src/components/button.tsx) - `LoaderCircleIcon`
- [packages/ui/src/components/calendar.tsx:13](../../packages/ui/src/components/calendar.tsx) - `ChevronLeftIcon, ChevronRightIcon`
- [packages/ui/src/components/carousel.tsx:15](../../packages/ui/src/components/carousel.tsx) - `ChevronLeftIcon, ChevronRightIcon`
- [packages/ui/src/components/checkbox.tsx:13](../../packages/ui/src/components/checkbox.tsx) - `CheckIcon, MinusIcon`
- [packages/ui/src/components/combobox.tsx:17](../../packages/ui/src/components/combobox.tsx) - `ChevronDownIcon`
- [packages/ui/src/components/date-picker.tsx:17](../../packages/ui/src/components/date-picker.tsx) - `CalendarIcon`
- [packages/ui/src/components/dialog.tsx:14](../../packages/ui/src/components/dialog.tsx) - `XIcon`
- [packages/ui/src/components/grid-list.tsx:17](../../packages/ui/src/components/grid-list.tsx) - `GripVerticalIcon`
- [packages/ui/src/components/number-field.tsx:14](../../packages/ui/src/components/number-field.tsx) - `MinusIcon, PlusIcon`
- [packages/ui/src/components/search-field.tsx:15](../../packages/ui/src/components/search-field.tsx) - `SearchIcon`
- [packages/ui/src/components/select.tsx:16](../../packages/ui/src/components/select.tsx) - `ChevronDownIcon`
- [packages/ui/src/components/sidebar.tsx:14](../../packages/ui/src/components/sidebar.tsx) - `PanelLeftIcon`
- [packages/ui/src/components/spinner.tsx:14](../../packages/ui/src/components/spinner.tsx) - `LoaderCircleIcon`
- [packages/ui/src/components/table.tsx:14](../../packages/ui/src/components/table.tsx) - `ArrowDownIcon, ArrowUpDownIcon, ArrowUpIcon`
- [packages/ui/src/components/tag-group.tsx:16](../../packages/ui/src/components/tag-group.tsx) - `XIcon`
- [packages/ui/src/components/toast.tsx:13](../../packages/ui/src/components/toast.tsx) - `XIcon`
- [packages/ui/src/components/tree.tsx:16](../../packages/ui/src/components/tree.tsx) - `ChevronRightIcon`

**Prose references** (name mentioned in text, not imported)

- [README.md:118](../../README.md) - package table row and description
- [README.md:169](../../README.md) - `@types/node` consumers list
- [README.md:178](../../README.md) - `lucide-static` consumers list
- [packages/ui/AGENTS.md:10,186](../../packages/ui/AGENTS.md) - "only dependencies" statements
- [packages/ui/README.md:7](../../packages/ui/README.md) - dependencies sentence

## Consequences

### Positive

- **The name says what the package is for** - importing icons, not importing Lucide specifically. A future switch of icon source data would not need a second rename.
- **Consistent with prior renames** - matches the reasoning in [ADR-032](./ADR-032-kv-cache-package-rename.md): each package name should say what it does, not an implementation detail behind it.

### Negative

- **Earlier ADRs refer to the old name** - [ADR-014](./ADR-014-r3-ui-component-library-on-remix-ui.md) and [docs/adr/r3-auth/ADR-001](./r3-auth/ADR-001-port-auth-to-remix-v3.md) describe the package as `@pkg/lucide-remix`, which is what it was called when those decisions were made. Left as written, per the same convention ADR-032 follows.
- **Every consumer's import line moves in the same change** - 57 import sites across `apps/uptime`, `apps/r3-gallery`, and `packages/ui`, listed above so the rename can land in one pass rather than being discovered file by file.

### Neutral

- **No API change** - `Icon`, `IconName`, and every generated `*Icon` component keep their names; only the import specifier changes.
- **`bun.lock` regenerates** - once `package.json` names and dependency declarations move, a `bun install` updates the lockfile; it is not hand-edited.

## Notes

- Historical ADRs keep the name they were written with, since they record what was decided at the time.
- The generated-file header in [scripts/generate-icons.ts](../../packages/lucide-remix/scripts/generate-icons.ts) also needs updating so future codegen runs emit the new package name in `src/index.ts`'s header comment.
