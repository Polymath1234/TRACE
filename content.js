/**
 * FirstNode v2.0 - Content Script (Autopilot Form & OAuth Scanner)
 * Continuously monitors active web browsing for personal data inputs and OAuth sign-in flows.
 * Automatically masks sensitive data for privacy and saves it to your local digital trail.
 */

(function () {
  'use strict';

  // Prevent multiple injections
  if (window.__FIRSTNODE_CONTENT_INJECTED__) return;
  window.__FIRSTNODE_CONTENT_INJECTED__ = true;

  // State management
  let hasLoggedThisSession = false;
  let detectedDataFields = [];
  let detectedOAuthProvider = null;
  let scanDebounceTimer = null;
  let inputDebounceTimer = null;

  // Extension user preferences
  let extensionSettings = {
    autopilot: true,
    autoDetect: true,
    showPrompts: false,
    trackAllFields: true
  };

  // Field Categories Definition (Clean & Professional, No Emojis)
  const CATEGORY_DEFINITIONS = {
    identity: {
      label: 'Identity',
      color: '#00D4FF',
      bgColor: 'rgba(0, 212, 255, 0.12)',
      borderColor: 'rgba(0, 212, 255, 0.35)',
      keywords: ['name', 'fullname', 'username', 'nickname', 'firstname', 'lastname', 'fname', 'lname', 'user']
    },
    contact: {
      label: 'Contact',
      color: '#FF6B6B',
      bgColor: 'rgba(255, 107, 107, 0.12)',
      borderColor: 'rgba(255, 107, 107, 0.35)',
      keywords: ['email', 'phone', 'mobile', 'tel', 'telephone', 'whatsapp', 'telegram', 'contact', 'cell']
    },
    address: {
      label: 'Address',
      color: '#00FFB3',
      bgColor: 'rgba(0, 255, 179, 0.12)',
      borderColor: 'rgba(0, 255, 179, 0.35)',
      keywords: ['address', 'street', 'city', 'state', 'zip', 'postal', 'country', 'pincode', 'district', 'province']
    },
    government_id: {
      label: 'Government ID',
      color: '#FFD700',
      bgColor: 'rgba(255, 215, 0, 0.12)',
      borderColor: 'rgba(255, 215, 0, 0.35)',
      keywords: ['ssn', 'socialsecurity', 'aadhaar', 'pan', 'passport', 'license', 'nationalid', 'taxid', 'voter']
    },
    financial: {
      label: 'Financial',
      color: '#9B59B6',
      bgColor: 'rgba(155, 89, 182, 0.12)',
      borderColor: 'rgba(155, 89, 182, 0.35)',
      keywords: ['card', 'creditcard', 'debitcard', 'bank', 'account', 'routing', 'upi', 'payment', 'cvv', 'iban']
    },
    professional: {
      label: 'Professional',
      color: '#3498DB',
      bgColor: 'rgba(52, 152, 219, 0.12)',
      borderColor: 'rgba(52, 152, 219, 0.35)',
      keywords: ['job', 'title', 'company', 'department', 'employeeid', 'position', 'role', 'employer', 'work']
    },
    education: {
      label: 'Education',
      color: '#1ABC9C',
      bgColor: 'rgba(26, 188, 156, 0.12)',
      borderColor: 'rgba(26, 188, 156, 0.35)',
      keywords: ['school', 'university', 'degree', 'education', 'college', 'graduate', 'major', 'alma']
    },
    demographics: {
      label: 'Demographics',
      color: '#E67E22',
      bgColor: 'rgba(230, 126, 34, 0.12)',
      borderColor: 'rgba(230, 126, 34, 0.35)',
      keywords: ['age', 'dob', 'birth', 'gender', 'nationality', 'birthday', 'sex', 'pronoun']
    },
    social_media: {
      label: 'Social Media',
      color: '#E74C3C',
      bgColor: 'rgba(231, 76, 60, 0.12)',
      borderColor: 'rgba(231, 76, 60, 0.35)',
      keywords: ['social', 'handle', 'bio', 'interests', 'about', 'profile', 'twitter', 'instagram', 'github']
    }
  };

  // Fetch settings from background
  try {
    chrome.runtime.sendMessage({ type: 'GET_SETTINGS' }, (response) => {
      if (chrome.runtime.lastError) return;
      if (response && response.settings) {
        extensionSettings = { ...extensionSettings, ...response.settings };
      }
      if (extensionSettings.autoDetect || extensionSettings.autopilot) {
        initAutopilotScanner();
      }
    });
  } catch (e) {
    initAutopilotScanner();
  }

  function initAutopilotScanner() {
    // Initial scan on page load
    debouncedScan();

    // DOM MutationObserver with 100ms debounce for SPAs, React dialogs, and dynamic modals
    const observer = new MutationObserver((mutations) => {
      let hasAddedNodes = false;
      for (const mutation of mutations) {
        if (mutation.addedNodes.length > 0) {
          hasAddedNodes = true;
          break;
        }
      }
      if (hasAddedNodes) {
        debouncedScan();
      }
    });

    observer.observe(document.body || document.documentElement, {
      childList: true,
      subtree: true
    });

    // Active input monitoring (Autopilot catches data as you enter it)
    document.addEventListener('input', () => {
      clearTimeout(inputDebounceTimer);
      inputDebounceTimer = setTimeout(() => {
        collectCurrentPageData(false);
      }, 600);
    }, true);

    // Form submission listener
    document.addEventListener('submit', (e) => {
      handleFormSubmit(e.target);
    }, true);

    // Click listener for OAuth login buttons (Google, Gmail, GitHub, Apple, Microsoft, etc.)
    document.addEventListener('click', (e) => {
      const target = e.target.closest('button, a, input[type="submit"], [role="button"], .btn');
      if (target) {
        const oauth = checkOAuthElement(target);
        if (oauth) {
          detectedOAuthProvider = oauth;
          const oauthField = {
            type: 'oauth',
            label: `OAuth (${oauth})`,
            fieldName: 'oauth_provider',
            value: `${oauth} Authentication`,
            sensitivity: 'medium'
          };
          detectedDataFields.push(oauthField);
          triggerSaveOrPrompt(true);
        }
      }
    }, true);

    // Page unload listener to ensure any filled data is preserved
    window.addEventListener('beforeunload', () => {
      if (!hasLoggedThisSession && detectedDataFields.length > 0) {
        saveCurrentSiteToBackground();
      }
    });
  }

  function debouncedScan() {
    clearTimeout(scanDebounceTimer);
    scanDebounceTimer = setTimeout(performScan, 150);
  }

  /**
   * Masks sensitive values for privacy (e.g. "jo***@email.com", "41************44")
   */
  function maskValue(val, category) {
    if (!val || typeof val !== 'string') return '******';
    const trimmed = val.trim();
    if (trimmed.length <= 4) return '****';

    if (category === 'contact' && trimmed.includes('@')) {
      const parts = trimmed.split('@');
      const namePart = parts[0];
      const domainPart = parts[1] || '';
      const maskedName = namePart.length > 2 ? namePart.substring(0, 2) + '***' : '***';
      return `${maskedName}@${domainPart}`;
    }

    if (category === 'financial' || category === 'government_id') {
      const start = trimmed.substring(0, 2);
      const end = trimmed.substring(trimmed.length - 2);
      const middle = '*'.repeat(Math.max(4, trimmed.length - 4));
      return `${start}${middle}${end}`;
    }

    const start = trimmed.substring(0, 2);
    const end = trimmed.substring(trimmed.length - 2);
    return `${start}***${end}`;
  }

  /**
   * Classifies an input element into one of the 9 categories
   */
  function classifyInput(input) {
    const type = (input.type || '').toLowerCase();
    const name = (input.name || '').toLowerCase();
    const id = (input.id || '').toLowerCase();
    const autocomplete = (input.autocomplete || '').toLowerCase();
    const placeholder = (input.placeholder || '').toLowerCase();
    const ariaLabel = (input.getAttribute('aria-label') || '').toLowerCase();
    const labelText = getAssociatedLabelText(input).toLowerCase();

    const combined = `${type} ${name} ${id} ${autocomplete} ${placeholder} ${ariaLabel} ${labelText}`;

    // 1. Financial
    if (/card|creditcard|debitcard|bank|account|routing|upi|cvv|cvc|expir|iban|swift|payment/.test(combined)) {
      return { category: 'financial', ...CATEGORY_DEFINITIONS.financial, sensitivity: 'high' };
    }

    // 2. Government ID
    if (/ssn|socialsecurity|aadhaar|pan|passport|license|nationalid|taxid|citizen|voter/.test(combined)) {
      return { category: 'government_id', ...CATEGORY_DEFINITIONS.government_id, sensitivity: 'high' };
    }

    // 3. Contact
    if (type === 'email' || autocomplete === 'email' || /email|e-mail/.test(combined)) {
      return { category: 'contact', ...CATEGORY_DEFINITIONS.contact, label: 'Email', sensitivity: 'high' };
    }
    if (type === 'tel' || autocomplete.includes('tel') || /phone|mobile|tel|telephone|whatsapp|telegram|contact|cell/.test(combined)) {
      return { category: 'contact', ...CATEGORY_DEFINITIONS.contact, label: 'Phone', sensitivity: 'high' };
    }

    // 4. Address
    if (autocomplete.includes('address') || /address|street|city|state|zip|postal|country|pincode|district|province/.test(combined)) {
      return { category: 'address', ...CATEGORY_DEFINITIONS.address, sensitivity: 'medium' };
    }

    // 5. Professional
    if (/job|title|company|department|employeeid|position|role|employer|work|organization/.test(combined)) {
      return { category: 'professional', ...CATEGORY_DEFINITIONS.professional, sensitivity: 'low' };
    }

    // 6. Education
    if (/school|university|degree|education|college|graduate|major|alma/.test(combined)) {
      return { category: 'education', ...CATEGORY_DEFINITIONS.education, sensitivity: 'low' };
    }

    // 7. Demographics
    if (/age|dob|birth|gender|nationality|birthday|sex|pronoun/.test(combined)) {
      return { category: 'demographics', ...CATEGORY_DEFINITIONS.demographics, sensitivity: 'medium' };
    }

    // 8. Social Media
    if (/social|handle|bio|interests|about|profile|twitter|instagram|github|linkedin/.test(combined)) {
      return { category: 'social_media', ...CATEGORY_DEFINITIONS.social_media, sensitivity: 'low' };
    }

    // 9. Identity (Name, Username)
    if (
      /first.*name|last.*name|full.*name|fname|lname|user.*name|nickname|recipient.*name/.test(combined) ||
      autocomplete.includes('name') ||
      (name.includes('name') && !name.includes('company') && !name.includes('domain'))
    ) {
      return { category: 'identity', ...CATEGORY_DEFINITIONS.identity, sensitivity: 'medium' };
    }

    return null;
  }

  function getAssociatedLabelText(input) {
    if (input.id) {
      const label = document.querySelector(`label[for="${input.id}"]`);
      if (label) return label.innerText || label.textContent || '';
    }
    const parentLabel = input.closest('label');
    if (parentLabel) return parentLabel.innerText || parentLabel.textContent || '';
    return '';
  }

  /**
   * Scans DOM inputs and collects personal data
   */
  function collectCurrentPageData(triggerImmediately = false) {
    const inputs = document.querySelectorAll('input, select, textarea');
    const detected = [];
    const seenFieldKeys = new Set();

    inputs.forEach(input => {
      if (['hidden', 'submit', 'button', 'reset', 'file', 'password'].includes(input.type)) return;

      const classification = classifyInput(input);
      if (classification) {
        const fieldName = input.name || input.id || classification.label;
        const key = `${classification.category}_${fieldName}`;
        if (!seenFieldKeys.has(key)) {
          seenFieldKeys.add(key);
          const rawValue = input.value || '';
          const masked = rawValue ? maskValue(rawValue, classification.category) : `${classification.label} field`;
          detected.push({
            type: classification.category,
            label: classification.label,
            fieldName: fieldName,
            value: masked,
            sensitivity: classification.sensitivity
          });
        }
      }
    });

    if (detected.length > 0) {
      detectedDataFields = detected;
      if (triggerImmediately || extensionSettings.autopilot) {
        saveCurrentSiteToBackground();
      }
    }
  }

  function performScan() {
    if (hasLoggedThisSession) return;
    collectCurrentPageData(false);
  }

  /**
   * Extracts values from a submitted form and sends to background
   */
  function handleFormSubmit(form) {
    if (!form) return;
    const inputs = form.querySelectorAll('input, select, textarea');
    const submittedFields = [];
    const seenKeys = new Set();

    inputs.forEach(input => {
      if (['hidden', 'submit', 'button', 'reset', 'password', 'file'].includes(input.type)) return;
      const classification = classifyInput(input);
      if (classification) {
        const fieldName = input.name || input.id || classification.label;
        const key = `${classification.category}_${fieldName}`;
        if (!seenKeys.has(key)) {
          seenKeys.add(key);
          const rawValue = input.value || '';
          submittedFields.push({
            type: classification.category,
            label: classification.label,
            fieldName: fieldName,
            value: maskValue(rawValue, classification.category),
            sensitivity: classification.sensitivity
          });
        }
      }
    });

    if (submittedFields.length > 0) {
      detectedDataFields = submittedFields;
      triggerSaveOrPrompt(true);
    }
  }

  /**
   * Checks whether an element is an OAuth login button
   */
  function checkOAuthElement(el) {
    if (!el) return null;
    const text = (el.innerText || el.textContent || '').toLowerCase();
    const className = (el.className || '').toString().toLowerCase();
    const id = (el.id || '').toLowerCase();
    const href = (el.getAttribute('href') || '').toLowerCase();
    const providerAttr = (el.getAttribute('data-provider') || el.getAttribute('data-oauth') || '').toLowerCase();
    const aria = (el.getAttribute('aria-label') || '').toLowerCase();

    const combined = `${text} ${className} ${id} ${href} ${providerAttr} ${aria}`;

    if (/google|accounts\.google|gmail|sign in with google|continue with google/.test(combined)) return 'Google';
    if (/github|github\.com|sign in with github/.test(combined)) return 'GitHub';
    if (/facebook|fb\.com|facebook\.com/.test(combined)) return 'Facebook';
    if (/twitter|x\.com|twitter\.com/.test(combined)) return 'Twitter';
    if (/apple|appleid|sign in with apple/.test(combined)) return 'Apple';
    if (/microsoft|live\.com|azure|ms-login|sign in with microsoft/.test(combined)) return 'Microsoft';
    if (/discord|discord\.com/.test(combined)) return 'Discord';
    if (/linkedin|linkedin\.com/.test(combined)) return 'LinkedIn';

    return null;
  }

  function triggerSaveOrPrompt(isImmediate) {
    if (hasLoggedThisSession && !isImmediate) return;

    if (extensionSettings.showPrompts) {
      hasLoggedThisSession = true;
      renderCleanPrompt();
    } else {
      // Autopilot mode: save seamlessly in background
      saveCurrentSiteToBackground();
      hasLoggedThisSession = true;
    }
  }

  /**
   * Sends site data to background worker
   */
  function saveCurrentSiteToBackground(customNotes) {
    const payload = {
      domain: window.location.hostname,
      fullUrl: window.location.href,
      dataFields: detectedDataFields,
      oauthProvider: detectedOAuthProvider,
      notes: customNotes || ''
    };

    try {
      chrome.runtime.sendMessage({
        type: 'SAVE_SITE',
        data: payload
      });
    } catch (e) {
      console.warn('FirstNode: Could not send site data to extension background worker.');
    }
  }

  /**
   * Renders clean, professional, non-emoji Shadow DOM prompt UI
   */
  function renderCleanPrompt() {
    const existing = document.getElementById('firstnode-prompt-host');
    if (existing) existing.remove();

    const host = document.createElement('div');
    host.id = 'firstnode-prompt-host';
    host.style.position = 'fixed';
    host.style.zIndex = '2147483647';
    host.style.bottom = '20px';
    host.style.right = '20px';
    host.style.width = 'auto';
    host.style.height = 'auto';

    const shadow = host.attachShadow({ mode: 'open' });
    const domainName = window.location.hostname.replace(/^www\./, '');

    const badgesHtml = detectedDataFields.map(f => {
      const def = CATEGORY_DEFINITIONS[f.type] || {
        label: f.label || 'Data',
        color: '#00D4FF',
        bgColor: 'rgba(0, 212, 255, 0.12)',
        borderColor: 'rgba(0, 212, 255, 0.35)'
      };
      return `
        <div class="fn-badge" style="color:${def.color}; background:${def.bgColor}; border-color:${def.borderColor}">
          <span class="fn-badge-cat">${f.label}</span>
          <span class="fn-badge-val">${f.value}</span>
        </div>
      `;
    }).join('');

    const styles = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
        font-family: -apple-system, BlinkMacSystemFont, 'Inter', 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }

      @keyframes fnSlideUp {
        from {
          opacity: 0;
          transform: translateY(24px) scale(0.97);
        }
        to {
          opacity: 1;
          transform: translateY(0) scale(1);
        }
      }

      @keyframes fnPulseDot {
        0% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0.5); }
        70% { box-shadow: 0 0 0 8px rgba(0, 212, 255, 0); }
        100% { box-shadow: 0 0 0 0 rgba(0, 212, 255, 0); }
      }

      .fn-card {
        width: 340px;
        background: #0A1628;
        border: 1px solid #2A3A4E;
        border-radius: 12px;
        box-shadow: 0 16px 36px rgba(0, 0, 0, 0.65), 0 0 0 1px rgba(0, 212, 255, 0.2);
        color: #FFFFFF;
        padding: 16px;
        animation: fnSlideUp 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        overflow: hidden;
      }

      .fn-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        padding-bottom: 10px;
        border-bottom: 1px solid #1E2A3A;
      }

      .fn-brand {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 13.5px;
        font-weight: 700;
        color: #00D4FF;
        letter-spacing: 0.3px;
      }

      .fn-close {
        background: transparent;
        border: none;
        color: #8899AA;
        font-size: 18px;
        cursor: pointer;
        line-height: 1;
        padding: 2px 6px;
        border-radius: 4px;
        transition: color 0.15s, background 0.15s;
      }
      .fn-close:hover {
        color: #FFFFFF;
        background: #1E2A3A;
      }

      .fn-body {
        padding: 12px 0 8px 0;
      }

      .fn-subtitle {
        font-size: 11px;
        color: #8899AA;
        margin-bottom: 4px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
      }

      .fn-domain-row {
        font-size: 14.5px;
        font-weight: 600;
        color: #FFFFFF;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
        word-break: break-all;
      }

      .fn-domain-dot {
        width: 8px;
        height: 8px;
        border-radius: 50%;
        background: #00D4FF;
        animation: fnPulseDot 2s infinite;
        flex-shrink: 0;
      }

      .fn-badges-label {
        font-size: 10.5px;
        text-transform: uppercase;
        letter-spacing: 0.5px;
        color: #8899AA;
        margin-bottom: 6px;
      }

      .fn-badges-container {
        display: flex;
        flex-direction: column;
        gap: 6px;
        max-height: 130px;
        overflow-y: auto;
        margin-bottom: 14px;
        padding-right: 4px;
      }

      .fn-badge {
        display: flex;
        align-items: center;
        justify-content: space-between;
        font-size: 11px;
        font-weight: 600;
        padding: 5px 8px;
        border-radius: 6px;
        border: 1px solid;
      }

      .fn-badge-cat {
        font-weight: 600;
      }

      .fn-badge-val {
        font-size: 10.5px;
        font-family: monospace;
        opacity: 0.85;
      }

      .fn-actions {
        display: flex;
        gap: 8px;
      }

      .fn-btn {
        flex: 1;
        padding: 8px 12px;
        border-radius: 6px;
        font-size: 12px;
        font-weight: 600;
        cursor: pointer;
        border: none;
        transition: all 0.15s ease;
        text-align: center;
      }

      .fn-btn-ignore {
        background: #1E2A3A;
        color: #8899AA;
        border: 1px solid #2A3A4E;
      }
      .fn-btn-ignore:hover {
        background: #2A3A4E;
        color: #FFFFFF;
      }

      .fn-btn-track {
        background: #00D4FF;
        color: #0A1628;
        font-weight: 700;
      }
      .fn-btn-track:hover {
        background: #0099CC;
        color: #FFFFFF;
        box-shadow: 0 0 10px rgba(0, 212, 255, 0.4);
      }

      .fn-footer {
        margin-top: 10px;
        padding-top: 8px;
        border-top: 1px solid #1E2A3A;
        font-size: 10px;
        color: #8899AA;
        display: flex;
        align-items: center;
        justify-content: center;
      }

      .fn-success-view {
        display: none;
        text-align: center;
        padding: 16px 0;
        color: #00FFB3;
        font-size: 13px;
        font-weight: 600;
      }
    `;

    shadow.innerHTML = `
      <style>${styles}</style>
      <div class="fn-card" id="fn-card">
        <div class="fn-header">
          <div class="fn-brand">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#00D4FF" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <circle cx="12" cy="12" r="4" stroke="#00D4FF" fill="#00D4FF" fill-opacity="0.2"/>
              <circle cx="19" cy="6" r="2" stroke="#00FFB3" fill="#00FFB3"/>
              <circle cx="19" cy="18" r="2.5" stroke="#FF6B6B" fill="#FF6B6B"/>
              <circle cx="5" cy="18" r="2" stroke="#FFD700" fill="#FFD700"/>
              <circle cx="5" cy="6" r="2" stroke="#9B59B6" fill="#9B59B6"/>
              <line x1="12" y1="12" x2="19" y2="6" stroke="#00FFB3" stroke-width="1.5" stroke-dasharray="2,2"/>
              <line x1="12" y1="12" x2="19" y2="18" stroke="#FF6B6B" stroke-width="1.5"/>
              <line x1="12" y1="12" x2="5" y2="18" stroke="#FFD700" stroke-width="1.5" stroke-dasharray="1.5,1.5"/>
              <line x1="12" y1="12" x2="5" y2="6" stroke="#9B59B6" stroke-width="1.5"/>
            </svg>
            FirstNode Autopilot
          </div>
          <button class="fn-close" id="fn-btn-close" aria-label="Close">×</button>
        </div>

        <div id="fn-prompt-content">
          <div class="fn-body">
            <div class="fn-subtitle">Data Trail Detection</div>
            <div class="fn-domain-row">
              <div class="fn-domain-dot"></div>
              <span>${domainName}</span>
            </div>

            <div class="fn-badges-label">Detected Information</div>
            <div class="fn-badges-container">
              ${badgesHtml || '<div class="fn-badge" style="color:#00D4FF; background:rgba(0,212,255,0.12); border-color:rgba(0,212,255,0.35)"><span class="fn-badge-cat">Interaction</span><span class="fn-badge-val">Detected</span></div>'}
            </div>

            <div class="fn-actions">
              <button class="fn-btn fn-btn-ignore" id="fn-btn-ignore">Dismiss</button>
              <button class="fn-btn fn-btn-track" id="fn-btn-track">Confirm Trail</button>
            </div>
          </div>

          <div class="fn-footer">
            <span>Encrypted and stored locally on your device</span>
          </div>
        </div>

        <div class="fn-success-view" id="fn-success-view">
          Logged to Digital Trail
        </div>
      </div>
    `;

    document.documentElement.appendChild(host);

    const card = shadow.getElementById('fn-card');
    const btnClose = shadow.getElementById('fn-btn-close');
    const btnIgnore = shadow.getElementById('fn-btn-ignore');
    const btnTrack = shadow.getElementById('fn-btn-track');
    const promptContent = shadow.getElementById('fn-prompt-content');
    const successView = shadow.getElementById('fn-success-view');

    const dismissPrompt = () => {
      card.style.transition = 'opacity 0.2s, transform 0.2s';
      card.style.opacity = '0';
      card.style.transform = 'translateY(16px) scale(0.95)';
      setTimeout(() => host.remove(), 220);
    };

    btnClose.addEventListener('click', dismissPrompt);
    btnIgnore.addEventListener('click', dismissPrompt);

    btnTrack.addEventListener('click', () => {
      saveCurrentSiteToBackground();
      promptContent.style.display = 'none';
      successView.style.display = 'block';
      setTimeout(dismissPrompt, 1000);
    });

    setTimeout(() => {
      if (document.body.contains(host)) {
        dismissPrompt();
      }
    }, 12000);
  }
})();
