# Updates to signoff-block.js for Passkey Integration

## In verifyFieldsHtml() function:

**FIND THIS:**
```javascript
<label class="${fieldClass}">Signature<input id="${signatureId}"></label>
```

**REPLACE WITH:**
```javascript
<label class="${fieldClass}">
  Signature
  <div style="position: relative;">
    <input id="${signatureId}" type="text" 
           placeholder="Enter passkey" readonly
           onclick="PasskeyInput.openForField('${signatureId}')"
           style="cursor: pointer; background: #f9f9f9;">
    <div class="passkey-verified-display" id="${signatureId}_display"></div>
  </div>
</label>
```

## In mountVerification() function:

After the HTML is rendered, add this code to set up the passkey listener:

```javascript
// Setup passkey input styles and behavior
const style = document.createElement('style');
style.textContent = `
  input[placeholder="Enter passkey"] {
    cursor: pointer;
    background: #f5f5f5 !important;
    border: 2px solid #2196F3 !important;
  }
  input[placeholder="Enter passkey"]:hover {
    background: #e3f2fd !important;
  }
  .passkey-verified-display {
    font-size: 12px;
    color: green;
    margin-top: 4px;
  }
  .verified-badge {
    background: #4caf50;
    color: white;
    padding: 2px 6px;
    border-radius: 3px;
    font-weight: bold;
  }
`;
document.head.appendChild(style);
```

## In readVerifyInputs() function:

Make sure signature field is read correctly:

```javascript
function readVerifyInputs(idPrefix) {
  const ids = verifyIds(idPrefix);
  return {
    verifiedBy: (el(ids.by).value || '').trim(),
    verifiedSig: (el(ids.title).value || '').trim(),
    verifiedDate: el(ids.date).value,
    verifiedSignature: (el(ids.signature).value || '').trim(),
    isPasskeyVerified: el(ids.signature).dataset.verified === 'true'
  };
}
```

## Add script tag to HTML pages:

In any page with verification signature block (before `</body>`):

```html
<script src="lib/passkey-input.js?v=1"></script>
<script src="lib/signoff-block.js?v=2"></script>
```

**IMPORTANT:** Update the `?v=2` cache bust number whenever you modify signoff-block.js
