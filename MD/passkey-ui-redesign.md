# Passkey UI Redesign

## Goal
Replace the current login modal UI with the clean PIN numpad design from the user manual mockup.

## Visual spec

### Numpad buttons
- **Current**: blue `mock-btn` blocks
- **Change to**: neutral grey or near-white with subtle border and shadow
  - Default state: `background: #f4f4f5`, `border: 1px solid #d4d4d8`, `border-radius: 10px`, `box-shadow: 0 1px 3px rgba(0,0,0,0.08)`
  - Hover state: `background: #e4e4e7`
  - Active/press state: `background: #d4d4d8`, `transform: scale(0.96)`
  - Text: `color: #1a1a1a`, `font-size: 22px`, `font-weight: 600`

### Confirm button (✓)
- Background: `#2f7a52` (green) — keep as-is
- Color: `#fff`

### Backspace button (⌫)
- Background: `#f4f4f5` (matches neutral keys)
- Color: `#555`
- Font-size slightly smaller than digit keys

### PIN dot display
- Row of 4–6 dots (depending on PIN length) below the header
- Empty dot: `border: 2px solid #d4d4d8`, `border-radius: 50%`, `width: 12px`, `height: 12px`, `background: transparent`
- Filled dot: `background: #1a1a1a`, `border-color: #1a1a1a`
- Animate fill with a subtle scale pop: `transform: scale(1.2)` → `scale(1)` on keypress

### Modal / container
- Background: `#fff`
- Border-radius: `16px`
- Box-shadow: `0 8px 32px rgba(0,0,0,0.18)`
- Padding: `28px 24px`
- Max-width: `320px`
- Centered on screen with a semi-transparent dark overlay behind it

### Header
- Keep dark header band (current `#1d2b38` or similar)
- Title: "Enter your passkey"
- Subtitle: role or facility name
- Border-radius on top corners to match modal: `16px 16px 0 0`

### Grid layout
- 3 columns, 4 rows: `1 2 3 / 4 5 6 / 7 8 9 / ⌫ 0 ✓`
- Gap: `10px`
- Each button: `aspect-ratio: 1` or fixed `height: 60px`

---

## Files to change

| File | Change |
|------|--------|
| `public/lib/login-ui.js` | Replace numpad button styles and structure with new spec above |
| `public/styles/record-theme.css` | Add `.passkey-key`, `.passkey-confirm`, `.passkey-delete`, `.passkey-dots` classes |
| `public/lib/passkey-input.js` (or wherever `PasskeyInput` is defined) | Update rendered HTML/CSS for the numpad modal |

## Cache-bust reminder
After changes, bump `?v=N` on every HTML file loading the changed JS files:
```bash
grep -rl "login-ui.js\|passkey-input.js" public/
```
