---
title: Copy the Whole Template Directory
impact: HIGH
tags: [bootstrap, files, template]
---

# Copy the Whole Template Directory

Create a new app by copying the entire `templates/app/` directory into `apps/<app-name>/`. Do not rebuild the template file-by-file.

## Why

- **Integrity**: The template includes the expected app structure, config, and support files
- **Speed**: Copying the directory is faster and less error-prone than recreating files manually
- **Parity**: Every new app starts from the same known baseline

## Pattern

```bash
# Good
cp -R templates/app apps/team-ops

# Bad
mkdir -p apps/team-ops
touch apps/team-ops/package.json
touch apps/team-ops/wrangler.jsonc
# Recreating files by hand drifts from the template
```

## Rules

1. Copy `templates/app/` as a whole into `apps/<app-name>/`
2. Preserve the template structure during bootstrapping
3. Replace placeholders after the copy instead of mutating the source template
