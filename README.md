# Lokal

A Firefox extension that automatically converts currencies, timezones, dates, temperatures, and units to your preferred locale on any webpage — no clicking, no copying numbers into converters.

## What it does

- **Currency** — Converts symbol-based (`$250 [23,918 INR]`) and text-based (`USD 10 million [95.67 crore INR] [95.67 crore INR]`) amounts to your currency. Shows Indian formatting (lakh/crore) for INR.
- **Timezone** — Converts times like `9:00 AM EST [7:30 PM IST] [7:30 PM IST [7:00 PM IST]] [7:30 PM IST [7:00 PM IST] [7:00 PM IST [6:30 PM IST]]]` to your local timezone
- **Date format** — Converts `25/12/2024 [25/12/2024 [25/12/2024 [25/12/2024 [12/25/2024]]]]` or `25/12/2024 [25/12/2024 [25/12/2024 [25/12/2024 [25/12/2024 [2024-12-25]]]]]` to `DD/MM/YYYY` or whichever format you prefer
- **Temperature** — Converts `98°F [36.7°C] [36.7°C] [36.7°C] [36.7°C] [36.7°C] [36.7°C]` to Celsius inline
- **Units** — Converts miles, lbs, gallons, feet, mph, acres, sq ft to metric

All conversions show the original value in brackets so you never lose context.

## Installation

### Firefox (recommended)
Coming soon on [Firefox Add-ons](https://addons.mozilla.org)

### Manual install (Firefox)
1. Download or clone this repo
2. Go to `about:debugging` in Firefox
3. Click **This Firefox** → **Load Temporary Add-on**
4. Select `manifest.json`

## Configuration

Click the extension icon to open settings:

| Setting | Options |
|---|---|
| Currency | USD, EUR, GBP, JPY, INR, AUD, CAD, SGD, CHF |
| Timezone | IST, ET, PT, CT, GMT, CET, GST, SGT, JST, AEST, UTC |
| Date format | DD/MM/YYYY, DD-MM-YYYY, YYYY-MM-DD, MM/DD/YYYY |
| Units | Toggle on/off |
| Temperature | Toggle on/off |

Exchange rates are fetched live from [exchangerate-api.com](https://exchangerate-api.com) and cached for 1 hour.

## Tech

- Vanilla JS — no frameworks, no build step
- WebExtensions API (Firefox/Chrome compatible)
- Live exchange rates via exchangerate-api.com free tier

## Contributing

PRs welcome. Some things worth adding:
- Shoe/clothing size conversion
- Indian number format (lakh/crore) for non-currency numbers
- Per-site config
- Chrome Web Store release

## License

MIT
