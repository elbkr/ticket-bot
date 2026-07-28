<p align="center">
  <a href="https://github.com/elbkr/ticket-bot">
    <img src="readme/ticket-bot.png" alt="ticket-bot" width="500"/>
  </a>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/node-%3E%3D20.11.0-339933?logo=node.js&logoColor=white" alt="Node.js >= 20.11.0"/>
  <img src="https://img.shields.io/badge/discord.js-v14-5865F2?logo=discord&logoColor=white" alt="discord.js v14"/>
  <img src="https://img.shields.io/badge/mongoose-v9-880000?logo=mongodb&logoColor=white" alt="Mongoose v9"/>
  <img src="https://img.shields.io/badge/license-MIT-blue" alt="MIT License"/>
</p>

---

## Overview

**ticket-bot** is an advanced, thread-based Discord ticket system built for
communities that need real support tooling rather than a channel-spam bot.

Every ticket is a **private thread** rather than a new channel. Threads inherit
their parent channel's placement, never contribute to the 500-channel guild cap,
and disappear cleanly when archived — which makes the system viable for servers
handling a high volume of tickets without accumulating channel clutter.

The bot is fully multi-tenant. A single deployment serves any number of guilds,
each with its own staff roles, log destinations, ticket blacklist and
configuration, isolated at the database layer.

<img src="readme/splash.png" width="3000" alt="splash">

---

## Key Features

| Capability | Description |
| --- | --- |
| **Thread-lifecycle management** | Open → claim → close → reopen → archive, with locking, access revocation and automatic cleanup at every step. |
| **Role-based ACL** | Staff access is granted by configurable moderator roles. Server managers and administrators always qualify, so a guild can never lock itself out. |
| **Transcript generation** | Full conversation history uploaded to Hastebin, with automatic fallback to a file attachment if the upload fails. |
| **Per-guild configuration** | Log channel, transcript channel, ticket parent channel and staff roles are all configured live via slash commands. |
| **Per-guild blacklist** | Block abusive users from opening tickets, with a stored reason. Scoped per guild — a ban in one server does not follow the user to another. |
| **Audit logging** | Every ticket action emits a colour-coded, semantically consistent embed to the configured log channel. |
| **Self-healing state** | A startup reconciliation sweep purges ticket records whose thread no longer exists, so manual deletions can never strand a user. |
| **Guided ticket creation** | Topic selection via select menu, then a modal capturing subject and description before the thread is ever created. |

---

## Architecture

The codebase is organised into strictly separated layers. Each one has a single
responsibility and depends only on the layer beneath it.

```
Discord Gateway
      │
      ▼
┌──────────────┐   events/      Gateway listeners; resolve guild config once
│   Events     │
└──────┬───────┘
       ▼
┌──────────────┐   handlers/    Button, modal and select-menu dispatch
│  Handlers    │   commands/    Slash commands (TicketCommand base class)
└──────┬───────┘
       ▼
┌──────────────┐   services/    Authorisation, orchestration, side effects
│   Service    │                ticketService.js
└──────┬───────┘
       ▼
┌──────────────┐   repositories/  All database access, lean reads
│ Repository   │
└──────┬───────┘
       ▼
┌──────────────┐   models/      Mongoose schemas and indexes
│   MongoDB    │
└──────────────┘

        ◄── presentation ──►   services/ticketPresentation.js
                               Pure, side-effect-free embed/component builders
                               consumed by the service layer
```

**Presentation ↔ Service ↔ Repository.** The service layer decides *what
happened*; the presentation layer decides *how it looks*; the repository layer
decides *how it is stored*. `ticketPresentation.js` performs no I/O and touches
no database, so user-facing copy and colour can change without any risk to
business logic — and the service can be reasoned about without reading a single
embed definition.

**Multi-tenant isolation.** Guild configuration is keyed by the Discord guild
snowflake as its primary key. Every ticket and blacklist query is scoped by
`guildID`/`guildId`, and a partial unique index enforces *one open ticket per
user per guild* at the storage layer rather than trusting an application-level
check that concurrent requests could race past.

**Object-oriented commands.** Commands and events are discovered from disk by
convention — dropping a file into `src/commands` registers it. Ticket commands
extend a `TicketCommand` base class that owns the entire
defer → run → reply → report lifecycle, so each command file contains only its
option schema and a single service call.

**Resilience by default.** Expected domain failures (`TicketServiceError`) are
shown to the user verbatim and never logged as defects; anything else is logged
with full context. Audit logging, transcript archival and permission edits are
best-effort — a deleted log channel or a departed member can never abort the
ticket operation that triggered it.

---

## Tech Stack

| Component | Technology |
| --- | --- |
| Runtime | **Node.js** ≥ 20.11.0 (ES Modules) |
| Discord API | **discord.js** v14 |
| Database | **MongoDB** via **Mongoose** v9 |
| Tooling | ESLint 9 (flat config) |

---

## Setup & Installation

### Prerequisites

- **Node.js 20.11.0 or newer**
- A **MongoDB** database — [Atlas](https://www.mongodb.com/atlas) free tier is sufficient
- A **Discord application** with a bot user

### 1. Clone and install

```bash
git clone https://github.com/elbkr/ticket-bot.git
```

```bash
cd ticket-bot && npm install
```

### 2. Create the Discord application

1. Open the [Discord Developer Portal](https://discord.com/developers/applications) and create an application.
2. Under **Bot**, create a bot user and copy its **token**.
3. Enable all three **Privileged Gateway Intents** (Presence, Server Members, Message Content).
4. Under **OAuth2**, copy the **Client ID**.
5. Invite the bot using the URL below, replacing `YOUR_CLIENT_ID`:

```
https://discord.com/api/oauth2/authorize?client_id=YOUR_CLIENT_ID&permissions=8&scope=applications.commands%20bot
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
TOKEN=your-discord-bot-token
CLIENT_ID=your-discord-application-client-id
MONGO=mongodb+srv://user:password@cluster.mongodb.net/ticketbot?retryWrites=true&w=majority
```

| Variable | Required | Description |
| --- | :---: | --- |
| `TOKEN` | ✅ | Discord bot token used to authenticate the gateway connection. |
| `CLIENT_ID` | ✅ | Discord application ID, used to register slash commands. |
| `MONGO` | ✅ | MongoDB connection string. |

> **Note:** never commit `.env` — it holds credentials that grant full control of your bot.

### 4. Run

```bash
npm start
```

For development with automatic restarts on file changes:

```bash
npm run dev
```

Lint the project:

```bash
npm run lint
```

---

## Configuration

Once the bot is online, configure it in your server. All configuration commands
require the **Manage Server** permission.

| Command | Description |
| --- | --- |
| `/set <function> <channel>` | Set the logs channel, transcripts channel, or ticket parent channel. All must be text channels — Discord does not permit threads under a category. |
| `/unset <function>` | Clear a previously configured value. Clearing the parent channel makes threads spawn in whichever channel the panel is used in. |
| `/roles add \| remove \| list` | Manage the moderator roles that grant staff access. |
| `/diagnostics` | Verify the current configuration and surface anything missing. |
| `/blacklist add \| remove \| show` | Manage the per-guild ticket blacklist. |

### Ticket commands

| Command | Description | Access |
| --- | --- | --- |
| `/panel <channel>` | Post the public ticket panel. | Manage Server |
| `/open` | Show the ticket topic picker. | Everyone |
| `/close` | Close the current ticket. | Owner or staff |
| `/reopen` | Reopen a closed ticket. | Staff |
| `/transcript` | Save the ticket transcript. | Staff |
| `/delete` | Archive and permanently delete the ticket. | Staff |
| `/add <user>` | Grant a user access to the ticket. | Staff |
| `/remove <user>` | Revoke a user's access to the ticket. | Staff |

### Recommended setup order

1. `/roles add @Support` — define who counts as staff.
2. `/set logs #ticket-logs` — enable audit logging.
3. `/set transcript #ticket-archive` — enable transcript archival.
4. `/set parent #tickets` — *(optional)* group every ticket thread into one channel.
5. `/panel #support` — publish the panel users interact with.
6. `/diagnostics` — confirm everything resolves correctly.

<p align="center">
  <img src="readme/topic.png" width="420" alt="topic selection"/>
  <img src="readme/control-panel.png" width="420" alt="ticket control panel"/>
</p>

---

## Project Structure

```
src/
├── commands/          Slash commands, grouped by domain
│   ├── config/        Server configuration
│   ├── info/          Utility commands
│   └── ticket/        Ticket lifecycle actions
├── database/          MongoDB connection and graceful shutdown
├── events/            Gateway event listeners
│   ├── client/        Startup and presence
│   ├── guild/         Guild, channel, thread and role lifecycle
│   └── interactions/  Central interaction router
├── handlers/          Button, modal and select-menu dispatch
├── models/            Mongoose schemas and indexes
├── repositories/      Database access layer
├── services/          Business logic and presentation builders
├── struct/            Bot client and base classes
└── utils/             Logger, theming, permissions, caching
```

---

## Contributing

Contributions are welcome.

1. Fork the repository and create a feature branch.
2. Make your changes, keeping to the existing layer boundaries — business logic
   belongs in services, database access in repositories, and rendering in
   `ticketPresentation.js`.
3. Ensure `npm run lint` passes cleanly.
4. Open a pull request describing what changed and why.

---

## License

Released under the [MIT License](LICENSE).

<p align="center">
  <a href="https://www.jetbrains.com/community/opensource/#support">
    <img src="readme/jb_beam.png" alt="JetBrains" width="25"/>
  </a>
  Thanks to <a href="https://www.jetbrains.com/community/opensource/#support">JetBrains</a> for providing a free license for developing this project.
</p>
