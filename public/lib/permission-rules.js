/*
 * Single source of truth for who may do what across the online records system.
 *
 * This file exists so that when sign-off/permission policy changes, there is exactly
 * one place to edit -- not one gate scattered through every record's script.
 *
 * ROLES and RULES below are a first pass. Edit freely as the real policy is defined;
 * nothing else needs to change as long as action names stay the same.
 *
 * There is no login system yet. Until one exists, the "acting as" role is chosen by
 * hand in each record's header and stored in localStorage (see setCurrentRole below).
 * Once real logins land, replace getCurrentRole() with the authenticated user's role --
 * every record calls PermissionRules.can(action), so that is the only change needed.
 */
(function () {
  // Underscored throughout: auth.js issues these exact strings on login and RULES keys
  // off them. 'QA MANAGER'/'PRODUCTION MANAGER' with spaces used to be listed here, so
  // setCurrentRole() silently rejected those two logins and left them on the default
  // role -- every QA/Production Manager silently held Production Supervisor rights.
  //
  // Same class of bug, second instance (fixed 2026-07-30): ROLE_LABELS and every RULES
  // entry keyed off 'PRODUCTION_AND_EXPORT_MANAGER' while ROLES and auth.js said
  // 'PRODUCTION_MANAGER'. can() therefore returned false for a logged-in Production
  // Manager on every gated action -- they could not fill, save, complete or verify
  // anything. auth.js is the authority for these strings; if a title changes, change it
  // there first, then grep this file for the OLD key before adding the new one.
  const ROLES = ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMINISTRATOR'];

  const ROLE_LABELS = {
    PRODUCTION_SUPERVISOR: 'Production Supervisor',
    SHIFT_MANAGER: 'Shift Manager',
    QUALITY_SUPERVISOR: 'Quality Supervisor',
    QUALITY_CONTROLLER: 'Quality Controller',
    QA_MANAGER: 'QA Manager',
    PRODUCTION_MANAGER: 'Production Manager',
    OPERATOR: 'Operator',
    ADMINISTRATOR: 'Administrator'
  };

  // action name -> roles allowed to perform it.
  // First-pass guess: quality roles hold sign-off/spec authority, production roles can
  // fill in and save but not complete/verify/change specs. Not yet confirmed against
  // real policy -- adjust freely, this is the only place that needs editing.
  const RULES = {
    fillMeasurements: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMINISTRATOR'],
    saveDraft: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMINISTRATOR'],
    completeRecord: ['QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'PRODUCTION_SUPERVISOR', 'OPERATOR', 'ADMINISTRATOR'],
    verifyRecord: ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER'],
    acknowledgeSpecChange: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER'],
    manageSpecs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMINISTRATOR'],
    // REC 01 Master Index List is a document-control record -- only the roles that own
    // document control tick off obsolete-retrieved / new-revision-distributed.
    manageMasterIndex: ['QA_MANAGER', 'QUALITY_SUPERVISOR', 'ADMINISTRATOR'],
    // SOPs are controlled procedure documents, not fill-in records -- editing the
    // procedure text itself (not just filling in a form) is a document-control action.
    manageSOPs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMINISTRATOR'],
  };

  const ROLE_KEY = 'acting_as_role';
  const storedRole = window.localStorage.getItem(ROLE_KEY);
  let currentRole = ROLES.includes(storedRole) ? storedRole : 'PRODUCTION_SUPERVISOR';

  function getCurrentRole() {
    return currentRole;
  }

  function setCurrentRole(role) {
    if (!ROLES.includes(role)) return;
    currentRole = role;
    window.localStorage.setItem(ROLE_KEY, role);
  }

  function can(action) {
    const allowed = RULES[action];
    if (!allowed) return true; // actions not listed are not gated
    return allowed.includes(currentRole);
  }

  window.PermissionRules = { ROLES, ROLE_LABELS, RULES, can, getCurrentRole, setCurrentRole };
})();
