(function () {

  const ROLES = ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMIN', 'ADMINISTRATOR'];

  const ROLE_LABELS = {
    PRODUCTION_SUPERVISOR: 'Production Supervisor',
    SHIFT_MANAGER: 'Shift Manager',
    QUALITY_SUPERVISOR: 'Quality Supervisor',
    QUALITY_CONTROLLER: 'Quality Controller',
    QA_MANAGER: 'QA Manager',
    PRODUCTION_MANAGER: 'Production Manager',
    OPERATOR: 'Operator',
    ADMIN: 'Admin',
    ADMINISTRATOR: 'Administrator'
  };


  const RULES = {
    fillMeasurements: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMIN', 'ADMINISTRATOR'],
    saveDraft: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMIN', 'ADMINISTRATOR'],
    completeRecord: ['QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'PRODUCTION_SUPERVISOR', 'OPERATOR', 'ADMIN', 'ADMINISTRATOR'],
    verifyRecord: ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
    acknowledgeSpecChange: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
    manageSpecs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMIN', 'ADMINISTRATOR'],

    manageMasterIndex: ['QA_MANAGER', 'QUALITY_SUPERVISOR', 'ADMIN', 'ADMINISTRATOR'],

    manageSOPs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
    managePolicies: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
    manageProcedures: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
    managePRPs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
    manageTemplates: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],

    // Delete a submitted/draft entry from a record. Requires double passkey sign-off on the API.
    // This rule controls whether the UI shows the delete button at all.
    // Amend a submitted record (reason + passkey re-sign-off). Verified records are additionally
    // gated to the record's verifier roles via SignOffBlock.verifyGate().
    editSubmission: ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMIN', 'ADMINISTRATOR'],

    deleteSubmission: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMIN', 'ADMINISTRATOR'],
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


  const ENFORCE_ROLES = false;

  function can(action) {
    if (!ENFORCE_ROLES) return true;
    if (currentRole === 'ADMINISTRATOR') return true;
    const allowed = RULES[action];
    if (!allowed) return true;
    return allowed.includes(currentRole);
  }

  window.PermissionRules = { ROLES, ROLE_LABELS, RULES, can, getCurrentRole, setCurrentRole };
})();
