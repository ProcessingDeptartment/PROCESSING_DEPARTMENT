# Change: Remove submission list from individual form pages

## Problem

Every time a user opens a record form page (e.g. Drying Process, Dry Cooking, Abalone Receiving), the app fetches the full submission list for that record type from the API. This list contains all past submissions as a large JSON array.

With ~20 users each opening multiple forms per day, this is generating several GB of network transfer per month against Neon's 5 GB monthly limit.

## Goal

- Individual form pages (e.g. `REC Drying Process.html`) should **not** load or display the past submission list
- The submission list stays available on the dedicated **Submissions page** only
- Users who need to view or continue a past submission go via the Submissions page

## What to change

### 1. `public/lib/form-record.js`

The list-loading logic is triggered on page load when the form is in "list mode" (before a record is opened). Find the section that:
- Fetches `formrecord:<recordKey>` from the API/KeyValue store
- Renders the list of past submissions

This fetch should be **skipped on individual form pages**. Options:
- Add a config flag `"showList": false` to the record definition JSON, and skip the list fetch when it is false
- Or detect that the page is a form page (not the submissions page) and skip the fetch entirely

The list UI elements on form pages can be hidden or removed from the HTML shells.

### 2. Individual record HTML files (`public/records/REC *.html`)

Each HTML shell may contain a list container element (e.g. a `<div id="record-list">` or similar). This can be removed or hidden, since the list will no longer load on these pages.

### 3. Submissions page

Confirm that the submissions page still loads and displays the full list as normal — this page should be the only place the full `formrecord:*` array is fetched.

## Expected outcome

- Network transfer drops significantly (list fetches removed from ~20 form opens per user per day)
- Users open form pages faster (no list fetch on load)
- Past submissions still accessible via the Submissions page
- No change to how individual records are saved or submitted

## Notes

- The `formrecord:<key>` data in KeyValue is **not** being deleted — it stays intact
- This is a frontend-only change; no DB or API changes required
- Bump `?v=N` on all affected HTML files after changing `form-record.js`
