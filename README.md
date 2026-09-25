# Tradebook

Tradebook is a private, local-first trading journal and performance tracking Progressive Web Application (PWA). Built for disciplined traders, it provides comprehensive trade logging, execution analysis, multi-account tracking, and a hardened prop firm evaluation rule engine—running entirely inside your web browser.

---

## Core Identity

- **Private & Local-First**: All data is stored directly in your browser using IndexedDB. No external servers or telemetry.
- **Offline-Capable PWA**: Fully functional offline; installable directly to your desktop or mobile home screen.
- **IndexedDB-Based Persistence**: Powered by Dexie.js for high-performance, structured local storage.
- **Zero Cloud or AI Dependencies**:
  - No backend server
  - No user accounts or authentication required
  - No broker connection or API credentials
  - No MetaTrader 4/5 (MT4/MT5) or cTrader bridge
  - No live market data or websocket feeds
  - No Gemini or third-party AI APIs
  - No cloud database or automatic cloud synchronization
- **User as the Source of Truth**: The trader retains 100% control, privacy, and ownership of all trade records and operational parameters.

---

## Core Principles

1. **Strict Privacy & Data Ownership**: Your trading records, financial balances, notes, and screenshots never leave your local machine unless you choose to export them.
2. **Honest Mathematical Calculations**: Accurate computation of realized P&L, multi-tier profit factor, mathematical expectancy, R-multiples, and currency isolation (currencies are never erroneously mixed or converted without explicit user input).
3. **Non-Advising, Descriptive Design**: Tradebook is a self-reflection and analytical tool. It never provides financial advice, trading signals, or automated execution.
4. **Structured Rule Engine**: Prop firm evaluation parameters (Daily Loss Limits, Max Overall Drawdown, Trailing High-Water-Mark Drawdown, Profit Targets, Minimum Trading Days) are evaluated strictly through structured machine-readable identifiers rather than fragile display strings. Unsupported constraints (e.g., news windows, holding policies) truthfully display their un-evaluable status rather than presenting false passes or fails.

---

## Architecture

Tradebook is built with a modern, lightweight, client-side stack:

- **Framework**: [React 19](https://react.dev/) + [TypeScript](https://www.typescriptlang.org/)
- **Build Tool**: [Vite](https://vitejs.dev/)
- **Local Database**: [Dexie.js](https://dexie.org/) (Structured IndexedDB wrapper with versioned schema migrations)
- **Styling**: [Tailwind CSS](https://tailwindcss.com/)
- **Icons**: [Lucide React](https://lucide.dev/)
- **Data Visualizations**: Recharts / D3 primitives

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) (version 18 or higher recommended)
- [npm](https://www.npmjs.com/) or compatible package manager

### Installation

Clone the repository and install dependencies:

```bash
npm install
```

### Development Server

Start the local development server:

```bash
npm run dev
```

Tradebook will be accessible at `http://localhost:3000`.

### Production Build

Create an optimized, static production build:

```bash
npm run build
```

The compiled assets will be output to the `dist/` directory, ready to be served by any static web server or host.

### Code Verification & Linting

Run TypeScript type-checking and code quality checks:

```bash
npm run lint
```

---

## Data Safety, Backups & Portability

Because Tradebook is strictly local-first and does not use automatic cloud backup or remote database syncing, your data resides entirely in your local browser's IndexedDB storage.

To protect against browser cache clearance, device upgrades, or system resets, Tradebook provides two distinct export methods in the Settings menu:

### 1. Encrypted Backup (`.tjbackup`)
- **Format**: `Tradebook-Backup-YYYY-MM-DD-HHmm.tjbackup`
- **Security**: AES-GCM 256-bit authenticated encryption with PBKDF2 key derivation (100,000 iterations).
- **Purpose**: Secure, password-protected archive for complete journal backup, device migration, and disaster recovery.
- **Protection**: The encrypted container does NOT expose raw or plain-text trading records; restoring requires the exact decryption password used during generation.
- **Scope**: Includes accounts, phases, trading plans, trade executions, exit history, setups, post-trade reviews, prop firm rules, and optionally attached screenshot evidence.

### 2. Raw JSON Export (`.json`)
- **Format**: `Tradebook-Raw-YYYY-MM-DD.json`
- **Security**: Unencrypted, human-readable plain JSON.
- **Purpose**: Intended for technical inspection, external scripting, manual data audits, or custom analytical pipelines.
- **Handling**: Because this file contains raw, unencrypted financial records, treat it with care and store it only in secure, trusted environments.

### 3. Backup Restore & Recovery
- Restore either encrypted `.tjbackup` containers (with password) or valid unencrypted JSON backups directly through the in-app Restore dialog.
- Built-in pre-restore safeguards automatically generate an encrypted backup of the current database before wiping or replacing tables.
