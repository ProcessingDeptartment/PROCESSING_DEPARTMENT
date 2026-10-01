# Implementation Guide: Passkey Authentication

Step-by-step guide to integrate passkey signature verification into your Processing Department app.

## Phase 1: Setup (30 minutes)

### 1.1 Install Dependencies

```bash
cd T:\\Abagold\ Processing\ Facility\\20.\ Paperless\\PROCESSING_DEPARTMENT

# Install WebAuthn server library
npm install @simplewebauthn/server uuid

# Verify Prisma is installed
npm list @prisma/client  # Should already be there
```

### 1.2 Update Database Schema

Copy the schema additions from `prisma-schema-additions.prisma` into `prisma/schema.prisma`:

```prisma
// Add these three models to your schema.prisma

model UserPasskey {
  id              String   @id @default(cuid())
  username        String
  credentialId    String   @unique
  publicKey       String
  signCount       Int      @default(0)
  transports      String[] @default([])
  attestationType String?
  credentialType  String   @default("public-key")
  aaguid          String?
  displayName     String?
  lastUsed        DateTime?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([username])
  @@index([credentialId])
}

model PasskeyChallenge {
  id        String   @id @default(cuid())
  username  String
  challenge String   @unique
  purpose   String
  origin    String?
  rpId      String?
  used      Boolean  @default(false)
  expiresAt DateTime
  createdAt DateTime @default(now())

  @@index([username])
  @@index([expiresAt])
  @@index([used])
}

model PasskeySignature {
  id               String   @id @default(cuid())
  recordKey        String
  verifiedBy       String
  verifiedDate     DateTime @db.Date
  credentialId     String
  signatureMessage String?
  signatureValue   String?
  authenticatorData String?
  clientDataJSON   String?
  verified         Boolean  @default(false)
  verifyError      String?
  entryIds         String[] @default([])
  loggedAt         DateTime @default(now())
  createdAt        DateTime @default(now())
  updatedAt        DateTime @updatedAt

  @@index([recordKey])
  @@index([verifiedBy])
  @@index([credentialId])
  @@index([verifiedDate])
}
```

Run migrations:

```bash
npx prisma migrate dev --name add_passkey_tables
```

### 1.3 Copy Frontend Files

Copy these files to your project:

- `passkey-auth.js` → `public/lib/passkey-auth.js`
- `signoff-block-minimal-change.js` → **Replace** `public/lib/signoff-block.js`
  - OR manually apply the minimal changes from the file

## Phase 2: Backend Integration (1 hour)

### 2.1 Add API Endpoints

Open `public/lib/api-backend.js` or `server.js` and add the passkey endpoints:

**Option A: Using Express**

```javascript
import express from 'express';
import { getRegistrationOptions, verifyRegistrationResponse,
         generateAuthenticationOptions, verifyAuthenticationResponse } from '@simplewebauthn/server';

const app = express();
app.use(express.json());

// Import functions from passkey-api-endpoints.js
import { 
  getRegistrationOptions, verifyRegistration,
  getAuthenticationOptions, verifyAuthentication 
} from './passkey-api-endpoints.js';

// Register endpoints
app.post('/api/auth/passkey/register-options', getRegistrationOptions);
app.post('/api/auth/passkey/register-verify', verifyRegistration);
app.post('/api/auth/passkey/authenticate-options', getAuthenticationOptions);
app.post('/api/auth/passkey/authenticate-verify', verifyAuthentication);
```

**Option B: Using Raw Node.js HTTP**

```javascript
// In your request handler:
if (req.method === 'POST' && req.url === '/api/auth/passkey/register-options') {
  return getRegistrationOptions(req, res);
}
if (req.method === 'POST' && req.url === '/api/auth/passkey/register-verify') {
  return verifyRegistration(req, res);
}
if (req.method === 'POST' && req.url === '/api/auth/passkey/authenticate-options') {
  return getAuthenticationOptions(req, res);
}
if (req.method === 'POST' && req.url === '/api/auth/passkey/authenticate-verify') {
  return verifyAuthentication(req, res);
}
```

### 2.2 Update Environment Variables

Add to `.env`:

```bash
# WebAuthn Configuration
WEBAUTHN_RP_ID=abagold.local                    # Change for production
WEBAUTHN_RP_NAME="Abagold Processing Department"
WEBAUTHN_ORIGIN=http://localhost:3000            # Change for production

# For production (e.g., api.abagold.co.za):
# WEBAUTHN_ RP_ID=abagold.co.za
# WEBAUTHN_ORIGIN=https://api.abagold.co.za
```

### 2.3 Test API Endpoints

```bash
# Start your server
npm run dev

# Test registration options
curl -X POST http://localhost:3000/api/auth/passkey/register-options \
  -H "Content-Type: application/json" \
  -d '{"username":"test@abagold.co.za","displayName":"Test User"}'

# Should return options with challenge
```

## Phase 3: Frontend Integration (30 minutes)

### 3.1 Add Passkey Scripts to Record Pages

In any HTML page that shows verification (e.g., `public/records/rec-7-1-5.html`):

```html
<!-- Add after other scripts, before </body> -->
<script src="lib/passkey-auth.js?v=1"></script>
<script src="lib/signoff-block.js?v=1"></script>
```

Update the cache bust version `?v=1` whenever you change these files.

### 3.2 Test in Browser

1. Open the app: `http://localhost:3000`
2. Navigate to a record with verification (e.g., REC 7.1.5)
3. Scroll to Verification section
4. Click **"🔐 Sign with Passkey"** button
5. Browser should prompt:
   - "Create a passkey?" (first time) OR
   - "Unlock with [device]?" (after setup)
6. Complete biometric/PIN
7. Should show "✓ Signed" and button should disable

### 3.3 Check Browser Console

Look for these log lines (means everything loaded):

```
PasskeyAuth loaded
SignOffBlock loaded
Verification UI mounted
```

If you see errors, check:
- Network tab for failed API calls
- Console for JavaScript errors
- Server logs for backend errors

## Phase 4: Migration (if upgrading) (15 minutes)

### 4.1 Backup Existing Data

```bash
# This creates a JSON backup of existing signatures
node scripts/migrate-signatures-to-passkeys.mjs
```

Backup file location: `verification_logs_backup_<timestamp>.json`

### 4.2 Verify Migration

Check that old signatures were archived:

```bash
# In database client (psql, etc)
SELECT COUNT(*) FROM "PasskeySignature" WHERE "verifyError" LIKE 'Migrated%';

# Should show count of archived signatures
```

## Phase 5: Testing Checklist

### Manual Testing

- [ ] **Registration Flow:**
  - [ ] Click "Register Passkey" on a record
  - [ ] Enter name and click button
  - [ ] Browser prompts for passkey setup
  - [ ] Complete biometric/PIN
  - [ ] See success message

- [ ] **Signing Verification:**
  - [ ] Fill out "Verified by", "Title", "Date"
  - [ ] Click "🔐 Sign with Passkey"
  - [ ] Browser prompts to authenticate
  - [ ] Complete biometric/PIN
  - [ ] Button shows "✓ Signed"
  - [ ] Click "Log verification"
  - [ ] See "Verification logged" toast

- [ ] **Verification History:**
  - [ ] Previous verifications show with timestamp
  - [ ] Shows "🔐 Passkey" instead of signature text
  - [ ] Can click refresh to see latest

- [ ] **Fallback (if passkey unavailable):**
  - [ ] On unsupported browser, should show text input
  - [ ] Can type signature normally
  - [ ] Verification still logs

### Automated Testing (Optional)

```javascript
// passkey-auth.test.js
describe('PasskeyAuth', () => {
  test('registration fails without name', async () => {
    try {
      await PasskeyAuth.register('', 'No Name');
      fail('Should have thrown');
    } catch (e) {
      expect(e.message).toContain('username');
    }
  });

  test('authentication returns credential ID', async () => {
    const result = await PasskeyAuth.authenticate('test@abagold.co.za');
    expect(result.credentialId).toBeDefined();
    expect(result.success).toBe(true);
  });
});
```

### Production Testing

Before deploying to production:

1. Test on Windows with Windows Hello
2. Test on Mac with Touch ID
3. Test on iPhone with Face ID
4. Test on Android with biometric
5. Test cross-platform (register on iPhone, use on Android)
6. Test with multiple passkeys per user
7. Test fallback for old browsers

## Phase 6: Deployment

### 6.1 Pre-Deployment Checklist

- [ ] All tests passing
- [ ] No console errors
- [ ] API endpoints responding correctly
- [ ] Database migrations applied
- [ ] Environment variables configured for production
- [ ] Backup of existing data taken
- [ ] Team trained on new flow

### 6.2 Deploy

```bash
# Build/bundle if needed
npm run build

# Deploy to production
# (Your deployment process here)

# Run migration
node scripts/migrate-signatures-to-passkeys.mjs

# Verify
curl -X POST https://api.abagold.co.za/api/auth/passkey/register-options ...
```

### 6.3 Monitor

After deployment, monitor:

- API response times (should be <200ms)
- Error rates (check PasskeySignature.verifyError)
- User adoption (count new UserPasskey entries)
- Biometric failures (check logs for error patterns)

## Rollback Plan

If you need to rollback:

### Quick Rollback (Same Day)

```bash
# Revert to previous version that doesn't use passkeys
git checkout main~1
npm install
npm run dev

# Old typed signatures still work and appear in history
```

### Full Rollback

```bash
# Restore from backup
node scripts/restore-signatures-backup.mjs verification_logs_backup_*.json

# Drop passkey tables (if needed)
npx prisma migrate resolve --rolled-back "add_passkey_tables"
```

Users who registered passkeys can still sign (backend still supports both).

## Troubleshooting

### "POST /api/auth/passkey/register-options 404"

- Check endpoints are registered in server
- Check URL path matches exactly
- Check server is running

### "WebAuthn not supported"

- Browser doesn't support WebAuthn
- Use Chrome/Safari/Firefox/Edge on supported device
- Check `IsWebAuthnSupported()` in console

### "Attestation verification failed"

- Device's authenticator cert is invalid
- Try with different device
- In dev, can disable attestation verification (not secure)

### "Sign count mismatch - possible cloned credential"

- Good! Clone detection is working
- Credential is compromised, revoke it
- User needs to register new passkey

### Database migration fails

```bash
# Check migrations
npx prisma migrate status

# Manually run if needed
npx prisma migrate deploy

# Check schema
npx prisma studio
```

## Next Steps

1. **User education:** Train team on new passkey flow
2. **Documentation:** Add to internal wiki
3. **Support:** Set up FAQs for common issues
4. **Monitoring:** Set up alerts for high error rates
5. **Expansion:** Consider using passkeys for login too

## Support Contacts

- **Tech Lead:** [Your name]
- **DBA:** [Database admin]
- **Security:** [Security team]
- **Vendor Support:** security@anthropic.com (for SimpleWebAuthn issues)
