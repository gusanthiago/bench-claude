<h1 align="center">bench-claude</h1>

<p align="center">
  <strong>Ask Claude "which is faster?" and get a real benchmark, not a guess.</strong>
</p>

<p align="center">
  <a href="https://github.com/gusanthiago/bench-claude/tags"><img src="https://img.shields.io/badge/dynamic/json?url=https%3A%2F%2Fraw.githubusercontent.com%2Fgusanthiago%2Fbench-claude%2Fmain%2F.claude-plugin%2Fplugin.json&query=%24.version&label=version&style=flat" alt="Version"></a>
  <a href="LICENSE"><img src="https://img.shields.io/github/license/gusanthiago/bench-claude?style=flat" alt="License"></a>
  <a href="https://github.com/RafaelGSS/bench-node"><img src="https://img.shields.io/badge/built%20on-bench--node-339933?style=flat" alt="Built on bench-node"></a>
  <a href="https://claude.com/claude-code"><img src="https://img.shields.io/badge/Claude%20Code-plugin-D97757?style=flat" alt="Claude Code plugin"></a>
</p>

<p align="center">
  <a href="#install">Install</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#usage">Usage</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#markers">Markers</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#reports">Reports</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#what-it-runs">What it runs</a>&nbsp;&nbsp;&nbsp;|&nbsp;&nbsp;&nbsp;
  <a href="#development">Development</a>
</p>

Claude Code plugin to run benchmarks with [bench-node](https://github.com/RafaelGSS/bench-node) and generate reports.

I decided to use bench-node because it's a good tool for Node.js and I have been contributing to it.

## Install

Copy/paste into Claude Code:

```
/plugin marketplace add gusanthiago/bench-claude
/plugin install bench-claude@gusanthiago
```

You need:

* Node.js >= 18.14
* [bench-node](https://github.com/RafaelGSS/bench-node) 0.1.0 or newer in your project -> `npm install --save-dev bench-node`

## What changes

<table>
<tr>
<td width="50%">

### Before

> Write a benchmark file by hand. Run `node --allow-natives-syntax bench.js`. Copy the numbers from the terminal. Guess if 3% is a real win or just noise.

</td>
<td width="50%">

### After

> `/bench-claude:bench`
>
> 1. Claude writes the benchmark, with your code as the baseline
> 2. Runs it with bench-node
> 3. Saves a report with the results, the t-test and an analysis
>
> Next: open `bench-results/<name>-<timestamp>.md`.

</td>
</tr>
</table>

## Usage

Run a benchmark file:

```
/bench-claude:bench benchmarks/parse.bench.mjs
```

Or just ask Claude:

```
which is faster, structuredClone or JSON.parse(JSON.stringify(obj))?
```

A report from a real run (some columns hidden):

| Benchmark | ops/sec | Mean | CV | vs baseline | Significance |
| :-- | --: | --: | --: | :-- | :-- |
| single pass | 1,058,028 | 943.79 ns | 1.7% | 2.12x faster | `***` (p<0.001) |
| indexOf + slice | 948,499 | 1.04 µs | 2.2% | 1.90x faster | `***` (p<0.001) |
| parse-headers (current) | 498,333 | 1.97 µs | 2.0% | baseline | — |

## Markers

Put markers around the code that you want to benchmark:

```js
export const parseHeaders = (raw) => {
  // Start bench-claude: parse-headers
  const headers = {};
  for (const line of raw.split('\r\n')) {
    const [key, value] = line.split(': ');
    headers[key.toLowerCase()] = value;
  }
  // End bench-claude
  return headers;
};
```

* `/bench-claude:bench` -> benchmark all marked regions in the project
* `/bench-claude:bench src/http.js` -> only the regions in this file
* Claude writes `benchmarks/<name>.bench.mjs` -> your code is the baseline, plus 1–3 faster versions
* The name after `:` is optional. Without a name -> `<file>:<line>`
* The benchmark file changes only when your marked code changes
* Claude doesn't change your code. If a faster version wins, the report shows the change

## Reports

Each run creates 2 files in `bench-results/`:

* `<name>-<timestamp>.md` -> the report: environment, results table, t-test (with `ttest: true`) and the analysis from Claude
* `<name>-<timestamp>.json` -> raw results with all samples

With bench-node 0.5.0 – 0.5.3 the report has no mean, p75, p99 and CV (these versions don't return the samples).

## How it works

* `scripts/bench.mjs` runs the benchmark with `--allow-natives-syntax` and `--expose-gc`
* `scripts/capture.cjs` is loaded before the benchmark (`--require`) and saves the results of each `suite.run()`
* Works with your benchmark files as they are: any reporter, CommonJS or ESM
* If `capture.cjs` can't read the results, your benchmark still finishes and you see the error

## What it runs

Everything runs on your machine. The plugin doesn't send your data anywhere and doesn't download anything.

* `node` -> runs the benchmark file that you choose (your own code), with `--allow-natives-syntax`, `--expose-gc` and `--require scripts/capture.cjs`
* `git rev-parse` and `git status` -> add the commit and branch to the report
* `git ls-files` -> finds the files with markers
* Reads files in your project -> to find markers and write benchmarks
* Writes files in your project -> reports in `bench-results/`, benchmarks in `benchmarks/`
* If bench-node is missing, Claude asks you before it runs `npm install --save-dev bench-node`

## Update

```sh
claude plugin marketplace update gusanthiago
claude plugin update bench-claude@gusanthiago
```

## Development

Node.js 22.12 or newer (Vitest 5). `.nvmrc` uses Node.js 24.

```sh
nvm use
npm install
npm test          # unit tests + end-to-end tests with bench-node
npm run validate  # claude plugin validate .
```

Try a local copy for one session:

```sh
git clone https://github.com/gusanthiago/bench-claude.git
claude --plugin-dir ./bench-claude
```

<details>
<summary>Structure</summary>

* `.claude-plugin/plugin.json` -> plugin manifest
* `.claude-plugin/marketplace.json` -> marketplace, to install with `/plugin`
* `skills/bench/SKILL.md` -> the `/bench-claude:bench` skill
* `skills/bench/references/writing-benchmarks.md` -> guide that Claude reads before writing a benchmark
* `scripts/bench.mjs` -> runs the benchmark and writes the reports
* `scripts/capture.cjs` -> saves the `suite.run()` results
* `scripts/markers.mjs` -> finds the marked regions
* `scripts/regions.mjs` -> reads the markers in a file
* `scripts/summarize.mjs`, `scripts/render.mjs` -> stats and Markdown
* `scripts/utils.mjs` -> helpers
* `test/` -> tests and fixtures

</details>

## License

[MIT](LICENSE).

Star ⭐ if it saved you from writing one benchmark by hand.
