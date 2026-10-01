/**
 * Passkey API Endpoints
 * Add these to your Express app or Node.js HTTP server
 */

import bcrypt from 'bcrypt';
import { prisma } from './src/index.js'; // adjust path as needed

// ============================================================================
// ADMIN ENDPOINTS - Create, list, manage passkeys
// ============================================================================

/**
 * POST /api/admin/passkeys/create
 * Admin creates or resets a passkey for a user
 */
export async function createPasskey(req, res) {
  // Check admin role
  const adminRole = req.headers['x-user-role'];
  if (adminRole !== 'ADMINISTRATOR') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, displayName, title, passkey } = req.body;

  if (!username || !displayName || !passkey) {
    return res.status(400).json({
      error: 'username, displayName, and passkey required'
    });
  }

  // Validate passkey format (numeric, 4-8 digits)
  if (!/^\d{4,8}$/.test(passkey)) {
    return res.status(400).json({
      error: 'Passkey must be 4-8 digits'
    });
  }

  try {
    // Hash the passkey before storing
    const hashedPasskey = await bcrypt.hash(passkey, 10);

    // Create or update
    const userPasskey = await prisma.userPasskey.upsert({
      where: { username },
      update: {
        passkey: hashedPasskey,
        displayName,
        title: title || null,
        isActive: true,
        lastResetAt: new Date(),
        createdBy: req.headers['x-user-id'] || 'admin'
      },
      create: {
        username,
        displayName,
        title: title || null,
        passkey: hashedPasskey,
        isActive: true,
        createdBy: req.headers['x-user-id'] || 'admin'
      }
    });

    res.json({
      success: true,
      username,
      displayName,
      message: `Passkey ${userPasskey.createdAt === userPasskey.lastResetAt ? 'created' : 'updated'} for ${displayName}`
    });
  } catch (error) {
    console.error('createPasskey error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/passkeys/list
 * Admin views all passkeys
 */
export async function listPasskeys(req, res) {
  const adminRole = req.headers['x-user-role'];
  if (adminRole !== 'ADMINISTRATOR') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  try {
    const passkeys = await prisma.userPasskey.findMany({
      select: {
        id: true,
        username: true,
        displayName: true,
        title: true,
        isActive: true,
        createdAt: true,
        lastResetAt: true,
        lastUsedAt: true
        // Never return the actual passkey hash
      },
      orderBy: { displayName: 'asc' }
    });

    res.json({
      success: true,
      count: passkeys.length,
      passkeys
    });
  } catch (error) {
    console.error('listPasskeys error:', error);
    res.status(500).json({ error: error.message });
  }
}

/**
 * POST /api/admin/passkeys/disable
 * Admin disables a user's passkey
 */
export async function disablePasskey(req, res) {
  const adminRole = req.headers['x-user-role'];
  if (adminRole !== 'ADMINISTRATOR') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username } = req.body;
  if (!username) {
    return res.status(400).json({ error: 'username required' });
  }

  try {
    await prisma.userPasskey.update({
      where: { username },
      data: { isActive: false }
    });

    res.json({
      success: true,
      message: `Passkey disabled for ${username}`
    });
  } catch (error) {
    console.error('disablePasskey error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// USER ENDPOINT - Verify passkey
// ============================================================================

/**
 * POST /api/passkey/verify
 * User verifies their passkey (called from signature block)
 * Returns: { success, username, displayName, title }
 */
export async function verifyPasskey(req, res) {
  const { passkey } = req.body;

  if (!passkey) {
    return res.status(400).json({ error: 'passkey required' });
  }

  // Validate passkey format
  if (!/^\d{4,8}$/.test(passkey)) {
    return res.status(400).json({
      error: 'Invalid passkey format'
    });
  }

  try {
    // Get all active passkeys and check each
    const users = await prisma.userPasskey.findMany({
      where: { isActive: true }
    });

    let matchedUser = null;
    for (const user of users) {
      const isMatch = await bcrypt.compare(passkey, user.passkey);
      if (isMatch) {
        matchedUser = user;
        break;
      }
    }

    if (!matchedUser) {
      return res.status(401).json({ error: 'Passkey not recognized' });
    }

    // Log the usage
    const recordKey = req.headers['x-record-key'] || 'unknown';
    await prisma.passKeyLog.create({
      data: {
        username: matchedUser.username,
        recordKey: recordKey
      }
    });

    // Update last used
    await prisma.userPasskey.update({
      where: { username: matchedUser.username },
      data: { lastUsedAt: new Date() }
    });

    // Return user info (NOT the passkey)
    res.json({
      success: true,
      username: matchedUser.username,
      displayName: matchedUser.displayName,
      title: matchedUser.title || null,
      message: 'Passkey verified'
    });
  } catch (error) {
    console.error('verifyPasskey error:', error);
    res.status(500).json({ error: error.message });
  }
}

// ============================================================================
// REGISTER ROUTES
// ============================================================================

/**
 * Add to your Express app:
 *
 * app.post('/api/admin/passkeys/create', createPasskey);
 * app.post('/api/admin/passkeys/list', listPasskeys);
 * app.post('/api/admin/passkeys/disable', disablePasskey);
 * app.post('/api/passkey/verify', verifyPasskey);
 */

/**
 * Or for raw Node.js HTTP server, add to your request handler:
 *
 * if (req.method === 'POST' && req.url === '/api/admin/passkeys/create') {
 *   return createPasskey(req, res);
 * }
 * if (req.method === 'POST' && req.url === '/api/admin/passkeys/list') {
 *   return listPasskeys(req, res);
 * }
 * if (req.method === 'POST' && req.url === '/api/admin/passkeys/disable') {
 *   return disablePasskey(req, res);
 * }
 * if (req.method === 'POST' && req.url === '/api/passkey/verify') {
 *   return verifyPasskey(req, res);
 * }
 */
