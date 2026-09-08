import readline from 'readline';

/**
 * Prompts user for a password in the terminal with masked asterisks or hidden input
 * @param {string} query Prompt message
 * @param {boolean} mask If true, prints '*' for each character; if false, completely silent
 * @returns {Promise<string>}
 */
export function promptPassword(query = 'Enter secret password: ', mask = true) {
  return new Promise((resolve) => {
    // If standard input is not a TTY (e.g. piped input or automated test)
    if (!process.stdin.isTTY) {
      const rl = readline.createInterface({
        input: process.stdin,
        output: process.stdout,
        terminal: false,
      });
      rl.question(query, (answer) => {
        rl.close();
        resolve(answer.trim());
      });
      return;
    }

    process.stdout.write(query);
    let password = '';

    const wasRaw = process.stdin.isRaw;
    process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');

    const onData = (chunk) => {
      for (const char of chunk) {
        // Enter / Return key
        if (char === '\r' || char === '\n' || char === '\u0004') {
          process.stdin.setRawMode(wasRaw);
          process.stdin.pause();
          process.stdin.removeListener('data', onData);
          process.stdout.write('\n');
          resolve(password);
          return;
        }

        // Ctrl+C (SIGINT)
        if (char === '\u0003') {
          process.stdin.setRawMode(wasRaw);
          process.stdout.write('\n');
          process.exit(130);
        }

        // Backspace / Delete
        if (char === '\u0008' || char === '\u007f') {
          if (password.length > 0) {
            password = password.slice(0, -1);
            if (mask) {
              process.stdout.write('\b \b');
            }
          }
        } else if (char.charCodeAt(0) >= 32) {
          // Printable characters
          password += char;
          if (mask) {
            process.stdout.write('*');
          }
        }
      }
    };

    process.stdin.on('data', onData);
  });
}
