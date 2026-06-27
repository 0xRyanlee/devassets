#!/usr/bin/env node
import { program } from './cli.js';

process.stdout.on('error', (err) => { if (err.code === 'EPIPE') process.exit(0); });

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
