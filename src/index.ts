#!/usr/bin/env node
import { program } from './cli.js';

program.parseAsync(process.argv).catch(err => {
  console.error(err);
  process.exit(1);
});
