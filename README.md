# Giant Outreach

A multi-channel campaign management and monitoring platform for managing outreach campaigns across SMS, WhatsApp, and Email.

## Features

- **Dashboard**: Real-time overview with campaign stats, channel metrics, and recent activity
- **Campaigns**: Create and manage multi-channel outreach campaigns with independent channel configuration
- **Conversations**: View and manage all customer conversations with message threading
- **Qualified Leads**: Track escalations that need manual attention
- **Analytics**: Visualize performance metrics with per-channel breakdown and customizable date ranges

## Multi-Channel Support

Giant Outreach supports three independent communication channels:

- **SMS**: Traditional text messaging
- **WhatsApp**: WhatsApp Business messaging
- **Email**: Email outreach campaigns

Each channel operates independently within campaigns, allowing you to:
- Enable/disable specific channels per campaign
- Track channel-specific metrics and performance
- Manage per-channel opt-outs and preferences

## Tech Stack

- React + TypeScript + Vite
- Tailwind CSS
- shadcn/ui components
- Supabase (database + real-time + Edge Functions)
- Recharts for analytics
- React Router for navigation

## Getting Started

### 1. Environment Setup

Create a `.env` file with your Supabase credentials:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### 2. Database Setup

Run the migrations in `supabase/migrations/` to set up the schema:

**Core Tables:**
- `contacts` - Customer contact information with per-channel opt-out tracking
- `messages` - All inbound/outbound messages across channels
- `escalations` - Qualified leads needing manual follow-up
- `daily_metrics` - Aggregated daily statistics

**Campaign Tables:**
- `campaigns` - Campaign configuration and status
- `campaign_contacts` - Contact enrollment in campaigns
- `campaign_metrics` - Per-campaign, per-channel metrics

### 3. Run the Application

```bash
npm install
npm run dev
```

The application will be available at `http://localhost:5173`

## Features in Detail

### Dashboard Page
- Active campaign count and total campaigns
- Total contacts and active conversations
- Calendar links sent and bookings today
- Real-time activity feed showing recent messages

### Campaigns Page
- Create new campaigns with channel configuration
- Set daily message limits, bump delays, and max bumps
- Start, pause, resume, or complete campaigns
- View campaign-specific stats and channel breakdown
- Search and filter campaigns by status

### Conversations Page
- Left panel: Searchable list of all contacts with messages
- Right panel: Full message thread for selected contact
- Send manual replies with GHL integration
- Real-time updates when new messages arrive
- AI-generated messages marked with badges

### Qualified Leads Page
- Table view of all pending escalations
- Expandable rows to view full details
- Actions: View Conversation, Mark Resolved, Dismiss
- Real-time notifications for new qualified leads

### Analytics Page
- Campaign filter to view specific campaign metrics
- Per-channel performance cards (SMS, WhatsApp, Email)
- Channel distribution pie chart
- Messages by channel bar chart
- Date range picker for historical analysis
- Conversion funnel visualization

## Campaign Management

### Campaign Lifecycle

1. **Draft**: Campaign created but not yet started
2. **Active**: Campaign is running and sending messages
3. **Paused**: Campaign temporarily stopped
4. **Completed**: Campaign finished
5. **Archived**: Campaign removed from active view

### Channel Configuration

Each campaign can independently enable:
- SMS messaging
- WhatsApp messaging
- Email outreach

### Campaign Settings

- **Daily Message Limit**: Maximum messages per day
- **Bump Delay Hours**: Time between follow-up attempts
- **Max Bumps**: Maximum follow-up attempts

## Real-time Features

The dashboard uses Supabase real-time subscriptions to:
- Auto-update conversations when new messages arrive
- Show toast notifications for new inbound messages
- Alert when new qualified leads are created
- Refresh campaign stats automatically
- Update metrics in real-time

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
│   ├── Campaigns.tsx    # Campaign management
│   ├── Conversations.tsx
│   ├── QualifiedLeads.tsx
│   └── Analytics.tsx
├── lib/
│   ├── supabase.ts      # Supabase client
│   ├── hooks.ts         # Custom React hooks (incl. campaign hooks)
│   ├── api.ts           # API function calls
│   └── utils.ts         # Utility functions
├── types/
│   └── database.ts      # TypeScript types
└── App.tsx              # Main app with routing

supabase/
├── functions/           # Edge Functions
│   ├── _shared/         # Shared utilities
│   ├── process-response/
│   ├── manual-reply/
│   ├── log-bump/
│   ├── log-calendar-sent/
│   ├── log-booking/
│   ├── log-optout/
│   └── update-escalation/
└── migrations/          # Database migrations
```

## Dark Mode

The application runs in dark mode by default with a blue accent color scheme optimized for monitoring dashboards.
