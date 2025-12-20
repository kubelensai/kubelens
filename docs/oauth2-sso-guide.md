# OAuth2/SSO Authentication Guide

This guide explains how to configure and use OAuth2/SSO authentication in Kubelens.

## Overview

Kubelens supports Single Sign-On (SSO) authentication through OAuth2/OpenID Connect (OIDC) providers. This allows users to authenticate using their existing identity provider accounts (Google, GitHub, GitLab, Microsoft, etc.) instead of managing separate credentials.

### Supported Providers

| Provider | Status | Notes |
|----------|--------|-------|
| Google | ✅ Supported | Google Workspace / Gmail accounts |
| GitHub | ✅ Supported | GitHub.com accounts |
| GitLab | ✅ Supported | GitLab.com or self-hosted |
| Microsoft | ✅ Supported | Azure AD / Microsoft 365 |
| Generic OIDC | ✅ Supported | Any OIDC-compliant provider |

### Architecture

Kubelens uses an internal OAuth2 extension that acts as an OIDC provider, proxying authentication to upstream identity providers.

```
┌─────────────┐     ┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Browser   │────▶│ Kubelens Server │────▶│ OAuth2 Extension │────▶│ Google/GitHub│
│             │◀────│                 │◀────│   (Internal)     │◀────│    etc.      │
└─────────────┘     └─────────────────┘     └──────────────────┘     └──────────────┘
```

## Authentication Flow

### Sequence Diagram

```
┌──────┐          ┌─────────┐          ┌─────────┐          ┌────────┐
│User  │          │Kubelens │          │OAuth2   │          │Google  │
│      │          │Server   │          │Extension│          │        │
└──┬───┘          └────┬────┘          └────┬────┘          └───┬────┘
   │                   │                    │                   │
   │ Click "Sign in    │                    │                   │
   │ with Google"      │                    │                   │
   │──────────────────▶│                    │                   │
   │                   │                    │                   │
   │                   │ GET /api/v1/auth/  │                   │
   │                   │ oauth/auth/google  │                   │
   │                   │───────────────────▶│                   │
   │                   │                    │                   │
   │                   │                    │ 302 Redirect to   │
   │◀─────────────────────────────────────────────────────────▶│
   │                   │                    │ Google OAuth      │
   │                   │                    │                   │
   │ Show consent      │                    │                   │
   │◀──────────────────────────────────────────────────────────│
   │                   │                    │                   │
   │ Approve           │                    │                   │
   │──────────────────────────────────────────────────────────▶│
   │                   │                    │                   │
   │ Redirect to       │                    │ Exchange code     │
   │ /api/v1/auth/     │                    │◀─────────────────▶│
   │ oauth/callback    │                    │                   │
   │──────────────────▶│───────────────────▶│                   │
   │                   │                    │                   │
   │ Redirect to       │                    │                   │
   │ /login?code=...   │                    │                   │
   │◀──────────────────│◀───────────────────│                   │
   │                   │                    │                   │
   │ POST /api/v1/auth │                    │                   │
   │ /exchange         │                    │                   │
   │──────────────────▶│ Verify & sync user │                   │
   │                   │───────────────────▶│                   │
   │                   │                    │                   │
   │ JWT Token +       │                    │                   │
   │ User Info         │                    │                   │
   │◀──────────────────│                    │                   │
   │                   │                    │                   │
   │ Redirect to       │                    │                   │
   │ Dashboard         │                    │                   │
   │──────────────────▶│                    │                   │
```

### PKCE Flow

Kubelens uses PKCE (Proof Key for Code Exchange) for enhanced security:

1. **Frontend generates PKCE parameters:**
   - `code_verifier`: Random 43-128 character string
   - `code_challenge`: SHA256 hash of code_verifier, base64url encoded

2. **Authorization request includes:**
   - `code_challenge`: The hashed verifier
   - `code_challenge_method`: "S256"

3. **Token exchange includes:**
   - `code_verifier`: The original random string
   - Server verifies: `SHA256(code_verifier) == code_challenge`

## API Endpoints Reference

### Authentication Endpoints

| Endpoint | Method | Auth Required | Description |
|----------|--------|---------------|-------------|
| `/api/v1/auth/signin` | POST | No | Credential-based login |
| `/api/v1/auth/sso/providers` | GET | No | List available SSO providers |
| `/api/v1/auth/oauth/auth` | GET | No | Start OAuth flow (shows provider selection) |
| `/api/v1/auth/oauth/auth/{provider}` | GET | No | Start OAuth flow for specific provider |
| `/api/v1/auth/oauth/callback` | GET | No | OAuth callback from identity provider |
| `/api/v1/auth/exchange` | POST | No | Exchange authorization code for JWT |

### OIDC Discovery Endpoints

| Endpoint | Method | Description |
|----------|--------|-------------|
| `/api/v1/auth/oauth/.well-known/openid-configuration` | GET | OIDC discovery document |
| `/api/v1/auth/oauth/keys` | GET | JWKS (JSON Web Key Set) |
| `/api/v1/auth/oauth/token` | POST | OIDC token endpoint (internal) |
| `/api/v1/auth/oauth/userinfo` | GET | OIDC userinfo endpoint |

### Example: List SSO Providers

**Request:**
```bash
curl -X GET https://kubelens.example.com/api/v1/auth/sso/providers
```

**Response:**
```json
{
  "enabled": true,
  "providers": [
    {
      "id": "google",
      "type": "google",
      "name": "Sign in with Google"
    }
  ]
}
```

### Example: Exchange Code for Token

**Request:**
```bash
curl -X POST https://kubelens.example.com/api/v1/auth/exchange \
  -H "Content-Type: application/json" \
  -d '{
    "code": "authorization_code_from_callback",
    "code_verifier": "original_pkce_code_verifier",
    "redirect_uri": "https://kubelens.example.com/login"
  }'
```

**Response:**
```json
{
  "token": "eyJhbGciOiJIUzI1NiIs...",
  "user": {
    "id": 1,
    "email": "user@example.com",
    "username": "user",
    "full_name": "John Doe",
    "avatar": "https://...",
    "is_admin": false,
    "permissions": [...]
  },
  "is_new_user": false
}
```

## Deployment Configuration

### Single Domain Setup (Recommended)

Deploy Kubelens with a single domain for both frontend and API:

```
https://kubelens.example.com
├── /                          → Frontend (static files)
├── /api/*                     → Backend API (proxied)
└── /api/v1/auth/oauth/*       → OAuth2 endpoints (proxied)
```

**Benefits:**
- Single SSL certificate
- No CORS configuration needed
- Simplified DNS setup
- Backend can be internal (not exposed to internet)

### Environment Variables

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `KUBELENS_PUBLIC_URL` | Yes (for SSO) | `http://localhost:8080` | Public URL where Kubelens is accessible |
| `OIDC_DEFAULT_GROUP` | No | `viewer` | Default group for new SSO users |
| `OIDC_AUTO_CREATE_GROUP` | No | `true` | Auto-create groups from OIDC claims |
| `OIDC_GROUP_MAPPING` | No | - | Map OIDC groups to Kubelens groups |

### Helm Values

```yaml
# values.yaml
server:
  publicURL: "https://kubelens.example.com"
  
  env:
    - name: OIDC_DEFAULT_GROUP
      value: "viewer"
```

### Docker Compose

```yaml
services:
  server:
    image: kubelensai/kubelens-server:latest
    environment:
      - KUBELENS_PUBLIC_URL=https://kubelens.example.com
      - OIDC_DEFAULT_GROUP=viewer
```

## Provider Setup Guides

### Google OAuth2 Setup

Follow these steps to configure Google as an OAuth2 provider:

#### Step 1: Create Google Cloud Project

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Note your project ID

#### Step 2: Configure OAuth Consent Screen

1. Navigate to **APIs & Services** → **OAuth consent screen**
2. Select **Internal** (for Google Workspace) or **External** (for any Google account)
3. Fill in the required information:
   - **App name**: Kubelens
   - **User support email**: Your email
   - **Developer contact information**: Your email
4. Click **Save and Continue**

#### Step 3: Add Scopes

1. Click **Add or Remove Scopes**
2. Select the following scopes:
   - `openid`
   - `email`
   - `profile`
3. Click **Update** and **Save and Continue**

#### Step 4: Create OAuth2 Credentials

1. Navigate to **APIs & Services** → **Credentials**
2. Click **Create Credentials** → **OAuth client ID**
3. Select **Web application**
4. Configure:
   - **Name**: Kubelens OAuth Client
   - **Authorized JavaScript origins**: 
     ```
     https://kubelens.example.com
     ```
   - **Authorized redirect URIs**:
     ```
     https://kubelens.example.com/api/v1/auth/oauth/callback
     ```
5. Click **Create**
6. **Save your Client ID and Client Secret**

#### Step 5: Configure Kubelens

**Option A: Via Kubelens UI**

1. Login to Kubelens as admin
2. Go to **Settings** → **Integrations** → **OAuth2**
3. Click **Add Provider**
4. Select **Google** and enter:
   - **Client ID**: From step 4
   - **Client Secret**: From step 4
   - **Allowed Domain** (optional): `example.com` to restrict to your domain
5. Click **Save**

**Option B: Via Extension Config API**

```bash
curl -X PUT https://kubelens.example.com/api/v1/extensions/kubelens-oauth2/config \
  -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "providers": "[{\"id\":\"google\",\"type\":\"google\",\"name\":\"Sign in with Google\",\"client_id\":\"YOUR_CLIENT_ID\",\"client_secret\":\"YOUR_CLIENT_SECRET\",\"allowed_domain\":\"example.com\"}]"
  }'
```

#### Step 6: Test the Flow

1. Open Kubelens login page
2. Click **Sign in with Google**
3. Authenticate with your Google account
4. Verify you're redirected to the dashboard

### GitHub OAuth2 Setup

#### Step 1: Create GitHub OAuth App

1. Go to [GitHub Developer Settings](https://github.com/settings/developers)
2. Click **OAuth Apps** → **New OAuth App**
3. Fill in:
   - **Application name**: Kubelens
   - **Homepage URL**: `https://kubelens.example.com`
   - **Authorization callback URL**: `https://kubelens.example.com/api/v1/auth/oauth/callback`
4. Click **Register application**
5. Generate a **Client Secret**

#### Step 2: Configure in Kubelens

Add GitHub provider with:
- **Client ID**: From GitHub
- **Client Secret**: From GitHub
- **Allowed Org** (optional): Restrict to specific organization

### GitLab OAuth2 Setup

#### Step 1: Create GitLab Application

1. Go to GitLab → **User Settings** → **Applications** (or Admin → Applications for instance-wide)
2. Create new application:
   - **Name**: Kubelens
   - **Redirect URI**: `https://kubelens.example.com/api/v1/auth/oauth/callback`
   - **Scopes**: `openid`, `email`, `profile`, `read_user`
3. Save **Application ID** and **Secret**

#### Step 2: Configure in Kubelens

Add GitLab provider with:
- **Client ID**: Application ID
- **Client Secret**: Secret
- **Base URL** (for self-hosted): `https://gitlab.yourcompany.com`

### Microsoft OAuth2 Setup

#### Step 1: Register Azure AD Application

1. Go to [Azure Portal](https://portal.azure.com/) → **Azure Active Directory**
2. Navigate to **App registrations** → **New registration**
3. Configure:
   - **Name**: Kubelens
   - **Supported account types**: Choose based on your needs
   - **Redirect URI**: Web → `https://kubelens.example.com/api/v1/auth/oauth/callback`
4. Note the **Application (client) ID**

#### Step 2: Create Client Secret

1. Go to **Certificates & secrets** → **New client secret**
2. Add description and expiration
3. **Copy the secret value immediately** (shown only once)

#### Step 3: Configure in Kubelens

Add Microsoft provider with:
- **Client ID**: Application (client) ID
- **Client Secret**: Secret value
- **Tenant** (optional): Your Azure AD tenant ID or domain

## Troubleshooting

### Common Issues

#### "redirect_uri_mismatch" Error

**Cause**: The callback URL configured in the provider doesn't match what Kubelens sends.

**Solution**:
1. Verify `KUBELENS_PUBLIC_URL` is set correctly
2. Ensure the provider's redirect URI is exactly:
   ```
   {KUBELENS_PUBLIC_URL}/api/v1/auth/oauth/callback
   ```
3. Check for trailing slashes and protocol (http vs https)

#### "Invalid state" Error

**Cause**: CSRF protection failed, usually due to session issues.

**Solution**:
1. Clear browser cookies and try again
2. Ensure cookies are not blocked by browser settings
3. Check if the login flow was interrupted

#### "Failed to exchange code" Error

**Cause**: Authorization code exchange failed.

**Solution**:
1. Check provider credentials (Client ID/Secret)
2. Verify the code hasn't expired (codes are short-lived)
3. Check server logs for detailed error messages

#### User Created but No Permissions

**Cause**: New SSO users may not have any permissions.

**Solution**:
1. Set `OIDC_DEFAULT_GROUP` to a group with appropriate permissions
2. Or manually assign the user to groups in Kubelens admin

### Debug Logging

Enable debug logging for OAuth2 issues:

```yaml
# Environment variable
LOG_LEVEL: debug
```

Check logs for:
- OAuth2 extension startup
- Authorization requests
- Token exchanges
- User sync operations

### FAQ

**Q: Can I use multiple SSO providers?**
A: Yes, configure multiple providers in the extension config. Users will see all available providers on the login page.

**Q: Can users still use username/password after enabling SSO?**
A: Yes, SSO is additive. Users can use either method unless you disable password authentication.

**Q: How are SSO users mapped to Kubelens users?**
A: Users are matched by email address. If no user exists, a new one is created automatically.

**Q: Can I restrict SSO to specific domains/organizations?**
A: Yes, each provider supports domain/org restrictions in its configuration.

**Q: How do I disable SSO?**
A: Disable the OAuth2 extension in Settings → Integrations, or remove all providers from the configuration.
