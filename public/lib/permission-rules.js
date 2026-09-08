(function () {

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


  const RULES = {
    fillMeasurements: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMINISTRATOR'],
    saveDraft: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'OPERATOR', 'ADMINISTRATOR'],
    completeRecord: ['QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'PRODUCTION_SUPERVISOR', 'OPERATOR', 'ADMINISTRATOR'],
    verifyRecord: ['QUALITY_SUPERVISOR', 'QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER'],
    acknowledgeSpecChange: ['PRODUCTION_SUPERVISOR', 'SHIFT_MANAGER', 'QUALITY_SUPERVISOR', 'QUALITY_CONTROLLER', 'QA_MANAGER', 'PRODUCTION_MANAGER'],
    manageSpecs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'SHIFT_MANAGER', 'ADMINISTRATOR'],

    manageMasterIndex: ['QA_MANAGER', 'QUALITY_SUPERVISOR', 'ADMINISTRATOR'],

    manageSOPs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMINISTRATOR'],
    managePolicies: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMINISTRATOR'],
    manageProcedures: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMINISTRATOR'],
    managePRPs: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMINISTRATOR'],
    manageTemplates: ['QA_MANAGER', 'PRODUCTION_MANAGER', 'ADMINISTRATOR'],
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
    const allowed = RULES[action];
    if (!allowed) return true;
    return allowed.includes(currentRole);
  }

  window.PermissionRules = { ROLES, ROLE_LABELS, RULES, can, getCurrentRole, setCurrentRole };
})();
