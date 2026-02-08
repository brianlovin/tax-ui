# Electron Release Checklist

Step-by-step guide to test, package, and release the Tax UI desktop app.

---

## Phase 1: Local Manual Testing

### 1.1 Launch in Development Mode
```bash
cd electron && npm run dev
```

**Verify:**
- [ ] Window opens with correct title "Tax UI"
- [ ] macOS: Traffic lights positioned correctly (hidden inset titlebar)
- [ ] App loads the web UI from localhost
- [ ] No console errors in DevTools (Cmd+Option+I)

### 1.2 Test Core Functionality
- [ ] Can enter API key in settings
- [ ] Can upload a PDF tax return
- [ ] PDF parsing works (requires valid API key)
- [ ] Data persists after closing and reopening app
- [ ] Chat functionality works

### 1.3 Verify Data Location
```bash
# macOS: Check userData directory
ls -la ~/Library/Application\ Support/tax-ui-electron/
```
Should contain:
- `.tax-returns.json` (after uploading a return)
- `.env` (after saving API key)
- `config.json` (electron-store window bounds)

---

## Phase 2: App Icons

### 2.1 Create Icons
Required files in `electron/assets/`:
- `icon.icns` - macOS (1024x1024, use iconutil or online converter)
- `icon.ico` - Windows (256x256 multi-resolution)
- `icon.png` - Linux fallback (512x512)

**Quick creation from PNG:**
```bash
# macOS: Create .icns from 1024x1024 PNG
mkdir icon.iconset
sips -z 16 16 icon.png --out icon.iconset/icon_16x16.png
sips -z 32 32 icon.png --out icon.iconset/icon_16x16@2x.png
sips -z 32 32 icon.png --out icon.iconset/icon_32x32.png
sips -z 64 64 icon.png --out icon.iconset/icon_32x32@2x.png
sips -z 128 128 icon.png --out icon.iconset/icon_128x128.png
sips -z 256 256 icon.png --out icon.iconset/icon_128x128@2x.png
sips -z 256 256 icon.png --out icon.iconset/icon_256x256.png
sips -z 512 512 icon.png --out icon.iconset/icon_256x256@2x.png
sips -z 512 512 icon.png --out icon.iconset/icon_512x512.png
sips -z 1024 1024 icon.png --out icon.iconset/icon_512x512@2x.png
iconutil -c icns icon.iconset -o icon.icns
rm -rf icon.iconset
```

---

## Phase 3: Local Packaging (No Code Signing)

### 3.1 Build for Current Platform
```bash
cd electron
npm run build # Compiles main/preload
cd ..
bun run build:server # Bundles Bun server for packaging
cd electron
npm run pack  # Creates unpacked app in release/
```

### 3.2 Test Packaged App
```bash
# macOS
open release/mac-arm64/Tax\ UI.app

# Or for x64
open release/mac/Tax\ UI.app
```

**Verify:**
- [ ] App launches without "damaged" warning (unsigned is OK locally)
- [ ] All functionality works same as dev mode
- [ ] Bundled Bun server starts correctly
- [ ] Check logs: `~/Library/Logs/tax-ui-electron/main.log`

### 3.3 Build Distributable
```bash
npm run dist  # Creates DMG/installer
```

Output in `release/`:
- `Tax UI-0.1.0-arm64.dmg` (macOS ARM)
- `Tax UI-0.1.0.dmg` (macOS Intel)
- `Tax UI-0.1.0-x64.exe` (Windows)

---

## Phase 4: Code Signing (macOS)

### 4.1 Prerequisites
- Apple Developer account ($99/year)
- Developer ID Application certificate
- Developer ID Installer certificate (for pkg, optional)

### 4.2 Export Certificates
1. Open Keychain Access
2. Find "Developer ID Application: Your Name"
3. Right-click → Export → Save as .p12
4. Set a password (save it securely)

### 4.3 Base64 Encode for GitHub
```bash
base64 -i Certificates.p12 | pbcopy
```

### 4.4 Create App-Specific Password
1. Go to appleid.apple.com
2. Sign In → Security → App-Specific Passwords
3. Generate password for "electron-notarize"

### 4.5 Test Local Signing
```bash
# Set environment variables
export CSC_LINK="path/to/Certificates.p12"
export CSC_KEY_PASSWORD="your-password"
export APPLE_ID="your@email.com"
export APPLE_APP_SPECIFIC_PASSWORD="xxxx-xxxx-xxxx-xxxx"
export APPLE_TEAM_ID="XXXXXXXXXX"

# Build with signing
npm run dist:mac
```

**Verify:**
- [ ] No Gatekeeper warning when opening DMG
- [ ] App shows as "identified developer" in System Settings
- [ ] `codesign -dv --verbose=4 "release/mac-arm64/Tax UI.app"` shows valid signature

---

## Phase 5: GitHub Release Setup

### 5.1 Add Repository Secrets
Go to: Repository → Settings → Secrets and variables → Actions

| Secret | Value |
|--------|-------|
| `APPLE_CERTIFICATE` | Base64-encoded .p12 file |
| `APPLE_CERTIFICATE_PASSWORD` | Password for .p12 |
| `APPLE_ID` | Apple ID email |
| `APPLE_PASSWORD` | App-specific password |
| `APPLE_TEAM_ID` | 10-character team ID |

### 5.2 Verify Workflow File
```bash
cat .github/workflows/electron-release.yml
```

### 5.3 Test Workflow (Manual Dispatch)
1. Go to: Repository → Actions → Electron Release
2. Click "Run workflow"
3. Enter version (e.g., "0.1.0")
4. Run and monitor

---

## Phase 6: Create Release

### 6.1 Update Version
```bash
# Update version in both package.json files
cd /path/to/tax-ui
npm version patch  # or minor/major

cd electron
npm version patch
```

### 6.2 Commit and Tag
```bash
git add -A
git commit -m "Release v0.1.0"
git tag v0.1.0
git push origin main --tags
```

### 6.3 Monitor Build
- Watch Actions tab for build progress
- macOS notarization takes 5-15 minutes
- Check for any signing errors

### 6.4 Publish Release
1. Go to Releases → Draft release created by workflow
2. Edit release notes
3. Publish release

---

## Troubleshooting

### "App is damaged" on macOS
```bash
xattr -cr "/Applications/Tax UI.app"
```

### Notarization fails
- Check Apple ID credentials
- Ensure hardened runtime is enabled
- Check entitlements.mac.plist has required permissions

### Server doesn't start in packaged app
- Check logs: `~/Library/Logs/tax-ui-electron/main.log`
- Verify Bun binary is in Resources
- Check TAX_UI_DATA_DIR is set correctly

### Windows SmartScreen warning
- Expected without EV certificate ($400+/year)
- Users click "More info" → "Run anyway"
- Warning disappears after enough users run it

---

## Version History

| Version | Date | Notes |
|---------|------|-------|
| 0.1.0 | TBD | Initial release |
