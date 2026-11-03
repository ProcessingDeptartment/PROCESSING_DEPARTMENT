# Passkey Users — Seed & Backend Update Instructions

**Date:** 2026-10-08  
**Scope:** Bulk-add 18 active users + add `update` and `enable` endpoints  
**Files to touch:** `src/` (or wherever passkey endpoints live), `public/pages/admin-passkeys.html`

---

## 1. Users to Add

Michaela will set job titles and passkeys via the admin UI after these are created.  
Use a **placeholder passkey** (e.g. `0000`) — Michaela will reset each one.

| # | Display Name | Email (username) |
|---|---|---|
| 1 | Eugene Lombaard | Eugene.Lombaard@abagold.co.za |
| 2 | Franciline Gardiner | franciline@abagold.co.za |
| 3 | Lungisa Ndlovu | lungisa@abagold.co.za |
| 4 | Luyanda Mthini | Luyanda@abagold.co.za |
| 5 | Michaela Cook | Michaela@abagold.co.za |
| 6 | Nandi April | nandi@abagold.co.za |
| 7 | Nasiwe Ndabambi | Nasiwe.Ndabambi@abagold.co.za |
| 8 | Ncumisa Kalase | Ncumisa@abagold.co.za |
| 9 | Nicolene Mylrea | Nicolene.Mylrea@abagold.co.za |
| 10 | Nobukhosi Kulati | NobukhosiK@abagold.co.za |
| 11 | Nomzamo Memani | nomzamo@abagold.co.za |
| 12 | Nosipho Tsonono | Nosiphot@abagold.co.za |
| 13 | Ntandazo Ngwane | Ntandazo@abagold.co.za |
| 14 | Philasande Ntlebi | philasande@abagold.co.za |
| 15 | Rowan Timmer | Rowan.Timmer@abagold.co.za |
| 16 | Saziso Maketa | saziso@abagold.co.za |
| 17 | Sonwabile Mfanyana | Sonwabile.Mfanyana@abagold.co.za |
| 18 | Thandolwethu Ntsethe | Thandolwethu.Ntsethe@abagold.co.za |

---

## 2. How to Seed — Two Options

### Option A: Via the Admin UI (recommended)
1. Open `/pages/admin-passkeys.html` while logged in as admin.
2. For each user, fill in: **Email**, **Full Name**, leave **Title** blank, enter `0000` as the passkey.
3. Click **Create / Reset Passkey**.
4. Repeat for all 18 users.
5. Michaela then uses the **Edit** button on each row to set the correct title and reset the passkey.

### Option B: Seed Script (faster for a developer)
Create `scripts/seed-passkeys.js` and run it **once** with `node scripts/seed-passkeys.js`.

```javascript
// scripts/seed-passkeys.js
// Run once: node scripts/seed-passkeys.js
// Requires: bcrypt, @prisma/client

const bcrypt = require('bcrypt');
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const PLACEHOLDER_PASSKEY = '0000';
const SALT_ROUNDS = 10;

const USERS = [
  { username: 'Eugene.Lombaard@abagold.co.za', displayName: 'Eugene Lombaard' },
  { username: 'franciline@abagold.co.za',       displayName: 'Franciline Gardiner' },
  { username: 'lungisa@abagold.co.za',           displayName: 'Lungisa Ndlovu' },
  { username: 'Luyanda@abagold.co.za',           displayName: 'Luyanda Mthini' },
  { username: 'Michaela@abagold.co.za',          displayName: 'Michaela Cook' },
  { username: 'nandi@abagold.co.za',             displayName: 'Nandi April' },
  { username: 'Nasiwe.Ndabambi@abagold.co.za',   displayName: 'Nasiwe Ndabambi' },
  { username: 'Ncumisa@abagold.co.za',           displayName: 'Ncumisa Kalase' },
  { username: 'Nicolene.Mylrea@abagold.co.za',   displayName: 'Nicolene Mylrea' },
  { username: 'NobukhosiK@abagold.co.za',        displayName: 'Nobukhosi Kulati' },
  { username: 'nomzamo@abagold.co.za',           displayName: 'Nomzamo Memani' },
  { username: 'Nosiphot@abagold.co.za',          displayName: 'Nosipho Tsonono' },
  { username: 'Ntandazo@abagold.co.za',          displayName: 'Ntandazo Ngwane' },
  { username: 'philasande@abagold.co.za',         displayName: 'Philasande Ntlebi' },
  { username: 'Rowan.Timmer@abagold.co.za',      displayName: 'Rowan Timmer' },
  { username: 'saziso@abagold.co.za',             displayName: 'Saziso Maketa' },
  { username: 'Sonwabile.Mfanyana@abagold.co.za', displayName: 'Sonwabile Mfanyana' },
  { username: 'Thandolwethu.Ntsethe@abagold.co.za', displayName: 'Thandolwethu Ntsethe' },
];

async function main() {
  const hash = await bcrypt.hash(PLACEHOLDER_PASSKEY, SALT_ROUNDS);
  let created = 0, skipped = 0;

  for (const user of USERS) {
    const existing = await prisma.userPasskey.findUnique({ where: { username: user.username } });
    if (existing) {
      console.log(`SKIP (exists): ${user.username}`);
      skipped++;
      continue;
    }
    await prisma.userPasskey.create({
      data: {
        username:    user.username,
        displayName: user.displayName,
        passkey:     hash,
        title:       null,
        isActive:    true,
      }
    });
    console.log(`CREATED: ${user.displayName} (${user.username})`);
    created++;
  }

  console.log(`\nDone. Created: ${created}  Skipped: ${skipped}`);
  await prisma.$disconnect();
}

main().catch(e => { console.error(e); process.exit(1); });
```

---

## 3. New Backend Endpoints Required

The updated `admin-passkeys.html` calls two new endpoints.  
Add these alongside the existing passkey handlers.

---

### Endpoint 5: `POST /api/admin/passkeys/update`

Allows admin to change a user's display name, title, and optionally reset their passkey.

```javascript
async function updatePasskey(req, res) {
  const adminRole = req.headers['x-user-role'];
  if (adminRole !== 'ADMINISTRATOR') {
    return res.status(403).json({ error: 'Admin access required' });
  }

  const { username, displayName, title, passkey } = req.body;
  if (!username || !displayName) {
    return res.status(400).json({ error: 'username and displayName required' });
  }

  // If a new passkey is supplied, validate and hash it
  let updateData = { displayName, title: title || null };

  if (passkey) {
    if (!/^\d{4,8}$/.test(passkey)) {
      return res.status(400).json({ error: 'Passkey must be 4–8 digits' });
    }
    const bcrypt = require('bcrypt');
    updateData.passkey = await bcrypt.hash(passkey, 10);
    updateData.lastResetAt = new Date();
  }

  try {
    await prisma.userPasskey.update({
      where: { username },
      data: updateData
    });
    res.json({ success: true, message: `Updated ${displayName}` });
  } catch (error) {
    if (error.code === 'P2025') {
      return res.status(404).json({ error: 'User not found' });
    }
    console.error('updatePasskey error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

---

### Endpoint 6: `POST /api/admin/passkeys/enable`

Re-activates a previously disabled user.

```javascript
async function enablePasskey(req, res) {
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
      data: { isActive: true }
    });
    res.json({ success: true, message: `Passkey enabled for ${username}` });
  } catch (error) {
    console.error('enablePasskey error:', error);
    res.status(500).json({ error: error.message });
  }
}
```

---

### Register Both Routes

Add these two lines alongside the existing route registrations:

```javascript
// Express
app.post('/api/admin/passkeys/update', updatePasskey);
app.post('/api/admin/passkeys/enable', enablePasskey);

// OR raw Node.js
if (req.method === 'POST' && req.url === '/api/admin/passkeys/update') {
  return updatePasskey(req, res);
}
if (req.method === 'POST' && req.url === '/api/admin/passkeys/enable') {
  return enablePasskey(req, res);
}
```

---

## 4. Admin-Passkeys HTML Changes (summary)

The updated `admin-passkeys.html` adds:

| Change | Detail |
|---|---|
| **Edit button** per row | Opens modal with name, title, optional passkey reset |
| **Enable button** | Shown instead of Disable for inactive users — re-activates them |
| **Search/filter bar** | Live search across name, email, title |
| **4-column create form** | Username, name, title, passkey all on one row |
| **Modal overlay** | Click outside or Cancel to close; Save calls `/api/admin/passkeys/update` |
| **User count** | Shows "18 users" under the table heading |

---

## 5. Workflow After Setup

1. Developer runs the seed script (or Michaela adds users manually via the UI).
2. All 18 users appear in the table with placeholder passkey `0000` and no title.
3. Michaela opens `/pages/admin-passkeys.html`, clicks **Edit** on each user, sets:
   - Correct **Job Title**
   - New **Passkey** (4–8 digits — keep a private record)
4. Users are live and can sign records using the number-pad on any form.

---

**Status:** Ready to implement  
**Estimated time:** 30 min seed + 30 min backend endpoints  
