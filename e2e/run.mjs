// Convenience runner: builds, then runs the browser tests with the node test runner.
import { spawnSync } from 'node:child_process';
const run = (cmd, args) => { const r = spawnSync(cmd, args, { stdio: 'inherit' }); if (r.status) process.exit(r.status); };
run('npm', ['run', 'build']);
run('node', ['--test', '--test-concurrency=1', 'e2e/jenderal.e2e.mjs']);
