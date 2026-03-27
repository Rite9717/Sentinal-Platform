# Sentinal Frontend

React-based authentication frontend for the Sentinal application.

## Tech Stack

- **React 19** with TypeScript
- **Vite** for build tooling
- **React Router** for navigation
- **Axios** for HTTP requests
- **Vitest** for unit testing
- **fast-check** for property-based testing
- **React Testing Library** for component testing

## Project Structure

```
src/
├── components/     # React UI components
├── services/       # API client and backend communication
├── context/        # React Context providers (Auth)
├── types/          # TypeScript type definitions
├── utils/          # Utility functions (validation, token management)
└── test/           # Test setup and utilities
```

## Development

```bash
# Install dependencies
npm install

# Start development server (runs on port 3000)
npm run dev

# Run tests
npm test

# Run tests in watch mode
npm run test:watch

# Build for production
npm run build
```

## Backend Integration

The frontend communicates with the Spring Boot backend running on `http://localhost:8080`.

## Authentication

- JWT tokens are stored in localStorage under the key `sentinal_jwt_token`
- Protected routes automatically redirect to login when unauthenticated
- OAuth2 Google login is supported via backend integration
