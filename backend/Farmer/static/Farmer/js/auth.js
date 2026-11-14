/* Yieldary AI farmer auth pages: plain JavaScript, no framework. */
(function () {
  'use strict';

  function byId(id) {
    return document.getElementById(id);
  }

  function getCookie(name) {
    var cookie = document.cookie ? document.cookie.split('; ') : [];
    for (var i = 0; i < cookie.length; i += 1) {
      var parts = cookie[i].split('=');
      if (parts[0] === name) {
        return decodeURIComponent(parts.slice(1).join('='));
      }
    }
    return '';
  }

  function csrfToken(form) {
    var input = form ? form.querySelector('input[name="csrfmiddlewaretoken"]') : null;
    return (input && input.value) || getCookie('csrftoken');
  }

  async function postJSON(url, data, form) {
    var response = await fetch(url, {
      method: 'POST',
      credentials: 'same-origin',
      headers: {
        'Content-Type': 'application/json',
        'X-CSRFToken': csrfToken(form),
        'X-Requested-With': 'XMLHttpRequest'
      },
      body: JSON.stringify(data)
    });
    var payload = {};
    try {
      payload = await response.json();
    } catch (error) {
      payload = {};
    }
    if (!response.ok || payload.ok === false) {
      throw new Error(payload.error || 'Something went wrong. Please try again.');
    }
    return payload;
  }

  function normalizePhone(value) {
    var raw = (value || '').trim().replace(/[\s().-]/g, '');
    if (raw.indexOf('00') === 0) {
      raw = '+' + raw.slice(2);
    }
    return raw;
  }

  /* ------------------------------------------------------------------ */
  /* Show / hide password buttons (login + signup)                       */
  /* ------------------------------------------------------------------ */
  document.querySelectorAll('[data-toggle-password]').forEach(function (button) {
    button.addEventListener('click', function () {
      var input = byId(button.getAttribute('data-toggle-password'));
      if (!input) return;
      var showing = input.type === 'text';
      input.type = showing ? 'password' : 'text';
      var isPassword = input.type === 'password';
      var closedEye = button.querySelector('.eye-closed');
      var openedEye = button.querySelector('.eye-open');
      if (closedEye) closedEye.classList.toggle('hidden', !isPassword);
      if (openedEye) openedEye.classList.toggle('hidden', isPassword);
      button.setAttribute('aria-label', isPassword ? 'Show password' : 'Hide password');
    });
  });

  /* ------------------------------------------------------------------ */
  /* Signup-only behaviour                                               */
  /* ------------------------------------------------------------------ */
  var form = byId('signup-form');
  if (!form) return;

  var config = byId('signup-config');
  var firebaseScript = byId('firebase-config');
  var firebaseConfig = {};
  if (firebaseScript) {
    try {
      firebaseConfig = JSON.parse(firebaseScript.textContent || '{}');
    } catch (error) {
      firebaseConfig = {};
    }
  }
  var useFirebase = Boolean(firebaseConfig.apiKey);
  var urls = {
    sendCode: config ? config.dataset.sendCodeUrl : '',
    verifyCode: config ? config.dataset.verifyCodeUrl : '',
    verifyFirebase: config ? config.dataset.verifyFirebaseUrl : ''
  };

  var phoneInput = byId('id_phone_number');
  var sendButton = byId('send-code-btn');
  var resendButton = byId('resend-code-btn');
  var otpPanel = byId('otp-panel');
  var codeInput = byId('phone-code');
  var verifyButton = byId('verify-code-btn');
  var phoneStatus = byId('phone-status');
  var phoneBadge = byId('phone-badge');
  var devHint = byId('dev-code-hint');
  var phoneVerified = config ? (config.dataset.verifiedPhone || '') : '';
  var confirmationResult = null;
  var firebaseAuth = null;
  var cooldownTimer = null;

  function setStatus(message, kind) {
    if (!phoneStatus) return;
    var colors = {
      info: 'text-slate-300',
      success: 'text-lime-300',
      error: 'text-rose-300'
    };
    phoneStatus.className = 'text-[11px] leading-5 ' + (colors[kind] || colors.info);
    phoneStatus.textContent = message;
  }

  function setBadge(visible) {
    if (!phoneBadge) return;
    phoneBadge.classList.toggle('hidden', !visible);
    phoneBadge.classList.toggle('inline-flex', visible);
  }

  function showOtpPanel() {
    if (!otpPanel) return;
    otpPanel.classList.remove('hidden');
    otpPanel.classList.add('grid');
  }

  function hideOtpPanel() {
    if (!otpPanel) return;
    otpPanel.classList.add('hidden');
    otpPanel.classList.remove('grid');
  }

  function setBusy(button, busy, busyLabel) {
    if (!button) return;
    if (busy) {
      button.dataset.idleLabel = button.textContent;
      if (busyLabel) button.textContent = busyLabel;
      button.disabled = true;
    } else {
      if (button.dataset.idleLabel) {
        button.textContent = button.dataset.idleLabel;
      }
      button.disabled = false;
    }
  }

  function startCooldown(seconds) {
    if (cooldownTimer) {
      window.clearInterval(cooldownTimer);
      cooldownTimer = null;
    }
    var remaining = seconds;
    if (resendButton) {
      resendButton.classList.remove('hidden');
      resendButton.disabled = true;
      resendButton.textContent = 'Resend in ' + remaining + 's';
    }
    if (sendButton) sendButton.disabled = true;
    cooldownTimer = window.setInterval(function () {
      remaining -= 1;
      if (remaining <= 0) {
        window.clearInterval(cooldownTimer);
        cooldownTimer = null;
        if (resendButton) {
          resendButton.disabled = false;
          resendButton.textContent = 'Resend code';
        }
        if (sendButton) sendButton.disabled = false;
        return;
      }
      if (resendButton) resendButton.textContent = 'Resend in ' + remaining + 's';
    }, 1000);
  }

  function markVerified(phone, message) {
    phoneVerified = phone;
    if (phoneInput && phone) phoneInput.value = phone;
    setBadge(true);
    hideOtpPanel();
    if (devHint) {
      devHint.classList.add('hidden');
      devHint.textContent = '';
    }
    if (codeInput) codeInput.value = '';
    setStatus(message || 'Phone number verified successfully.', 'success');
    if (sendButton) {
      sendButton.disabled = false;
      sendButton.textContent = 'Verified';
    }
    if (resendButton) resendButton.classList.add('hidden');
  }

  function resetVerificationIfChanged() {
    var current = normalizePhone(phoneInput ? phoneInput.value : '');
    if (phoneVerified && current !== phoneVerified) {
      phoneVerified = '';
      confirmationResult = null;
      setBadge(false);
      hideOtpPanel();
      if (devHint) {
        devHint.classList.add('hidden');
        devHint.textContent = '';
      }
      if (sendButton) {
        sendButton.disabled = false;
        sendButton.textContent = 'Send code';
      }
      if (resendButton) resendButton.classList.add('hidden');
      setStatus("We'll send a 6-digit verification code.", 'info');
    }
  }

  async function loadFirebase() {
    if (firebaseAuth) return window.__yieldaryFirebaseAuth;
    var appModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js');
    var authModule = await import('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js');
    var app = appModule.initializeApp(firebaseConfig);
    firebaseAuth = authModule.getAuth(app);
    window.__yieldaryFirebaseAuth = authModule;
    window.__yieldaryRecaptcha = new authModule.RecaptchaVerifier(
      firebaseAuth,
      'recaptcha-container',
      { size: 'invisible' }
    );
    return authModule;
  }

  async function sendLocalCode(phone) {
    var payload = await postJSON(urls.sendCode, { phone_number: phone }, form);
    showOtpPanel();
    if (payload.dev_code) {
      if (codeInput) codeInput.value = payload.dev_code;
      if (devHint) {
        devHint.textContent = 'Dev code: ' + payload.dev_code;
        devHint.classList.remove('hidden');
      }
    }
    setStatus(payload.message || 'Verification code sent.', 'info');
  }

  async function sendFirebaseCode(phone) {
    var authModule = await loadFirebase();
    confirmationResult = await authModule.signInWithPhoneNumber(
      firebaseAuth,
      phone,
      window.__yieldaryRecaptcha
    );
    showOtpPanel();
    setStatus('A verification SMS was sent to ' + phone + '.', 'info');
  }

  async function sendCode() {
    var phone = normalizePhone(phoneInput ? phoneInput.value : '');
    if (!phone) {
      setStatus('Enter your phone number first.', 'error');
      if (phoneInput) phoneInput.focus();
      return;
    }
    if (phoneVerified === phone) {
      setStatus('This phone number is already verified.', 'success');
      return;
    }
    setBusy(sendButton, true, 'Sending...');
    var sent = false;
    try {
      if (useFirebase) {
        await sendFirebaseCode(phone);
      } else {
        await sendLocalCode(phone);
      }
      sent = true;
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(sendButton, false);
    }
    if (sent) startCooldown(60);
  }

  async function verifyCode() {
    var phone = normalizePhone(phoneInput ? phoneInput.value : '');
    var code = (codeInput ? codeInput.value : '').trim();
    if (!phone) {
      setStatus('Enter your phone number first.', 'error');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setStatus('Enter the 6-digit verification code.', 'error');
      if (codeInput) codeInput.focus();
      return;
    }

    setBusy(verifyButton, true, 'Verifying...');
    try {
      var payload;
      if (useFirebase && confirmationResult) {
        var credential = await confirmationResult.confirm(code);
        var idToken = await credential.user.getIdToken();
        payload = await postJSON(
          urls.verifyFirebase,
          { phone_number: phone, id_token: idToken },
          form
        );
      } else {
        payload = await postJSON(
          urls.verifyCode,
          { phone_number: phone, code: code },
          form
        );
      }
      markVerified(phone, payload.message);
      if (cooldownTimer) {
        window.clearInterval(cooldownTimer);
        cooldownTimer = null;
      }
    } catch (error) {
      setStatus(error.message, 'error');
    } finally {
      setBusy(verifyButton, false);
    }
  }

  if (sendButton) sendButton.addEventListener('click', sendCode);
  if (resendButton) resendButton.addEventListener('click', sendCode);
  if (verifyButton) verifyButton.addEventListener('click', verifyCode);
  if (codeInput) {
    codeInput.addEventListener('keydown', function (event) {
      if (event.key === 'Enter') {
        event.preventDefault();
        verifyCode();
      }
    });
  }
  if (phoneInput) {
    phoneInput.addEventListener('input', resetVerificationIfChanged);
    phoneInput.addEventListener('blur', function () {
      var phone = normalizePhone(phoneInput.value);
      if (phone) phoneInput.value = phone;
    });
  }
  if (phoneVerified) {
    setBadge(true);
    setStatus('Phone number verified.', 'success');
    if (sendButton) sendButton.textContent = 'Verified';
  }

  form.addEventListener('submit', function (event) {
    var phone = normalizePhone(phoneInput ? phoneInput.value : '');
    if (!phoneVerified || phoneVerified !== phone) {
      event.preventDefault();
      setStatus('Verify your phone number with the SMS code before creating your account.', 'error');
      if (phoneInput) {
        phoneInput.focus();
        phoneInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
      return;
    }
    var submit = byId('signup-submit');
    if (submit) {
      submit.disabled = true;
      submit.textContent = 'Creating account...';
    }
  });

  /* ------------------------------------------------------------------ */
  /* User-type conditional fields                                        */
  /* ------------------------------------------------------------------ */
  var userType = byId('id_user_type');
  var farmerFields = byId('farmer-fields');
  function toggleUserType() {
    if (!userType || !farmerFields) return;
    farmerFields.classList.toggle('hidden', userType.value !== 'farmer');
  }
  if (userType) {
    userType.addEventListener('change', toggleUserType);
    toggleUserType();
  }

  /* ------------------------------------------------------------------ */
  /* OpenStreetMap (Nominatim) place search                              */
  /* ------------------------------------------------------------------ */
  var placeInput = byId('place-search');
  var placeResults = byId('place-results');
  var placeHidden = byId('id_place_name');
  var latitudeHidden = byId('id_latitude');
  var longitudeHidden = byId('id_longitude');
  var selectedBox = byId('place-selected');
  var selectedName = byId('place-selected-name');
  var selectedCoords = byId('place-selected-coords');
  var placeTimer = null;
  var placeAbort = null;

  function closePlaceResults() {
    if (!placeResults) return;
    placeResults.classList.add('hidden');
    placeResults.innerHTML = '';
  }

  function clearSelectedPlace() {
    if (placeHidden) placeHidden.value = '';
    if (latitudeHidden) latitudeHidden.value = '';
    if (longitudeHidden) longitudeHidden.value = '';
    if (selectedBox) selectedBox.classList.add('hidden');
  }

  function selectPlace(item) {
    if (!placeInput || !placeHidden || !latitudeHidden || !longitudeHidden) return;
    var display = item.display_name || '';
    var lat = Number(item.lat);
    var lon = Number(item.lon);
    if (!display || !isFinite(lat) || !isFinite(lon)) return;
    placeInput.value = display;
    placeHidden.value = display;
    latitudeHidden.value = lat.toFixed(6);
    longitudeHidden.value = lon.toFixed(6);
    if (selectedName) selectedName.textContent = display;
    if (selectedCoords) {
      selectedCoords.textContent = lat.toFixed(6) + ', ' + lon.toFixed(6);
    }
    if (selectedBox) selectedBox.classList.remove('hidden');
    closePlaceResults();
  }

  function renderPlaceResults(items) {
    if (!placeResults) return;
    placeResults.innerHTML = '';
    placeResults.classList.remove('hidden');
    if (!items.length) {
      var empty = document.createElement('p');
      empty.className = 'px-3 py-2 text-xs text-slate-500';
      empty.textContent = 'No places found. Try a nearby town or district.';
      placeResults.appendChild(empty);
      return;
    }
    items.forEach(function (item) {
      var button = document.createElement('button');
      button.type = 'button';
      button.setAttribute('role', 'option');
      button.className = 'block w-full rounded-lg px-3 py-2 text-left text-xs leading-5 text-slate-300 transition hover:bg-lime/10 hover:text-white focus:bg-lime/10 focus:outline-none';
      button.textContent = item.display_name;
      button.addEventListener('mousedown', function (event) {
        event.preventDefault();
        selectPlace(item);
      });
      placeResults.appendChild(button);
    });
  }

  function searchPlaces(query) {
    if (placeAbort) placeAbort.abort();
    placeAbort = new AbortController();
    var url = 'https://nominatim.openstreetmap.org/search?format=jsonv2&addressdetails=1&limit=5&q=' + encodeURIComponent(query);
    fetch(url, {
      signal: placeAbort.signal,
      headers: { 'Accept-Language': 'en' }
    })
      .then(function (response) {
        if (!response.ok) throw new Error('Place search failed.');
        return response.json();
      })
      .then(renderPlaceResults)
      .catch(function (error) {
        if (error.name === 'AbortError') return;
        closePlaceResults();
      });
  }

  if (placeInput) {
    placeInput.addEventListener('input', function () {
      clearSelectedPlace();
      if (placeTimer) window.clearTimeout(placeTimer);
      var query = placeInput.value.trim();
      if (query.length < 3) {
        closePlaceResults();
        return;
      }
      placeTimer = window.setTimeout(function () {
        searchPlaces(query);
      }, 1000);
    });
    placeInput.addEventListener('keydown', function (event) {
      if (event.key === 'Escape') {
        closePlaceResults();
      }
      if (event.key === 'Enter' && placeResults) {
        var first = placeResults.querySelector('button');
        if (first && !placeResults.classList.contains('hidden')) {
          event.preventDefault();
          first.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
        }
      }
    });
    document.addEventListener('click', function (event) {
      if (!placeResults) return;
      if (!placeResults.contains(event.target) && event.target !== placeInput) {
        closePlaceResults();
      }
    });
    if (placeHidden && placeHidden.value && latitudeHidden && longitudeHidden) {
      if (selectedCoords) {
        selectedCoords.textContent = latitudeHidden.value + ', ' + longitudeHidden.value;
      }
      if (selectedBox) selectedBox.classList.remove('hidden');
    }
  }

  /* ------------------------------------------------------------------ */
  /* Crop chips + password strength                                      */
  /* ------------------------------------------------------------------ */
  var cropsInput = byId('id_crops_grown');
  var cropChips = byId('crop-chips');
  function renderCrops() {
    if (!cropsInput || !cropChips) return;
    cropChips.innerHTML = '';
    var seen = {};
    cropsInput.value.split(/[,;\n]+/).forEach(function (part) {
      var crop = part.trim();
      if (!crop || seen[crop.toLowerCase()]) return;
      seen[crop.toLowerCase()] = true;
      var chip = document.createElement('span');
      chip.className = 'inline-flex items-center rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[10px] text-slate-300';
      chip.textContent = crop;
      cropChips.appendChild(chip);
    });
  }
  if (cropsInput) {
    cropsInput.addEventListener('input', renderCrops);
    renderCrops();
  }

  var passwordInput = byId('id_password');
  var strengthBars = [byId('strength-1'), byId('strength-2'), byId('strength-3')];
  var strengthLabel = byId('strength-label');
  function updateStrength() {
    if (!passwordInput) return;
    var value = passwordInput.value;
    var score = 0;
    if (value.length >= 8) score += 1;
    if (value.length >= 12) score += 1;
    if (/[a-z]/.test(value) && /[A-Z]/.test(value) && /\d/.test(value)) score += 1;
    if (/[^A-Za-z0-9]/.test(value)) score += 1;
    var level = value.length === 0 ? 0 : Math.min(3, Math.max(1, score));
    var labels = ['Strength', 'Weak', 'Fair', 'Strong'];
    var colors = ['bg-rose', 'bg-rose', 'bg-amber', 'bg-lime'];
    strengthBars.forEach(function (bar, index) {
      if (!bar) return;
      bar.style.width = index < level ? '100%' : '0%';
      bar.className = 'h-full rounded-full transition-all ' + (index < level ? colors[level - 1] : 'bg-transparent');
    });
    if (strengthLabel) {
      strengthLabel.textContent = labels[level];
      strengthLabel.className = 'w-16 text-right font-data text-[9px] uppercase tracking-wider ' + (level === 3 ? 'text-lime' : 'text-slate-600');
    }
  }
  if (passwordInput) {
    passwordInput.addEventListener('input', updateStrength);
    updateStrength();
  }
})();
