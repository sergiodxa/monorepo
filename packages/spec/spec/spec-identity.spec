use fs
use cli
use str
use spec

# Generated data is deterministic on purpose: the same seed draws the same
# values every run, which is what makes a failure reproducible. That collides
# with a persistent database the moment a suite inserts a row under a unique
# constraint, because the second run inserts the same email again.
#
# The spec capability is the seam. It reports what THIS run and THIS attempt are
# called, and a suite composes that into the one value that must not reproduce —
# an identifier — leaving every sample draw untouched. The three tools read an
# identity the runner already fixed, so they generate nothing, are pure reads,
# and need no grants.

test "the nonce is the run id joined to the attempt" {
	when {
		let unique = spec.nonce
		# Composing the nonce by hand is the definition restated, which is the
		# point: a spec can build its own variants of it the same way. An identity
		# tool is read where its value is wanted — a bare path whose head is not a
		# binding is a call wherever an expression may appear — so neither piece
		# needs a line of its own.
		let composed = format "${id}-${n}" { id: spec.run_id, n: spec.attempt }
	}
	then {
		expect unique composed
	}
}

test "two reads of the nonce within one test agree" {
	when {
		# Unlike a sample draw, reading the nonce advances nothing: it is one
		# value for the attempt, so a spec may compose it into as many
		# identifiers as it needs and they all share the same suffix.
		#
		# Bound under names that do not collide with the imported run_id/attempt/
		# nonce tools: a bare name that is both a binding and a tool is ambiguous.
		let first = spec.nonce
		let second = spec.nonce
	}
	then {
		expect first second
	}
}

test "the attempt counts from 1, so a run with no retries is on attempt 1" {
	when {
		let try_number = spec.attempt
	}
	then {
		# The suite's own run passes no --retries, so this test is on its first
		# and only attempt. Under --retries the number moves and the nonce with
		# it, which is what keeps a retry's inserts clean.
		expect try_number 1
	}
}

test "the run id is stable across the tools that report it" {
	when {
		let unique = spec.nonce
		let expected = format "${id}-1" { id: spec.run_id }
	}
	then {
		# Two tests on the same attempt share one nonce, which is safe because
		# their sample streams are keyed on test identity — and it is what makes
		# rows left behind greppable by a single run id.
		expect unique expected
	}
}

test "an identity tool asserts the value it reads" {
	# Called bare, an identity tool observes its value; handed one, it asserts
	# equality — the convention every reading observable follows, so a run's
	# identity is assertable without binding it first.
	then {
		expect spec.attempt 1
	}
}

test "the identity tools take one argument at most" {
	given {
		write "spec/nonce-arguments.spec" """
			use spec

			test "there is nothing for a second argument to select" {
				when {
					let unique = spec.nonce "extra" "more"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "spec.nonce takes at most one argument"
	}
}
