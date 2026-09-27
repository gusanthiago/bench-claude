---
name: bench
description: Benchmark JavaScript/Node.js code with bench-node and write a Markdown report. Use when the user asks to benchmark code, measure or compare the performance of implementations ("which is faster?"), run an existing bench-node benchmark file, or benchmark code marked with `// Start bench-claude` and `// End bench-claude` comments.
argument-hint: "[file | what to benchmark]"
allowed-tools:
  - Read
  - Glob
  - Grep
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/bench.mjs" *)
  - Bash(node "${CLAUDE_PLUGIN_ROOT}/scripts/markers.mjs" *)
---

# bench-claude

Benchmark with [bench-node](https://github.com/RafaelGSS/bench-node) and turn the results into a Markdown report the user can commit.

Request: $ARGUMENTS

## Paths (substituted at invocation, use verbatim)

- Runner: `${CLAUDE_PLUGIN_ROOT}/scripts/bench.mjs`
- Marker finder: `${CLAUDE_PLUGIN_ROOT}/scripts/markers.mjs`
- Authoring guide: `${CLAUDE_SKILL_DIR}/references/writing-benchmarks.md`

## 1. Pick the benchmark

- **The request names a file.** If it has `// Start bench-claude` markers, benchmark its marked regions (below). Otherwise it's a benchmark file: use it as is and don't rewrite it.
- **The request describes code to compare.** Write a new benchmark. Read the authoring guide first.
  - Save it in the project's existing benchmark folder (`benchmarks/`, `benchmark/`, or `bench/`). Otherwise use `benchmarks/<topic>.bench.mjs`.
  - Match the project's module style (ESM or CommonJS).
  - Use one `Suite` per question, and mark the current implementation `baseline: true`.
  - Import the real code under test from the project instead of copying it.
- **No request.** If the conversation says what to benchmark, write that benchmark. Otherwise, benchmark all marked regions in the project (below).

### Marked regions

Users mark the code to benchmark like this (the name after `:` is optional):

```js
// Start bench-claude: parse-headers
…
// End bench-claude
```

1. Find the regions from the project root. Pass a file instead of `.` to read only that file.

   ```sh
   node "${CLAUDE_PLUGIN_ROOT}/scripts/markers.mjs" .
   ```

   It prints JSON with `regions` and `errors`. Each region has `name`, `file`, `start`, `end`, `code`, `benchmark` (the file to use), `header`, and `fresh`.
   - If there are `errors`, show them to the user and stop.
   - If there are no regions, tell the user how to add markers and stop.
2. If a region is `fresh`, its benchmark file is up to date. Don't rewrite it.
3. Otherwise, write the benchmark at the region's `benchmark` path. Follow the authoring guide, and:
   - Use the region's `header` as the exact first line. Its hash keeps the file `fresh` until the marked code changes.
   - Read the source around the region. Find the variables the code uses, and build realistic inputs for them at module scope.
   - Add the marked code, unchanged, as the `baseline` benchmark named `<name> (current)`. End the function with a `return` of the value the region produces, so the work isn't optimized away.
   - Add 1–3 alternatives that do the same work faster. If there's no real alternative, benchmark the current code alone and say so.
   - Assert once, outside the timed code, that every variant returns the same result.
4. Run each region's benchmark (step 2), one at a time.

## 2. Run it

Run it from the project root with a Bash timeout of 600000 ms, one benchmark at a time:

```sh
node "${CLAUDE_PLUGIN_ROOT}/scripts/bench.mjs" <benchmark-file>
```

- The runner adds `--allow-natives-syntax` and `--expose-gc`, and captures every `suite.run()` result whatever reporter the file uses. It writes `<name>-<timestamp>.md` and `<name>-<timestamp>.json` to `bench-results/`. Pass `--out-dir <dir>` to write them somewhere else.
- Don't check versions, or whether bench-node is installed, before running. The runner checks bench-node, and the report shows the Node.js, V8 and bench-node versions, the CPU, and the git commit.
- Don't run anything else heavy at the same time. Parallel work skews the numbers.
- If the runner says bench-node isn't installed, ask the user before adding it as a dev dependency with the project's package manager.
- If the benchmark throws, fix the benchmark file (not the code under test) and rerun.

## 3. Add the analysis

Read the generated `.md` report and append an `## Analysis` section to it:

- **Verdict:** which implementation is fastest and by how much. Quote the comparison column; don't recompute it.
- **Confidence:** if the report has a Significance column, cite the stars and p-values. If it doesn't, say this was a single run. For results within about 10% of each other, suggest rerunning with `ttest: true`.
- **Red flags:** call out any of these:
  - CV above about 10%
  - few samples
  - a wide min … max spread
  - a load average that's high relative to the CPU count
  - uncommitted changes in the Git line
  - dead code elimination warnings in the console output
- **Marked regions:** list the inputs you built. If an alternative wins, show the change for the marked code, but don't edit the user's code unless they ask.
- **Caveat:** these are microbenchmark numbers for this machine and Node.js version. By default bench-node's `V8NeverOptimizePlugin` keeps V8 from optimizing the benchmark function. The numbers show relative cost, not production latency.

Keep it short and factual.

## 4. Reply

Reply in 2–4 lines: the verdict, how confident the result is, and the report path.
