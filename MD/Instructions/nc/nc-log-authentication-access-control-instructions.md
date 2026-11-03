# NC Log Authentication & Access Control — Instructions

**Date:** 2026-11-03  
**Raised by:** Michaela  
**Type:** Security & authentication for NC log system  
**Use in:** Claude Code (build) + backend API  
**Related:** `nc-log-passkey-signoff-instructions.md`, `nc-auto-close-on-corrective-action-completion-instructions.md`

---

## 1. Purpose

The NC (Non-Conformance) Log is a critical compliance record. Only authenticated, authorized users should be able to view, edit, or manage NC records:

✅ **Require login** before showing the NC log page  
✅ **Enforce role-based access** (who can view, edit, close NCs)  
✅ **Prevent unauthenticated access** via direct URL navigation  
✅ **Redirect to login** if session expires while viewing NC log  
✅ **Log all access** to NC records for audit purposes

---

## 2. Access control rules

### 2a. Who can VIEW the NC log?

- ✅ Quality Manager
- ✅ Production Manager
- ✅ Quality Supervisor
- ✅ Dry Room Manager
- ✅ Process Manager
- ✅ Admin

**Others:** Cannot access. Get 403 "Access Denied" if they try.

### 2b. Who can EDIT an NC?

- ✅ NC creator (who raised the NC)
- ✅ Quality Manager
- ✅ Production Manager
- ✅ Admin

**Condition:** NC must not be closed (read-only after closure).

### 2c. Who can CLOSE an NC?

- ✅ Quality Manager (any severity)
- ✅ Production Manager (any severity)
- ✅ Quality Supervisor (Minor/Major only, not Critical)
- ✅ Admin (any severity)

**Condition:** NC must be "ready_to_close" + corrective action filled.

### 2d. Who can REOPEN a closed NC?

- ✅ Quality Manager
- ✅ Production Manager
- ✅ Admin

**Condition:** Only with passkey authentication + reason documented.

### 2e. Who can DELETE an NC?

- ✅ Admin only

---

## 3. Database changes

### 3a. Add `nc_access_log` table

```sql
CREATE TABLE "nc_access_log" (
  id BIGSERIAL PRIMARY KEY,
  username TEXT NOT NULL,
  nc_id BIGINT REFERENCES "nc_log"(id),
  action TEXT,                           -- 'view', 'edit', 'close', 'reopen', 'denied'
  accessed_at TIMESTAMP DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

CREATE INDEX idx_nc_access_log_username ON "nc_access_log"(username);
CREATE INDEX idx_nc_access_log_accessed_at ON "nc_access_log"(accessed_at DESC);
```

---

## 4. Backend API changes

### 4a. Protect ALL `/api/nc/*` endpoints

Add authentication + role checks to every endpoint:

```javascript
// Check session first
if (!req.session?.userId) return res.status(401).json({ error: 'Not authenticated' });

// Check role
const allowedRoles = ['Quality Manager', 'Production Manager', 'Quality Supervisor', 'Dry Room Manager', 'Process Manager', 'Admin'];
if (!allowedRoles.includes(req.session.role)) {
  return res.status(403).json({ error: 'Access denied' });
}

// Log access
logAccess(req.session.userId, ncId, action, req);
```

### 4b. Add role-based authorization for CLOSE

```javascript
const canClose = (role, severity) => {
  if (['Quality Manager', 'Production Manager', 'Admin'].includes(role)) return true;
  if (role === 'Quality Supervisor' && ['Minor', 'Major'].includes(severity)) return true;
  return false;
};

if (!canClose(req.session.role, nc.severity)) {
  return res.status(403).json({ error: `Your role cannot close ${nc.severity} severity NCs.` });
}
```

### 4c. Add logAccess() helper

```javascript
async function logAccess(username, ncId, action, req) {
  try {
    await prisma.ncAccessLog.create({
      data: {
        username,
        ncId: ncId ? parseInt(ncId) : null,
        action,
        ipAddress: req.ip || req.connection.remoteAddress,
        userAgent: req.get('user-agent')
      }
    });
  } catch (error) {
    console.warn('Failed to log access:', error);
  }
}
```

---

## 5. Frontend changes

### 5a. Add auth check to nc-log.html

```javascript
window.addEventListener('DOMContentLoaded', () => {
  const user = window.Auth?.getCurrentUser?.();
  const role = window.Auth?.getCurrentRole?.();
  
  const allowedRoles = ['Quality Manager', 'Production Manager', 'Quality Supervisor', 'Dry Room Manager', 'Process Manager', 'Admin'];
  
  // Not logged in → redirect to login
  if (!user) {
    window.location.href = '/index.html?redirectTo=/pages/nc-log.html';
    return;
  }
  
  // No valid role → show access denied
  if (!allowedRoles.includes(role)) {
    document.body.innerHTML = `
      <div style="padding: 20px; text-align: center;">
        <h1>⛔ Access Denied</h1>
        <p>You do not have permission to access the NC Log.</p>
        <p>Your role: <strong>${role}</strong></p>
      </div>
    `;
    return;
  }
  
  // Allowed → load NC log
  initNCLog();
});
```

### 5b. Disable edit buttons based on role

```javascript\nfunction updateModalButtonState(nc, user, role) {\n  const isCreator = user === nc.created_by;\n  const isManager = ['Quality Manager', 'Production Manager', 'Admin'].includes(role);\n  const canEdit = isCreator || isManager;\n  \n  if (nc.status === 'closed' || !canEdit) {\n    document.getElementById('nc-signoff-section').innerHTML = '<p>⛔ Read-only</p>';\n    document.getElementById('nc-corrective-action').disabled = true;\n    document.getElementById('nc-notes').disabled = true;\n    return;\n  }\n  \n  // User can edit\n  document.getElementById('nc-signoff-section').style.display = 'block';\n}\n```\n\n### 5c. Handle session expiry\n\n```javascript\nasync function initNCLog() {\n  const response = await fetch('/api/nc');\n  \n  if (response.status === 401) {\n    window.location.href = '/index.html?redirectTo=/pages/nc-log.html';\n    return;\n  }\n  \n  if (response.status === 403) {\n    document.body.innerHTML = '<h1>Access Denied</h1>';\n    return;\n  }\n  \n  const ncs = await response.json();\n  renderNCTable(ncs);\n}\n```\n\n---\n\n## 6. Configuration\n\n### 6a. Add to `.env`\n\n```\nNC_ALLOWED_ROLES=Quality Manager,Production Manager,Quality Supervisor,Dry Room Manager,Process Manager,Admin\nNC_MANAGER_ROLES=Quality Manager,Production Manager,Admin\nNC_CRITICAL_ROLES=Quality Manager,Production Manager,Admin\n```\n\n---\n\n## 7. Implementation checklist\n\n- [ ] Add `nc_access_log` table to Neon\n- [ ] Add authentication check to ALL `/api/nc/*` endpoints\n- [ ] Add role-based authorization checks\n- [ ] Implement `logAccess()` function\n- [ ] Add auth check to `nc-log.html` (redirect if not logged in)\n- [ ] Disable edit buttons for users without permission\n- [ ] Handle session expiry (redirect to login on 401)\n- [ ] Test: Access NC log without login → redirect to login\n- [ ] Test: Access with invalid role → show \"Access Denied\"\n- [ ] Test: Supervisor cannot close Critical NCs\n- [ ] Test: Manager can close any severity\n\n---\n\n## 8. Access control table\n\n| User | Role | View | Edit | Close Major | Close Critical |\n|---|---|---|---|---|---|\n| Michaela | Quality Manager | ✅ | ✅ | ✅ | ✅ |\n| John | Quality Supervisor | ✅ | ✅ | ✅ | ❌ |\n| Sarah | Dry Room Manager | ✅ | ✅ | ❌ | ❌ |\n| Bob | Line Operator | ❌ | ❌ | ❌ | ❌ |\n| (not logged in) | None | ❌ | ❌ | ❌ | ❌ |\n\n---\n\n## 9. Security summary\n\n✅ Authentication required (session-based)  \n✅ Role-based access control (RBAC)  \n✅ Passkey verification for all changes  \n✅ Audit logging of all access  \n✅ Read-only for closed NCs  \n✅ No unauthenticated access allowed
