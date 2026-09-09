// Server-side handle on the compute registry. Same file the browser loads as
// window.ComputeRegistry, so a form's live preview and the value the API stores/validates
// are produced by identical code. See public/lib/compute/registry.js and Consolidated Plan 6.1.
module.exports = require('../public/lib/compute/registry.js');
