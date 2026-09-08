#!/usr/bin/env node
import { handleProtect } from './commands/protect.js';
import { handleRestore } from './commands/restore.js';
import { handleRun } from './commands/run.js';
import { startInteractiveMenu } from './lib/menu.js';

const VERSION = '1.0.0';

function printHelp() {
  console.log(`
🛡️  \x1b[1m\x1b[36mProject Protector CLI\x1b[0m (v${VERSION})
Converts any JavaScript project into an encrypted standalone executable (AES-256-GCM + scrypt)

\x1b[1mUSAGE:\x1b[0m
  $ protector                           \x1b[90m# Open interactive TUI menu\x1b[0m
  $ protector <command> [arguments] [options]

\x1b[1mCOMMANDS:\x1b[0m
  \x1b[33mprotect\x1b[0m <project-dir> [output-file]   Compress and encrypt a project into app.js
  \x1b[33mrestore\x1b[0m <app.js> [output-dir]        Decrypt and restore original project files
  \x1b[33mrun\x1b[0m     <app.js>                     Decrypt and execute project purely in memory
  \x1b[33mmenu\x1b[0m                                 Launch the interactive visual TUI menu

\x1b[1mOPTIONS:\x1b[0m
  \x1b[32m--entry\x1b[0m, \x1b[32m-e\x1b[0m <file>                 Specify entry point file (e.g. src/index.js)
  \x1b[32m--password\x1b[0m, \x1b[32m-p\x1b[0m <pass>             Provide password via argument / script
  \x1b[32m--help\x1b[0m, \x1b[32m-h\x1b[0m                        Display this help menu
  \x1b[32m--version\x1b[0m, \x1b[32m-v\x1b[0m                     Display version

\x1b[1mEXAMPLES:\x1b[0m
  $ protector
  $ protector protect ./my-api ./dist/app.js
  $ protector restore ./dist/app.js ./restored-api
  $ protector run ./dist/app.js
  $ node ./dist/app.js                       \x1b[90m# Run standalone without protector installed!\x1b[0m
`);
}

async function main() {
  const args = process.argv.slice(2);

  // If no arguments passed or 'menu' command -> launch interactive TUI menu
  if (args.length === 0 || args[0] === 'menu' || args[0] === '--menu') {
    await startInteractiveMenu();
    return;
  }

  if (args.includes('--help') || args.includes('-h')) {
    printHelp();
    process.exit(0);
  }

  if (args.includes('--version') || args.includes('-v')) {
    console.log(`v${VERSION}`);
    process.exit(0);
  }

  const command = args[0];
  const positionals = [];
  const options = {};

  for (let i = 1; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--entry' || arg === '-e') {
      options.entry = args[++i];
    } else if (arg.startsWith('--entry=')) {
      options.entry = arg.slice(8);
    } else if (arg === '--password' || arg === '-p') {
      options.password = args[++i];
    } else if (arg.startsWith('--password=')) {
      options.password = arg.slice(11);
    } else if (!arg.startsWith('-')) {
      positionals.push(arg);
    }
  }

  try {
    switch (command) {
      case 'protect':
        await handleProtect(positionals[0], positionals[1], options);
        break;

      case 'restore':
        await handleRestore(positionals[0], positionals[1], options);
        break;

      case 'run':
        await handleRun(positionals[0], options);
        break;

      default:
        console.error(`\x1b[31mUnknown command: "${command}"\x1b[0m`);
        printHelp();
        process.exit(1);
    }
  } catch (err) {
    console.error(`\x1b[31mError: ${err.message}\x1b[0m`);
    process.exit(1);
  }
}

main();
