# Writing bench-node benchmarks

This is condensed from the [bench-node README](https://github.com/RafaelGSS/bench-node#readme). When in doubt, check the installed version's README at `node_modules/bench-node/README.md`.

## Skeleton

```js
// benchmarks/includes-vs-indexof.bench.mjs
import assert from 'node:assert';
import { Suite } from 'bench-node';

const list = Array.from({ length: 1_000 }, (_, i) => i);
assert.strictEqual(list.includes(999), list.indexOf(999) !== -1);

const suite = new Suite();

suite
  .add('Array#includes', { baseline: true }, () => list.includes(999))
  .add('Array#indexOf', () => list.indexOf(999) !== -1);

await suite.run();
```

In CommonJS, use `const { Suite } = require('bench-node');` and end the file with `suite.run();`.

## Suite options (`new Suite(options)`)

| Option | Default | Use |
| :-- | :-- | :-- |
| `ttest` | `false` | Runs Welch's t-test against the baseline and sets `repeatSuite` to 30. |
| `repeatSuite` | `1` (`30` with `ttest`) | Independent repeats per benchmark. |
| `minSamples` | `10` | Minimum samples per round. |
| `benchmarkMode` | `'ops'` | Set `'time'` to time one execution per repeat (reported as `totalTime`). |
| `plugins` | `[new V8NeverOptimizePlugin()]` | Also available: `MemoryPlugin`, `V8GetOptimizationStatus`, `V8OptimizeOnNextCallPlugin`. |
| `detectDeadCodeElimination` | `false` | Warns when a benchmark is about as fast as an empty function. It drops the default plugin so V8 optimizes normally. Works in `ops` mode only, and not with workers. |
| `useWorkers` | `false` | Runs each benchmark in its own worker thread (experimental). |
| `reporter` | `textReport` | Keep the default. The runner captures what `suite.run()` resolves with, whatever the reporter. |

## Benchmark options (`suite.add(name, [options], fn)`)

- `baseline`: mark the reference implementation. Only one per suite; adding a second throws.
- `minTime`: `0.05` s.
- `maxTime`: `0.5` s.
- `repeatSuite` and `minSamples`: override the suite-level values.

## Rules

1. **Measure one thing.** Build inputs once at module scope, sized like real workloads. Keep setup out of `fn` unless creating the input is part of what's measured.
2. **Consume the result.** Return the value from `fn`. The default `V8NeverOptimizePlugin` passes it to `DoNotOptimize`, so V8 can't eliminate the work. With `detectDeadCodeElimination` that plugin is off, so also use the value, for example by throwing when it's wrong.
3. **Same work in every variant.** Use the same inputs and expect the same output; only the implementation should differ. Assert once, outside the timed code, that the variants agree.
4. **Mark a baseline.** Make the current implementation `baseline: true` so each row reads as "x faster/slower than today".
5. **Close result? Use `ttest: true`.** A single run can't tell a few percent apart from noise.
6. **Per-iteration setup: use the managed timer.**

   ```js
   suite.add('readFileSync', (timer) => {
     const file = createFixture();
     timer.start();
     for (let i = 0; i < timer.count; i++) {
       const data = readFileSync(file, 'utf8');
       assert.ok(data);
     }
     timer.end(timer.count);
     rmSync(file);
   });
   ```

   - Always call `timer.start()` and `timer.end(n)`. Otherwise bench-node throws `ERR_BENCHMARK_MISSING_OPERATION`.
   - Consume the value inside the loop. `DoNotOptimize` only sees the function's return value.
   - Setup inside a timed function is deoptimized too, so don't compare managed variants with unmanaged ones.
7. **Async works.** bench-node awaits `async () => { await work(); }`.
8. **Costly single operations: use `benchmarkMode: 'time'`.** Add `repeatSuite` to average several runs.
9. **Workers (`useWorkers: true`) re-create `fn` from its source text.** Rule 1's module-scope inputs don't apply here:
   - Don't close over outer variables; require or import inside the body instead.
   - Use a block body `{ ... }`.
   - Name the timer parameter `timer`.

Keep benchmark names short and distinct; each one becomes a row in the report.
