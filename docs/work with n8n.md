# Working with n8n and Git Version Control

This guide outlines how to manage, edit, and version-control your n8n workflows locally alongside your Next.js application.

---

## 🚀 1. Railway n8n Service Setup

To run n8n with persistent storage on Railway:

1.  **Add Service:** Add the `n8nio/n8n:latest` Docker image service to your Railway project canvas.
2.  **Attach Volume:** Mount a persistent volume at mount path `/home/node/.n8n` to prevent losing credentials and workflows on restarts.
3.  **Generate Public Domain:** Expose port `5678` under **Settings -> Networking** and click **Generate Domain** to retrieve the public dashboard URL.
4.  **Configure Environment Variables:** Add the following keys in the **Variables** tab:
    *   `PORT` = `5678`
    *   `N8N_PORT` = `5678`
    *   `N8N_ENCRYPTION_KEY` = `[Your 32-character encryption key]`
    *   `RAILWAY_RUN_UID` = `0` *(Required to run the container as root and bypass volume write permission errors)*
    *   `N8N_WEBHOOK_REDIRECT_ACTIVE` = `true`

---

## 🔑 2. Local CLI Authentication Setup

To bind your local workspace scripts with your Railway n8n instance, configure the local credentials:

1.  Open your n8n browser UI (e.g. `https://n8n-production-xxxx.up.railway.app`).
2.  Navigate to **Settings** (gear icon) -> **n8n API** and click **Create an API key**.
3.  Create/open your local **[.env.local](file:///e:/projects/CPE/.env.local)** file at the root of the CPE workspace.
4.  Add your keys:
    ```env
    # The URL must end with /api/v1
    N8N_API_URL=https://<your-n8n-railway-url>/api/v1
    N8N_API_KEY=your_personal_api_key
    ```

---

## 🔄 3. Development Workflow

To avoid n8n enterprise costs while retaining Git history, use our CLI synchronization scripts:

### A. Downloading Workflows to Git (Pull)
When you build or modify workflows inside the n8n browser UI, save your changes, and run:
```bash
npm run n8n:pull
```
*   **What it does:** Downloads all active and inactive workflows from your Railway n8n server.
*   **Git Cleanup:** The script automatically strips volatile timestamp fields (like `createdAt` and `updatedAt`) before saving, preventing noisy Git diffs.
*   **Storage Location:** Workflows are saved as `.json` files inside **[n8n/workflows/](file:///e:/projects/CPE/n8n/workflows)**.

### B. Deploying Local Changes to n8n (Push)
If you check out a branch with new workflows or modify a workflow JSON locally:
```bash
npm run n8n:push
```
*   **What it does:** Scans the `n8n/workflows/` directory.
*   **Updates:** Overwrites existing workflows on the n8n server that match the file's ID.
*   **Additions:** If you add a new JSON workflow file without an ID, the script creates it on n8n, retrieves the generated ID, and updates the local filename to track it.
