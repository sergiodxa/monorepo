#!/bin/bash

set -e

bunx oxfmt --check || {
  echo "❌ Formatting issues found. Run 'bun format:fix' to fix."
  exit 1
}

bun lint || {
  echo "❌ Linting issues found. Run 'bun lint:fix' to fix."
  exit 1
}

bun typecheck || {
  echo "❌ Type checking failed."
  exit 1
}

bun test || {
  echo "❌ Tests failed."
  exit 1
}
