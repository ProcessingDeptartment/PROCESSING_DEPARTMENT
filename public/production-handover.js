function init() {
    updateComplianceIcons();
    validatePrint();
}

function cycleStatus(btn, sectionId) {
    if (btn.classList.contains('conforming')) {
        btn.classList.remove('conforming');
    } else {
        btn.classList.add('conforming');
    }
    updateComplianceIcons();
}

function toggleField(btn, fieldId, sectionId) {
    const fieldBlock = document.getElementById(fieldId);
    const isOpen = !fieldBlock.classList.contains('hidden');

    if (isOpen) {
        fieldBlock.classList.add('hidden');
        btn.classList.remove('conforming');
        clearSectionFields(fieldBlock);
    } else {
        fieldBlock.classList.remove('hidden');
        btn.classList.add('conforming');
    }
    updateComplianceIcons();
}

function toggleStaffingSelection(btn, showFieldId) {
    const showField = document.getElementById(showFieldId);
    const isOpen = !showField.classList.contains('hidden');

    if (isOpen) {
        showField.classList.add('hidden');
        btn.classList.remove('conforming');
        clearSectionFields(showField);
    } else {
        showField.classList.remove('hidden');
        btn.classList.add('conforming');
    }
    updateComplianceIcons();
}

function clearSectionFields(container) {
    const inputs = container.querySelectorAll('input, select');
    inputs.forEach(input => {
        if (input.type === 'checkbox' || input.type === 'radio') input.checked = false;
        else input.value = '';
        if (input.id === 'dry-grade-days') input.value = '';
    });
    const countSpan = container.querySelector('.bubble-val-input[id$="-count"]');
    if (countSpan) countSpan.innerText = '--';
    container.querySelectorAll('.bubble-block').forEach(block => {
        block.classList.remove('conforming');
        block.classList.remove('nc');
    });
}

function markFieldInput(input) {
    const parent = input.closest('.bubble-block');
    if (!parent) return;
    const value = input.value.trim();
    if (!value) {
        parent.classList.remove('conforming');
        parent.classList.remove('nc');
    } else {
        parent.classList.remove('nc');
        parent.classList.add('conforming');
    }
    updateComplianceIcons();
}

function setYesNoValue(button, inputId) {
    const input = document.getElementById(inputId);
    const parent = input.closest('.bubble-block');
    const toggle = button.closest('.yesno-toggle');
    const value = button.getAttribute('data-value');
    input.value = value;
    toggle.querySelectorAll('button').forEach(btn => btn.classList.toggle('active', btn === button));
    if (!value) {
        parent.classList.remove('conforming');
        parent.classList.remove('nc');
    } else if (/^yes\b/i.test(value)) {
        parent.classList.remove('conforming');
        parent.classList.add('nc');
    } else {
        parent.classList.remove('nc');
        parent.classList.add('conforming');
    }
    updateComplianceIcons();
}

function updateHarvestCount(type) {
    const prefix = type === 'CAN' ? 'harvest-can' : 'harvest-dry';
    const weight = parseFloat(document.getElementById(`${prefix}-weight`).value);
    const size = parseFloat(document.getElementById(`${prefix}-size`).value);
    const countElement = document.getElementById(`${prefix}-count`);
    let countText = '--';
    if (!isNaN(weight) && !isNaN(size) && weight > 0) {
        const computed = Math.round(weight * size);
        countText = computed.toString();
    }
    countElement.innerText = countText;
    if (countText !== '--') countElement.closest('.bubble-block')?.classList.add('conforming');
    updateComplianceIcons();
}

function addHarvestJob(type) {
    const prefix = type === 'CAN' ? 'harvest-can' : 'harvest-dry';
    const panel = document.getElementById(prefix);
    if (panel.classList.contains('hidden')) {
        alert(`Please open the ${type === 'CAN' ? 'Can' : 'Dry'} section before adding a job.`);
        return;
    }
    const job = document.getElementById(`${prefix}-job`).value.trim();
    const weight = document.getElementById(`${prefix}-weight`).value.trim();
    const sizeText = document.getElementById(`${prefix}-size`).selectedOptions[0]?.textContent || '';
    const sizeValue = document.getElementById(`${prefix}-size`).value;
    const count = document.getElementById(`${prefix}-count`).innerText;
    if (!job || !weight || !sizeValue || count === '--') {
        alert('Please complete job number, weight and size range before adding the job.');
        return;
    }
    addSectionJob('harvest-job-list', [
        { label: 'Type', value: type },
        { label: 'Job', value: job },
        { label: 'Weight', value: weight },
        { label: 'Size', value: sizeText },
        { label: 'Count', value: count }
    ]);
    document.getElementById(`${prefix}-job`).value = '';
    document.getElementById(`${prefix}-weight`).value = '';
    document.getElementById(`${prefix}-size`).value = '';
    document.getElementById(`${prefix}-count`).innerText = '--';
    updateComplianceIcons();
}

function addSectionJob(listId, values) {
    const container = document.getElementById(listId);
    if (!container) return;
    const visibleValues = values.filter(item => item.value !== undefined && item.value !== null && String(item.value).trim() !== '');
    if (!visibleValues.length) return;
    const row = document.createElement('div');
    row.className = 'compliance-row';
    row.innerHTML = `
        <div class="flex flex-wrap items-center gap-2 text-[12px]">
            ${visibleValues.map(item => `<span class="inline-detail-pill"><strong>${item.label}:</strong> ${String(item.value).trim()}</span>`).join('')}
        </div>
        <button class="text-red-500 font-bold text-[10px] uppercase hover:underline self-start" onclick="this.closest('.compliance-row').remove(); updateComplianceIcons();">Remove</button>
    `;
    container.appendChild(row);
    updateComplianceIcons();
}

function addCanningJob(type) {
    const prefix = type === 'cultivated' ? 'cultivated' : 'thirdparty';
    const panel = document.getElementById(`${prefix}-fields`);
    if (panel.classList.contains('hidden')) {
        alert(`Please open the ${type === 'cultivated' ? 'Cultivated abalone' : 'Third party abalone'} section before adding a job.`);
        return;
    }
    const job = document.getElementById(`${prefix}-job`).value.trim();
    if (!job) {
        alert('Please complete the job number before adding the job.');
        return;
    }
    addSectionJob(`${prefix}-job-list`, [
        { label: 'Type', value: type === 'cultivated' ? 'Cultivated abalone' : 'Third party abalone' },
        { label: 'Job', value: job },
        { label: 'OOSW%', value: document.getElementById(`${prefix}-oosw`).value.trim() || 'n/a' },
        { label: 'Precook%', value: document.getElementById(`${prefix}-precook`).value.trim() || 'n/a' },
        { label: 'Cans closed', value: document.getElementById(`${prefix}-cans`).value.trim() || 'n/a' },
        { label: 'Carry over', value: document.getElementById(`${prefix}-carry`).value.trim() || 'n/a' }
    ]);
    document.getElementById(`${prefix}-job`).value = '';
    document.getElementById(`${prefix}-oosw`).value = '';
    document.getElementById(`${prefix}-precook`).value = '';
    document.getElementById(`${prefix}-cans`).value = '';
    document.getElementById(`${prefix}-carry`).value = '';
}

function addDryingJob(type) {
    const prefix = type === 'processing' ? 'dry-process' : 'dry-grade';
    const panel = document.getElementById(`${prefix === 'dry-process' ? 'dry-processing' : 'dry-grading'}-fields`);
    if (panel.classList.contains('hidden')) {
        alert(`Please open the ${type === 'processing' ? 'Dry processing' : 'Grading'} section before adding a job.`);
        return;
    }
    const job = document.getElementById(`${prefix}-job`).value.trim();
    if (!job) {
        alert('Please complete the job number before adding the job.');
        return;
    }
    if (type === 'processing') {
        addSectionJob('dry-process-job-list', [
            { label: 'Type', value: 'Dry processing' },
            { label: 'Job', value: job },
            { label: 'OOSW%', value: document.getElementById('dry-process-oosw').value.trim() || 'n/a' },
            { label: 'Pots cooked', value: document.getElementById('dry-process-pots').value.trim() || 'n/a' },
            { label: 'Stringed & hung', value: document.getElementById('dry-process-stringed').value.trim() || 'n/a' },
            { label: 'Carry over', value: document.getElementById('dry-process-carry').value.trim() || 'n/a' }
        ]);
        document.getElementById('dry-process-job').value = '';
        document.getElementById('dry-process-oosw').value = '';
        document.getElementById('dry-process-pots').value = '';
        document.getElementById('dry-process-stringed').value = '';
        document.getElementById('dry-process-carry').value = '';
    } else {
        addSectionJob('dry-grade-job-list', [
            { label: 'Type', value: 'Grading' },
            { label: 'Job', value: job },
            { label: 'Date in', value: document.getElementById('dry-grade-in').value || 'n/a' },
            { label: 'Date out', value: document.getElementById('dry-grade-out').value || 'n/a' },
            { label: 'Days', value: document.getElementById('dry-grade-days').value.trim() || 'n/a' },
            { label: 'Grading complete', value: document.getElementById('dry-grade-complete').value.trim() || 'n/a' },
            { label: 'Boxing complete', value: document.getElementById('dry-grade-boxing').value.trim() || 'n/a' },
            { label: 'Carry over', value: document.getElementById('dry-grade-carry').value.trim() || 'n/a' }
        ]);
        document.getElementById('dry-grade-job').value = '';
        document.getElementById('dry-grade-in').value = '';
        document.getElementById('dry-grade-out').value = '';
        document.getElementById('dry-grade-days').value = '';
        document.getElementById('dry-grade-complete').value = '';
        document.getElementById('dry-grade-boxing').value = '';
        document.getElementById('dry-grade-carry').value = '';
    }
}

function updateDaysInDrying() {
    const start = document.getElementById('dry-grade-in').value;
    const end = document.getElementById('dry-grade-out').value;
    const output = document.getElementById('dry-grade-days');
    const block = document.getElementById('dry-grade-days-block');
    if (start && end) {
        const startDate = new Date(start);
        const endDate = new Date(end);
        const diff = Math.round((endDate - startDate) / (1000 * 60 * 60 * 24));
        output.value = diff >= 0 ? diff.toString() : '';
        if (diff > 25) {
            block.classList.add('nc');
            block.classList.remove('conforming');
        } else {
            block.classList.remove('nc');
            block.classList.add('conforming');
        }
    } else {
        output.value = '';
        block.classList.remove('nc');
        block.classList.remove('conforming');
    }
    markFieldInput(output);
}

function updateComplianceIcons() {
    const sections = [
        { id: 'sec-1', statusId: 'status-1', ncSelector: '.nc', activeSelector: '.conforming' },
        { id: 'sec-2', statusId: 'status-2', ncSelector: '.nc', activeSelector: '.conforming' },
        { id: 'sec-3', statusId: 'status-3', ncSelector: '.nc', activeSelector: '.conforming' },
        { id: 'sec-4', statusId: 'status-4', ncSelector: '.nc', activeSelector: '.conforming' },
        { id: 'sec-5', statusId: 'status-5', ncSelector: '.nc', activeSelector: '.conforming' },
        { id: 'sec-6', statusId: 'status-6', ncSelector: '.nc', activeSelector: '.conforming' }
    ];
    sections.forEach(sec => {
        const sectionEl = document.getElementById(sec.id);
        if (!sectionEl) return;
        const isNC = sectionEl.querySelectorAll(sec.ncSelector).length > 0;
        const hasActive = sectionEl.querySelectorAll(sec.activeSelector).length > 0;
        const hasJobRows = sec.id === 'sec-3' && document.getElementById('harvest-job-list').children.length > 0;
        const icon = document.getElementById(sec.statusId);
        // Remove visual emoji/status text - keep icons empty per user preference
        if (icon) {
            icon.innerText = '';
            icon.style.color = '';
        }
    });
}

function validatePrint() {
    const dateInput = document.getElementById('hDate').value;
    const shiftInput = document.getElementById('hShift').value;
    const nameInput = document.getElementById('hName').value.trim();
    const btn = document.getElementById('printBtn');
    const isReady = (dateInput !== '' && shiftInput !== '' && nameInput !== '');
    btn.disabled = !isReady;
    document.getElementById('printWarning').classList.toggle('hidden', isReady);
}

function preparePrint() {
    const dateVal = document.getElementById('hDate').value;
    const shiftVal = document.getElementById('hShift').value;
    const managerName = document.getElementById('hName').value || '---';
    document.getElementById('dynamicPrintTitle').innerText = `REC 9.9.1 PRODUCTION HANDOVER REPORT ${shiftVal} SHIFT - ${dateVal}`;
    document.getElementById('dynamicPrintName').innerText = `COMPLETED BY: ${managerName}`;
    document.title = `REC_9.9.1_Production_Handover_${shiftVal}SHIFT_${dateVal}`;

    const sectionSummaries = {
        'sec-1': buildSectionSummary('sec-1', ['Live sorting','Live packing','Frozen sorting','Harvesting','Scrub and Precook','Dry cooking','Dry grading','Canning and retorting']),
        'sec-2': buildStaffingSummary(),
        'sec-3': buildHarvestSummary(),
        'sec-4': buildLiveSummary(),
        'sec-5': buildCanningSummary(),
        'sec-6': buildDryingSummary()
    };

    Object.keys(sectionSummaries).forEach(key => {
        const printNode = document.getElementById(`print-notes-${key.split('-')[1]}`);
        if (printNode) printNode.innerHTML = sectionSummaries[key];
    });

    // Job details are included in each section's summary; annex removed.

    document.getElementById('print-gen-comments').innerText = document.getElementById('gen-comments').value || 'No additional comments recorded.';
    // Temporarily hide interactive-only elements (those already marked 'no-print' in markup)
    // Avoid adding no-print to entire .section-card to preserve print-only summaries
    const interactiveEls = Array.from(document.querySelectorAll('.section-card .p-4, .section-card .bubble-block, .section-card .grid, .section-card .yesno-toggle, .section-card input, .section-card textarea, .section-card select, .section-card button'));
    const toRestore = [];
    interactiveEls.forEach(el => {
        if (!el.classList.contains('print-only') && !el.classList.contains('no-print')) {
            el.style.displayBackup = el.style.display || '';
            el.style.display = 'none';
            toRestore.push(el);
        }
    });

    // Print and then restore the interactive elements
    window.print();
    setTimeout(() => {
        toRestore.forEach(el => {
            el.style.display = el.style.displayBackup || '';
            delete el.style.displayBackup;
        });
    }, 400);
}

function renderPrintList(items) {
    if (!items.length) return '<div class="print-empty">No details entered.</div>';
    // remove exact duplicates
    items = items.filter((v, i, a) => a.indexOf(v) === i);
    // Render each item on its own line so multiple jobs show as separate rows
    const html = items.map(i => `<div class="print-summary-item">${i}</div>`).join('');
    return `<div class="print-summary-list">${html}</div>`;
}

function buildSectionSummary(sectionId, labels) {
    const section = document.getElementById(sectionId);
    if (!section) return '';
    const ncItems = [];
    section.querySelectorAll('.nc').forEach(el => {
        const name = el.getAttribute('data-name');
        if (name) ncItems.push(name);
    });
    if (ncItems.length > 0) return renderPrintList([`NON-CONFORMING: ${ncItems.join(', ')}.`]);
    const activeItems = [];
    labels.forEach(label => {
        const btn = Array.from(section.querySelectorAll('.bubble-btn')).find(el => el.getAttribute('data-name') === label);
        if (btn && btn.classList.contains('conforming')) activeItems.push(label);
    });
    // For section 1 (Processes on shift) render active items inline rather than each on its own line
    if (sectionId === 'sec-1') {
        if (!activeItems.length) return '<div class="print-empty">No processes entered.</div>';
        const content = activeItems.join(' • ');
        return `<div class="print-summary-list"><div class="print-summary-item" style="display:inline-block; white-space:nowrap;">${content}</div></div>`;
    }
    return renderPrintList(activeItems);
}

function buildStaffingSummary() {
    const absent = document.getElementById('staff-absent-input').value.trim();
    const leave = document.getElementById('staff-leave-input').value.trim();
    const items = [];
    if (absent) items.push(`Absent staff: ${absent}`);
    if (leave) items.push(`Staff on leave: ${leave}`);
    return renderPrintList(items);
}

function buildHarvestSummary() {
    // Group harvest jobs by Type (CAN / DRY) and render header then job lines
    const rows = Array.from(document.querySelectorAll('#harvest-job-list .compliance-row'));
    const groups = { CAN: [], DRY: [] };
    rows.forEach(row => {
        const map = {};
        row.querySelectorAll('.inline-detail-pill').forEach(span => {
            const text = span.textContent.trim();
            const parts = text.split(':');
            if (parts.length >= 2) {
                const label = parts[0].trim();
                const value = parts.slice(1).join(':').trim();
                map[label] = value;
            }
        });
        const type = (map['Type'] || '').toUpperCase();
        const lineParts = [];
        ['Job','Weight','Size','Count'].forEach(k => { if (map[k]) lineParts.push(`${k} ${map[k]}`); });
        const line = lineParts.join(' | ');
        if (type === 'CAN') groups.CAN.push(line);
        else if (type === 'DRY') groups.DRY.push(line);
        else if (line) groups.CAN.push(line); // default to CAN if unknown
    });

    // If no job rows, use the live inputs for Can/Dry
    if (!rows.length) {
        const canParts = [];
        const canJob = document.getElementById('harvest-can-job').value.trim();
        if (canJob) canParts.push(`Job ${canJob}`);
        const canWeight = document.getElementById('harvest-can-weight').value.trim();
        if (canWeight) canParts.push(`Weight ${canWeight}`);
        const canSizeText = document.querySelector('#harvest-can-size option:checked')?.text || '';
        if (canSizeText) canParts.push(`Size ${canSizeText}`);
        const canCount = document.getElementById('harvest-can-count').textContent.trim();
        if (canCount && canCount !== '--') canParts.push(`Count ${canCount}`);
        if (canParts.length) groups.CAN.push(canParts.join(' | '));

        const dryParts = [];
        const dryJob = document.getElementById('harvest-dry-job').value.trim();
        if (dryJob) dryParts.push(`Job ${dryJob}`);
        const dryWeight = document.getElementById('harvest-dry-weight').value.trim();
        if (dryWeight) dryParts.push(`Weight ${dryWeight}`);
        const drySizeText = document.querySelector('#harvest-dry-size option:checked')?.text || '';
        if (drySizeText) dryParts.push(`Size ${drySizeText}`);
        const dryCount = document.getElementById('harvest-dry-count').textContent.trim();
        if (dryCount && dryCount !== '--') dryParts.push(`Count ${dryCount}`);
        if (dryParts.length) groups.DRY.push(dryParts.join(' | '));
    }

    const output = [];
    if (groups.CAN.length) {
        output.push(`<strong>Can:</strong>`);
        groups.CAN.forEach(line => output.push(line));
    }
    if (groups.DRY.length) {
        output.push(`<strong>Dry:</strong>`);
        groups.DRY.forEach(line => output.push(line));
    }
    return renderPrintList(output);
}

function buildLiveSummary() {
    const output = [];
    const liveBaskets = document.getElementById('live-sorting-baskets').value.trim();
    const liveBags = document.getElementById('live-sorting-bags').value.trim();
    if (liveBaskets || liveBags) {
        output.push(`<strong>Live sorting</strong>`);
        const line = `No. of baskets in: ${liveBaskets || '0'} / No. of bags produced: ${liveBags || '0'}`;
        output.push(line);
    }

    const frozenBaskets = document.getElementById('frozen-sorting-baskets').value.trim();
    const frozenBags = document.getElementById('frozen-sorting-bags').value.trim();
    if (frozenBaskets || frozenBags) {
        output.push(`<strong>Frozen sorting</strong>`);
        const line = `No. of baskets in: ${frozenBaskets || '0'} / No. of bags produced: ${frozenBags || '0'}`;
        output.push(line);
    }

    const packed = document.getElementById('live-packing-boxes').value.trim();
    const prepared = document.getElementById('live-packing-prepared').value.trim();
    if (packed || prepared) {
        output.push(`<strong>Live packing</strong>`);
        const line = `No. of boxes packed: ${packed || '0'} / No. of boxes prepared: ${prepared || '0'}`;
        output.push(line);
    }

    return renderPrintList(output);
}

function buildCanningSummary() {
    // For canning, group by cultivated and third party and render header then job lines
    const output = [];
    const cultivated = document.getElementById('cultivated-job-list');
    if (cultivated) {
        const rows = Array.from(cultivated.querySelectorAll('.compliance-row'));
        if (rows.length) {
            output.push(`<strong>Cultivated abalone:</strong>`);
            rows.forEach(row => {
                const map = {};
                row.querySelectorAll('.inline-detail-pill').forEach(span => {
                    const text = span.textContent.trim();
                    const parts = text.split(':');
                    if (parts.length >= 2) { map[parts[0].trim()] = parts.slice(1).join(':').trim(); }
                });
                const lineParts = [];
                ['Job','OOSW%','Precook%','Cans closed','Carry over'].forEach(k => { if (map[k]) lineParts.push(`${k} ${map[k]}`); });
                let line = lineParts.join(' | ');
                // if this job has carry over to next shift, append a red dot
                const carry = (map['Carry over'] || '').toLowerCase();
                if (carry && carry !== 'n/a' && carry !== 'no' && carry !== 'false') {
                    line += ' <span style="color:#dc2626">●</span>';
                }
                output.push(line);
            });
        } else {
            // fallback to live fields
            const job = document.getElementById('cultivated-job').value.trim();
            if (job) {
                const details = [`Job ${job}`,
                    `OOSW% ${document.getElementById('cultivated-oosw').value.trim() || 'n/a'}`,
                    `Precook% ${document.getElementById('cultivated-precook').value.trim() || 'n/a'}`,
                    `Cans closed ${document.getElementById('cultivated-cans').value.trim() || 'n/a'}`,
                    `Carry over ${document.getElementById('cultivated-carry').value.trim() || 'n/a'}`];
                output.push(`<strong>Cultivated abalone:</strong>`);
                output.push(details.join(' | '));
            }
        }
    }

    const third = document.getElementById('thirdparty-job-list');
    if (third) {
        const rows = Array.from(third.querySelectorAll('.compliance-row'));
        if (rows.length) {
            output.push(`<strong>Third party abalone:</strong>`);
            rows.forEach(row => {
                const map = {};
                row.querySelectorAll('.inline-detail-pill').forEach(span => {
                    const text = span.textContent.trim();
                    const parts = text.split(':');
                    if (parts.length >= 2) { map[parts[0].trim()] = parts.slice(1).join(':').trim(); }
                });
                const lineParts = [];
                ['Job','OOSW%','Precook%','Cans closed','Carry over'].forEach(k => { if (map[k]) lineParts.push(`${k} ${map[k]}`); });
                let line = lineParts.join(' | ');
                const carry = (map['Carry over'] || '').toLowerCase();
                if (carry && carry !== 'n/a' && carry !== 'no' && carry !== 'false') {
                    line += ' <span style="color:#dc2626">●</span>';
                }
                output.push(line);
            });
        } else {
            const job = document.getElementById('thirdparty-job').value.trim();
            if (job) {
                const details = [`Job ${job}`,
                    `OOSW% ${document.getElementById('thirdparty-oosw').value.trim() || 'n/a'}`,
                    `Precook% ${document.getElementById('thirdparty-precook').value.trim() || 'n/a'}`,
                    `Cans closed ${document.getElementById('thirdparty-cans').value.trim() || 'n/a'}`,
                    `Carry over ${document.getElementById('thirdparty-carry').value.trim() || 'n/a'}`];
                output.push(`<strong>Third party abalone:</strong>`);
                output.push(details.join(' | '));
            }
        }
    }
    return renderPrintList(output);
}

function buildDryingSummary() {
    const output = [];
    const procContainer = document.getElementById('dry-process-job-list');
    if (procContainer) {
        const rows = Array.from(procContainer.querySelectorAll('.compliance-row'));
        if (rows.length) {
            output.push(`<strong>Dry processing:</strong>`);
            rows.forEach(row => {
                const map = {};
                row.querySelectorAll('.inline-detail-pill').forEach(span => {
                    const text = span.textContent.trim();
                    const parts = text.split(':');
                    if (parts.length >= 2) { map[parts[0].trim()] = parts.slice(1).join(':').trim(); }
                });
                const lineParts = [];
                ['Job','OOSW%','Pots cooked','Stringed & hung','Carry over'].forEach(k => { if (map[k]) lineParts.push(`${k} ${map[k]}`); });
                let line = lineParts.join(' | ');
                const carry = (map['Carry over'] || '').toLowerCase();
                if (carry && carry !== 'n/a' && carry !== 'no' && carry !== 'false') line += ' <span style="color:#dc2626">●</span>';
                output.push(line);
            });
        } else {
            const processJob = document.getElementById('dry-process-job').value.trim();
            if (processJob) {
                const processDetails = [`Job ${processJob}`,
                    `OOSW% ${document.getElementById('dry-process-oosw').value.trim() || 'n/a'}`,
                    `Pots cooked ${document.getElementById('dry-process-pots').value.trim() || 'n/a'}`,
                    `Stringed & hung ${document.getElementById('dry-process-stringed').value.trim() || 'n/a'}`,
                    `Carry over ${document.getElementById('dry-process-carry').value.trim() || 'n/a'}`].filter(Boolean);
                output.push(`<strong>Dry processing:</strong>`);
                output.push(processDetails.join(' | '));
            }
        }
    }

    const gradeContainer = document.getElementById('dry-grade-job-list');
    if (gradeContainer) {
        const rows = Array.from(gradeContainer.querySelectorAll('.compliance-row'));
        if (rows.length) {
            output.push(`<strong>Grading:</strong>`);
            rows.forEach(row => {
                const map = {};
                row.querySelectorAll('.inline-detail-pill').forEach(span => {
                    const text = span.textContent.trim();
                    const parts = text.split(':');
                    if (parts.length >= 2) { map[parts[0].trim()] = parts.slice(1).join(':').trim(); }
                });
                const lineParts = [];
                ['Job','Date in','Date out','Days','Grading complete','Boxing complete','Carry over'].forEach(k => { if (map[k]) lineParts.push(`${k} ${map[k]}`); });
                let line = lineParts.join(' | ');
                const daysVal = parseInt(map['Days'] || '', 10);
                if (!isNaN(daysVal) && daysVal > 25) {
                    line += ' <span style="color:#ef4444">❌</span>';
                }
                const carry = (map['Carry over'] || '').toLowerCase();
                if (carry && carry !== 'n/a' && carry !== 'no' && carry !== 'false') line += ' <span style="color:#dc2626">●</span>';
                output.push(line);
            });
        } else {
            const gradeJob = document.getElementById('dry-grade-job').value.trim();
            if (gradeJob) {
                const days = document.getElementById('dry-grade-days').value.trim();
                const warning = parseInt(days, 10) > 25 ? ' | WARNING: Days in drying room exceeds 25' : '';
                const gradingDetails = [`Job ${gradeJob}`,
                    `In ${document.getElementById('dry-grade-in').value || 'n/a'}`,
                    `Out ${document.getElementById('dry-grade-out').value || 'n/a'}`,
                    `Days ${days || 'n/a'}${warning}`,
                    `Grading complete ${document.getElementById('dry-grade-complete').value.trim() || 'n/a'}`,
                    `Boxing complete ${document.getElementById('dry-grade-boxing').value.trim() || 'n/a'}`,
                    `Carry over ${document.getElementById('dry-grade-carry').value.trim() || 'n/a'}`].filter(Boolean);
                output.push(`<strong>Grading:</strong>`);
                output.push(gradingDetails.join(' | '));
            }
        }
    }
    return renderPrintList(output);
}
