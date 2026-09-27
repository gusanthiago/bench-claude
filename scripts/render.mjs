const DASH = '—';

export const formatNumber = (value) => {
  if (value === undefined) return DASH;
  return new Intl.NumberFormat('en-US', { maximumFractionDigits: value < 100 ? 2 : 0 }).format(value);
};

export const formatDuration = (ns) => {
  if (ns === undefined || Number.isNaN(ns)) return DASH;
  if (ns < 1e3) return `${ns.toFixed(2)} ns`;
  if (ns < 1e6) return `${(ns / 1e3).toFixed(2)} µs`;
  if (ns < 1e9) return `${(ns / 1e6).toFixed(2)} ms`;
  return `${(ns / 1e9).toFixed(2)} s`;
};

export const formatPercent = (value) => (value === undefined ? DASH : `${value.toFixed(1)}%`);

const formatGit = (git) => {
  if (!git) return DASH;
  return `\`${git.commit}\` on \`${git.branch}\`${git.dirty ? ' (uncommitted changes)' : ''}`;
};

const formatSignificance = ({ significance }) => {
  if (!significance) return DASH;
  const p = significance.pValue < 0.001 ? 'p<0.001' : `p=${significance.pValue.toFixed(3)}`;
  return significance.significant ? `\`${significance.stars}\` (${p})` : `not significant (${p})`;
};

const escapeCell = (text) => String(text).replaceAll('|', '\\|').replaceAll('\n', ' ');

const minMax = (row) => `${formatDuration(row.min)} … ${formatDuration(row.max)}`;

const opsColumns = () => [
  ['Benchmark', 'left', (row) => row.name],
  ['ops/sec', 'right', (row) => formatNumber(row.opsSec)],
  ['Mean', 'right', (row) => formatDuration(row.mean)],
  ['p75', 'right', (row) => formatDuration(row.p75)],
  ['p99', 'right', (row) => formatDuration(row.p99)],
  ['Min … Max', 'right', minMax],
  ['CV', 'right', (row) => formatPercent(row.cv)],
  ['Samples', 'right', (row) => formatNumber(row.samples)],
];

const timeColumns = () => [
  ['Benchmark', 'left', (row) => row.name],
  ['Time', 'right', (row) => formatDuration(row.totalTime * 1e9)],
  ['Min … Max', 'right', minMax],
  ['Samples', 'right', (row) => formatNumber(row.samples)],
];

const renderTable = (columns, rows) => {
  const line = (cells) => `| ${cells.join(' | ')} |`;
  return [
    line(columns.map(([title]) => title)),
    line(columns.map(([, align]) => (align === 'right' ? '--:' : ':--'))),
    ...rows.map((row) => line(columns.map(([, , cell]) => escapeCell(cell(row))))),
  ];
};

const renderPluginReports = (rows) => {
  const reports = rows.map((row) => row.pluginReports.join(', '));
  if (reports.every((report) => report === '')) return [];
  if (reports.every((report) => report === reports[0])) return ['', `Plugins: ${reports[0]}`];
  return ['', 'Plugins:', ...rows.flatMap((row, i) => (reports[i] ? [`- ${row.name}: ${reports[i]}`] : []))];
};

const renderEnvironment = ({ startedAt, durationMs, environment: env }) => [
  `- **Date:** ${startedAt.slice(0, 19).replace('T', ' ')} UTC`,
  `- **Node.js:** ${env.node} (V8 ${env.v8})`,
  `- **bench-node:** ${env.benchNode ?? DASH}`,
  `- **Platform:** ${env.platform} ${env.arch} (${env.release})`,
  `- **CPU:** ${env.cpu} × ${env.cpus}`,
  `- **Memory:** ${Math.round(env.memoryBytes / 1024 ** 3)} GB`,
  `- **Load average (1 min):** ${env.loadAverage.toFixed(2)}`,
  `- **Git:** ${formatGit(env.git)}`,
  `- **Duration:** ${formatDuration(durationMs * 1e6)}`,
];

const renderSuite = (suite) => {
  const columns = suite.mode === 'ops' ? opsColumns() : timeColumns();
  columns.push([suite.reference ? `vs ${suite.reference.kind}` : 'Comparison', 'left', (row) => row.comparison ?? DASH]);
  const tested = suite.rows.find((row) => row.significance);
  if (tested) columns.push(['Significance', 'left', formatSignificance]);

  const lines = renderTable(columns, suite.rows);
  if (tested) {
    lines.push(
      '',
      `Significance: Welch's t-test against the baseline over 30+ runs (α = ${tested.significance.alpha}). \`*\` p<0.05, \`**\` p<0.01, \`***\` p<0.001.`,
    );
  }
  lines.push(...renderPluginReports(suite.rows));
  return lines;
};

export const renderMarkdown = (run) => {
  const lines = [`# Benchmark report: \`${run.file}\``, '', ...renderEnvironment(run)];
  run.suites.forEach((suite, index) => {
    const title = run.suites.length > 1 ? `Suite ${index + 1} of ${run.suites.length}` : 'Results';
    lines.push('', `## ${title}`, '', ...renderSuite(suite));
  });
  return `${lines.join('\n')}\n`;
};
