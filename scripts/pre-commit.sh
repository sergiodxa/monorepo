#!/bin/bash

set -e

bunx oxfmt --check . || exit 1
bunx oxlint . || exit 1
bunx tsgo || exit 1
