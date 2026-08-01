# Antigravity Agent Skills Backup

This repository contains all exported custom agent skills, global skills, and plugin skills for Antigravity coding assistant.

## 📁 Repository Structure

- `skills/`: Core skills (e.g., `agent-reach`, `agent-review`, `root-cause-verifier`, BigQuery, GCP pipelines, etc.)
- `plugins/science/skills/`: Scientific research & bioinformatics plugin skills (AlphaFold, ChEMBL, PubMed, UniProt, etc.)

---

## 🚀 How to Restore Skills on a New OS (Linux / macOS / Windows)

### 1. Restore Global Skills
Copy the contents of `skills/` to your Antigravity global skills directory:

- **Linux / macOS**: `~/.gemini/config/skills/`
  ```bash
  mkdir -p ~/.gemini/config/skills
  cp -r skills/* ~/.gemini/config/skills/
  ```

- **Windows**: `C:\Users\<YourUsername>\.gemini\config\skills\`
  ```powershell
  New-Item -ItemType Directory -Path "$env:USERPROFILE\.gemini\config\skills" -Force
  Copy-Item -Recurse -Force skills\* "$env:USERPROFILE\.gemini\config\skills\"
  ```

### 2. Restore Workspace Skills (Project Specific)
To use specific skills inside a repository workspace:

- Place skills under `.agents/skills/` in your workspace root:
  ```bash
  mkdir -p .agents/skills
  cp -r skills/agent-reach .agents/skills/
  cp -r skills/agent-review .agents/skills/
  ```

### 3. Restore Science Plugin Skills (Optional)
Copy plugin skills to your global plugins directory:

- **Linux / macOS**: `~/.gemini/config/plugins/science/skills/`
  ```bash
  mkdir -p ~/.gemini/config/plugins/science/skills
  cp -r plugins/science/skills/* ~/.gemini/config/plugins/science/skills/
  ```

- **Windows**: `C:\Users\<YourUsername>\.gemini\config\plugins\science\skills\`
  ```powershell
  New-Item -ItemType Directory -Path "$env:USERPROFILE\.gemini\config\plugins\science\skills" -Force
  Copy-Item -Recurse -Force plugins\science\skills\* "$env:USERPROFILE\.gemini\config\plugins\science\skills\"
  ```
