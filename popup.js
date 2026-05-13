const $ = id => document.getElementById(id);

const powerBtn    = $('powerBtn');
const statusDot   = $('statusDot');
const statusText  = $('statusText');
const applyBtn    = $('applyBtn');
const rateInfo    = $('rateInfo');

let enabled = true;

async function load() {
  const stored = await browser.storage.local.get([
    'enabled','currency','currencyFrom','dateFormat','timezone','convertUnits','convertTemp','rateCache'
  ]);

  enabled = stored.enabled !== false;
  updatePower();

  if (stored.currency)      $('currencyTo').value    = stored.currency;
  if (stored.currencyFrom)  $('currencyFrom').value  = stored.currencyFrom;
  if (stored.dateFormat)    $('dateFormat').value     = stored.dateFormat;
  if (stored.timezone)      $('timezone').value       = stored.timezone;

  $('convertUnits').checked = stored.convertUnits !== false;
  $('convertTemp').checked  = stored.convertTemp  !== false;

  if (stored.rateCache && stored.rateCache.timestamp) {
    const mins = Math.round((Date.now() - stored.rateCache.timestamp) / 60000);
    const to = stored.currency || 'INR';
    const rate = stored.rateCache[`USD_${to}`];
    if (rate) rateInfo.textContent = `1 USD = ${rate.toFixed(2)} ${to} · ${mins}m ago`;
  }
}

function updatePower() {
  if (enabled) {
    powerBtn.classList.add('on');
    statusDot.className = 'status-dot active';
    statusText.textContent = 'Active on this page';
    document.body.classList.remove('disabled');
  } else {
    powerBtn.classList.remove('on');
    statusDot.className = 'status-dot inactive';
    statusText.textContent = 'Disabled';
    document.body.classList.add('disabled');
  }
}

powerBtn.addEventListener('click', () => {
  enabled = !enabled;
  browser.storage.local.set({ enabled });
  updatePower();
  sendToPage({ action: 'apply-settings', enabled });
});

applyBtn.addEventListener('click', async () => {
  const tzSelect = $('timezone');
  const tzLabel = tzSelect.options[tzSelect.selectedIndex]?.getAttribute('data-label') || 'Local';
  const settings = {
    action: 'apply-settings',
    enabled,
    currency: $('currencyTo').value,
    currencyFrom: $('currencyFrom').value,
    dateFormat: $('dateFormat').value,
    timezone: tzSelect.value,
    tzLabel,
    convertUnits: $('convertUnits').checked,
    convertTemp: $('convertTemp').checked
  };

  await browser.storage.local.set({
    currency: settings.currency,
    currencyFrom: settings.currencyFrom,
    dateFormat: settings.dateFormat,
    timezone: settings.timezone,
    tzLabel: settings.tzLabel,
    convertUnits: settings.convertUnits,
    convertTemp: settings.convertTemp
  });

  sendToPage(settings);

  applyBtn.textContent = 'Applied!';
  applyBtn.style.background = '#16a34a';
  setTimeout(() => {
    applyBtn.textContent = 'Apply to this page';
    applyBtn.style.background = '';
  }, 1500);
});

async function sendToPage(msg) {
  try {
    const tabs = await browser.tabs.query({ active: true, currentWindow: true });
    if (tabs[0]) browser.tabs.sendMessage(tabs[0].id, msg);
  } catch (e) {}
}

document.querySelectorAll('.section-header').forEach(header => {
  header.addEventListener('click', () => {
    const targetId = header.getAttribute('data-target');
    const body = document.getElementById(targetId);
    const chevronId = 'chevron-' + targetId;
    const chevron = document.getElementById(chevronId);
    if (!body) return;
    const isOpen = body.classList.toggle('open');
    if (chevron) chevron.classList.toggle('open', !isOpen);
  });
});

load();