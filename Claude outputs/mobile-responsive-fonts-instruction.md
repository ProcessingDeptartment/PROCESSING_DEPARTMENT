# Instruction: Mobile & Tablet Font Responsiveness

## Requirement
All records must be easy to use on tablet and phone devices. Current font sizes are not compatible with smaller screens and need to be adjusted for better mobile/tablet readability and usability.

## Scope
- Apply to all record pages in the Processing Department system
- Covers both `public/styles/record-theme.css` (global theme) and `public/styles/responsive.css` (responsive overrides)
- Focus on label text, input fields, button text, section titles, and form instructions

## Acceptance Criteria
- Text must be readable without zooming on phones (minimum 16px base font on mobile)
- Labels and field values scale appropriately for touch interaction (tap targets ≥44px)
- Section titles remain visually distinct across all screen sizes
- Form inputs (text fields, dropdowns, number fields) accommodate mobile keyboards without horizontal scroll
- Roster/batch rows remain navigable on phones (either stacked or horizontally scrollable with clear indicators)
- All interactive elements (buttons, links, checkboxes) have sufficient size and spacing for thumb/finger input on mobile

## Implementation Notes
- Tablet breakpoint: typically 600px–1024px width
- Phone breakpoint: < 600px width
- Use CSS media queries in `responsive.css` for mobile/tablet overrides
- Test on actual devices or browser DevTools device emulation before marking complete
