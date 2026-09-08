import readline from 'readline';
import path from 'path';
import fs from 'fs';
import { handleProtect } from '../commands/protect.js';
import { handleRestore } from '../commands/restore.js';
import { handleRun } from '../commands/run.js';
import { promptPassword } from './prompt.js';

const BANNER = `
\x1b[36m   ██████╗ ██████╗  ██████╗      ██████╗ ██████╗  ██████╗ ████████╗███████╗ ██████╗████████╗ ██████╗ ██████╗ 
   ██╔══██╗██╔══██╗██╔═══██╗    ██╔══██╗██╔══██╗██╔═══██╗╚══██╔══╝██╔════╝██╔════╝╚══██╔══╝██╔═══██╗██╔══██╗
   ██████╔╝██████╔╝██║   ██║    ██████╔╝██████╔╝██║   ██║   ██║   █████╗  ██║        ██║   ██║   ██║██████╔╝
   ██╔═══╝ ██╔══██╗██║   ██║    ██╔═══╝ ██╔══██╗██║   ██║   ██║   ██╔══╝  ██║        ██║   ██║   ██║██╔══██╗
   ██║     ██║  ██║╚██████╔╝    ██║     ██║  ██║╚██████╔╝   ██║   ███████╗╚██████╗   ██║   ╚██████╔╝██║  ██║
   ╚═╝     ╚═╝  ╚═╝ ╚═════╝     ╚═╝     ╚═╝  ╚═╝ ╚═════╝    ╚═╝   ╚══════╝ ╚═════╝   ╚═╝    ╚═════╝ ╚═╝  ╚═╝\x1b[0m
          \x1b[90m🔒 AES-256-GCM  •  🧠 In-Memory Execution  •  ⚡ Single-File Executable (Node.js)\x1b[0m
`;

/**
 * Prompts user for a text string with a default value
 * @param {string} query 
 * @param {string} defaultValue 
 * @returns {Promise<string>}
 */
export function promptText(query, defaultValue = '') {
  return new Promise((resolve) => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
    });

    const displayPrompt = defaultValue ? `${query} \x1b[90m(по умолчанию: ${defaultValue})\x1b[0m: ` : `${query}: `;

    rl.question(displayPrompt, (answer) => {
      rl.close();
      const result = answer.trim() || defaultValue;
      resolve(result);
    });
  });
}

/**
 * Renders an interactive terminal menu with Arrow Keys or Number selection
 * @param {Array<string>} items 
 * @returns {Promise<number>} selected index
 */
export function selectMenu(items) {
  return new Promise((resolve) => {
    let selected = 0;

    if (!process.stdin.isTTY) {
      // Non-interactive fallback
      items.forEach((item, i) => console.log(` [${i + 1}] ${item}`));
      const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
      rl.question('\nВыберите пункт (1-5): ', (ans) => {
        rl.close();
        const num = parseInt(ans.trim(), 10) - 1;
        resolve(num >= 0 && num < items.length ? num : 0);
      });
      return;
    }

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    function render(isFirst = false) {
      if (!isFirst) {
        // Move cursor up by items.length
        process.stdout.write(`\x1b[${items.length}A`);
      }
      for (let i = 0; i < items.length; i++) {
        if (i === selected) {
          process.stdout.write(`\x1b[2K  \x1b[1m\x1b[32m➔ ${items[i]}\x1b[0m\n`);
        } else {
          process.stdout.write(`\x1b[2K    \x1b[90m${items[i]}\x1b[0m\n`);
        }
      }
    }

    render(true);

    const onKey = (chunk) => {
      // Enter key
      if (chunk === '\r' || chunk === '\n' || chunk === '\u0004') {
        cleanup();
        resolve(selected);
        return;
      }

      // Ctrl+C
      if (chunk === '\u0003') {
        cleanup();
        process.stdout.write('\n\x1b[90mДо свидания!\x1b[0m\n');
        process.exit(0);
      }

      // Arrow Up
      if (chunk === '\u001b[A' || chunk === 'w' || chunk === 'W') {
        selected = (selected - 1 + items.length) % items.length;
        render();
        return;
      }

      // Arrow Down
      if (chunk === '\u001b[B' || chunk === 's' || chunk === 'S') {
        selected = (selected + 1) % items.length;
        render();
        return;
      }

      // Number keys 1-9
      const num = parseInt(chunk, 10);
      if (!isNaN(num) && num >= 1 && num <= items.length) {
        cleanup();
        resolve(num - 1);
        return;
      }
    };

    function cleanup() {
      process.stdin.setRawMode(wasRaw);
      process.stdin.pause();
      process.stdin.removeListener('data', onKey);
    }

    process.stdin.on('data', onKey);
  });
}

/**
 * Main Interactive Menu Loop
 */
export async function startInteractiveMenu() {
  while (true) {
    console.clear();
    console.log(BANNER);
    console.log('📌 \x1b[1mВыберите действие (стрелками ↑ / ↓ или цифрами 1-5):\x1b[0m\n');

    const menuItems = [
      '🔒 [1] Защитить проект (Protect) -> скомпилировать в dist/app.js',
      '🚀 [2] Запустить защищенный app.js в памяти (Run in RAM)',
      '🔓 [3] Восстановить исходный проект из app.js (Restore)',
      'ℹ️  [4] Справка и примеры команд (Help)',
      '🚪 [5] Выход (Exit)'
    ];

    const choice = await selectMenu(menuItems);
    console.log('');

    if (choice === 0) {
      // Protect
      console.log('\x1b[1m\x1b[36m=== 🔒 Защита проекта (Protect) ===\x1b[0m\n');
      const projectDir = await promptText('📂 Путь к папке проекта', './');
      const defaultOut = path.join(projectDir, 'dist', 'app.js');
      const outPath = await promptText('💾 Куда сохранить зашифрованный файл', defaultOut);
      const entry = await promptText('🎯 Точка входа (оставьте пустым для автоопределения)', '');

      console.log('');
      const password = await promptPassword('🔑 Задайте секретный пароль: ');
      if (!password) {
        console.log('\x1b[31m❌ Пароль не может быть пустым.\x1b[0m');
        await pause();
        continue;
      }
      const confirm = await promptPassword('🔑 Повторите пароль: ');
      if (password !== confirm) {
        console.log('\x1b[31m❌ Пароли не совпадают!\x1b[0m');
        await pause();
        continue;
      }

      console.log('');
      try {
        await handleProtect(projectDir, outPath, { password, entry: entry || null });
      } catch (e) {
        console.error(`\x1b[31mОшибка: ${e.message}\x1b[0m`);
      }
      await pause();

    } else if (choice === 1) {
      // Run in memory
      console.log('\x1b[1m\x1b[36m=== 🚀 Запуск в памяти (Run in RAM) ===\x1b[0m\n');
      const appJs = await promptText('📄 Путь к защищенному файлу', './dist/app.js');
      if (!fs.existsSync(path.resolve(appJs))) {
        console.log(`\x1b[31m❌ Файл "${appJs}" не найден.\x1b[0m`);
        await pause();
        continue;
      }

      console.log('');
      const password = await promptPassword('🔑 Введите пароль для расшифровки: ');
      console.log('\n\x1b[32m🚀 Запуск проекта в оперативной памяти...\x1b[0m\n');
      try {
        await handleRun(appJs, { password });
      } catch (e) {
        console.error(`\x1b[31mОшибка: ${e.message}\x1b[0m`);
      }
      await pause();

    } else if (choice === 2) {
      // Restore
      console.log('\x1b[1m\x1b[36m=== 🔓 Восстановление проекта (Restore) ===\x1b[0m\n');
      const appJs = await promptText('📄 Путь к защищенному файлу', './dist/app.js');
      const outDir = await promptText('📂 Папка для восстановления', './restored_project');

      console.log('');
      const password = await promptPassword('🔑 Введите пароль: ');
      console.log('');
      try {
        await handleRestore(appJs, outDir, { password });
      } catch (e) {
        console.error(`\x1b[31mОшибка: ${e.message}\x1b[0m`);
      }
      await pause();

    } else if (choice === 3) {
      // Help
      console.log(`
\x1b[1m\x1b[36m=== ℹ️ Справка и примеры использования ===\x1b[0m

1️⃣ \x1b[1mБыстрые команды из любого терминала:\x1b[0m
   $ protector protect ./my-project ./dist/app.js
   $ protector run ./dist/app.js
   $ protector restore ./dist/app.js ./my-project-restored

2️⃣ \x1b[1mПрямой запуск без CLI:\x1b[0m
   Сгенерированный файл \x1b[33m./dist/app.js\x1b[0m является полностью автономным!
   Его можно перенести на любой сервер/VPS и запустить напрямую:
   $ \x1b[32mnode ./dist/app.js\x1b[0m

3️⃣ \x1b[1mКак сделать команду глобальной:\x1b[0m
   В папке с проектом выполните:
   $ \x1b[32mnpm link\x1b[0m
   После этого команда \x1b[36mprotector\x1b[0m или \x1b[36mencrypter\x1b[0m будет доступна в любой папке системы!
`);
      await pause();

    } else if (choice === 4) {
      console.log('\x1b[90mДо свидания!\x1b[0m\n');
      process.exit(0);
    }
  }
}

function pause() {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('\n\x1b[90m[Нажмите Enter, чтобы продолжить...]\x1b[0m', () => {
      rl.close();
      resolve();
    });
  });
}
