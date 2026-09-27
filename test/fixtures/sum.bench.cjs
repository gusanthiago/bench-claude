const { Suite } = require('bench-node');

const options = { minTime: 0.005, maxTime: 0.02 };

new Suite({ reporter: false })
  .add('for loop', { ...options, baseline: true }, () => {
    let sum = 0;
    for (let i = 0; i < 100; i++) sum += i;
    return sum;
  })
  .add('gauss formula', options, () => (99 * 100) / 2)
  .run();
