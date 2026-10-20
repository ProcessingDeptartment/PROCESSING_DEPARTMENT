# Monitoring.js PDF Save Naming Standardization

**Status**: ✅ COMPLETED  
**File Modified**: `public/lib/monitoring-log.js` (Line 3000)  
**Date**: 2026-10-20

---

## Issue

The PDF save naming convention in `monitoring-log.js` differs from the form naming in `form-record.js`, creating inconsistent filenames and redundancy.

### Current (Non-Standard)
```
Monitoring Log (monitoring-log.js): docCode_title_date
Example: REC-7.4.2_REC-7.4.2-Dry-Monitoring_2026-10-20.pdf ❌ (redundant)
```

### Standard (form-record.js)
```
Dry Monitoring Forms: title_date
Example: REC-7.4.2-Dry-Monitoring_2026-10-20.pdf ✅ (clean)
```

---

## Solution Applied

Changed line 3000 in `public/lib/monitoring-log.js`:

### Before
```javascript
const filename = safeKey(docCode) + '_' + safeKey(title) + '_' + stamp;
```

### After
```javascript
const filename = safeKey(title) + '_' + stamp;
```

---

## Result

PDF filenames now follow the standard format across both systems:

| System | Format | Example |
|--------|--------|---------|
| Dry Monitoring (form-record.js) | `[title]_[date]` | `REC-7.4.2-Dry-Monitoring_2026-10-20.pdf` |
| Monitoring Log (monitoring-log.js) | `[title]_[date]` | `REC-7.4.2-Dry-Monitoring_2026-10-20.pdf` |

---

## Technical Details

- **File**: `public/lib/monitoring-log.js`
- **Line**: 3000
- **Scope**: PDF filename generation only (no database or form changes)
- **Testing**: Save any monitoring entry as PDF to verify filename format
- **Impact**: Cleaner, shorter, more consistent filenames

---

## Alternative: Include docCode

If you prefer docCode prefix for better file sorting:

```javascript
const filename = safeKey(docCode) + '-' + safeKey(title) + '_' + stamp;
```

Example: `REC-7.4.2-REC-7.4.2-Dry-Monitoring_2026-10-20.pdf`

---

## Deployment

- ✅ Code change completed
- ✅ File committed to repository
- Ready to push to `main` for auto-deployment via Render
