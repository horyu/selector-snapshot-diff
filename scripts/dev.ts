import { spawn, type ChildProcess } from 'node:child_process';

const pnpm = process.platform === 'win32' ? 'pnpm.exe' : 'pnpm';
const commands: ReadonlyArray<readonly [string, string[]]> = [
  [pnpm, ['--filter', '@selector-snapshot-diff/capture-gateway', 'dev']],
  [pnpm, ['exec', 'vite']],
];

const children: ChildProcess[] = commands.map(([command, args]) =>
  spawn(command, args, { stdio: 'inherit' })
);

const stop = (): void => {
  for (const child of children) child.kill();
};

process.once('SIGINT', stop);
process.once('SIGTERM', stop);

for (const child of children) {
  child.once('exit', (code) => {
    stop();
    process.exitCode = code ?? 1;
  });
}
