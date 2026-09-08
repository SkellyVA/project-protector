# 🛡️ Project Protector CLI (`protector` / `encrypter`)

[![Node.js Version](https://img.shields.io/badge/node-%3E%3D20.0.0-brightgreen.svg)](https://nodejs.org/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![Zero Dependencies](https://img.shields.io/badge/dependencies-0-success.svg)]()
[![Security: AES-256-GCM](https://img.shields.io/badge/security-AES--256--GCM-red.svg)]()

> Production-ready Node.js CLI that protects any JavaScript project (ESM or CommonJS) by compiling it into an encrypted standalone executable (`app.js`) with **100% in-memory execution** (zero files written to disk), interactive TUI menu, and lossless restoration.

---

## ⚡ 1-Line Quick Installation

### 🪟 Windows (PowerShell)
Run in PowerShell (as Administrator or Standard User):
```powershell
irm https://raw.githubusercontent.com/SkellyVA/project-protector/main/install.ps1 | iex
```

### 🐧 Linux & 🍎 macOS (Bash / Zsh)
Run in your terminal:
```bash
curl -fsSL https://raw.githubusercontent.com/SkellyVA/project-protector/main/install.sh | bash
```

### 📦 Global NPM Install
```bash
npm install -g https://github.com/SkellyVA/project-protector.git
```

Once installed, the commands `protector` and `encrypter` are available globally across your entire system!

---

## 🌟 Key Features

* **🔒 Military-Grade Encryption**: **AES-256-GCM** with authenticated 128-bit integrity tags and **scrypt** key derivation ($N=16384$).
* **⚡ Standalone Executable (`dist/app.js`)**: Packs an entire multi-file project (JS/ESM/CJS, JSON configs, binary assets, `.env`) into a single file.
* **🧠 100% In-Memory VM Execution**: Executes virtual files directly inside RAM using Node's `vm` loader. **Never writes decrypted files to disk**.
* **✨ Beautiful Interactive TUI Menu**: Launch simply by typing `protector` — choose actions, select files, and configure options visually.
* **📦 Smart First-Run Dependency Installer**: If executed on a fresh VPS/machine, automatically downloads missing npm packages into `node_modules` before launching.
* **🔑 Encrypted Environment Variables**: Safely packages `.env` into encrypted RAM and auto-injects variables into `process.env` at startup.
* **🔓 Exact Project Restoration**: The `restore` command recreates the original directory and file hierarchy byte-for-byte with the secret password.
* **🚫 Zero External Runtime Dependencies**: Built 100% on Node.js standard libraries (`crypto`, `fs`, `zlib`, `path`, `vm`, `module`, `readline`).

---

## 🎮 Interactive Visual TUI Menu

Simply type `protector` or `encrypter` without arguments:

```bash
protector
```

```
============================================================
  🛡️  PROJECT PROTECTOR (v1.0.0)
  AES-256-GCM + scrypt In-Memory Executable Packager
============================================================

? Select an action:
  ❯ 🔒 Protect a Project (Compress & Encrypt to app.js)
    🚀 Run Protected Executable (In-Memory Execution)
    🔓 Restore Original Project Files
    ℹ️  View Help & Documentation
    🚪 Exit
```

---

## 💻 CLI Commands

### 1. 🔒 `protect` (Encrypt a project)

```bash
# Interactive mode (prompts for directory and password with masked input)
protector protect ./my-project ./dist/app.js

# Custom entry point
protector protect ./my-project ./dist/app.js --entry src/server.js

# Pass password non-interactively (ideal for CI/CD or build scripts)
protector protect ./my-project ./dist/app.js --password "MySecretPass123!"
```

### 2. 🚀 `run` (Execute in memory)

```bash
# Run via CLI
protector run ./dist/app.js

# OR run standalone directly with Node.js on ANY server/VPS!
node ./dist/app.js
```
*(Prompts for password, decrypts payload into RAM, loads `.env`, and executes without touching the disk)*

### 3. 🔓 `restore` (Extract original source code)

```bash
# Restore project to target folder
protector restore ./dist/app.js ./restored-project
```

---

## 🏗️ Architecture & Security

```
Original Project Source
├── package.json
├── .env
├── src/index.js
└── src/utils/helper.js
       │
       ▼  (Serialize & Brotli Compress)
  Raw Buffer
       │
       ▼  (scrypt Key Derivation + AES-256-GCM)
  Encrypted Container
       │
       ▼  (Combined with In-Memory ESM/CJS Loader Bootstrap)
Single Standalone dist/app.js
```

### Security Specifications

| Property | Value |
| :--- | :--- |
| **Cipher** | `AES-256-GCM` (Galois/Counter Mode) |
| **Authentication Tag** | 128-bit GCM MAC tag (detects tampering/corruption) |
| **Key Derivation** | `scrypt` ($N=16384, r=8, p=1, \text{maxmem}=32\text{MB}$) |
| **Salt / IV** | 128-bit Salt + 96-bit unique random IV per build |
| **Memory Security** | Key buffers are wiped (`key.fill(0)`) immediately |
| **Disk Security** | Decrypted files are never saved to disk during `run` |

---

## 🧪 Automated Test Suite

Run full automated verification tests (covers ESM packing, decryption validation, in-memory execution, and byte-for-byte lossless restoration):

```bash
npm test
```

---

## 📄 License

MIT License © 2026
