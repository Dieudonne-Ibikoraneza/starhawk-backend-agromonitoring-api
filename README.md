# Starhawk Backend - NestJS MVP

Agricultural Insurance Management System for Rwanda

## Technology Stack

- **Framework**: NestJS (TypeScript)
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT (Passport.js)
- **File Storage**: Local filesystem
- **External APIs**: 
  - EOSDA API (Field Management, Weather, Statistics, Imagery, Render)
  - NIDA API (National ID verification)

## Prerequisites

- Node.js (v18 or higher)
- MongoDB (v5 or higher)
- npm or yarn

## Installation

```bash
npm install
```

## Environment Setup

1. Copy `env.template` to `.env`
2. Update environment variables with your configuration:
   - **JWT_SECRET**: Generate a secure base64-encoded secret (minimum 256 bits)
     - Linux/Mac: `openssl rand -base64 32`
     - Windows PowerShell: `[Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }))`
   - **MONGODB_URI**: Your MongoDB connection string
   - **EOSDA_API_KEY** and **EOSDA_CLIENT_ID**: Your EOSDA API credentials
   - **NIDA_API_KEY**: Your NIDA API key (if required)
   - **MAIL_*****: SMTP email configuration
   - **ADMIN_*****: Initial admin user credentials (change in production!)

## Required Environment Variables

- `MONGODB_URI`: MongoDB connection string
- `JWT_SECRET`: Base64-encoded secret for JWT signing (256 bits minimum)
- `EOSDA_API_KEY`: EOSDA API key
- `EOSDA_CLIENT_ID`: EOSDA client ID
- `MAIL_HOST`, `MAIL_PORT`, `MAIL_USER`, `MAIL_PASSWORD`: SMTP configuration
- `ADMIN_EMAIL`, `ADMIN_PHONE`, `ADMIN_NATIONAL_ID`, `ADMIN_PASSWORD`: Admin bootstrap

## Running the Application

```bash
# Development
npm run start:dev

# Production
npm run build
npm run start:prod
```

## API Documentation

Once the application is running, access Swagger UI at:
`http://localhost:3000/api`

## Testing

```bash
# Unit tests
npm run test

# E2E tests
npm run test:e2e

# Test coverage
npm run test:cov
```

## Deployment

### Render.com Deployment

For detailed deployment instructions to Render.com, see [RENDER_DEPLOYMENT_GUIDE.md](./RENDER_DEPLOYMENT_GUIDE.md)

**Quick Start:**
1. Set up MongoDB Atlas (cloud database)
2. Push code to GitHub
3. Create Web Service on Render
4. Configure environment variables
5. Deploy

**Key Environment Variables for Production:**
- `MONGODB_URI`: MongoDB Atlas connection string
- `JWT_SECRET`: Secure base64-encoded secret (256 bits minimum)
- `EOSDA_API_KEY`: EOSDA API credentials
- `MAIL_*`: SMTP email configuration
- `ADMIN_*`: Initial admin user credentials (change defaults!)

See `env.template` for complete list of required variables.

## Project Structure

```
src/
├── main.ts
├── app.module.ts
├── config/
├── common/
├── auth/
├── users/
├── profiles/
├── nida/
├── farms/
├── eosda/
├── email/
├── files/
└── health/
```

## License

UNLICENSED

