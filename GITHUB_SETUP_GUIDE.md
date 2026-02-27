# GitHub Project Setup Guide

This guide will help you set up your AVD Self-Service Recovery Tool project on GitHub from scratch.

## 📦 Part 1: Create the GitHub Repository

### Step 1: Create Repository on GitHub

1. Go to [GitHub](https://github.com) and log in
2. Click the **"+"** icon in the top right → **"New repository"**
3. Fill in the details:
   - **Repository name**: `avd-self-service-recovery`
   - **Description**: "A self-service desktop troubleshooting solution for Azure Virtual Desktop environments"
   - **Visibility**: Choose Public or Private
   - **DO NOT** initialize with README (we'll add it later)
4. Click **"Create repository"**

### Step 2: Initialize Local Repository

Open your terminal/command prompt and run:

```bash
# Create project directory
mkdir avd-self-service-recovery
cd avd-self-service-recovery

# Initialize git repository
git init

# Create the main branch
git branch -M main
```

## 📁 Part 2: Create Project Structure

### Step 1: Create Folder Structure

```bash
# Create main directories
mkdir -p docs
mkdir -p src/windows-app
mkdir -p src/logic-apps
mkdir -p src/automation
mkdir -p src/functions
mkdir -p src/infrastructure/bicep
mkdir -p src/infrastructure/terraform
mkdir -p tests/unit
mkdir -p tests/integration
mkdir -p .github/workflows
mkdir -p .github/ISSUE_TEMPLATE
```

### Step 2: Add Project Files

Copy the files I've created for you:
- `README.md` → Root directory
- `CONTRIBUTING.md` → Root directory
- `.gitignore` → Root directory
- `build-windows-app.yml` → `.github/workflows/`
- `deploy-functions.yml` → `.github/workflows/`
- `deploy-logic-apps.yml` → `.github/workflows/`
- `bug_report.md` → `.github/ISSUE_TEMPLATE/`
- `feature_request.md` → `.github/ISSUE_TEMPLATE/`
- `avd-troubleshooter-flowchart.svg` → `docs/`

### Step 3: Create Placeholder Files

```bash
# Create placeholder README files in key directories
echo "# Windows Application" > src/windows-app/README.md
echo "# Logic Apps" > src/logic-apps/README.md
echo "# Automation Runbooks" > src/automation/README.md
echo "# Azure Functions" > src/functions/README.md
echo "# Infrastructure as Code" > src/infrastructure/README.md
```

## 🔐 Part 3: Configure GitHub Settings

### Step 1: Add Secrets (for CI/CD)

1. Go to your repository on GitHub
2. Click **Settings** → **Secrets and variables** → **Actions**
3. Click **"New repository secret"** and add:
   - `AZURE_CREDENTIALS`: Your Azure service principal credentials
   - `FUNCTION_APP_ENDPOINT`: Your Function App endpoint
   - `AUTOMATION_ACCOUNT_ID`: Your Automation Account resource ID

### Step 2: Configure Branch Protection

1. Go to **Settings** → **Branches**
2. Click **"Add rule"** for `main` branch
3. Enable:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass before merging
   - ✅ Require branches to be up to date before merging
   - ✅ Include administrators

## 📤 Part 4: Initial Commit and Push

```bash
# Stage all files
git add .

# Create initial commit
git commit -m "Initial commit: Project structure and documentation"

# Add remote origin (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/avd-self-service-recovery.git

# Push to GitHub
git push -u origin main
```

## 🌿 Part 5: Create Development Branch

```bash
# Create and switch to develop branch
git checkout -b develop

# Push develop branch
git push -u origin develop

# Switch back to main
git checkout main
```

## 🏷️ Part 6: Set Up GitHub Project Boards

### Option 1: Classic Projects (Simpler)

1. Go to **Projects** tab → **New project**
2. Choose **"Board"** template
3. Create columns:
   - 📋 Backlog
   - 🔄 In Progress
   - 👀 In Review
   - ✅ Done

### Option 2: New Projects (More Features)

1. Go to **Projects** tab → **New project**
2. Choose **"Team backlog"** or **"Feature"** template
3. Customize views and fields as needed

## 🏁 Part 7: Create Initial Issues

Create issues for initial work:

1. **Issue #1**: Set up CI/CD pipelines
2. **Issue #2**: Design Windows App UI mockups
3. **Issue #3**: Create Logic App workflow
4. **Issue #4**: Develop PowerShell runbooks
5. **Issue #5**: Set up Log Analytics workspace

## 📋 Part 8: Set Up Milestones

1. Go to **Issues** → **Milestones**
2. Create milestones:
   - **v0.1.0 - MVP** (Q2 2026)
   - **v0.2.0 - Enhanced Diagnostics** (Q3 2026)
   - **v1.0.0 - Production Ready** (Q4 2026)

## 👥 Part 9: Add Collaborators (Optional)

1. Go to **Settings** → **Collaborators**
2. Click **"Add people"**
3. Enter GitHub usernames or emails

## 🔔 Part 10: Configure Notifications

1. Go to your profile → **Settings** → **Notifications**
2. Configure how you want to receive updates
3. Enable notifications for:
   - Issues
   - Pull requests
   - Actions
   - Discussions

## ✅ Verification Checklist

Verify your setup:

- [ ] Repository created and visible
- [ ] All files committed and pushed
- [ ] GitHub Actions workflows visible
- [ ] Branch protection rules active
- [ ] Secrets configured
- [ ] Project board created
- [ ] Initial issues created
- [ ] Milestones defined

## 🚀 Next Steps

Now you're ready to start development! Here's what to do next:

1. **Pick an issue** from your project board
2. **Create a feature branch**: `git checkout -b feature/issue-name`
3. **Make your changes**
4. **Commit and push**: 
   ```bash
   git add .
   git commit -m "feat: description of changes"
   git push origin feature/issue-name
   ```
5. **Create a Pull Request** on GitHub
6. **Review and merge** once approved

## 📚 Useful Git Commands

```bash
# Check status
git status

# Create new branch
git checkout -b feature/new-feature

# Switch branches
git checkout main

# Pull latest changes
git pull origin main

# View commit history
git log --oneline

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Stash changes temporarily
git stash
git stash pop
```

## 🆘 Common Issues and Solutions

### Issue: Push rejected
```bash
# Solution: Pull latest changes first
git pull origin main --rebase
git push origin main
```

### Issue: Merge conflicts
```bash
# Solution: Resolve conflicts manually
# 1. Open conflicted files
# 2. Remove conflict markers (<<<, ===, >>>)
# 3. Keep the correct code
# 4. Stage and commit
git add .
git commit -m "Resolved merge conflicts"
```

### Issue: Wrong commit message
```bash
# Solution: Amend last commit
git commit --amend -m "New commit message"
```

## 📖 Resources

- [GitHub Docs](https://docs.github.com)
- [Git Documentation](https://git-scm.com/doc)
- [Azure DevOps GitHub Integration](https://docs.microsoft.com/en-us/azure/devops/pipelines/repos/github)

---

**Need Help?** Open an issue or check the GitHub Discussions!
