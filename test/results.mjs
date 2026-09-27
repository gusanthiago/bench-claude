export const opsResult = (name, opsSec, extra = {}) => {
  const ns = 1e9 / opsSec;
  return {
    name,
    opsSec,
    baseline: false,
    histogram: { samples: 3, min: ns, max: ns, sampleData: [ns, ns, ns] },
    plugins: [{ name: 'V8NeverOptimizePlugin', result: 'enabled', report: 'v8-never-optimize=true' }],
    ...extra,
  };
};

export const timeResult = (name, totalTime, extra = {}) => {
  const ns = totalTime * 1e9;
  return {
    name,
    totalTime,
    baseline: false,
    histogram: { samples: 1, min: ns, max: ns, sampleData: [ns] },
    plugins: [],
    ...extra,
  };
};
