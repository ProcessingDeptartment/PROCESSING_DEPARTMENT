# Fix: Restore Title Pre-Fill from Login

## In public/lib/form-record.js

### Find the suggestCompletedBy() function (around line 1438-1450)

**CURRENT CODE (BROKEN):**
```javascript
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  if (username && formElement(cbByInputId)) {
    formElement(cbByInputId).value = username;
  }
}
```

**REPLACE WITH (FIXED):**
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

### Find openForm() function and ensure it calls suggestCompletedBy()

**ENSURE THIS CODE EXISTS:**
```javascript
function openForm(id) {
  if (!id) {  // new entry, not editing
    // Clear fields
    if (formElement(cbByInputId)) formElement(cbByInputId).value = '';
    if (formElement(cbTitleInputId)) formElement(cbTitleInputId).value = '';
    if (formElement(cbDateInputId)) formElement(cbDateInputId).value = '';
    if (formElement(cbSigInputId)) formElement(cbSigInputId).value = '';
    
    // Pre-fill from auth
    suggestCompletedBy();
  } else {
    // editing existing - load stored values
    if (existing.completedBy) {
      if (formElement(cbByInputId)) formElement(cbByInputId).value = existing.completedBy.by || '';
      if (formElement(cbTitleInputId)) formElement(cbTitleInputId).value = existing.completedBy.title || '';
      if (formElement(cbDateInputId)) formElement(cbDateInputId).value = existing.completedBy.date || '';
      if (formElement(cbSigInputId)) formElement(cbSigInputId).value = existing.completedBy.signature || '';
    }
  }
  
  // ... rest of openForm logic ...
}

// Hook to auth changes
if (window.addEventListener) {
  window.addEventListener('authSuccess', function() {
    if (formIsOpen && !currentEntryId) {
      suggestCompletedBy();
    }
  });
}
```

---

## In public/lib/monitoring-log.js

### Find suggestCompletedBy() function (look for it in the monitoring log initialization)

**CURRENT CODE (BROKEN):**
```javascript
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  if (username && el(idPrefix + '_cb_by')) {
    el(idPrefix + '_cb_by').value = username;
  }
}
```

**REPLACE WITH (FIXED):**
```javascript
function suggestCompletedBy() {
  const username = window.Auth?.getCurrentUsername?.() || '';
  const title = window.Auth?.getCurrentRole?.() || '';
  
  if (username && el(idPrefix + '_cb_by')) {
    el(idPrefix + '_cb_by').value = username;
  }
  if (title && el(idPrefix + '_cb_title')) {
    el(idPrefix + '_cb_title').value = title;
  }
}
```

### Ensure it's called in openForm():

```javascript
function openForm(id) {
  if (!id) {  // new entry
    // Clear fields
    if (el(idPrefix + '_cb_by')) el(idPrefix + '_cb_by').value = '';
    if (el(idPrefix + '_cb_title')) el(idPrefix + '_cb_title').value = '';
    if (el(idPrefix + '_cb_date')) el(idPrefix + '_cb_date').value = '';
    if (el(idPrefix + '_cb_sig')) el(idPrefix + '_cb_sig').value = '';
    
    // Pre-fill from auth
    suggestCompletedBy();
  } else {
    // editing existing
    if (existing.completedBy) {
      if (el(idPrefix + '_cb_by')) el(idPrefix + '_cb_by').value = existing.completedBy.by || '';
      if (el(idPrefix + '_cb_title')) el(idPrefix + '_cb_title').value = existing.completedBy.title || '';
      if (el(idPrefix + '_cb_date')) el(idPrefix + '_cb_date').value = existing.completedBy.date || '';
      if (el(idPrefix + '_cb_sig')) el(idPrefix + '_cb_sig').value = existing.completedBy.signature || '';
    }
  }
}

// Hook to auth changes
window.addEventListener('authSuccess', function() {
  if (formIsOpen && !currentEntryId) {
    suggestCompletedBy();
  }
});
```

---

## Testing

After making these changes:

1. ✓ Login as "Quality Supervisor"
2. ✓ Open a record form
3. ✓ Check "Completed by" field shows your username
4. ✓ Check "Title" field shows "Quality Supervisor"
5. ✓ Sign out and login as different role
6. ✓ Verify title now shows the new role
7. ✓ Test in monitoring logs too
