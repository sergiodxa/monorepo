use cli

# The process-execution capability, exercised directly (no child `spec`). These
# tests run `echo` — POSIX-stable, present everywhere — so the dogfood run must
# grant it: the wrapper in src/dogfood.test.ts and the gate invocation both pass
# --allow-run=spec,echo. `spec` is granted for the meta suites; `echo` is granted
# for this one. Everything here observes cli.run's result shape directly, so it
# is fast and CI-safe.

test "run captures stdout and a zero exit code" {
	when {
		let result = run "echo" "hello"
	}
	then {
		# echo writes its argument and a trailing newline, then exits 0.
		expect result.exit_code 0
		expect result.stdout "hello\n"
	}
}

test "a non-zero exit is reported verbatim" {
	when {
		# `spec` against a missing suite directory exits 2 (a load error): a
		# stable way to observe a non-zero exit using only the granted
		# executables, since `echo` always succeeds. The child resolves the
		# missing directory against its fresh, empty workspace.
		let result = run "spec" "run" "no-such-suite-directory"
	}
	then {
		expect result.exit_code 2
	}
}
