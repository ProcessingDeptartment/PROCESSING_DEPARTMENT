# Fix: Exclude ready_to_close NCs from login notification popup

File: `public/lib/nc-login-alert.js`

## Change required

In `fetchOpenNCs()`, the filter currently excludes only `closed` status.
NCs with `ready_to_close` status must also be excluded so they no longer
appear in the login popup.

### Line ~69 — update the filter:

Change:
```
return (rows || []).filter(function (nc) { return nc.status !== 'closed'; });
```

To:
```
return (rows || []).filter(function (nc) {
  return nc.status !== 'closed' && nc.status !== 'ready_to_close';
});
```

### Also in `showAlert()` — clean up the dead branch:

Change:
```
var cls = nc.status === 'in_progress' ? 'nc-alert-prog'
           : nc.status === 'ready_to_close' ? 'nc-alert-rtc' : '';
var statusLabel = nc.status === 'in_progress' ? 'In progress'
                : nc.status === 'ready_to_close' ? 'Ready to close' : 'Open';
```

To:
```
var cls = nc.status === 'in_progress' ? 'nc-alert-prog' : '';
var statusLabel = nc.status === 'in_progress' ? 'In progress' : 'Open';
```

## Commit
```
git add public/lib/nc-login-alert.js
git commit -m "nc-login-alert: exclude ready_to_close NCs from login popup"
git push
```
