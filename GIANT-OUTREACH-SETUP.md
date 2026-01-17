# Giant-outreach Repository Setup Guide

## Objective
Clone the contents of `RenewEnergies25/FinanceLeadDashboard` into a new, independent repository called `RenewEnergies25/Giant-outreach` with no git history connection to the original.

## Target Repository
- **Organization:** RenewEnergies25
- **Repository Name:** Giant-outreach
- **GitHub URL:** https://github.com/RenewEnergies25/Giant-outreach
- **Status:** Repository has been created (empty)

## Source Repository
- **Organization:** RenewEnergies25
- **Repository Name:** FinanceLeadDashboard
- **GitHub URL:** https://github.com/RenewEnergies25/FinanceLeadDashboard

---

## Setup Instructions

### Step 1: Clone the Source Repository
```bash
git clone https://github.com/RenewEnergies25/FinanceLeadDashboard.git temp-source
```

### Step 2: Create New Directory and Copy Files
```bash
mkdir Giant-outreach
cp -r temp-source/* Giant-outreach/
cp -r temp-source/.* Giant-outreach/ 2>/dev/null || true
rm -rf Giant-outreach/.git
```

### Step 3: Initialize Fresh Git Repository
```bash
cd Giant-outreach
git init
git branch -m main
```

### Step 4: Add All Files and Commit
```bash
git add -A
git commit -m "Initial commit: Giant-outreach project"
```

### Step 5: Add Remote and Push
```bash
git remote add origin https://github.com/RenewEnergies25/Giant-outreach.git
git push -u origin main
```

### Step 6: Cleanup
```bash
cd ..
rm -rf temp-source
```

---

## Project Structure

The repository contains 108 files organized as follows:

```
Giant-outreach/
├── .bolt/
│   ├── config.json
│   ├── ignore
│   └── prompt
├── .gitignore
├── README.md
├── components.json
├── eslint.config.js
├── index.html
├── package.json
├── package-lock.json
├── postcss.config.js
├── seed-data.sql
├── tailwind.config.js
├── tsconfig.json
├── tsconfig.app.json
├── tsconfig.node.json
├── vite.config.ts
├── src/
│   ├── App.css
│   ├── App.tsx
│   ├── index.css
│   ├── main.tsx
│   ├── vite-env.d.ts
│   ├── components/
│   │   ├── ActivityFeed.tsx
│   │   ├── ConversationList.tsx
│   │   ├── EscalationTypeBadge.tsx
│   │   ├── Layout.tsx
│   │   ├── MessageBubble.tsx
│   │   ├── MessageThread.tsx
│   │   ├── MessageTypeBadge.tsx
│   │   ├── QualifiedTable.tsx
│   │   ├── Sidebar.tsx
│   │   ├── StageBadge.tsx
│   │   ├── StatsCard.tsx
│   │   └── ui/
│   │       ├── accordion.tsx
│   │       ├── alert.tsx
│   │       ├── alert-dialog.tsx
│   │       ├── aspect-ratio.tsx
│   │       ├── avatar.tsx
│   │       ├── badge.tsx
│   │       ├── breadcrumb.tsx
│   │       ├── button.tsx
│   │       ├── calendar.tsx
│   │       ├── card.tsx
│   │       ├── carousel.tsx
│   │       ├── chart.tsx
│   │       ├── checkbox.tsx
│   │       ├── collapsible.tsx
│   │       ├── command.tsx
│   │       ├── context-menu.tsx
│   │       ├── dialog.tsx
│   │       ├── drawer.tsx
│   │       ├── dropdown-menu.tsx
│   │       ├── form.tsx
│   │       ├── hover-card.tsx
│   │       ├── input.tsx
│   │       ├── input-otp.tsx
│   │       ├── label.tsx
│   │       ├── menubar.tsx
│   │       ├── navigation-menu.tsx
│   │       ├── pagination.tsx
│   │       ├── popover.tsx
│   │       ├── progress.tsx
│   │       ├── radio-group.tsx
│   │       ├── resizable.tsx
│   │       ├── scroll-area.tsx
│   │       ├── select.tsx
│   │       ├── separator.tsx
│   │       ├── sheet.tsx
│   │       ├── skeleton.tsx
│   │       ├── slider.tsx
│   │       ├── sonner.tsx
│   │       ├── switch.tsx
│   │       ├── table.tsx
│   │       ├── tabs.tsx
│   │       ├── textarea.tsx
│   │       ├── toast.tsx
│   │       ├── toaster.tsx
│   │       ├── toggle.tsx
│   │       ├── toggle-group.tsx
│   │       └── tooltip.tsx
│   ├── hooks/
│   │   └── use-toast.ts
│   ├── lib/
│   │   ├── api.ts
│   │   ├── hooks.ts
│   │   ├── supabase.ts
│   │   └── utils.ts
│   ├── pages/
│   │   ├── Analytics.tsx
│   │   ├── Conversations.tsx
│   │   ├── Dashboard.tsx
│   │   └── QualifiedLeads.tsx
│   └── types/
│       └── database.ts
└── supabase/
    ├── functions/
    │   ├── _shared/
    │   │   ├── conversation-tracker.ts
    │   │   ├── cors.ts
    │   │   ├── ghl.ts
    │   │   ├── openai.ts
    │   │   ├── prompt-builder.ts
    │   │   └── supabase.ts
    │   ├── log-booking/
    │   │   └── index.ts
    │   ├── log-bump/
    │   │   └── index.ts
    │   ├── log-calendar-sent/
    │   │   └── index.ts
    │   ├── log-optout/
    │   │   └── index.ts
    │   ├── manual-reply/
    │   │   └── index.ts
    │   ├── process-response/
    │   │   └── index.ts
    │   └── update-escalation/
    │       └── index.ts
    └── migrations/
        ├── 20251208095004_create_dead_lead_schema.sql
        ├── 20251208100000_enhance_dead_lead_schema.sql
        └── 20251208124453_20251208100000_enhance_dead_lead_schema.sql
```

---

## Tech Stack

- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui components
- **Backend:** Supabase (Edge Functions + PostgreSQL)
- **Linting:** ESLint

---

## One-Liner Script

For quick execution, run this single command:

```bash
git clone https://github.com/RenewEnergies25/FinanceLeadDashboard.git temp-source && \
mkdir Giant-outreach && \
cp -r temp-source/* Giant-outreach/ && \
cp -r temp-source/.bolt temp-source/.gitignore Giant-outreach/ && \
rm -rf Giant-outreach/.git && \
cd Giant-outreach && \
git init && \
git branch -m main && \
git add -A && \
git commit -m "Initial commit: Giant-outreach project" && \
git remote add origin https://github.com/RenewEnergies25/Giant-outreach.git && \
git push -u origin main && \
cd .. && \
rm -rf temp-source && \
echo "Done! Giant-outreach repository has been set up successfully."
```

---

## Verification

After setup, verify the repository:

1. Check commit history shows only 1 commit:
   ```bash
   cd Giant-outreach && git log --oneline
   ```
   Expected output: `<hash> Initial commit: Giant-outreach project`

2. Check no connection to original repo:
   ```bash
   git remote -v
   ```
   Expected output: Only `origin` pointing to `Giant-outreach`

3. Verify file count:
   ```bash
   find . -type f -not -path './.git/*' | wc -l
   ```
   Expected output: `108`
