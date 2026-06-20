# Authentication & Authorization Boundary

## Overview

This directory (`next-app/lib/auth/`) contains the authentication and authorization boundary scaffold for the EUS Support Next.js application.

**This is a structural scaffold, not a finished auth system.** It establishes the patterns and interfaces that future pages and API routes will use, with a pluggable provider architecture designed for the planned transition to Cisco Duo MFA.

## Design Principles

### Separation of Concerns

| Concern | Description | Location |
|---------|-------------|----------|
| **Authentication** (WHO you are) | Handled by pluggable providers | `providers/` |
| **Authorization** (WHAT you can do) | Handled by app-level helpers | `require-role.js`, `require-team-access.js`, `allowed-modules.js` |

These are deliberately kept separate so that changing the authentication method (e.g., mock → Duo) does **not** require changes to authorization logic.

### Why Not Migrate the Legacy Auth?

The existing Python/FastAPI application uses a custom username/password + JWT + MFA system. This is **temporary** and will be replaced entirely by Cisco Duo MFA. Therefore:

- We do **NOT** deeply integrate with or migrate the legacy auth stack.
- We do **NOT** implement JWT validation, password hashing, or MFA code generation.
- We **DO** build the authorization boundary (roles, teams, modules) that will survive the auth transition.
- We **DO** create a clean provider interface where Duo will plug in.

## Architecture

```
lib/auth/
├── index.js                  # Centralized exports
├── get-current-user.js       # Resolves user from active provider
├── require-auth.js           # Enforces authentication (throws if no user)
├── require-role.js           # Enforces role-based access
├── require-team-access.js    # Enforces team-based access
├── allowed-modules.js        # Determines module-level permissions
├── mock-user.js              # Mock user data for development
├── README.md                 # This file
└── providers/
    ├── mock-provider.js      # Development mock (default)
    └── future-duo-provider.js # Cisco Duo placeholder (not yet implemented)
```

## Usage

### In Server Components

```jsx
// app/protected/page.jsx
import { requireAuth } from '@/lib/auth/require-auth.js';
import { getAllowedModules } from '@/lib/auth/allowed-modules.js';

export default async function ProtectedPage() {
  const user = await requireAuth();         // Throws if unauthenticated
  const modules = await getAllowedModules(); // Get permitted modules

  return <div>Hello, {user.username}</div>;
}
```

### In API Routes

```js
// app/api/something/route.js
import { requireRole } from '@/lib/auth/require-role.js';

export async function GET(request) {
  try {
    const user = await requireRole('admin', request);
    return Response.json({ data: '...' });
  } catch (error) {
    if (error.unauthorized) {
      return Response.json({ error: 'Unauthorized' }, { status: 401 });
    }
    if (error.forbidden) {
      return Response.json({ error: 'Forbidden' }, { status: 403 });
    }
    throw error;
  }
}
```

### Team-Based Access

```js
import { requireTeamAccess } from '@/lib/auth/require-team-access.js';

const user = await requireTeamAccess(['platform', 'support-ops']);
// Only users in 'platform' OR 'support-ops' teams reach here
```

## Providers

### Mock Provider (default in development)

- Always returns a pre-configured development user
- No real credential validation
- Active when `AUTH_PROVIDER=mock` or unset

### Cisco Duo Provider (future)

- **Not yet implemented**
- Will validate Duo-issued tokens/sessions
- Will map Duo groups to application roles and teams
- Will activate when `AUTH_PROVIDER=duo`

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `AUTH_PROVIDER` | `mock` | Active auth provider (`mock` or `duo` in future) |
| `NEXT_PUBLIC_ENV_LABEL` | `development` | Environment label for UI display |

### Future Duo Variables (not yet needed)

| Variable | Description |
|----------|-------------|
| `DUO_CLIENT_ID` | Cisco Duo application client ID |
| `DUO_CLIENT_SECRET` | Cisco Duo application client secret |
| `DUO_API_HOST` | Duo API hostname |
| `DUO_REDIRECT_URI` | OAuth redirect URI for Duo flow |

## Current State

- ✅ Auth boundary scaffold created
- ✅ Provider abstraction in place
- ✅ Mock provider working for development
- ✅ Role, team, and module authorization helpers
- ✅ Protected route example (`/protected`)
- ⬜ Cisco Duo integration (future phase)
- ⬜ Login/logout UI (future phase)
- ⬜ Session persistence (future phase)
- ⬜ Duo group → role/team mapping (future phase)

## Constraints

- No real authentication is performed in this scaffold
- No connection to production data or services
- No login screens implemented
- No JWT validation or token issuance
- The mock provider is for development only and must never be used in production
