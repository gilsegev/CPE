/**
 * Directus Schema Setup Script for CPE Training Platform
 * 
 * This script runs locally and uses the Directus REST API to automatically create
 * all collections, custom fields, and relationships required for Phase 1.
 * 
 * Usage:
 *   node setup_directus.js <DIRECTUS_URL> <ADMIN_TOKEN>
 * 
 * Example:
 *   node setup_directus.js https://cpe-production.up.railway.app sOmE_aDmIn_tOkEn
 */

const dns = require('dns');
dns.setDefaultResultOrder('ipv4first'); // Fixes potential localhost connection issues on Node 18+

const [,, directusUrl, adminToken] = process.argv;

if (!directusUrl || !adminToken) {
  console.error('\x1b[31mError: Missing arguments.\x1b[0m');
  console.log('Usage: node setup_directus.js <DIRECTUS_URL> <ADMIN_TOKEN>');
  process.exit(1);
}

// Automatically strip trailing slashes or '/admin' from the URL
let url = directusUrl.trim().replace(/\/$/, '');
url = url.replace(/\/admin\/?$/, '');


const headers = {
  'Content-Type': 'application/json',
  'Authorization': `Bearer ${adminToken}`
};

// Helper function to send API requests
async function api(path, method = 'GET', body = null) {
  const options = {
    method,
    headers,
  };
  if (body) {
    options.body = JSON.stringify(body);
  }
  
  const response = await fetch(`${url}${path}`, options);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`API Error on ${method} ${path} (${response.status}): ${errorText}`);
  }
  return response.json();
}

async function main() {
  console.log(`\n\x1b[36mStarting Directus Configuration on ${url}...\x1b[0m\n`);

  // 1. Extend System Users (directus_users)
  console.log('1. Extending system users collection with legal_name and tea_id...');
  try {
    await api('/fields/directus_users', 'POST', {
      field: 'legal_name',
      type: 'string',
      meta: {
        interface: 'input',
        required: true,
        width: 'half',
        options: { placeholder: 'Enter Legal Name for Certificate' }
      }
    });
    console.log('   [✓] Created legal_name field');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   [i] Field legal_name already exists, skipping.');
    } else {
      throw err;
    }
  }

  try {
    await api('/fields/directus_users', 'POST', {
      field: 'tea_id',
      type: 'string',
      meta: {
        interface: 'input',
        required: false,
        width: 'half',
        options: { placeholder: 'Enter TEA ID (Optional)' }
      }
    });
    console.log('   [✓] Created tea_id field');
  } catch (err) {
    if (err.message.includes('already exists')) {
      console.log('   [i] Field tea_id already exists, skipping.');
    } else {
      throw err;
    }
  }

  // Clean up virtual collections if they exist (schema === null)
  console.log('2. Checking for existing virtual collections (folders) to clean up...');
  const collectionNames = ['Courses', 'Modules', 'Purchases', 'Quizzes', 'Questions', 'Submissions', 'Certificates'];
  for (const name of collectionNames) {
    try {
      const res = await api(`/collections/${name}`, 'GET');
      if (res.data && res.data.schema === null) {
        console.log(`   [i] Collection "${name}" is a virtual folder. Deleting so it can be recreated...`);
        await api(`/collections/${name}`, 'DELETE');
        console.log(`   [✓] Deleted virtual folder: ${name}`);
      }
    } catch (err) {
      // Ignore if not found
    }
  }

  // Define collections to create
  const collections = [
    {
      collection: 'Courses',
      schema: {},
      meta: { show_in_navigation: true, icon: 'school' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'status', type: 'string', schema: { default_value: 'draft' }, meta: { interface: 'select-dropdown', options: { choices: [{text: 'Published', value: 'published'}, {text: 'Draft', value: 'draft'}, {text: 'Archived', value: 'archived'}] } } },
        { field: 'title', type: 'string', meta: { interface: 'input', required: true } },
        { field: 'description', type: 'text', meta: { interface: 'input-rich-text-html' } },
        { field: 'price', type: 'decimal', meta: { interface: 'input' } },
        { field: 'is_published', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean' } },
        { field: 'thumbnail_url', type: 'string', meta: { interface: 'input' } }
      ]
    },
    {
      collection: 'Modules',
      schema: {},
      meta: { show_in_navigation: true, icon: 'view_module' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'title', type: 'string', meta: { interface: 'input', required: true } },
        { field: 'order_index', type: 'integer', schema: { default_value: 0 }, meta: { interface: 'input' } },
        { field: 'mux_asset_id', type: 'string', meta: { interface: 'input' } },
        { field: 'is_free_preview', type: 'boolean', schema: { default_value: false }, meta: { interface: 'boolean' } },
        { field: 'course_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } }
      ]
    },
    {
      collection: 'Purchases',
      schema: {},
      meta: { show_in_navigation: true, icon: 'shopping_cart' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'stripe_payment_id', type: 'string', meta: { interface: 'input' } },
        { field: 'status', type: 'string', schema: { default_value: 'active' }, meta: { interface: 'select-dropdown', options: { choices: [{text: 'Active', value: 'active'}, {text: 'Refunded', value: 'refunded'}] } } },
        { field: 'user_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } },
        { field: 'course_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } }
      ]
    },
    {
      collection: 'Quizzes',
      schema: {},
      meta: { show_in_navigation: true, icon: 'quiz' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'passing_score', type: 'integer', schema: { default_value: 80 }, meta: { interface: 'input' } },
        { field: 'module_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } }
      ]
    },
    {
      collection: 'Questions',
      schema: {},
      meta: { show_in_navigation: true, icon: 'help_outline' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'question_text', type: 'text', meta: { interface: 'input', required: true } },
        { field: 'options', type: 'json', meta: { interface: 'tags' } }, // Simple tags interface to enter array of options
        { field: 'correct_answer_index', type: 'integer', meta: { interface: 'input', required: true } },
        { field: 'quiz_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } }
      ]
    },
    {
      collection: 'Submissions',
      schema: {},
      meta: { show_in_navigation: true, icon: 'assignment_turned_in' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'quiz_score', type: 'integer', meta: { interface: 'input' } },
        { field: 'essay_text', type: 'text', meta: { interface: 'textarea' } },
        { field: 'status', type: 'string', schema: { default_value: 'Pending' }, meta: { interface: 'select-dropdown', options: { choices: [{text: 'Pending', value: 'Pending'}, {text: 'Approved', value: 'Approved'}, {text: 'Rejected', value: 'Rejected'}] } } },
        { field: 'user_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } },
        { field: 'course_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } }
      ]
    },
    {
      collection: 'Certificates',
      schema: {},
      meta: { show_in_navigation: true, icon: 'workspace_premium' },
      fields: [
        { field: 'id', type: 'uuid', schema: { is_primary_key: true }, meta: { interface: 'input', readonly: true, hidden: true } },
        { field: 'pdf_url', type: 'string', meta: { interface: 'input' } },
        { field: 'issued_date', type: 'timestamp', schema: { default_value: 'CURRENT_TIMESTAMP' }, meta: { interface: 'datetime' } },
        { field: 'user_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } },
        { field: 'course_id', type: 'uuid', meta: { interface: 'select-relational', hidden: true } }
      ]
    }
  ];

  // 3. Create collections and fields
  console.log('\n3. Creating collections and basic fields...');
  for (const col of collections) {
    try {
      await api('/collections', 'POST', col);
      console.log(`   [✓] Created collection: ${col.collection}`);
    } catch (err) {
      if (err.message.includes('already exists')) {
        console.log(`   [i] Collection ${col.collection} already exists, skipping creation.`);
      } else {
        throw err;
      }
    }
  }

  // 3. Setup Relations (Many-to-One / One-to-One)
  console.log('\n3. Linking collections (establishing relationships)...');
  const relations = [
    // Modules -> Courses
    { collection: 'Modules', field: 'course_id', related_collection: 'Courses' },
    // Purchases -> Users & Courses
    { collection: 'Purchases', field: 'user_id', related_collection: 'directus_users' },
    { collection: 'Purchases', field: 'course_id', related_collection: 'Courses' },
    // Quizzes -> Modules
    { collection: 'Quizzes', field: 'module_id', related_collection: 'Modules' },
    // Questions -> Quizzes
    { collection: 'Questions', field: 'quiz_id', related_collection: 'Quizzes' },
    // Submissions -> Users & Courses
    { collection: 'Submissions', field: 'user_id', related_collection: 'directus_users' },
    { collection: 'Submissions', field: 'course_id', related_collection: 'Courses' },
    // Certificates -> Users & Courses
    { collection: 'Certificates', field: 'user_id', related_collection: 'directus_users' },
    { collection: 'Certificates', field: 'course_id', related_collection: 'Courses' }
  ];

  for (const rel of relations) {
    try {
      await api('/relations', 'POST', rel);
      console.log(`   [✓] Linked ${rel.collection}.${rel.field} -> ${rel.related_collection}`);
    } catch (err) {
      if (err.message.includes('already exists') || err.message.includes('duplicate key')) {
        console.log(`   [i] Relation ${rel.collection}.${rel.field} -> ${rel.related_collection} already exists, skipping.`);
      } else {
        console.warn(`   [!] Warning: Failed to link ${rel.collection}.${rel.field}. Error: ${err.message}`);
      }
    }
  }

  // 4. Setup Roles and Permissions
  await setupRolesAndPermissions();

  console.log('\n\x1b[32m[✓] Directus backend setup successfully completed!\x1b[0m\n');
  console.log('Next steps:');
  console.log('1. Log in to your Directus dashboard.');
  console.log('2. Verify the collections are present in the sidebar.');
  console.log('3. Verify roles and permissions are active under Settings.\n');
}

async function setupRolesAndPermissions() {
  console.log('\n4. Configuring Roles & Permissions...');
  
  // 1. Detect Directus version
  let isV11 = false;
  try {
    const serverInfo = await api('/server/info', 'GET');
    const version = serverInfo.data.version || '';
    isV11 = version.startsWith('11') || parseInt(version.split('.')[0]) >= 11;
    console.log(`   [i] Detected Directus version: ${version} (Using v${isV11 ? 11 : 10} API structure)`);
  } catch (err) {
    console.warn(`   [!] Warning: Could not detect server version. Defaulting to v10 structure. Error: ${err.message}`);
  }

  // 2. Query / create roles
  let studentRoleId;
  let publicRoleId = null; // Default to null (which represents Public role/unauthenticated in v10)

  const rolesRes = await api('/roles', 'GET');
  const roles = rolesRes.data || [];

  // Find or create Student Role
  let studentRole = roles.find(r => r.name.toLowerCase() === 'student');
  if (!studentRole) {
    console.log('   [+] Creating Student role...');
    const newRole = await api('/roles', 'POST', {
      name: 'Student',
      icon: 'school',
      description: 'Student role for authenticated course consumers',
      admin_access: false,
      app_access: false
    });
    studentRoleId = newRole.data.id;
  } else {
    studentRoleId = studentRole.id;
    console.log(`   [i] Student role already exists (ID: ${studentRoleId})`);
  }

  // 3. Handle Policies (Directus v11+)
  let studentPolicyId;
  let publicPolicyId;

  if (isV11) {
    // In Directus 11, the system Public policy has a fixed hardcoded ID representing unauthenticated access
    publicPolicyId = 'abf8a154-5b1c-4a46-ac9c-7300570f4f17';
    console.log(`   [i] Using system default Public Policy (ID: ${publicPolicyId})`);

    const policiesRes = await api('/policies', 'GET');
    const policies = policiesRes.data || [];

    // Student Policy
    let studentPolicy = policies.find(p => p.name === 'Student Policy');
    if (!studentPolicy) {
      console.log('   [+] Creating Student Policy...');
      const newPolicy = await api('/policies', 'POST', {
        name: 'Student Policy',
        description: 'Policy for Student role',
        app_access: false,
        admin_access: false
      });
      studentPolicyId = newPolicy.data.id;

      console.log('   [+] Linking Student Policy to Student Role...');
      await api(`/roles/${studentRoleId}`, 'PATCH', {
        policies: [
          {
            policy: studentPolicyId
          }
        ]
      });
    } else {
      studentPolicyId = studentPolicy.id;
      console.log(`   [i] Student Policy already exists (ID: ${studentPolicyId})`);
    }
  }

  // 4. Define granular permissions
  const permissionsToCreate = [
    // === STUDENT PERMISSIONS ===
    {
      target: 'student',
      collection: 'Courses',
      action: 'read',
      permissions: { is_published: { _eq: true } }
    },
    {
      target: 'student',
      collection: 'Modules',
      action: 'read',
      permissions: {
        _or: [
          { is_free_preview: { _eq: true } },
          { course_id: { purchases: { user_id: { _eq: "$CURRENT_USER" } } } }
        ]
      }
    },
    {
      target: 'student',
      collection: 'Purchases',
      action: 'read',
      permissions: { user_id: { _eq: "$CURRENT_USER" } }
    },
    {
      target: 'student',
      collection: 'Quizzes',
      action: 'read',
      permissions: {
        module_id: { course_id: { purchases: { user_id: { _eq: "$CURRENT_USER" } } } }
      }
    },
    {
      target: 'student',
      collection: 'Questions',
      action: 'read',
      permissions: {
        quiz_id: { module_id: { course_id: { purchases: { user_id: { _eq: "$CURRENT_USER" } } } } }
      }
    },
    {
      target: 'student',
      collection: 'Submissions',
      action: 'read',
      permissions: { user_id: { _eq: "$CURRENT_USER" } }
    },
    {
      target: 'student',
      collection: 'Submissions',
      action: 'create',
      validation: { user_id: { _eq: "$CURRENT_USER" } },
      presets: { user_id: "$CURRENT_USER" }
    },
    {
      target: 'student',
      collection: 'Certificates',
      action: 'read',
      permissions: { user_id: { _eq: "$CURRENT_USER" } }
    },
    {
      target: 'student',
      collection: 'directus_users',
      action: 'read',
      permissions: { id: { _eq: "$CURRENT_USER" } }
    },
    {
      target: 'student',
      collection: 'directus_users',
      action: 'update',
      permissions: { id: { _eq: "$CURRENT_USER" } }
    },

    // === PUBLIC PERMISSIONS ===
    {
      target: 'public',
      collection: 'Courses',
      action: 'read',
      permissions: { is_published: { _eq: true } }
    },
    {
      target: 'public',
      collection: 'Modules',
      action: 'read',
      permissions: { is_free_preview: { _eq: true } }
    },
    {
      target: 'public',
      collection: 'directus_users',
      action: 'create',
      fields: ['email', 'password', 'first_name', 'last_name', 'legal_name', 'tea_id']
    }
  ];

  const existingPermissionsRes = await api('/permissions', 'GET');
  const existingPermissions = existingPermissionsRes.data || [];

  for (const p of permissionsToCreate) {
    const targetField = isV11 ? 'policy' : 'role';
    const targetId = p.target === 'student' 
      ? (isV11 ? studentPolicyId : studentRoleId)
      : (isV11 ? publicPolicyId : publicRoleId);

    // Find if this permission already exists
    const match = existingPermissions.find(ep => 
      ep.collection === p.collection && 
      ep.action === p.action && 
      ep[targetField] === targetId
    );

    const payload = {
      collection: p.collection,
      action: p.action,
      [targetField]: targetId,
      permissions: p.permissions || null,
      validation: p.validation || null,
      presets: p.presets || null,
      fields: p.fields || ['*']
    };

    try {
      if (match) {
        console.log(`   [~] Updating permission: ${p.target} -> ${p.collection} (${p.action})`);
        await api(`/permissions/${match.id}`, 'PATCH', payload);
      } else {
        console.log(`   [+] Creating permission: ${p.target} -> ${p.collection} (${p.action})`);
        await api('/permissions', 'POST', payload);
      }
    } catch (err) {
      console.warn(`   [!] Warning: Failed to set permission for ${p.target} on ${p.collection} (${p.action}): ${err.message}`);
    }
  }
}

main().catch(err => {
  console.error('\n\x1b[31m[!] Configuration failed:\x1b[0m');
  console.error(err);
  process.exit(1);
});
