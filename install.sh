#!/usr/bin/env bash
# ================================================================
#   Project Protector CLI - Linux & macOS Automated Installer
#   AES-256-GCM + scrypt In-Memory Executable Packager
# ================================================================

set -e

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
CYAN='\033[0;36m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${CYAN}================================================================${NC}"
echo -e "  🛡️  ${GREEN}PROJECT PROTECTOR CLI${NC} - Linux & macOS Installer"
echo -e "  AES-256-GCM + scrypt In-Memory Executable Packager"
echo -e "${CYAN}================================================================${NC}\n"

# 1. Check Node.js
echo -e "${CYAN}🔍 Checking Node.js environment...${NC}"
if ! command -v node >/dev/null 2>&1; then
    echo -e "${RED} [ERROR] Node.js is not installed!${NC}"
    echo -e " Please install Node.js (v20+ or v22+) first:"
    echo -e "   Ubuntu/Debian: curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash - && sudo apt-get install -y nodejs"
    echo -e "   macOS:         brew install node"
    exit 1
fi

NODE_VERSION=$(node -v)
echo -e " ${GREEN}[OK]${NC} Node.js detected: ${GREEN}${NODE_VERSION}${NC}"

# 2. Setup Target Directory
INSTALL_DIR="$HOME/.project-protector"
BIN_DIR="$HOME/.local/bin"
REPO_URL="${PROTECTOR_REPO_URL:-https://github.com/firdavsabdualiev/project-protector.git}"

echo -e "\n${CYAN}📁 Preparing installation directory: ${INSTALL_DIR}${NC}"
mkdir -p "$INSTALL_DIR"
mkdir -p "$BIN_DIR"

# 3. Clone or Update
if [ -d "$INSTALL_DIR/.git" ]; then
    echo -e "${CYAN}🔄 Updating existing installation...${NC}"
    cd "$INSTALL_DIR"
    git pull origin main --quiet || true
else
    echo -e "${CYAN}🌐 Downloading project from repository...${NC}"
    if command -v git >/dev/null 2>&1; then
        git clone --depth 1 "$REPO_URL" "$INSTALL_DIR" --quiet
    else
        echo -e "${CYAN}⬇️ Downloading tarball...${NC}"
        curl -fsSL https://github.com/firdavsabdualiev/project-protector/archive/refs/heads/main.tar.gz | tar -xz -C "$INSTALL_DIR" --strip-components=1
    fi
fi

# 4. Make CLI executable
CLI_PATH="$INSTALL_DIR/cli.js"
chmod +x "$CLI_PATH"

# 5. Create launcher symlinks
ln -sf "$CLI_PATH" "$BIN_DIR/protector"
ln -sf "$CLI_PATH" "$BIN_DIR/encrypter"

# If sudo is available and user wants global system link, try /usr/local/bin
if [ -w "/usr/local/bin" ]; then
    ln -sf "$CLI_PATH" "/usr/local/bin/protector" 2>/dev/null || true
    ln -sf "$CLI_PATH" "/usr/local/bin/encrypter" 2>/dev/null || true
fi

# 6. Check PATH
SHELL_CONFIG=""
if [ -n "$ZSH_VERSION" ] || [ -f "$HOME/.zshrc" ]; then
    SHELL_CONFIG="$HOME/.zshrc"
elif [ -f "$HOME/.bashrc" ]; then
    SHELL_CONFIG="$HOME/.bashrc"
elif [ -f "$HOME/.profile" ]; then
    SHELL_CONFIG="$HOME/.profile"
fi

if [[ ":$PATH:" != *":$BIN_DIR:"* ]]; then
    if [ -n "$SHELL_CONFIG" ]; then
        echo "export PATH=\"\$HOME/.local/bin:\$PATH\"" >> "$SHELL_CONFIG"
        echo -e " ${GREEN}[OK]${NC} Added ${BIN_DIR} to ${SHELL_CONFIG}"
    fi
    export PATH="$BIN_DIR:$PATH"
fi

# 7. Global npm link
cd "$INSTALL_DIR"
npm link --silent 2>/dev/null || true

echo -e "\n${GREEN}================================================================${NC}"
echo -e "  🎉 ${GREEN}PROJECT PROTECTOR CLI INSTALLED SUCCESSFULLY!${NC}"
echo -e "${GREEN}================================================================${NC}\n"
echo -e "  Quick Start Commands:"
echo -e "    ${CYAN}protector${NC}               # Launch Interactive TUI Menu"
echo -e "    ${CYAN}protector protect ./src${NC} # Encrypt project into single executable"
echo -e "    ${CYAN}protector run app.js${NC}    # Run encrypted project in-memory"
echo -e "    ${CYAN}protector restore app.js${NC}# Restore original project files\n"
