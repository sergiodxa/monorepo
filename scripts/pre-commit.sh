#!/bin/bash

set -e

bunx oxfmt --check . || {
  echo "❌ Formatting issues found. Run 'bunx oxfmt .' to fix."
  exit 1
}

bunx oxlint . || {
  echo "❌ Linting issues found. Run 'bunx oxlint --fix .' to fix."
  exit 1
}

bunx tsgo || {
  echo "❌ Type checking failed."
  exit 1
}
