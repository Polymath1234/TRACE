<p align="center">
  <img src="assets/brand-banner.svg" alt="FirstNode - Digital Identity Journey Tracker" width="100%">
</p>

<p align="center">
  <strong>Your Digital Trail Map</strong> — Track where your personal data lives online and visualize your digital journey as an interactive timeline, network graph, and global server map.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Manifest-V3-00D4FF?style=flat-square&logo=googlechrome&logoColor=white" alt="Manifest V3">
  <img src="https://img.shields.io/badge/Browser-Chrome%20%7C%20Edge%20%7C%20Brave-00FFB3?style=flat-square" alt="Browsers">
  <img src="https://img.shields.io/badge/Architecture-100%25%20Local--First-FFD700?style=flat-square" alt="Local-First">
  <img src="https://img.shields.io/badge/Telemetry-Zero%20External%20Tracking-FF6B6B?style=flat-square" alt="Zero Telemetry">
  <img src="https://img.shields.io/badge/License-MIT-3498DB?style=flat-square" alt="License">
</p>

---

## Overview

In an era of ubiquitous web signups and single sign-on (SSO) flows, individuals lose track of where their sensitive identity attributes (names, emails, phone numbers, addresses, government IDs, and payment details) have been deposited.

**FirstNode** is a privacy-first Chromium browser extension that runs on **Autopilot Mode**. As you browse, fill forms, or sign in via OAuth (Google, GitHub, Apple, Microsoft), FirstNode silently catches the transaction, masks sensitive values on-device, and maps your personal data trail across:

1. **Chronological Timeline View** — Sequential submission log with session dividers and categorized site breakdown tabs.
2. **Interactive Journey Graph (Cytoscape.js)** — Force-directed network graph showing website nodes, directional hops, and elapsed time differences.
3. **Global Server Data Map (Leaflet.js)** — Dark-theme world map plotting data center locations with glowing pulse markers and historical playback.
4. **Analytics & Growth Dashboard (Chart.js)** — 30-day exposure trajectory, stacked category distribution, and top OAuth provider tracking.

---

## Dashboard Preview

<p align="center">
  <img src="assets/demo-preview.svg" alt="FirstNode 4-Panel Dashboard Preview" width="100%">
</p>

---

## Key Features

### 1. Autopilot Active Browsing Engine
- **Always Active**: Continuously monitors web forms, inputs, and authentication buttons in the background without disruptive dialogs.
- **OAuth Single Sign-On Interception**: Detects "Sign in with Google", Gmail, GitHub, Apple, Microsoft, Facebook, and Discord flows.
- **Client-Side Value Masking**: Personal values are masked prior to storage (e.g. `jo***@email.com`, `Jo*** Do**`, `41************11`).

### 2. Categorized Breakdown Tabs (Per-Site Inspection)
Every tracked website entry features dedicated sub-tabs to inspect the exact categories of data provided:
- **Identity**: Full Name, Username, Nickname
- **OAuth**: Google, GitHub, Apple authentication provider details
- **Contact**: Email addresses, Mobile and Phone numbers
- **Address**: Street, City, State, ZIP/Postal code, Country
- **Government ID**: SSN, Passport, Aadhaar, PAN, National ID
- **Financial**: Credit/Debit cards, UPI identifiers, Bank accounts
- **Professional & Education**: Job title, Employer, University, Degree
- **Demographics & Social**: Date of Birth, Gender, Social handles

### 3. Data Sovereignty & Portability
- **JSON Export**: Complete backup with version metadata and timestamped schema.
- **CSV Export**: Clean tabular format for audit logs and spreadsheet review.
- **JSON Import**: Merge or restore previous digital trails seamlessly.
- **Danger Zone**: Single-click local data wipe with confirmation dialog.

---

## 9-Category Field Detection Matrix

FirstNode employs multi-layer heuristics (HTML5 input types, `autocomplete` tokens, `name`/`id` attributes, `aria-label`, and adjacent `<label>` semantics) along with a 100ms debounced `MutationObserver` for dynamic SPAs:

| Category | Typical Fields | Heuristic Keywords | Sensitivity |
| :--- | :--- | :--- | :--- |
| **Identity** | Full Name, First/Last Name, Username | `name, fullname, username, nickname, fname, lname` | Medium |
| **OAuth** | Google / Gmail, GitHub, Apple, Microsoft | `google, gmail, accounts.google, github, apple, live.com` | Medium |
| **Contact** | Email, Phone, Mobile, WhatsApp, Telegram | `email, phone, mobile, tel, telephone, whatsapp, telegram` | High |
| **Address** | Street, City, State, ZIP, Postal, Country | `address, street, city, state, zip, postal, country, pincode` | Medium |
| **Government ID** | SSN, Passport, Aadhaar, PAN, Tax ID | `ssn, socialsecurity, aadhaar, pan, passport, license` | High |
| **Financial** | Credit/Debit Card, Bank Account, Routing, UPI | `card, creditcard, debitcard, bank, account, routing, upi` | High |
| **Professional** | Job Title, Company, Department, Employee ID | `job, title, company, department, employeeid, position` | Low |
| **Education** | University, School, Degree, Major | `school, university, degree, education, college, graduate` | Low |
| **Demographics** | Age, Date of Birth, Gender, Nationality | `age, dob, birth, gender, nationality, birthday` | Medium |
| **Social Media** | Twitter/X, Instagram, GitHub, Bio | `social, handle, bio, interests, about, profile` | Low |

---

## Architecture & Data Flow

```
[ Active Web Browsing ]
         │
         ├─── Form Inputs / Change Events
         └─── OAuth Button Clicks (Google, GitHub, etc.)
         │
         ▼
[ content.js (Autopilot Scanner) ]
         │
         ├─── Heuristic 9-Category Classification
         └─── On-Device Value Masking (jo***@email.com)
         │
         ▼ (chrome.runtime.sendMessage)
[ background.js (Service Worker) ]
         │
         ├─── Session ID Management & Chronological Graph Linking
         ├─── 24h Cached Server Geolocation (ipapi.co)
         └─── Persist to chrome.storage.local
         │
         ▼
[ popup.js (Dashboard Interface) ]
         ├─── Timeline View (Categorized sub-tabs & search)
         ├─── Cytoscape.js (Network graph & journey scrubber)
         ├─── Leaflet.js (Dark world map & pulsing pins)
         └─── Chart.js (30-day exposure trajectory)
```

---

## Installation Guide (Chrome / Edge / Brave)

1. Clone or download this repository:
   ```bash
   git clone https://github.com/your-username/firstnode.git
   ```
2. Open your Chromium-based browser and navigate to the Extensions page:
   - **Google Chrome**: `chrome://extensions`
   - **Microsoft Edge**: `edge://extensions`
   - **Brave**: `brave://extensions`
3. Toggle on **Developer mode** in the top-right corner.
4. Click **Load unpacked** in the top-left corner.
5. Select the `firstnode` directory (containing `manifest.json`).
6. Pin **FirstNode** to your browser toolbar for quick access.

---

## Testing & Demonstration

FirstNode includes a dedicated test suite with dynamic SPA form injection and multi-category inputs:

1. Open `test-demo/signup.html` in your browser:
   ```
   file:///path-to-firstnode/test-demo/signup.html
   ```
2. Click any of the OAuth buttons (**Sign in with Google**, **GitHub**, **Apple**) or fill in the 9-category form.
3. Click the **FirstNode** extension icon in your browser toolbar to verify the captured trail across all four views.

---

## Repository Structure

```
firstnode/
├── manifest.json            # Manifest V3 configuration & permissions
├── background.js           # Service worker (Autopilot engine, journey graph, sessions)
├── content.js              # Real-time form & OAuth scanner, value masking
├── LICENSE                 # MIT License
├── README.md               # Documentation & preview assets
├── .gitignore              # Git ignore rules
├── assets/                 # Vector brand banners & animated previews
│   ├── brand-banner.svg
│   └── demo-preview.svg
├── icons/                  # High-resolution vector & PNG extension icons
│   ├── icon.svg
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── popup/
│   ├── popup.html          # Dashboard interface with 4 views
│   ├── styles.css          # Design system & dark theme stylesheet
│   ├── popup.js            # Controller (Cytoscape, Leaflet, Chart.js)
│   ├── welcome.html        # Onboarding guide
│   └── vendor/             # Local fallbacks for Leaflet.js
└── test-demo/
    └── signup.html         # Test suite with 9 categories & OAuth
```

---

## Privacy Policy & Security Guarantee

- **Zero Remote Telemetry**: FirstNode does not transmit user data, analytics, or behavioral telemetry to any third-party servers.
- **Local-First Storage**: All records are held exclusively within `chrome.storage.local` on your device.
- **Open Source**: Complete transparency with clean, readable source code under the MIT License.

---

## License

Distributed under the [MIT License](LICENSE). Built for privacy-conscious web citizens.
