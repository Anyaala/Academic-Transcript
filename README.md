# Verifiable Academic Vault

A secure blockchain-based academic transcript verification system that enables institutions to issue tamper-proof transcripts and provides public verification capabilities.

## Features

- **Secure Transcript Generation**: Institutions can upload and digitally sign academic transcripts
- **Blockchain Integration**: All transcripts are secured on the blockchain for immutable verification  
- **Public Verification**: Anyone can verify transcript authenticity using verification IDs or file uploads
- **Verification Limits**: Built-in rate limiting to prevent abuse
- **Student Management**: Institutions can manage student records and reset verification limits

## How to run locally

Follow these steps:

```sh
git clone <your-repo-url>
cd verifiable-academic-vault
npm i
npm run dev
```

## Tech Stack

- **Frontend**: React, TypeScript, Tailwind CSS, Vite
- **Backend**: Supabase (PostgreSQL, Edge Functions)
- **Blockchain**: Polygon network integration
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage

## Project Structure

```
src/
├── components/         # Reusable UI components
├── hooks/             # Custom React hooks
├── integrations/      # External service integrations
├── pages/             # Main application pages
└── lib/               # Utility functions

supabase/
├── functions/         # Edge functions for blockchain operations
└── migrations/        # Database schema migrations
```

## Getting Started

### For Institutions

1. Sign up at `/institution/signup`
2. Complete institution profile setup
3. Add student records and upload transcripts
4. Students receive verification IDs for their transcripts

### For Students

1. Sign up at `/student/signup` (optional - verification is public)
2. Receive transcript verification ID from institution
3. Use verification portal to verify authenticity

### For Public Verification

1. Visit `/verify` (no registration required)
2. Enter verification ID or upload transcript file
3. View verification results and blockchain confirmation

## Environment Setup

Create a `.env.local` file with:

```
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

## Deployment

The application can be deployed to any static hosting service like Vercel, Netlify, or similar platforms.

## License

This project is licensed under the MIT License.
