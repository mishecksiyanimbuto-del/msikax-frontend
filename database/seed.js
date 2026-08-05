// ============================================================================
// This is a thin pointer, not the real script. The actual seeding logic
// lives in server/scripts/seed.js — it has to, since Node resolves
// require('dotenv')/require('mongoose')/etc. relative to wherever the file
// physically sits, and only server/ has those packages installed
// (server/node_modules). A copy sitting directly in this folder would fail
// to find them, since database/ is a sibling of server/, not inside it.
//
// Run the real thing with: npm run seed   (from inside server/)
// ============================================================================
require('../server/scripts/seed.js');
