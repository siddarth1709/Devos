#!/usr/bin/env node
import { main } from '../dist/index.js';

main()
  .then((code) => {
    if (typeof code === 'number') {
      process.exit(code);
    }
  })
  .catch((err) => {
    process.stderr.write(`Error: ${err.message || String(err)}\n`);
    process.exit(2);
  });
