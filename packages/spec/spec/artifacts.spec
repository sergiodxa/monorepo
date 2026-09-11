use fs
use cli

# `--artifacts=DIR` is where a failure leaves what a person needs in order to
# see it: the document a lookup read, and under a browser the screenshot and
# accessibility-tree dump beside it. The report prints every path it wrote, so
# a failure noticed in CI is one `open` away from the evidence.
#
# These cases drive the `html` namespace because it needs neither a browser nor
# a grant, which makes the evidence exact and the run cheap. The directory is
# resolved against the working directory the run starts in — the workspace of
# the outer test below — so the file the inner run writes is readable here.
#
# These are meta-tests: each writes an inner one-file suite, runs the real
# `spec` CLI against it as a child, and asserts on the child's exit and output.

test "a failing lookup leaves the document it read under the artifacts directory" {
	given {
		write "spec/artifacts-html.spec" """
			use html

			test "the page carries a Save button" {
				then {
					expect html.button "<html><body><button>Cancel</button></body></html>" "Save"
				}
			}
		"""
	}
	when {
		# An artifact is named after the attempt that wrote it, so naming the
		# run makes the file name something this test can state outright rather
		# than glob for.
		let result = run "spec" "run" "spec" "--artifacts=artifacts" "--run-id=evidence"
	}
	then {
		expect result.exit_code 1
		output_contains result.stdout "Wrote:"
		output_contains result.stdout "html-button-evidence-1.html"
		# The dump is the document as the lookup saw it, which is what turns
		# "no button named Save" into a diagnosis.
		expect file "artifacts/html-button-evidence-1.html" contains "<button>Cancel</button>"
	}
}

# Artifacts are evidence of a failure, so a run with nothing to explain writes
# none — the directory a passing run was pointed at stays uncreated.

test "a passing run writes no artifacts at all" {
	given {
		write "spec/artifacts-pass.spec" """
			use html

			test "the page carries a Cancel button" {
				then {
					expect html.button "<html><body><button>Cancel</button></body></html>" "Cancel"
				}
			}
		"""
	}
	when {
		let result = run "spec" "run" "spec" "--artifacts=artifacts"
	}
	then {
		expect result.exit_code 0
		expect not directory "artifacts" exists
	}
}
