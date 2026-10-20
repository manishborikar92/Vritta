# Vritta — Personal Routine Companion

[![Next.js](https://img.shields.io/badge/Next.js-16.1.0-black?logo=next.js)](https://nextjs.org/)
[![React](https://img.shields.io/badge/React-19.2.3-blue?logo=react)](https://react.dev/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-v4-38B2AC?logo=tailwind-css)](https://tailwindcss.com/)
[![Firebase](https://img.shields.io/badge/Firebase-v12.7.0-FFCA28?logo=firebase)](https://firebase.google.com/)
[![License](https://img.shields.io/badge/License-Proprietary-red)](#license)

**Vritta** (वृत्त — classical Sanskrit for mindful rhythm, conduct, and cyclical observance) is a modern Progressive Web Application (PWA) designed to foster mindful consistency, physical conditioning, language learning, and reflection through a tightly curated set of daily practices.

Built with Next.js 16, React 19, Tailwind CSS v4, and Firebase, it features a clean mobile-first interface, offline persistence, and a two-state zero-flash theme engine.

---

## Core Capabilities

- **Composable Routine Architecture:** Dynamic feature slots (`features.counter`, `features.timer`, `features.checklist`, `features.notes`, `features.catalog`, `features.daySchedule`) grouped by 9 canonical life-area categories and natural periods (Anytime, Afternoon, Before Bed) rather than rigid clock deadlines.
- **Physical Conditioning & Recovery:** Weekday-adaptive movement schedules (workout, walk, active recovery) with explicit Sunday rest.
- **Unified Habit Tracking & Configuration:**
  - **`HabitTrackerCard`:** Composable active tracking card on Today view with atomic interactive slots: `SlotStepper` (counters/sessions), `SlotDaySchedule` (weekday variations), `SlotCatalog` (discourse/item libraries), `SlotTimer` (countdown/stopwatch), `SlotNotes` (autosaved reflection notes), and `SlotChecklist` (sub-task completion).
  - **`HabitConfigCard`:** Management and organization card on Habits view with reordering controls, category badges, and collapsible instructions.
- **Guilt-Free Consistency Rhythm:** Consistency calculations that exclude scheduled rest days from denominators, eliminating artificial streak failures.
- **Interactive Sound Architecture:** Procedural Web Audio API synthesis providing serene acoustic feedback for timer events, habit completions, checklist toggles, and tactile navigation, with global mute and volume controls.
- **Resilient Background Timer:** Dedicated Web Worker execution combined with wall-clock timestamp synchronization, guaranteeing zero interval drift, immunity to background tab throttling, and silent reload recovery.
- **Two-State Theme Engine:** Binary Light/Dark mode with a tactile icon-only toggle (`ThemeToggle`) meeting WCAG 2.2 Level AAA touch target standards (>= 44×44px) and zero-flash pre-paint execution.
- **Authoritative Visual Identity:** The Guiding Sutra monoline mark, Deep Obsidian (`#090D16`), Luminous Teal (`#14B8A6`), and Warm Amber (`#D97706`).
- **Offline-First Persistence:** Cloud Firestore persistent local cache enables seamless operation without active network connectivity.

---

## Technology Stack

| Layer | Technology | Purpose |
| :--- | :--- | :--- |
| **Framework** | [Next.js 16 (App Router)](https://nextjs.org/) | Modern React framework with server components and static route generation. |
| **UI Library** | [React 19](https://react.dev/) | Client component hierarchy and external store synchronization. |
| **Styling** | [Tailwind CSS v4](https://tailwindcss.com/) | CSS variables, semantic design tokens, and fluid responsive design. |
| **Backend & Database** | [Cloud Firestore](https://firebase.google.com/docs/firestore) | Real-time NoSQL database with offline persistence and owner-scoped security rules. |
| **Authentication** | [Firebase Auth](https://firebase.google.com/docs/auth) | Google OAuth identity provider with secure session management. |
| **Admin Operations** | [Firebase Admin SDK v14](https://firebase.google.com/docs/admin/setup) | Privileged CLI routine seeding and customization preservation. |
| **Iconography** | [Lucide React](https://lucide.dev/) | Lightweight, accessible iconography. |
| **Hosting & CI/CD** | [Vercel](https://vercel.com/) | Edge deployment network (`myvritta.vercel.app`) with atomic rollouts. |

---

## Quick Start

### 1. Clone & Install
```bash
git clone https://github.com/manishborikar92/Vritta.git
cd Vritta/web
npm install
```

### 2. Configure Environment Variables
Copy the template and configure your Firebase project credentials in `web/.env.local`:
```bash
cp .env.local.example .env.local
```

### 3. Start Development Server
```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the application.

---

## Documentation Suite

Comprehensive technical guides and operational runbooks are maintained under the [`docs/`](docs/) directory:

- 📖 **[Documentation Index](docs/README.md):** Complete navigation map for all project documentation.
- 🏛️ **[Architecture & System Design](docs/architecture.md):** Deep dive into system design, data flows, theme engine, sound architecture, and Firestore schemas.
- 💻 **[Local Development Guide](docs/development.md):** Workstation setup, package scripts, testing strategy, and troubleshooting.
- 🔥 **[Firebase Setup & Operations Runbook](docs/firebase-setup.md):** Credential management, security rules, indexes, and service account key rotation.
- 🚀 **[Deployment & Release Guide](docs/deployment.md):** Vercel edge deployment, Git release workflow (`dev` -> `main`), and verification checklists.
- 🗺️ **[Project Roadmap & Production Readiness](docs/roadmap.md):** Milestone completion summary (Phases 1–8 complete) and production release runbook.

---

## Verification & Quality Gates

Run all project checks before committing:

```bash
# From project root
npm --prefix web run test    # 630+ automated tests across 210 suites
npm --prefix web run lint    # Next.js flat ESLint verification
npm --prefix web run build   # Production webpack build compilation
git diff --check             # Whitespace and formatting verification
```

---

## License

This project is proprietary and confidential. All rights reserved.