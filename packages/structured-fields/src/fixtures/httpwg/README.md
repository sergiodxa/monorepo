# httpwg structured-field-tests

The HTTP working group's conformance suite for RFC 9651 Structured Field Values, vendored so
`src/conformance.test.ts` runs offline and an upstream change arrives as a reviewed update.

- Source: <https://github.com/httpwg/structured-field-tests>
- Commit: `00462dd7938b43bf596cb2af6a373d9c928a6cbe` (2026-09-16)
- License: BSD 3-Clause, IETF Trust, in [LICENSE.md](./LICENSE.md)

Every top-level `*.json` file and the `serialisation-tests/` directory are copied, then laid out
by the repo formatter (`vp fmt`), which changes whitespace only. The upstream `generate.py`,
`schema/` and CI files are left out, since nothing here runs them.

To refresh, clone the repository at a newer commit, copy the same files over these, update the
commit above, run `vp fmt packages/structured-fields`, and run `vp test run packages/structured-fields`.
