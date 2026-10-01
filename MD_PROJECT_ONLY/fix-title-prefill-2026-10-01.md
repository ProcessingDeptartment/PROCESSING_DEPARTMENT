# Fix: Restore User Title Pre-Fill from Login

**Issue:** The "Title" field in the "Completed by / Title / Date / Signature" block is not pre-filling with the logged-in user's role.

**Expected Behavior:**
- When a user logs in (e.g., "Quality Supervisor")
- The "Title" field in the Completed by block should auto-fill with their role
- On `authSuccess` event, the suggestion should run again
- Each new entry should get the current user's title pre-filled

**Root Cause:**
The `suggestCompletedBy()` function in `public/lib/form-record.js` (around line ~1438) is missing the **title pre-fill logic**. It currently pre-fills the "Completed by" name from `window.Auth.getCurrentUsername()` but does not pre-fill the "Title" field with `window.Auth.getCurrentRole()`.

---

## Fix - In `public/lib/form-record.js`

**Location:** In the `formElements` object (or wherever `formElement` handlers are defined), find the `suggestCompletedBy` function or create it if missing.

**Current (broken) code:**
```javascript
// Around line 1438-1450
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  if (username && formElement(cbByInputId)) {
    formElement(cbByInputId).value = username;
  }
}
```

**Replace with (fixed):**
```javascript
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  const title = window.Auth?.getCurrentRole?.() || '';
  
  if (username && formElement(cbByInputId)) {
    formElement(cbByInputId).value = username;
  }
  
  if (title && formElement(cbTitleInputId)) {
    formElement(cbTitleInputId).value = title;
  }
}
```

---

## Additional: Hook `suggestCompletedBy` to Auth Events

**Location:** In `public/lib/form-record.js`, find where `authSuccess` event is handled (likely in an `openForm()` or similar function).

**Ensure this code runs on form load and on auth changes:**
```javascript
// When openForm() runs for a new entry:
function openForm(id) {
  if (!id) {  // new entry, not editing existing
    // clear the fields first
    if (formElement(cbByInputId)) formElement(cbByInputId).value = '';
    if (formElement(cbTitleInputId)) formElement(cbTitleInputId).value = '';
    if (formElement(cbDateInputId)) formElement(cbDateInputId).value = '';
    if (formElement(cbSigInputId)) formElement(cbSigInputId).value = '';
    
    // then pre-fill from current auth
    suggestCompletedBy();
  } else {
    // editing existing entry - load the stored completedBy
    if (existing.completedBy) {
      if (formElement(cbByInputId)) formElement(cbByInputId).value = existing.completedBy.by || '';
      if (formElement(cbTitleInputId)) formElement(cbTitleInputId).value = existing.completedBy.title || '';
      if (formElement(cbDateInputId)) formElement(cbDateInputId).value = existing.completedBy.date || '';
      if (formElement(cbSigInputId)) formElement(cbSigInputId).value = existing.completedBy.signature || '';
    }
  }
  // ... rest of openForm logic
}

// Also hook to auth changes
if (window.addEventListener) {
  window.addEventListener('authSuccess', function() {
    // if the form is open and it's for a new entry, update suggestions
    if (formIsOpen && !currentEntryId) {
      suggestCompletedBy();
    }
  });
}
```

---

## Apply the Same Fix to Monitoring Logs

**File:** `public/lib/monitoring-log.js`

The same issue exists in the monitoring log engine. In `openForm(id)`:

**Replace:**
```javascript
// old - only pre-fills username
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  if (username) {
    el(idPrefix + '_cb_by').value = username;
  }
}
```

**With:**
```javascript
// new - pre-fills both username and title
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  const title = window.Auth?.getCurrentRole?.() || '';
  
  if (username) {
    el(idPrefix + '_cb_by').value = username;
  }
  if (title) {
    el(idPrefix + '_cb_title').value = title;
  }
}
```

And ensure it's called:
- When opening a new entry in `openForm()`
- After `authSuccess` event fires

---

## Testing Checklist

After applying the fix:

- [ ] Load the form in a fresh browser session
- [ ] Sign in as "Quality Supervisor"
- [ ] Open a record (e.g., REC 7.1.2)
- [ ] Check that **"Completed by"** field shows your username
- [ ] Check that **"Title"** field shows "Quality Supervisor"
- [ ] Submit the form and check the saved data
- [ ] Sign out and sign in as a different role
- [ ] Open another record - confirm new role appears in Title field
- [ ] Test in a monitoring log (e.g., REC 7.1.1 Dry Monitoring)
- [ ] Confirm Title pre-fills there too

---

## Files to Update

1. `public/lib/form-record.js`
   - Fix `suggestCompletedBy()` function
   - Wire it to `openForm()` and `authSuccess` event

2. `public/lib/monitoring-log.js`
   - Fix `suggestCompletedBy()` function in the monitoring log implementation
   - Wire it to `openForm()` and `authSuccess` event

3. Cache bust: After deploying, bump `?v=` on pages that load these libraries (~250 pages)

---

## Why This Broke

During the "completed by" block refactor (SIGNOFF-LOGIN-FIX-2026-09-22), the title pre-fill was accidentally not implemented when the username pre-fill was added. The function only handles the "Completed by" name field, not the "Title" field.

---

**Status:** Ready to implement  
**Severity:** Medium (users can still manually type title, but convenience is lost)  
**Complexity:** Low (1-2 lines per file)
