# bench-claude

Claude Code plugin to run benchmarks with [bench-node](https://github.com/RafaelGSS/bench-node) and generate reports.

I decided to use bench-node because it's a good tool for Node.js and I have been contributing to that

## Requirements

* Node.js >= 18.14
* [bench-node](https://github.com/RafaelGSS/bench-node) 0.1.0 or newer in your project -> `npm install --save-dev bench-node`
  * With 0.5.0 – 0.5.3 the report has no mean, p75, p99 and CV (these versions don't return the samples)

## Install

```
/plugin marketplace add gusanthiago/bench-claude
/plugin install bench-claude@gusanthiago
```

Only for one session, from a local copy:

```sh
git clone https://github.com/gusanthiago/bench-claude.git
claude --plugin-dir ./bench-claude
```

## How to use

* Run a benchmark file:

```
/bench-claude:bench benchmarks/parse.bench.mjs
```

* Or ask Claude to compare some code. Example: "which is faster, `structuredClone` or `JSON.parse(JSON.stringify(obj))`?"

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
* `node scripts/markers.mjs` -> lists the marked regions as JSON

## Reports

Each run creates 2 files in `bench-results/`:

* `<name>-<timestamp>.md` -> the report: environment, results table, t-test (with `ttest: true`) and the analysis from Claude
* `<name>-<timestamp>.json` -> raw results with all samples

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

## Development

Node.js 22.12 or newer (Vitest 5). `.nvmrc` uses Node.js 24.

```sh
nvm use
npm install
npm test          # unit tests + end-to-end tests with bench-node
npm run validate  # claude plugin validate .
```

### Structure

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

## License

[MIT](LICENSE)
