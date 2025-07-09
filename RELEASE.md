# Release Guide

This document explains how to create releases for the Polimi Exam Calendar Extension.

## Automated Release Methods

### Method 1: GitHub Actions (Manual Trigger)

1. Go to your repository on GitHub
2. Click on "Actions" tab
3. Select "Create Release" workflow
4. Click "Run workflow"
5. Choose the version bump type:
   - **patch** (1.0.0 → 1.0.1) - Bug fixes
   - **minor** (1.0.0 → 1.1.0) - New features
   - **major** (1.0.0 → 2.0.0) - Breaking changes
6. Optionally add custom release notes
7. Click "Run workflow"

The workflow will:
- Bump the version in `package.json` and `manifest.json`
- Build and package the extension
- Create a git tag
- Create a GitHub release with the packaged extension

### Method 2: Git Tags (Automatic)

Push a version tag to trigger automatic release:

```bash
git tag v1.2.3
git push origin v1.2.3
```

This will automatically trigger the release workflow and create a GitHub release.

## Manual Release Methods

### Method 3: NPM Scripts

Use the built-in npm scripts for quick releases:

```bash
# Patch release (bug fixes)
npm run release:patch

# Minor release (new features)
npm run release:minor

# Major release (breaking changes)
npm run release:major
```

These scripts will:
1. Run linting checks
2. Bump the version
3. Build and package the extension
4. Create a git tag
5. Push the tag (which triggers the GitHub release)

### Method 4: Manual Process

1. **Update version numbers:**
   ```bash
   npm version patch  # or minor/major
   ```

2. **Build the extension:**
   ```bash
   npm run build
   npm run package
   ```

3. **Commit and tag:**
   ```bash
   git add .
   git commit -m "chore: release v1.x.x"
   git tag v1.x.x
   git push origin HEAD --tags
   ```

## Workflow Details

### CI/CD Pipeline

- **CI Build (`ci.yml`)**: Runs on every push/PR to test builds
- **Release (`release.yml`)**: Triggered by version tags to create releases
- **Create Release (`create-release.yml`)**: Manual workflow for controlled releases

### What Gets Built

Each release includes:
- **Production build** (`dist/` folder)
- **Packaged extension** (`.zip` file ready for browser installation)
- **Source maps** for debugging
- **All static assets** (manifest, icons)

### Release Assets

GitHub releases will contain:
- `polimi-exam-calendar-vX.X.X.zip` - Ready-to-install extension package
- Automated release notes with changelog
- Installation instructions for different browsers

## Version Management

Versions follow [Semantic Versioning](https://semver.org/):
- `MAJOR.MINOR.PATCH`
- Major: Breaking changes
- Minor: New features (backward compatible)
- Patch: Bug fixes (backward compatible)

Both `package.json` and `manifest.json` versions are kept in sync automatically.

## Installation Instructions for Users

The release will include these instructions for end users:

### Chrome/Edge Installation
1. Download the `.zip` file from the release
2. Extract to a folder
3. Open `chrome://extensions/` or `edge://extensions/`
4. Enable "Developer mode"
5. Click "Load unpacked" and select the extracted folder

### Firefox Installation
1. Download the `.zip` file from the release
2. Open `about:debugging` in Firefox
3. Click "This Firefox"
4. Click "Load Temporary Add-on"
5. Select the `.zip` file directly

## Troubleshooting

### Build Fails
- Check that all dependencies are installed: `npm ci`
- Ensure TypeScript compiles: `npm run build:dev`
- Check for linting errors: `npm run lint`

### Release Workflow Fails
- Ensure you have proper GitHub permissions
- Check that the version bump was successful
- Verify all required files exist in the repository

### Manual Release Issues
- Make sure you're on the main/master branch
- Ensure working directory is clean before versioning
- Check that git remote is properly configured
