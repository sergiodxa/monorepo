use fs
use cli
use str
use spec

# The str capability is the language's only string composition: there is no `+`
# and no interpolation inside a literal, so a generated value reaches a URL, a
# heading or a query parameter through str.format and nowhere else. It is pure
# computation over its arguments — permissionless — so the cases below run and
# actually PASS with no grants.
#
# Most of format's design is what it REFUSES. A template and its arguments are
# written in two places and drift apart as a suite is edited, so every mismatch
# is an error naming both, rather than a hole silently left empty or an argument
# silently dropped. Those cases cannot be written here directly — a tool error
# fails the test it runs in — so each one writes a one-test suite into the
# workspace and runs the CLI over it, asserting on the message a person sees.

test "a positional hole is filled from the argument at its index" {
	given {
		# The value the template fills comes from a binding, read at the call
		# site as a dotted reference the way any generated value would be.
		let who = { username: "marta" }
	}
	when {
		let profile = format "/${0}" who.username
	}
	then {
		expect profile "/marta"
	}
}

test "an index names an argument, so holes may be written in any order" {
	when {
		# ${1} is the second value argument and ${0} the first, regardless of
		# where each hole sits in the template.
		let greeting = format "${1}, ${0}!" "world" "hello"
	}
	then {
		expect greeting "hello, world!"
	}
}

test "one argument fills every hole that names its index" {
	when {
		let doubled = format "${0}/${0}" "x"
	}
	then {
		expect doubled "x/x"
	}
}

test "a named hole is filled from the key of the same name" {
	given {
		let user = { slug: "team-a" }
	}
	when {
		# Named holes take a single object argument. Written this way the call
		# site says which value goes where, which a long positional list does not.
		let invite = format "/${slug}/invite" { slug: user.slug }
	}
	then {
		expect invite "/team-a/invite"
	}
}

test "a hole reads a tool inline, with no binding in between" {
	given {
		let who = { username: "marta" }
	}
	when {
		# A bare path whose head is not a binding is a call wherever an expression
		# may appear, so the value a tool observes reaches a hole directly. This is
		# what makes generated identity a single readable line.
		let slug = format "${name}-${nonce}" { name: who.username, nonce: spec.nonce }
		# Binding first still reads the same, because a bound head is always a
		# reference: `nonce` here is the binding, never the tool of that name.
		let nonce = spec.nonce
		let bound = format "${name}-${nonce}" { name: who.username, nonce: nonce }
	}
	then {
		expect slug bound
	}
}

test "values stringify the way JSON would, without the quotes" {
	when {
		# A number arrives as its decimal form and a boolean as true/false, so a
		# query string is composed from real values rather than from their text.
		let query = format "?page=${0}&all=${1}" 12 true
	}
	then {
		expect query "?page=12&all=true"
	}
}

test "a bare dollar is literal and {{ writes the two characters a hole opens with" {
	when {
		# Nothing about a `$` alone starts a hole, so prices and shell-looking
		# text need no escape. Where the output itself wants "${", write "{{".
		let price = format "costs $5"
		let literal = format "write {{name} for a hole"
	}
	then {
		expect price "costs $5"
		expect literal "write ${name} for a hole"
	}
}

test "a hole with no value names the hole and the template" {
	given {
		write "spec/missing-value.spec" """
			use str

			test "the second hole has no argument" {
				when {
					let path = format "/${0}/${1}" "only"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "found no value for the hole"
		output_contains result.stdout "${1}"
		output_contains result.stdout "/${0}/${1}"
	}
}

test "an argument no hole uses is refused rather than dropped" {
	given {
		write "spec/spare-argument.spec" """
			use str

			test "the second argument has no hole" {
				when {
					let path = format "/${0}" "used" "spare"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "argument no hole uses"
		output_contains result.stdout "spare"
	}
}

test "a key no hole uses is refused, naming the key" {
	given {
		write "spec/spare-key.spec" """
			use str

			test "the object carries a key the template never asks for" {
				when {
					let path = format "/${slug}" { slug: "team-a", extra: "b" }
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "key no hole uses"
		output_contains result.stdout "extra"
	}
}

test "mixing positional and named holes is refused, naming both" {
	given {
		write "spec/mixed-holes.spec" """
			use str

			test "one template, two ways of naming its holes" {
				when {
					let path = format "/${0}/${slug}" "a"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "mix positional and named holes"
		output_contains result.stdout "${0}"
		output_contains result.stdout "${slug}"
	}
}

test "null is an error naming the hole, never the text null" {
	given {
		# This is the case the strictness exists for: a nullable column that
		# stringified to "null" would compose a URL that looks real and is not.
		# Objects and arrays are refused the same way and for the same reason.
		# The language has no null literal, and needs none: a command body that
		# never returns produces null, which is exactly the shape a nullable
		# column arrives in.
		write "spec/null-value.spec" """
			use str

			command no_slug {
			}

			test "a hole is handed nothing" {
				when {
					let missing = no_slug
					let path = format "/u/${slug}" { slug: missing }
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "cannot write null into the hole"
		output_contains result.stdout "${slug}"
	}
}
