#!/bin/bash

set -e

bunx oxfmt . || exit 1
bunx oxlint --fix . || exit 1
bunx tsgo || exit 1
