# 🔄 Local Git Sync Utility for n8n

This utility lets you pull your workflows from a remote/self-hosted n8n instance (like one running on Railway) down to your local Git repository as clean JSON files, and push local modifications back up to n8n. 

It prevents noisy Git diffs by auto-sanitizing volatile metadata (like database timestamps) and eliminates the need to pay for n8n's enterprise tier to get Git integration.

---

### 1. The Script: `scripts/n8n-sync.js`

Create a file named `scripts/n8n-sync.js` in your target project and paste the following code. It uses standard Node.js libraries (`fs`, `path`, `http`/`https`) so you don't need to install external HTTP dependencies like `axios` or `node-fetch`.

```javascript
const fs = require('fs');
const path = require('path');
const https = require('https');
const http = require('http');

// Helper to load env variables from .env and .env.local
function loadEnv() {
  const envFiles = ['.env', '.env.local'];
  envFiles.forEach(file => {
    const envPath = path.join(__dirname, '..', file);
    if (fs.existsSync(envPath)) {
      const content = fs.readFileSync(envPath, 'utf8');
      content.split('\n').forEach(line => {
        line = line.trim();
        if (line && !line.startsWith('#')) {
          const match = line.match(/^([^=]+)=(.*)$/);
          if (match) {
            const key = match[1].trim();
            let val = match[2].trim();
            // Remove surrounding quotes if present
            if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
              val = val.substring(1, val.length - 1);
            }
            if (!process.env[key]) {
              process.env[key] = val;
            }
          }
        }
      });
    }
  });
}

loadEnv();

const N8N_API_URL = process.env.N8N_API_URL;
const N8N_API_KEY = process.env.N8N_API_KEY;

if (!N8N_API_URL || !N8N_API_KEY) {
  console.error("\x1b[31mError: Please set N8N_API_URL and N8N_API_KEY in your env variables or .env.local file.\x1b[0m");
  console.log("\nSetup steps:");
  console.log("  1. Add to .env.local:");
  console.log("     N8N_API_URL=https://<your-n8n-url>/api/v1");
  console.log("     N8N_API_KEY=<your-personal-api-key-from-n8n-settings>");
  process.exit(1);
}

const action = process.argv[2];
if (action !== 'pull' && action !== 'push') {
  console.error("\x1b[31mError: Action must be 'pull' or 'push'\x1b[0m");
  process.exit(1);
}

const WORKFLOWS_DIR = path.join(__dirname, '../n8n/workflows');

// Ensure workflows directory exists
if (!fs.existsSync(WORKFLOWS_DIR)) {
  fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
}

// HTTP request helper utilizing native Node.js libraries
function request(method, urlString, body = null) {
  return new Promise((resolve, reject) => {
    try {
      const parsedUrl = new URL(urlString);
      const options = {
        method: method,
        hostname: parsedUrl.hostname,
        port: parsedUrl.port || (parsedUrl.protocol === 'https:' ? 443 : 80),
        path: parsedUrl.pathname + parsedUrl.search,
        headers: {
          'X-N8N-API-KEY': N8N_API_KEY,
          'Content-Type': 'application/json'
        }
      };

      const reqLib = parsedUrl.protocol === 'https:' ? https : http;
      const req = reqLib.request(options, (res) => {
        let data = '';
        res.on('data', (chunk) => { data += chunk; });
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            resolve(data ? JSON.parse(data) : null);
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${data}`));
          }
        });
      });

      req.on('error', (err) => { reject(err); });

      if (body) {
        req.write(JSON.stringify(body));
      }
      req.end();
    } catch (e) {
      reject(e);
    }
  });
}

// Pull all workflows from the n8n server
async function pull() {
  console.log(`\x1b[36mPulling workflows from ${N8N_API_URL}...\x1b[0m`);
  try {
    const response = await request('GET', `${N8N_API_URL}/workflows`);
    const workflows = response.data || [];
    console.log(`Found ${workflows.length} workflows on remote n8n server.`);

    for (const w of workflows) {
      // Get the full workflow details
      const fullWorkflow = await request('GET', `${N8N_API_URL}/workflows/${w.id}`);
      
      // Sanitize properties to prevent noisy git diffs (excludes volatile timestamp fields)
      const sanitized = {
        id: fullWorkflow.id,
        name: fullWorkflow.name,
        active: fullWorkflow.active,
        nodes: fullWorkflow.nodes,
        connections: fullWorkflow.connections,
        settings: fullWorkflow.settings,
        staticData: fullWorkflow.staticData,
        meta: fullWorkflow.meta
      };

      // Create a clean filename
      const safeName = w.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
      const filename = `${safeName}_${w.id}.json`;
      const filePath = path.join(WORKFLOWS_DIR, filename);
      
      fs.writeFileSync(filePath, JSON.stringify(sanitized, null, 2));
      console.log(`\x1b[32m✓ Saved: ${filename}\x1b[0m`);
    }
    console.log("\n\x1b[32mPull complete! All workflows downloaded to n8n/workflows/\x1b[0m");
  } catch (error) {
    console.error("\x1b[31mPull failed:\x1b[0m", error.message);
    process.exit(1);
  }
}

// Push local workflows back to the n8n server
async function push() {
  console.log(`\x1b[36mPushing local workflows to ${N8N_API_URL}...\x1b[0m`);
  try {
    // Get existing remote workflows to match IDs
    const response = await request('GET', `${N8N_API_URL}/workflows`);
    const existingWorkflows = response.data || [];
    const existingMap = new Map();
    existingWorkflows.forEach(w => {
      existingMap.set(w.id, w);
    });

    const files = fs.readdirSync(WORKFLOWS_DIR).filter(f => f.endsWith('.json'));
    if (files.length === 0) {
      console.log("No local JSON files found in n8n/workflows/ to push.");
      return;
    }
    console.log(`Found ${files.length} local workflow files.`);

    for (const file of files) {
      const filePath = path.join(WORKFLOWS_DIR, file);
      const workflowData = JSON.parse(fs.readFileSync(filePath, 'utf8'));

      const id = workflowData.id;
      const existsOnRemote = id && existingMap.has(id);

      const payload = {
        name: workflowData.name,
        nodes: workflowData.nodes,
        connections: workflowData.connections,
        settings: workflowData.settings,
        staticData: workflowData.staticData
      };

      if (existsOnRemote) {
        console.log(`Updating workflow: "${workflowData.name}" (ID: ${id})`);
        await request('PUT', `${N8N_API_URL}/workflows/${id}`, payload);
        console.log(`\x1b[32m✓ Updated: ${workflowData.name}\x1b[0m`);
      } else {
        console.log(`Creating new workflow: "${workflowData.name}"`);
        const newWorkflow = await request('POST', `${N8N_API_URL}/workflows`, payload);
        console.log(`\x1b[32m✓ Created: ${newWorkflow.name} (New ID: ${newWorkflow.id})\x1b[0m`);
        
        // Save the newly generated server ID back to the local file
        workflowData.id = newWorkflow.id;
        const newSafeName = newWorkflow.name.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const newFilename = `${newSafeName}_${newWorkflow.id}.json`;
        const newFilePath = path.join(WORKFLOWS_DIR, newFilename);

        // Delete the temporary file if the filename tracking changed
        if (filePath !== newFilePath) {
          fs.unlinkSync(filePath);
        }
        
        fs.writeFileSync(newFilePath, JSON.stringify(workflowData, null, 2));
      }
    }
    console.log("\n\x1b[32mPush complete! All local workflows synced to n8n.\x1b[0m");
  } catch (error) {
    console.error("\x1b[31mPush failed:\x1b[0m", error.message);
    process.exit(1);
  }
}

if (action === 'pull') {
  pull();
} else if (action === 'push') {
  push();
}
```

---

### 2. Setup Guide

#### Step A: Configure package scripts
Add the following commands to your new project's `package.json` file in the `"scripts"` block:
```json
"scripts": {
  "n8n:pull": "node scripts/n8n-sync.js pull",
  "n8n:push": "node scripts/n8n-sync.js push"
}
```

#### Step B: Add Credentials to local environment
In the root directory of your project, add the connection endpoints to your `.env.local` or `.env` file (which is ignored by Git to keep tokens secret):
```env
# URL must end with /api/v1
N8N_API_URL=https://<your-n8n-instance-url>/api/v1
N8N_API_KEY=your_n8n_api_token
```

> **To get your n8n API Key:**
> 1. Log in to your n8n browser UI dashboard.
> 2. Click on **Settings** (gear icon) -> **n8n API** on the left menu.
> 3. Click **Create an API key** and copy it to your environment file.

#### Step C: Pull or Push Workflows
* Run **`npm run n8n:pull`** to fetch all workflows currently saved on your remote server. They will download into `n8n/workflows/[workflow_name]_[id].json`.
* Run **`npm run n8n:push`** after you make local file edits (or pull commits from branch merges) to push the local JSON structure back to n8n.

---

### 3. How the Git Sanitization Works
When n8n runs, it appends database metadata to the workflow JSON representation (like `createdAt` and `updatedAt`). If you push and pull directly without cleaning these up, Git will register changes on every single sync even if the node logic remained unchanged. 

The `pull()` function in the script intercepts this by extracting only the functional workflow fields:
```javascript
const sanitized = {
  id: fullWorkflow.id,
  name: fullWorkflow.name,
  active: fullWorkflow.active,
  nodes: fullWorkflow.nodes,
  connections: fullWorkflow.connections,
  settings: fullWorkflow.settings,
  staticData: fullWorkflow.staticData,
  meta: fullWorkflow.meta
};
```
By excluding volatile system properties, the script ensures that Git diffs only show up when you actually add, remove, or modify node parameters inside your workflows.
