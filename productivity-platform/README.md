# Productivity Platform

A modern, enterprise-grade productivity application similar to Todoist and TickTick, with advanced task management and Microsoft Outlook Calendar integration.

## 🚀 Features

- **Task Management**: Create, organize, and track tasks with priorities, due dates, and labels
- **Projects**: Group tasks into customizable projects with colors and icons
- **Subtasks**: Break down tasks into manageable checklists
- **Smart Views**: Inbox, Today, Upcoming, and custom filters
- **Outlook Integration**: Bidirectional sync with Microsoft Outlook Calendar
- **Reminders**: Push and email notifications for tasks
- **Recurring Tasks**: Advanced recurrence rules (daily, weekly, monthly)
- **Productivity Dashboard**: Track your completion rates and focus time
- **Dark Mode**: Beautiful dark theme support

## 🛠️ Tech Stack

### Frontend
- **React 18** with Next.js 14 (App Router)
- **TypeScript** for type safety
- **TailwindCSS** for styling
- **Zustand** for state management
- **TanStack Query** for server state
- **React Hook Form** + **Zod** for forms

### Backend
- **Node.js** 20 LTS
- **NestJS** for modular architecture
- **Prisma** ORM with PostgreSQL
- **Redis** for caching and queues
- **Passport.js** for authentication
- **BullMQ** for job queues

### Infrastructure
- **Docker** & Docker Compose
- **Microsoft Graph API** for Outlook integration
- **JWT** for authentication

## 📦 Project Structure

```
productivity-platform/
├── apps/
│   ├── web/          # Next.js frontend
│   └── api/          # NestJS backend
├── packages/
│   └── database/     # Prisma schema and client
├── docker/           # Docker configuration
└── docs/             # Documentation
```

## 🚀 Quick Start

### Prerequisites
- Node.js 20+
- npm 10+
- Docker & Docker Compose

### 1. Clone and Install

```bash
cd productivity-platform
npm install
```

### 2. Environment Setup

```bash
cp .env.example .env
# Edit .env with your Microsoft OAuth credentials
```

### 3. Start Development Environment

```bash
# Start all services (database, redis, api, web)
npm run docker:up

# Or start individual services
docker-compose -f docker/docker-compose.yml up postgres redis
```

### 4. Database Setup

```bash
# Generate Prisma client
npm run db:generate --workspace=@productivity-platform/database

# Run migrations
npm run db:migrate --workspace=@productivity-platform/database

# Seed database with demo data
npm run db:seed --workspace=@productivity-platform/database
```

### 5. Run Applications

```bash
# Start everything (requires Docker services running)
npm run dev

# Or start individually
npm run dev --workspace=@productivity-platform/api
npm run dev --workspace=@productivity-platform/web
```

Access the application at:
- **Frontend**: http://localhost:3000
- **Backend API**: http://localhost:3001
- **Prisma Studio**: `npm run db:studio`

## 🔐 Microsoft OAuth Setup

1. Go to [Azure Portal](https://portal.azure.com)
2. Navigate to **Azure Active Directory** → **App registrations**
3. Click **New registration**
4. Configure:
   - Name: `Productivity Platform`
   - Supported account types: Accounts in any organizational directory and personal Microsoft accounts
   - Redirect URI: `http://localhost:3000/auth/callback`
5. Copy **Application (client) ID** and **Directory (tenant) ID**
6. Create a client secret under **Certificates & secrets**
7. Add API permissions:
   - `User.Read`
   - `Calendars.ReadWrite`
   - `Calendars.ReadWrite.Shared`
   - `offline_access`

Update `.env` with your credentials:
```env
MICROSOFT_CLIENT_ID=your-client-id
MICROSOFT_CLIENT_SECRET=your-client-secret
MICROSOFT_TENANT_ID=common
```

## 📚 Documentation

- [Architecture Overview](./docs/ARCHITECTURE.md)
- API Documentation (coming soon)
- Deployment Guide (coming soon)

## 🧪 Testing

```bash
# Run all tests
npm test

# Test specific workspace
npm test --workspace=@productivity-platform/api
npm test --workspace=@productivity-platform/web
```

## 📝 Development

### Database Commands

```bash
npm run db:generate    # Generate Prisma Client
npm run db:migrate     # Create and apply migrations
npm run db:seed        # Seed database
npm run db:studio      # Open Prisma Studio
npm run db:reset       # Reset database
```

### Docker Commands

```bash
npm run docker:up      # Start all containers
npm run docker:down    # Stop all containers
```

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.

## 🙏 Acknowledgments

Inspired by:
- [Todoist](https://todoist.com)
- [TickTick](https://ticktick.com)
- [Notion](https://notion.so)

---

Built with ❤️ using Next.js, NestJS, and TypeScript
