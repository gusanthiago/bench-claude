export const percentile = (sorted, p) => {
  if (sorted.length === 0) return undefined;
  if (p === 0) return sorted[0];
  return sorted[Math.ceil(sorted.length * (p / 100)) - 1];
};

export const mean = (values) => {
  if (values.length === 0) return undefined;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
};

export const coefficientOfVariation = (values) => {
  const avg = mean(values);
  if (values.length < 2 || avg === 0) return undefined;
  const variance = values.reduce((sum, value) => sum + (value - avg) ** 2, 0) / (values.length - 1);
  return (Math.sqrt(variance) / avg) * 100;
};

export const summarizeResult = (result) => {
  const samples = [...(result.histogram?.sampleData ?? [])].sort((a, b) => a - b);
  return {
    name: result.name,
    baseline: result.baseline === true,
    opsSec: result.opsSec,
    totalTime: result.totalTime,
    samples: result.histogram?.samples ?? samples.length,
    min: result.histogram?.min,
    max: result.histogram?.max,
    mean: mean(samples),
    p75: percentile(samples, 75),
    p99: percentile(samples, 99),
    cv: coefficientOfVariation(samples),
    significance: result.significance,
    pluginReports: (result.plugins ?? []).map((plugin) => plugin.report).filter(Boolean),
  };
};

// Higher is faster in both modes, so time mode inverts totalTime; 0 when the metric is missing.
const speed = (row, mode) => {
  const value = mode === 'ops' ? row?.opsSec : row?.totalTime;
  if (!(value > 0)) return 0;
  return mode === 'ops' ? value : 1 / value;
};

const compare = (row, reference, mode) => {
  if (!reference) return undefined;
  if (row === reference) return reference.baseline ? 'baseline' : 'fastest';
  const ratio = speed(row, mode) / speed(reference, mode);
  if (!(ratio > 0) || !Number.isFinite(ratio)) return undefined;
  return ratio >= 1 ? `${ratio.toFixed(2)}x faster` : `${(1 / ratio).toFixed(2)}x slower`;
};

export const summarizeSuite = (results) => {
  const rows = results.map(summarizeResult);
  const mode = rows.some((row) => row.opsSec !== undefined) ? 'ops' : 'time';
  const ranked = [...rows].sort((a, b) => speed(b, mode) - speed(a, mode));
  const reference = rows.find((row) => row.baseline) ?? (speed(ranked[0], mode) > 0 ? ranked[0] : undefined);
  return {
    mode,
    reference: reference && { name: reference.name, kind: reference.baseline ? 'baseline' : 'fastest' },
    rows: ranked.map((row) => ({ ...row, comparison: compare(row, reference, mode) })),
  };
};

export const summarizeRun = (run) => ({
  ...run,
  suites: run.suites.map((suite) => summarizeSuite(suite.results)),
});
