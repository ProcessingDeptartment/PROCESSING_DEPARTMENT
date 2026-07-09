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
  const ROLES = ['PRODUCTION_OPERATOR', 'QUALITY_TECHNICIAN', 'QA_MANAGER', 'ADMIN'];

  // action name -> roles allowed to perform it
  const RULES = {
    fillMeasurements: ['PRODUCTION_OPERATOR', 'QUALITY_TECHNICIAN', 'QA_MANAGER', 'ADMIN'],
    saveDraft: ['PRODUCTION_OPERATOR', 'QUALITY_TECHNICIAN', 'QA_MANAGER', 'ADMIN'],
    completeRecord: ['QA_MANAGER', 'ADMIN'],
    verifyRecord: ['QA_MANAGER', 'ADMIN'],
    acknowledgeSpecChange: ['PRODUCTION_OPERATOR', 'QUALITY_TECHNICIAN', 'QA_MANAGER', 'ADMIN'],
    updateSpecProfile: ['QA_MANAGER', 'ADMIN'],
    publishSpecVersion: ['QA_MANAGER', 'ADMIN'],
    uploadSpecFile: ['QA_MANAGER', 'ADMIN']
  };

  const ROLE_KEY = 'acting_as_role';
  let currentRole = window.localStorage.getItem(ROLE_KEY) || 'PRODUCTION_OPERATOR';

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

  window.PermissionRules = { ROLES, RULES, can, getCurrentRole, setCurrentRole };
})();
