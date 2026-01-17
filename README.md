# Dead Lead Reactivation Dashboard

An internal monitoring tool for finance companies to track and manage dead lead reactivation campaigns.

## Features

- **Dashboard**: Real-time overview with key metrics and recent activity
- **Conversations**: View and manage all customer conversations with message threading
- **Qualified Leads**: Track escalations that need manual attention
- **Analytics**: Visualize performance metrics over customizable date ranges

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui components
- Supabase (database + real-time)
- Recharts for analytics
- React Router for navigation

## Getting Started

### 1. Environment Setup

The `.env` file is already configured with your Supabase credentials.

### 2. Database Setup

The database schema has been created with these tables:
- `contacts` - Customer contact information
- `messages` - All inbound/outbound messages
- `escalations` - Qualified leads needing manual follow-up
- `daily_metrics` - Aggregated daily statistics

Sample data has been seeded into the database with:
- 5 sample contacts
- 15 sample messages
- 2 pending escalations
- 30 days of metrics data

### 3. Run the Application

```bash
npm run dev
```

The application will be available at `http://localhost:5173`

## Features in Detail

### Dashboard Page
- Shows 4 stat cards: Total Conversations, Messages Today, Response Rate, Qualified Leads
- Real-time activity feed showing the last 10 messages
- Auto-updates when new messages arrive

### Conversations Page
- Left panel: Searchable list of all contacts with messages
- Right panel: Full message thread for selected contact
- Send manual replies (currently logs to console, backend integration needed)
- Real-time updates when new messages arrive
- AI-generated messages are marked with badges

### Qualified Leads Page
- Table view of all pending escalations
- Expandable rows to view full suggested replies
- Actions: View Conversation, Mark Resolved, Dismiss
- Real-time notifications for new qualified leads

### Analytics Page
- Date range picker (defaults to last 30 days)
- Line chart: Messages sent vs received over time
- Bar chart: AI replies vs manual replies
- Summary stats: Total opt-outs, escalations, and message volume

## Real-time Features

The dashboard uses Supabase real-time subscriptions to:
- Auto-update conversations when new messages arrive
- Show toast notifications for new inbound messages
- Alert when new qualified leads are created
- Refresh escalations table automatically

## Dark Mode

The application runs in dark mode by default with a blue accent color scheme optimized for internal monitoring tools.

## Next Steps

To integrate with your backend:
1. Update the manual reply handler in `MessageThread.tsx` to POST to your API endpoint
2. Configure webhook handlers for incoming messages
3. Set up authentication if needed for production deployment

## File Structure

```
src/
├── components/
│   ├── ui/              # shadcn/ui components
│   ├── Layout.tsx       # Main layout with sidebar
│   ├── Sidebar.tsx      # Navigation sidebar
│   ├── StatsCard.tsx    # Reusable stat card
│   ├── ActivityFeed.tsx # Recent messages feed
│   ├── ConversationList.tsx
│   ├── MessageThread.tsx
│   ├── MessageBubble.tsx
│   └── QualifiedTable.tsx
├── pages/
│   ├── Dashboard.tsx
│   ├── Conversations.tsx
│   ├── QualifiedLeads.tsx
│   └── Analytics.tsx
├── lib/
│   ├── supabase.ts      # Supabase client
│   ├── hooks.ts         # Custom React hooks
│   └── utils.ts         # Utility functions
├── types/
│   └── database.ts      # TypeScript types
└── App.tsx              # Main app with routing
```
