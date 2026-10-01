# Passkey Authentication for Signature Verification

Replaces typed signature text with WebAuthn/FIDO2 passkey cryptographic authentication. Users sign verifications using their device's biometric (fingerprint, face) or PIN.

## Quick Start

### For Users

1. **First-time setup:**
   - Open the Processing Department app
   - Navigate to a record requiring verification
   - Click **"🔐 Sign with Passkey"** button
   - Follow your browser's passkey setup flow
   - Use your fingerprint, face, or PIN to complete registration

2. **Sign a verification:**
   - Enter "Verified by" name and title
   - Select the date
   - Click **"🔐 Sign with Passkey"** button
   - Use your biometric/PIN when prompted
   - Click **"Log verification"** when done

### For Developers

1. **Install dependencies:**
   ```bash
   npm install @simplewebauthn/server uuid
   ```

2. **Update database schema:**
   ```bash
   npx prisma migrate deploy
   ```

3. **Add files to your project:**
   - Copy `public/lib/passkey-auth.js` to your project
   - Update `public/lib/signoff-block.js` or replace with `signoff-block-minimal-change.js`
   - Add API endpoints from `passkey-api-endpoints.js` to your backend

4. **Load passkey-auth on verification pages:**
   ```html
   <script src="public/lib/passkey-auth.js?v=1"></script>
   <script src="public/lib/signoff-block.js?v=1"></script>
   ```

5. **Run migration (if upgrading from typed signatures):**
   ```bash
   node scripts/migrate-signatures-to-passkeys.mjs
   ```

## How It Works

### Registration Flow (First Time)

1. **User clicks "Register Passkey"**
   - Client calls `POST /api/auth/passkey/register-options`
   - Server returns WebAuthn registration options with random challenge
   - Challenge stored in database temporarily

2. **Browser prompts user**
   - "Create a passkey?"
   - User completes biometric/PIN verification
   - Authenticator generates public/private key pair

3. **Client sends attestation response**
   - POST to `/api/auth/passkey/register-verify`
   - Includes: credential ID, public key, attestation object

4. **Server verifies and stores**
   - Validates attestation (proves authenticator is real)
   - Stores credential in `UserPasskey` table
   - Returns success to client

### Verification Signing Flow (Every Time)

1. **User clicks "Sign with Passkey"**
   - Client calls `POST /api/auth/passkey/authenticate-options`
   - Server returns WebAuthn authentication options with challenge
   - Challenge stored in database temporarily

2. **Browser prompts user**
   - "Unlock with [device type]?"
   - User completes biometric/PIN verification

3. **Client sends assertion response**
   - POST to `/api/auth/passkey/authenticate-verify`
   - Includes: credential ID, signature, authenticator data

4. **Server verifies signature**
   - Validates that challenge was signed by stored public key
   - Clone detection (checks signature counter)
   - Logs verification to `PasskeySignature` table
   - Returns success to client

5. **Client stores credential ID**
   - Hidden input field populated with credential ID
   - Sent with verification when form submitted

## Configuration

### Environment Variables

```bash
# WebAuthn Relying Party ID (domain where passkeys are registered)
WEBAUTHN_RP_ID=abagold.local          # Local dev
WEBAUTHN_RP_ID=api.abagold.co.za      # Production

# Origin for challenge verification
WEBAUTHN_ORIGIN=https://abagold.local:3000    # Local
WEBAUTHN_ORIGIN=https://processing.abagold.co.za  # Production
```

### Passkey Support Matrix

| Browser | Support | Notes |
|---------|---------|-------|
| Chrome 67+ | ✅ Full | Windows Hello, Android biometric/PIN |
| Safari 16+ | ✅ Full | Face ID, Touch ID, Passkeys synced to iCloud |
| Firefox 60+ | ✅ Full | Windows Hello, with flags enabled |
| Edge 18+ | ✅ Full | Windows Hello, Same as Chrome |
| Mobile Safari | ✅ Full | Face ID, Touch ID on iOS 16+ |
| Android Chrome | ✅ Full | Biometric/PIN on Android 7+ |

**Note:** Older browsers fall back to typed signature text input.

## Security Considerations

### What Passkeys Protect Against

- **Phishing:** Private key never leaves device; attacker can't steal password
- **Replay attacks:** Each challenge is unique; signature can't be reused
- **Credential theft:** No password to steal; biometric/PIN stays on device
- **Weak passwords:** No password needed; cryptographic keys instead
- **Brute force:** Device locks after failed biometric attempts

### What Passkeys Don't Protect Against

- **Device compromise:** If device is stolen and unlocked, attacker can use passkey
- **Credential deletion:** If user deletes passkey from device, they can't sign anymore
- **Accidental signing:** Device doesn't detect *what* user is signing, only that signature is valid
- **Attestation spoofing:** With "none" attestation, claims about authenticator type unverified

### Best Practices

1. **Require passkey registration** before allowing verification access
2. **Store backup codes** for account recovery if passkey is lost
3. **Monitor for cloned credentials** using signature counter
4. **Audit verification history** for unusual patterns
5. **Use attestation verification** in production (`attestation: "direct"`)
6. **Validate origin/RP ID** strictly to prevent phishing

## API Reference

### POST /api/auth/passkey/register-options

Gets WebAuthn registration options.

**Request:**
```json
{
  "username": "john.smith@abagold.co.za",
  "displayName": "John Smith"
}
```

**Response:**
```json
{
  "challenge": "base64url-encoded-challenge",
  "rp": {
    "name": "Abagold Processing Department",
    "id": "abagold.local"
  },
  "user": {
    "id": "base64url-user-id",
    "name": "john.smith@abagold.co.za",
    "displayName": "John Smith"
  },
  "pubKeyCredParams": [
    { "type": "public-key", "alg": -7 },
    { "type": "public-key", "alg": -257 }
  ],
  "timeout": 60000,
  "attestation": "direct",
  "authenticatorSelection": {
    "authenticatorAttachment": null,
    "residentKey": "preferred",
    "userVerification": "preferred"
  }
}
```

### POST /api/auth/passkey/register-verify

Verifies registration response and stores credential.

**Request:**
```json
{
  "username": "john.smith@abagold.co.za",
  "id": "base64url-credential-id",
  "rawId": "base64url-raw-id",
  "response": {
    "clientDataJSON": "base64url",
    "attestationObject": "base64url"
  },
  "type": "public-key"
}
```

**Response:**
```json
{
  "success": true,
  "credentialId": "base64url-credential-id",
  "message": "Passkey registered successfully"
}
```

### POST /api/auth/passkey/authenticate-options

Gets WebAuthn authentication options.

**Request:**
```json
{
  "username": "john.smith@abagold.co.za"
}
```

**Response:**
```json
{
  "challenge": "base64url-encoded-challenge",
  "timeout": 60000,
  "rpId": "abagold.local",
  "userVerification": "preferred",
  "allowCredentials": [
    {
      "type": "public-key",
      "id": "base64url-credential-id",
      "transports": ["internal", "usb", "ble", "nfc"]
    }
  ]
}
```

### POST /api/auth/passkey/authenticate-verify

Verifies authentication response and signs verification.

**Request:**
```json
{
  "username": "john.smith@abagold.co.za",
  "id": "base64url-credential-id",
  "rawId": "base64url-raw-id",
  "response": {
    "clientDataJSON": "base64url",
    "authenticatorData": "base64url",
    "signature": "base64url"
  },
  "type": "public-key"
}
```

**Response:**
```json
{
  "success": true,
  "credentialId": "base64url-credential-id",
  "message": "Authentication successful"
}
```

## Database Schema

### UserPasskey

Stores registered passkey credentials.

```sql
CREATE TABLE "UserPasskey" (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  "credentialId" TEXT UNIQUE NOT NULL,
  "publicKey" TEXT NOT NULL,
  "signCount" INTEGER DEFAULT 0,
  transports TEXT[] DEFAULT '{}',
  "attestationType" TEXT,
  "credentialType" TEXT DEFAULT 'public-key',
  aaguid TEXT,
  "displayName" TEXT,
  "lastUsed" TIMESTAMP,
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);
```

### PasskeyChallenge

Temporary challenge storage (prevents replay attacks).

```sql
CREATE TABLE "PasskeyChallenge" (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL,
  challenge TEXT UNIQUE NOT NULL,
  purpose TEXT NOT NULL, -- 'registration' | 'authentication'
  origin TEXT,
  "rpId" TEXT,
  used BOOLEAN DEFAULT false,
  "expiresAt" TIMESTAMP NOT NULL,
  "createdAt" TIMESTAMP DEFAULT now()
);
```

### PasskeySignature

Audit trail of passkey-signed verifications.

```sql
CREATE TABLE "PasskeySignature" (
  id TEXT PRIMARY KEY,
  "recordKey" TEXT NOT NULL,
  "verifiedBy" TEXT NOT NULL,
  "verifiedDate" DATE NOT NULL,
  "credentialId" TEXT NOT NULL,
  "signatureMessage" TEXT,
  "signatureValue" TEXT,
  "authenticatorData" TEXT,
  "clientDataJSON" TEXT,
  verified BOOLEAN DEFAULT false,
  "verifyError" TEXT,
  "entryIds" TEXT[] DEFAULT '{}',
  "loggedAt" TIMESTAMP DEFAULT now(),
  "createdAt" TIMESTAMP DEFAULT now(),
  "updatedAt" TIMESTAMP
);
```

## Troubleshooting

### "WebAuthn not supported"

- **Cause:** Browser/device doesn't support WebAuthn
- **Fix:** Update browser or use a supported device (see support matrix above)
- **Fallback:** Enable typed signature text input for unsupported browsers

### "Attestation verification failed"

- **Cause:** Device's authenticator certificate is invalid
- **Fix:** Check that attestation certificate chain is valid
- **Debug:** Log attestationObject during registration

### "Authentication verification failed"

- **Cause:** Signature doesn't match stored public key
- **Fix:** Ensure credential ID matches; check signature hasn't been tampered with
- **Debug:** Verify challenge in assertion matches what was issued

### "No passkeys registered"

- **Cause:** User hasn't registered a passkey yet
- **Fix:** Show passkey registration UI
- **Code:** Check `UserPasskey` table for username

### "Signature counter mismatch"

- **Cause:** Authenticator counter decreased (possible cloned device)
- **Fix:** Reject assertion; alert security team; revoke credential
- **Security:** This detects cloned authenticators

## Migration from Typed Signatures

If upgrading from an older system with typed signatures:

1. **Backup existing data:**
   ```bash
   node scripts/migrate-signatures-to-passkeys.mjs
   ```

2. **Update forms:**
   - Replace old signature input with passkey button
   - Keep verification_log intact for audit trail

3. **Deploy incrementally:**
   - Deploy new code with passkey support
   - Existing verifications show typed signatures
   - New verifications use passkeys

4. **No data loss:**
   - Old typed signatures archived in PasskeySignature table
   - Verification history preserved
   - Can rollback if needed

## References

- [WebAuthn Standard](https://www.w3.org/TR/webauthn-2/)
- [@SimpleWebAuthn/Server Docs](https://simplewebauthn.dev/docs/packages/server)
- [OWASP WebAuthn Guide](https://cheatsheetseries.owasp.org/cheatsheets/Web_Authn_Cheat_Sheet.html)
- [Passkeys.dev Resource Center](https://passkeys.dev/)

## Support

For issues or questions:
- GitHub Issues: [processing-department repo]
- Slack: #processing-tech
- Email: tech-support@abagold.co.za
