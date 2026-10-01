/**
 * Passkey WebAuthn API Endpoints
 *
 * Add these endpoints to your Express/Node.js backend (api-backend.js or server.js)
 * Requires: @simplewebauthn/server npm package
 *
 * Installation:
 *   npm install @simplewebauthn/server uuid
 */

// At the top of your API file, add:
// const { generateRegistrationOptions, verifyRegistrationResponse,
//         generateAuthenticationOptions, verifyAuthenticationResponse } = require('@simplewebauthn/server');
// const { crypto } = require('crypto');

/**
 * Helper: Convert base64url to Buffer
 */
function base64urlToBuffer(str) {
  str = str.replace(/-/g, '+').replace(/_/g, '/');
  const padLen = (4 - (str.length % 4)) % 4;
  str += '='.repeat(padLen);
  return Buffer.from(str, 'base64');
}

/**
 * Helper: Convert Buffer to base64url
 */
function bufferToBase64url(buf) {
  return buf.toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

// ============================================================================
// PASSKEY REGISTRATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/passkey/register-options
 * Step 1: Get registration options for user
 *
 * Request body:
 *   { username: "user@example.com", displayName: "John Smith" }
 *
 * Response:
 *   {
 *     challenge: "base64url-encoded-challenge",
 *     rp: { name: "Abagold Processing", id: "example.com" },
 *     user: { id: "base64url-encoded-user-id", name, displayName },
 *     pubKeyCredParams: [...],
 *     timeout: 60000,
 *     attestation: "direct"
 *   }
 */
async function getRegistrationOptions(req, res) {
  const { username, displayName } = req.body;

  if (!username || !displayName) {
    return res.status(400).json({ error: 'username and displayName required' });
  }

  try {
    // Generate registration options
    const options = await generateRegistrationOptions({
      rpName: 'Abagold Processing Department',
      rpID: getRelyingPartyID(), // e.g., 'abagold.local' or 'api.abagold.co.za'
      userID: bufferToBase64url(crypto.randomBytes(64)),
      userName: username,
      userDisplayName: displayName,
      timeout: 60000,
      attestationType: 'direct', // Require attestation for higher security

      // Request specific authenticator capabilities
      authenticatorSelection: {
        authenticatorAttachment: undefined, // Allow both platform and cross-platform
        residentKey: 'preferred', // Prefer discoverable credentials
        userVerification: 'preferred' // Prefer biometric/PIN
      },

      supportedAlgorithmIDs: [-7, -257], // ES256, RS256
    });

    // Store challenge temporarily (must be used within a few minutes)
    // In production, store this in PasskeyChallenge table with expiration
    const challengeKey = `passkey_challenge:${username}:register:${Date.now()}`;
    if (global.storage && global.storage.set) {
      await global.storage.set(challengeKey, JSON.stringify({
        challenge: options.challenge,
        createdAt: Date.now(),
        expires: Date.now() + 10 * 60 * 1000 // 10 minutes
      }));
    }

    res.json(options);
  } catch (error) {
    console.error('Registration options error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/auth/passkey/register-verify
 * Step 2: Verify registration response and store credential
 *
 * Request body:
 *   {
 *     username: "user@example.com",
 *     id: "base64url-credential-id",
 *     rawId: "base64url-raw-id",
 *     response: {
 *       clientDataJSON: "base64url",
 *       attestationObject: "base64url"
 *     },
 *     type: "public-key"
 *   }
 *
 * Response:
 *   { success: true, credentialId: "...", message: "Passkey registered" }
 */
async function verifyRegistration(req, res) {
  const { username, id, rawId, response, type } = req.body;

  if (!username || !response?.clientDataJSON || !response?.attestationObject) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get the challenge we stored earlier
    // In production, query PasskeyChallenge table
    const challengeKey = `passkey_challenge:${username}:register:*`;
    // ... retrieve challenge from storage ...

    // Verify the attestation response
    const verification = await verifyRegistrationResponse({
      response: {
        id: rawId,
        rawId: base64urlToBuffer(rawId),
        type: type,
        response: {
          clientDataJSON: base64urlToBuffer(response.clientDataJSON),
          attestationObject: base64urlToBuffer(response.attestationObject)
        }
      },
      expectedChallenge: Buffer.from(challenge, 'utf8'), // Challenge stored from step 1
      expectedOrigin: getOrigin(req), // e.g., 'https://abagold.local'
      expectedRPID: getRelyingPartyID(),
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Attestation verification failed' });
    }

    // Extract credential details
    const { credentialID, credentialPublicKey, counter, aaguid, credentialDeviceType } = verification.registrationInfo;

    // Store the credential in database (UserPasskey model)
    // In production:
    // await prisma.userPasskey.create({
    //   data: {
    //     username,
    //     credentialId: bufferToBase64url(credentialID),
    //     publicKey: bufferToBase64url(credentialPublicKey),
    //     signCount: counter,
    //     aaguid: bufferToBase64url(aaguid),
    //     credentialType: credentialDeviceType
    //   }
    // });

    // For localStorage fallback:
    if (global.storage && global.storage.set) {
      const passkeyKey = `user_passkey:${username}`;
      const passkeyData = {
        username,
        credentialId: bufferToBase64url(credentialID),
        publicKey: bufferToBase64url(credentialPublicKey),
        signCount: counter,
        aaguid,
        createdAt: Date.now()
      };
      await global.storage.set(passkeyKey, JSON.stringify(passkeyData));
    }

    res.json({
      success: true,
      credentialId: bufferToBase64url(credentialID),
      message: 'Passkey registered successfully'
    });
  } catch (error) {
    console.error('Registration verification error:', error);
    res.status(400).json({ error: error.message });
  }
}

// ============================================================================
// PASSKEY AUTHENTICATION ENDPOINTS
// ============================================================================

/**
 * POST /api/auth/passkey/authenticate-options
 * Step 1: Get authentication options for user
 *
 * Request body:
 *   { username: "user@example.com" }
 *
 * Response:
 *   {
 *     challenge: "base64url-encoded-challenge",
 *     timeout: 60000,
 *     userVerification: "preferred",
 *     allowCredentials: [...]
 *   }
 */
async function getAuthenticationOptions(req, res) {
  const { username } = req.body;

  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }

  try {
    // Get user's registered credentials from database
    // In production:
    // const passkeyCredentials = await prisma.userPasskey.findMany({
    //   where: { username }
    // });

    // For localStorage fallback:
    let passkeyData = null;
    if (global.storage && global.storage.get) {
      const stored = await global.storage.get(`user_passkey:${username}`, false);
      passkeyData = stored ? JSON.parse(stored.value) : null;
    }

    if (!passkeyData) {
      return res.status(404).json({ error: 'No passkeys registered for this user' });
    }

    // Generate authentication options
    const options = await generateAuthenticationOptions({
      rpID: getRelyingPartyID(),
      timeout: 60000,
      userVerification: 'preferred',

      // List credentials this user can use
      allowCredentials: [{
        id: base64urlToBuffer(passkeyData.credentialId),
        type: 'public-key',
        transports: ['internal', 'usb', 'ble', 'nfc']
      }]
    });

    // Store challenge temporarily
    const challengeKey = `passkey_challenge:${username}:auth:${Date.now()}`;
    if (global.storage && global.storage.set) {
      await global.storage.set(challengeKey, JSON.stringify({
        challenge: options.challenge,
        createdAt: Date.now(),
        expires: Date.now() + 10 * 60 * 1000
      }));
    }

    res.json(options);
  } catch (error) {
    console.error('Authentication options error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/auth/passkey/authenticate-verify
 * Step 2: Verify authentication response and return signature
 *
 * Request body:
 *   {
 *     username: "user@example.com",
 *     id: "base64url-credential-id",
 *     rawId: "base64url-raw-id",
 *     response: {
 *       clientDataJSON: "base64url",
 *       authenticatorData: "base64url",
 *       signature: "base64url"
 *     },
 *     type: "public-key"
 *   }
 *
 * Response:
 *   {
 *     success: true,
 *     credentialId: "...",
 *     message: "Authentication successful"
 *   }
 */
async function verifyAuthentication(req, res) {
  const { username, id, rawId, response, type } = req.body;

  if (!username || !response?.clientDataJSON || !response?.authenticatorData || !response?.signature) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  try {
    // Get user's stored credential and challenge
    // In production:
    // const passkey = await prisma.userPasskey.findUnique({
    //   where: { credentialId: rawId }
    // });

    // For localStorage fallback:
    let passkeyData = null;
    if (global.storage && global.storage.get) {
      const stored = await global.storage.get(`user_passkey:${username}`, false);
      passkeyData = stored ? JSON.parse(stored.value) : null;
    }

    if (!passkeyData || passkeyData.credentialId !== rawId) {
      return res.status(404).json({ error: 'Credential not found' });
    }

    // Verify the authentication response
    const verification = await verifyAuthenticationResponse({
      response: {
        id: rawId,
        rawId: base64urlToBuffer(rawId),
        type: type,
        response: {
          clientDataJSON: base64urlToBuffer(response.clientDataJSON),
          authenticatorData: base64urlToBuffer(response.authenticatorData),
          signature: base64urlToBuffer(response.signature)
        }
      },
      expectedChallenge: Buffer.from(challenge, 'utf8'), // Challenge from step 1
      expectedOrigin: getOrigin(req),
      expectedRPID: getRelyingPartyID(),
      credential: {
        credentialID: base64urlToBuffer(passkeyData.credentialId),
        credentialPublicKey: base64urlToBuffer(passkeyData.publicKey),
        counter: passkeyData.signCount,
        transports: passkeyData.transports
      }
    });

    if (!verification.verified) {
      return res.status(400).json({ error: 'Authentication verification failed' });
    }

    // Update sign count (clone detection)
    // In production:
    // await prisma.userPasskey.update({
    //   where: { credentialId: rawId },
    //   data: { signCount: verification.authenticationInfo.newSignCount }
    // });

    // Log the signature (optional, for audit trail)
    // await prisma.passkeySignature.create({
    //   data: {
    //     verifiedBy: username,
    //     credentialId: rawId,
    //     signatureValue: response.signature,
    //     verified: true
    //   }
    // });

    res.json({
      success: true,
      credentialId: rawId,
      message: 'Authentication successful'
    });
  } catch (error) {
    console.error('Authentication verification error:', error);
    res.status(400).json({ error: error.message });
  }
}

// ============================================================================
// HELPER FUNCTIONS
// ============================================================================

function getRelyingPartyID() {
  // Return your domain/hostname
  // For local dev: 'localhost' or 'abagold.local'
  // For production: 'abagold.co.za' or 'api.abagold.co.za'
  return process.env.WEBAUTHN_RP_ID || 'localhost';
}

function getOrigin(req) {
  // Build full origin from request
  // e.g., 'https://abagold.local:3000'
  const protocol = req.protocol || 'https';
  const host = req.get('host') || 'localhost';
  return `${protocol}://${host}`;
}

// ============================================================================
// ROUTE REGISTRATION
// ============================================================================

// If using Express:
// app.post('/api/auth/passkey/register-options', getRegistrationOptions);
// app.post('/api/auth/passkey/register-verify', verifyRegistration);
// app.post('/api/auth/passkey/authenticate-options', getAuthenticationOptions);
// app.post('/api/auth/passkey/authenticate-verify', verifyAuthentication);

// If using raw Node.js HTTP server (like your current setup):
// Add to your request router:
// if (req.method === 'POST' && req.url === '/api/auth/passkey/register-options') {
//   return getRegistrationOptions(req, res);
// }
// if (req.method === 'POST' && req.url === '/api/auth/passkey/register-verify') {
//   return verifyRegistration(req, res);
// }
// if (req.method === 'POST' && req.url === '/api/auth/passkey/authenticate-options') {
//   return getAuthenticationOptions(req, res);
// }
// if (req.method === 'POST' && req.url === '/api/auth/passkey/authenticate-verify') {
//   return verifyAuthentication(req, res);
// }

module.exports = {
  getRegistrationOptions,
  verifyRegistration,
  getAuthenticationOptions,
  verifyAuthentication
};
