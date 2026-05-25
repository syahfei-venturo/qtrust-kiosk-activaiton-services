# Kiosk Socket Service

Socket.IO backend service for kiosk realtime transport (replacing Firebase RTDB).

## Prerequisites

- Node.js 20+
- PostgreSQL (local)
- Redis (local)

## Setup

```bash
# Install dependencies
npm install

# Copy env
cp .env.example .env
# Edit .env with your local Postgres/Redis credentials

# Generate Prisma client
npx prisma generate

# Run migrations
npx prisma migrate dev

# Seed mock data
npx prisma db seed

# Start dev server
npm run start:dev
```

## API

### Auth
- `POST /auth/login` — returns JWT

### Technician
- `POST /v1/technician/take-picture/:hardwareId` — trigger shutter (broadcasts to kiosk)
- `GET /v1/technician/take-picture-status/:hardwareId` — poll status

### Activation
- `PUT /v1/activation/:hardwareId` — update activation (broadcasts to kiosk)

### Socket.IO (namespace: /kiosk)
- Connect with `auth: { token: JWT }`
- Emit `subscribe` with `{ channel: "activation.KIOSK-001" }` → ack with initial data
- Listen `event` for realtime updates: `{ channel, data, timestamp }`

## Testing

```bash
npm run test:e2e    # integration tests
npm run test:cov    # coverage report
```
