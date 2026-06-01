// API base URL
const API_BASE = '';

// DOM elements
const ticketForm = document.getElementById('ticket-form');
const ticketsList = document.getElementById('tickets-list');
const statusFilter = document.getElementById('status-filter');
const searchInput = document.getElementById('search-input');
const rmaForm = document.getElementById('rma-form');
const rmasList = document.getElementById('rmas-list');
const rmaSearchInput = document.getElementById('rma-search-input');
const rmaTicketSelect = document.getElementById('rma-ticket-number');
const editRmaTicketSelect = document.getElementById('edit-rma-ticket-number');
const ticketsTab = document.getElementById('tickets-tab');
const rmasTab = document.getElementById('rmas-tab');
const upsTab = document.getElementById('ups-tab');
const ticketsView = document.getElementById('tickets-view');
const rmasView = document.getElementById('rmas-view');
const upsView = document.getElementById('ups-view');
const upsStatusFilter = document.getElementById('ups-status-filter');
const upsSearchInput = document.getElementById('ups-search-input');
const upsInstallationsList = document.getElementById('ups-installations-list');
const upsScheduledList = document.getElementById('ups-scheduled-list');
const generateNocScheduleBtn = document.getElementById('generate-noc-schedule-btn');
const upsScheduleModal = document.getElementById('ups-schedule-modal');
const upsScheduleCloseModal = document.getElementById('ups-schedule-close-modal');
const saveNocScheduleBtn = document.getElementById('save-noc-schedule-btn');
const closeNocScheduleBtn = document.getElementById('close-noc-schedule-btn');
const upsScheduleResults = document.getElementById('ups-schedule-results');
const generateWarehouseEmailBtn = document.getElementById('generate-warehouse-email-btn');
const moveCompletedBtn = document.getElementById('move-completed-btn');
const upsWarehouseModal = document.getElementById('ups-warehouse-modal');
const upsWarehouseCloseModal = document.getElementById('ups-warehouse-close-modal');
const closeWarehouseEmailBtn = document.getElementById('close-warehouse-email-btn');
const copyWarehouseEmailBtn = document.getElementById('copy-warehouse-email-btn');
const upsWarehouseResults = document.getElementById('ups-warehouse-results');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const themeToggle = document.getElementById('theme-toggle');

// Modal elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const closeModal = document.querySelector('.close');
const rmaEditModal = document.getElementById('rma-edit-modal');
const rmaEditForm = document.getElementById('rma-edit-form');
const rmaCloseModal = document.getElementById('rma-close-modal');
const upsDetailModal = document.getElementById('ups-detail-modal');
const upsDetailCloseModal = document.getElementById('ups-detail-close-modal');
const upsPhase3Modal = document.getElementById('ups-phase3-modal');
const upsPhase3CloseModal = document.getElementById('ups-phase3-close-modal');

// State
let currentPage = 1;
const limit = 12;
let currentStatusFilter = '';
let currentSearch = '';
let currentRmaSearch = '';
let currentRmas = [];
let currentTickets = [];
let currentUpsInstallations = [];
let currentUpsStatusFilter = 'intake';
let currentUpsSearch = '';
let currentDetailUpsId = null;
let currentScheduledUpsInstallations = [];
const selectedUpsInstallationIds = new Set();
const selectedScheduledUpsInstallationIds = new Set();

// Device type mapping
const deviceTypeMap = {
    'Switch': 'switch',
    'Access Point': 'access_point',
    'UPS': 'ups'
};

const reverseDeviceTypeMap = {
    'switch': 'Switch',
    'access_point': 'Access Point',
    'ups': 'UPS'
};

const statusLabelMap = {
    'open': 'Open',
    'on_hold': 'On Hold',
    'closed': 'Closed'
};

const upsStatusLabelMap = {
    'intake': 'Pending',
    'servicing': 'Servicing',
    'scheduled': 'In Progress',
    'fulfilled': 'Fulfilled'
};

function escapeHtml(value) {
    return String(value || '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    upsStatusFilter.value = currentUpsStatusFilter;
    loadTickets();
    loadRmas();
    loadUpsInstallations();
    setupEventListeners();
    loadTheme();
});

// Event listeners
function setupEventListeners() {
    ticketForm.addEventListener('submit', handleCreateTicket);
    rmaForm.addEventListener('submit', handleCreateRma);
    ticketsTab.addEventListener('click', () => showView('tickets'));
    rmasTab.addEventListener('click', () => showView('rmas'));
    upsTab.addEventListener('click', () => showView('ups'));
    statusFilter.addEventListener('change', handleFilterChange);
    searchInput.addEventListener('input', debounce(handleSearchChange, 300));
    rmaSearchInput.addEventListener('input', debounce(handleRmaSearchChange, 300));
    upsStatusFilter.addEventListener('change', handleUpsFilterChange);
    upsSearchInput.addEventListener('input', debounce(handleUpsSearchChange, 300));
    generateNocScheduleBtn.addEventListener('click', openUpsScheduleModal);
    saveNocScheduleBtn.addEventListener('click', saveNocSchedule);
    upsScheduleCloseModal.addEventListener('click', closeUpsScheduleModal);
    closeNocScheduleBtn.addEventListener('click', closeUpsScheduleModal);
    generateWarehouseEmailBtn.addEventListener('click', openWarehouseEmailModal);
    moveCompletedBtn.addEventListener('click', moveSelectedScheduledToCompleted);
    upsWarehouseCloseModal.addEventListener('click', closeWarehouseEmailModal);
    closeWarehouseEmailBtn.addEventListener('click', closeWarehouseEmailModal);
    copyWarehouseEmailBtn.addEventListener('click', copyGeneratedWarehouseEmail);
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
    themeToggle.addEventListener('click', toggleTheme);

    // Modal events
    closeModal.addEventListener('click', () => editModal.style.display = 'none');
    rmaCloseModal.addEventListener('click', () => rmaEditModal.style.display = 'none');
    upsDetailCloseModal.addEventListener('click', () => upsDetailModal.style.display = 'none');
    upsPhase3CloseModal.addEventListener('click', () => upsPhase3Modal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
        if (e.target === rmaEditModal) {
            rmaEditModal.style.display = 'none';
        }
        if (e.target === upsDetailModal) {
            upsDetailModal.style.display = 'none';
        }
        if (e.target === upsPhase3Modal) {
            upsPhase3Modal.style.display = 'none';
        }
        if (e.target === upsScheduleModal) {
            closeUpsScheduleModal();
        }
        if (e.target === upsWarehouseModal) {
            closeWarehouseEmailModal();
        }
    });
    editForm.addEventListener('submit', handleUpdateTicket);
    rmaEditForm.addEventListener('submit', handleUpdateRma);
}

// API functions
async function apiRequest(endpoint, options = {}) {
    const url = `${API_BASE}${endpoint}`;
    const config = {
        headers: {
            'Content-Type': 'application/json',
        },
        ...options
    };

    try {
        const response = await fetch(url, config);
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        return await response.json();
    } catch (error) {
        console.error('API request failed:', error);
        showError('Failed to communicate with server');
        throw error;
    }
}

// Ticket CRUD operations
async function loadTickets() {
    try {
        showLoading();
        const params = new URLSearchParams({
            limit,
            offset: (currentPage - 1) * limit
        });

        if (currentStatusFilter) {
            params.append('status', currentStatusFilter);
        }

        const tickets = await apiRequest(`/tickets/?${params}`);
        currentTickets = tickets;
        renderTickets(tickets);
        populateRmaTicketOptions();
        updatePagination();
    } catch (error) {
        showError('Failed to load tickets');
    } finally {
        hideLoading();
    }
}

async function handleCreateTicket(e) {
    e.preventDefault();

    const formData = new FormData(ticketForm);
    const ticketData = {
        external_ticket_number: formData.get('external_ticket_number'),
        device_type: formData.get('device_type'),
        school_name: formData.get('school_name'),
        tea_code: parseInt(formData.get('tea_code')),
        mdf_idf: formData.get('mdf_idf') || null,
        date: formData.get('date'),
        note: formData.get('note') || null
    };

    try {
        await apiRequest('/tickets/', {
            method: 'POST',
            body: JSON.stringify(ticketData)
        });

        showSuccess('Ticket created successfully!');
        ticketForm.reset();
        loadTickets();
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to create ticket');
    }
}

async function loadUpsInstallations() {
    try {
        upsInstallationsList.innerHTML = '<div class="loading">Loading UPS installations...</div>';
        const params = new URLSearchParams({
            limit,
            offset: 0
        });

        if (currentUpsStatusFilter) {
            params.append('status', currentUpsStatusFilter);
        }

        const loadedUpsInstallations = await apiRequest(`/ups-installations/?${params}`);
        currentUpsInstallations = currentUpsStatusFilter
            ? loadedUpsInstallations
            : loadedUpsInstallations.filter(install => install.status !== 'scheduled');
        renderUpsInstallations(currentUpsInstallations);
        currentScheduledUpsInstallations = await apiRequest('/ups-installations/?status=scheduled&limit=1000&offset=0');
        renderScheduledUpsInstallations(currentScheduledUpsInstallations);
    } catch (error) {
        showError('Failed to load UPS installations');
    }
}

async function loadRmas() {
    try {
        rmasList.innerHTML = '<div class="loading">Loading RMAs...</div>';
        currentRmas = await apiRequest('/rmas/');
        renderRmas(currentRmas);
    } catch (error) {
        showError('Failed to load RMAs');
    }
}

async function handleCreateRma(e) {
    e.preventDefault();

    const formData = new FormData(rmaForm);
    const ticketNumber = formData.get('ticket_number');
    const rmaData = {
        ticket_number: ticketNumber ? parseInt(ticketNumber) : null,
        customer: formData.get('customer'),
        campus: formData.get('campus'),
        dynamics_case_number: formData.get('dynamics_case_number'),
        part_number_model: formData.get('part_number_model'),
        defective_serial_number: formData.get('defective_serial_number'),
        issue: formData.get('issue')
    };

    try {
        const createdRma = await apiRequest('/rmas/', {
            method: 'POST',
            body: JSON.stringify(rmaData)
        });

        showSuccess('RMA created successfully!');
        copyRmaEmailPrompt(createdRma);
        rmaForm.reset();
        loadRmas();
    } catch (error) {
        showError('Failed to create RMA');
    }
}

async function handleUpdateTicket(e) {
    e.preventDefault();

    const ticketNumber = document.getElementById('edit-ticket-number').value;
    const formData = new FormData(editForm);
    const ticketData = {
        note: formData.get('note') || null,
        status: formData.get('status')
    };

    try {
        await apiRequest(`/tickets/${ticketNumber}`, {
            method: 'PUT',
            body: JSON.stringify(ticketData)
        });

        showSuccess('Ticket updated successfully!');
        editModal.style.display = 'none';
        loadTickets();
    } catch (error) {
        showError('Failed to update ticket');
    }
}

async function deleteTicket(ticketNumber) {
    if (!confirm('Are you sure you want to delete this ticket?')) {
        return;
    }

    try {
        await apiRequest(`/tickets/${ticketNumber}`, {
            method: 'DELETE'
        });

        showSuccess('Ticket deleted successfully!');
        loadTickets();
    } catch (error) {
        showError('Failed to delete ticket');
    }
}

async function handleUpdateRma(e) {
    e.preventDefault();

    const rmaId = document.getElementById('edit-rma-id').value;
    const formData = new FormData(rmaEditForm);
    const ticketNumber = formData.get('ticket_number');
    const rmaData = {
        ticket_number: ticketNumber ? parseInt(ticketNumber) : null,
        customer: formData.get('customer'),
        campus: formData.get('campus'),
        dynamics_case_number: formData.get('dynamics_case_number'),
        part_number_model: formData.get('part_number_model'),
        defective_serial_number: formData.get('defective_serial_number'),
        issue: formData.get('issue')
    };

    try {
        await apiRequest(`/rmas/${rmaId}`, {
            method: 'PUT',
            body: JSON.stringify(rmaData)
        });

        showSuccess('RMA updated successfully!');
        rmaEditModal.style.display = 'none';
        loadRmas();
    } catch (error) {
        showError('Failed to update RMA');
    }
}

async function deleteRma(rmaId) {
    if (!confirm('Are you sure you want to delete this RMA?')) {
        return;
    }

    try {
        await apiRequest(`/rmas/${rmaId}`, {
            method: 'DELETE'
        });

        showSuccess('RMA deleted successfully!');
        loadRmas();
    } catch (error) {
        showError('Failed to delete RMA');
    }
}

async function deleteUpsInstallation(upsInstallationId) {
    if (!confirm('Are you sure you want to delete this UPS installation record?')) {
        return;
    }

    try {
        await apiRequest(`/ups-installations/${upsInstallationId}`, {
            method: 'DELETE'
        });

        showSuccess('UPS installation deleted successfully!');
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to delete UPS installation');
    }
}

// UI functions
function showView(viewName) {
    const showingTickets = viewName === 'tickets';
    const showingRmas = viewName === 'rmas';
    const showingUps = viewName === 'ups';

    ticketsTab.classList.toggle('active', showingTickets);
    rmasTab.classList.toggle('active', showingRmas);
    upsTab.classList.toggle('active', showingUps);
    ticketsView.classList.toggle('active', showingTickets);
    rmasView.classList.toggle('active', showingRmas);
    upsView.classList.toggle('active', showingUps);
}

function renderTickets(tickets) {
    if (!tickets || tickets.length === 0) {
        ticketsList.innerHTML = '<p class="loading">No tickets found</p>';
        return;
    }

    ticketsList.innerHTML = tickets.map(ticket => `
        <div class="ticket-card">
            <div class="ticket-header">
                <div>
                    <div class="ticket-title">Ticket #${ticket.external_ticket_number || ticket.ticket_number}</div>
                    <div class="ticket-meta">
                        ${reverseDeviceTypeMap[ticket.device_type] || ticket.device_type} • ${ticket.school_name} • TEA: ${ticket.tea_code}
                    </div>
                    ${ticket.mdf_idf ? `<div class="ticket-meta">MDF/IDF: ${escapeHtml(ticket.mdf_idf)}</div>` : ''}
                    <div class="ticket-meta">${ticket.date}</div>
                </div>
                <span class="ticket-status status-${ticket.status}" data-status="${ticket.status}">${statusLabelMap[ticket.status] || ticket.status}</span>
            </div>
            ${ticket.note ? `<p>${ticket.note}</p>` : ''}
            <div class="ticket-actions">
                <button class="btn-secondary" onclick="editTicket(${ticket.ticket_number})">Edit</button>
                <button class="btn-danger" onclick="deleteTicket(${ticket.ticket_number})">Delete</button>
            </div>
        </div>
    `).join('');
}

function renderRmas(rmas) {
    const visibleRmas = currentRmaSearch
        ? rmas.filter(rma => Object.values(rma).join(' ').toLowerCase().includes(currentRmaSearch))
        : rmas;

    if (!visibleRmas || visibleRmas.length === 0) {
        rmasList.innerHTML = '<p class="loading">No RMAs found</p>';
        return;
    }

    rmasList.innerHTML = visibleRmas.map(rma => {
        const linkedTicket = getTicketLabel(rma.ticket_number);
        return `
        <div class="ticket-card">
            <div class="ticket-header">
                <div>
                    <div class="ticket-title">Case #${rma.dynamics_case_number}</div>
                    ${linkedTicket ? `<div class="ticket-meta">Related Ticket: ${linkedTicket}</div>` : ''}
                    <div class="ticket-meta">${rma.customer} • ${rma.campus}</div>
                    <div class="ticket-meta">${rma.part_number_model} • SN: ${rma.defective_serial_number}</div>
                </div>
            </div>
            <p>${rma.issue}</p>
            <div class="ticket-actions">
                <button class="btn-secondary" onclick="editRma(${rma.rma_id})">Edit</button>
                <button class="btn-danger" onclick="deleteRma(${rma.rma_id})">Delete</button>
            </div>
        </div>
    `;
    }).join('');
}

function renderUpsInstallations(upsInstallations) {
    const visibleUpsInstallations = currentUpsSearch
        ? upsInstallations.filter(install => Object.values(install).join(' ').toLowerCase().includes(currentUpsSearch))
        : upsInstallations;

    if (!visibleUpsInstallations || visibleUpsInstallations.length === 0) {
        upsInstallationsList.innerHTML = '<p class="loading">No UPS installations found</p>';
        selectedUpsInstallationIds.clear();
        updateGenerateNocScheduleButton();
        return;
    }

    selectedUpsInstallationIds.forEach(id => {
        if (!visibleUpsInstallations.some(install => install.ups_installation_id === id)) {
            selectedUpsInstallationIds.delete(id);
        }
    });

    upsInstallationsList.innerHTML = `
        <table class="ups-table">
            <thead>
                <tr>
                    <th>Select</th>
                    <th>Ticket #</th>
                    <th>School</th>
                    <th>TEA Code</th>
                    <th>MDF/IDF</th>
                    <th>Defective UPS Serial</th>
                    <th>Defective BP Serial</th>
                    <th>Hostname</th>
                    <th>Status</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${visibleUpsInstallations.map(install => `
                    <tr data-ups-id="${install.ups_installation_id}" class="${selectedUpsInstallationIds.has(install.ups_installation_id) ? 'ups-row-selected' : ''}" style="cursor: pointer;" onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'INPUT') openUpsDetailModal(${install.ups_installation_id})">
                        <td onclick="event.stopPropagation()">
                            <input type="checkbox" ${selectedUpsInstallationIds.has(install.ups_installation_id) ? 'checked' : ''} ${currentUpsStatusFilter !== 'intake' ? 'disabled' : ''} onchange="toggleUpsSelection(${install.ups_installation_id}, this.checked)">
                        </td>
                        <td>${install.external_ticket_number || install.ticket_number}</td>
                        <td>${escapeHtml(install.school_name)}</td>
                        <td>${install.tea_code}</td>
                        <td>${escapeHtml(install.idf) || '-'}</td>
                        <td>${escapeHtml(install.serial_number) || '-'}</td>
                        <td>${escapeHtml(install.defective_battery_pack_serial) || '-'}</td>
                        <td>${escapeHtml(install.hostname) || '-'}</td>
                        <td class="status-cell"><span class="status-${install.status}">${upsStatusLabelMap[install.status] || install.status}</span></td>
                        <td class="actions-cell" onclick="event.stopPropagation()">
                            <button class="btn-danger" onclick="deleteUpsInstallation(${install.ups_installation_id})">Delete</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    updateGenerateNocScheduleButton();
}

function renderScheduledUpsInstallations(upsInstallations) {
    if (!upsInstallations || upsInstallations.length === 0) {
        upsScheduledList.innerHTML = '<p class="loading">No in-progress UPS installations found</p>';
        selectedScheduledUpsInstallationIds.clear();
        updateInProgressBulkButtons();
        return;
    }

    selectedScheduledUpsInstallationIds.forEach(id => {
        if (!upsInstallations.some(install => install.ups_installation_id === id)) {
            selectedScheduledUpsInstallationIds.delete(id);
        }
    });

    upsScheduledList.innerHTML = `
        <table class="ups-table">
            <thead>
                <tr>
                    <th>Select</th>
                    <th>Ticket #</th>
                    <th>School</th>
                    <th>IDF</th>
                    <th>Proposed Install Date</th>
                    <th>Equipment</th>
                    <th>UPS PO</th>
                    <th>BP PO</th>
                    <th>Actions</th>
                </tr>
            </thead>
            <tbody>
                ${upsInstallations.map(install => `
                    <tr data-ups-id="${install.ups_installation_id}" class="${selectedScheduledUpsInstallationIds.has(install.ups_installation_id) ? 'ups-row-selected' : ''}" style="cursor: pointer;" onclick="if(event.target.tagName !== 'BUTTON' && event.target.tagName !== 'INPUT') openUpsPhase3Modal(${install.ups_installation_id})">
                        <td onclick="event.stopPropagation()">
                            <input type="checkbox" ${selectedScheduledUpsInstallationIds.has(install.ups_installation_id) ? 'checked' : ''} onchange="toggleScheduledUpsSelection(${install.ups_installation_id}, this.checked)">
                        </td>
                        <td>${install.external_ticket_number || install.ticket_number}</td>
                        <td>${escapeHtml(install.school_name)}</td>
                        <td>${escapeHtml(install.idf) || '-'}</td>
                        <td>${install.proposed_install_date || '-'}</td>
                        <td>${deriveEquipment(install)}</td>
                        <td onclick="event.stopPropagation()"><input class="ups-inline-input" id="scheduled-ups-po-${install.ups_installation_id}" type="text" maxlength="100" value="${escapeHtml(install.ups_po)}"></td>
                        <td onclick="event.stopPropagation()"><input class="ups-inline-input" id="scheduled-bp-po-${install.ups_installation_id}" type="text" maxlength="100" value="${escapeHtml(install.bp_po)}"></td>
                        <td class="actions-cell" onclick="event.stopPropagation()">
                            <button class="btn-primary" onclick="saveScheduledPo(${install.ups_installation_id})">Save PO</button>
                            <button class="btn-secondary" onclick="rollbackUpsInstallation(${install.ups_installation_id})">Send Back to Pending</button>
                        </td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
    updateInProgressBulkButtons();
}

function toggleUpsSelection(upsInstallationId, checked) {
    if (checked) {
        selectedUpsInstallationIds.add(upsInstallationId);
    } else {
        selectedUpsInstallationIds.delete(upsInstallationId);
    }
    renderUpsInstallations(currentUpsInstallations);
}

function updateGenerateNocScheduleButton() {
    generateNocScheduleBtn.hidden = selectedUpsInstallationIds.size === 0 || currentUpsStatusFilter !== 'intake';
    if (!generateNocScheduleBtn.hidden) {
        generateNocScheduleBtn.textContent = `Generate NOC Schedule (${selectedUpsInstallationIds.size})`;
    } else {
        generateNocScheduleBtn.textContent = 'Generate NOC Schedule';
    }
}

function toggleScheduledUpsSelection(upsInstallationId, checked) {
    if (checked) {
        selectedScheduledUpsInstallationIds.add(upsInstallationId);
    } else {
        selectedScheduledUpsInstallationIds.delete(upsInstallationId);
    }
    renderScheduledUpsInstallations(currentScheduledUpsInstallations);
}

function updateInProgressBulkButtons() {
    const hasSelection = selectedScheduledUpsInstallationIds.size > 0;
    generateWarehouseEmailBtn.hidden = !hasSelection;
    moveCompletedBtn.hidden = !hasSelection;
    if (hasSelection) {
        generateWarehouseEmailBtn.textContent = `Generate Warehouse Email (${selectedScheduledUpsInstallationIds.size})`;
        moveCompletedBtn.textContent = `Move to Completed (${selectedScheduledUpsInstallationIds.size})`;
    } else {
        generateWarehouseEmailBtn.textContent = 'Generate Warehouse Email';
        moveCompletedBtn.textContent = 'Move to Completed';
    }
}

function openUpsScheduleModal() {
    const installs = getSelectedPendingInstalls();
    if (installs.length === 0) {
        showError('Select at least one UPS installation');
        return;
    }

    const defaultDate = getNextMondayDate();
    renderNocScheduleResults(buildNocScheduleRows(installs, defaultDate));
    upsScheduleModal.style.display = 'block';
}

function closeUpsScheduleModal() {
    upsScheduleModal.style.display = 'none';
}

function getSelectedPendingInstalls() {
    return currentUpsInstallations.filter(install => selectedUpsInstallationIds.has(install.ups_installation_id));
}

function getNextMondayDate() {
    const today = new Date();
    const daysUntilNextMonday = ((8 - today.getDay()) % 7) || 7;
    const nextMonday = new Date(today);
    nextMonday.setDate(today.getDate() + daysUntilNextMonday);
    return nextMonday.toISOString().slice(0, 10);
}

function buildNocScheduleRows(installs, proposedInstallDate) {
    return installs.map(install => ({
        ups_installation_id: install.ups_installation_id,
        ticket_number: String(install.external_ticket_number || install.ticket_number),
        idf: install.idf || '',
        school_name: install.school_name,
        install_contact: '',
        install_contact_number: '',
        proposed_install_date: proposedInstallDate,
        type: 'Replace',
        equipment: deriveEquipment(install)
    }));
}

async function saveNocSchedule() {
    const rows = Array.from(document.querySelectorAll('[data-schedule-ups-id]')).map(row => ({
        ups_installation_id: parseInt(row.dataset.scheduleUpsId, 10),
        proposed_install_date: row.querySelector('.noc-schedule-date').value
    }));

    if (rows.length === 0 || rows.some(row => !row.proposed_install_date)) {
        showError('Every selected UPS installation needs a proposed install date');
        return;
    }

    try {
        const schedule = await apiRequest('/ups/schedule/custom', {
            method: 'POST',
            body: JSON.stringify({ rows })
        });
        renderNocScheduleResults(schedule.rows);
        await copyScheduleTableToClipboard(schedule.rows);
        selectedUpsInstallationIds.clear();
        closeUpsScheduleModal();
        loadUpsInstallations();
        showSuccess('Moved to In Progress and copied NOC schedule table for Outlook');
    } catch (error) {
        showError('Failed to send NOC schedule');
    }
}

function renderNocScheduleResults(rows) {
    const schoolCounts = rows.reduce((counts, row) => {
        counts[row.school_name] = (counts[row.school_name] || 0) + 1;
        return counts;
    }, {});

    upsScheduleResults.innerHTML = `
        <table class="ups-table schedule-results-table">
            <thead>
                <tr>
                    <th>Ticket #</th>
                    <th>IDF</th>
                    <th>School Name</th>
                    <th>Install Contact</th>
                    <th>Install Contact #</th>
                    <th>Proposed Install Date</th>
                    <th>Type</th>
                    <th>Equipment</th>
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr data-schedule-ups-id="${row.ups_installation_id}" class="${schoolCounts[row.school_name] > 1 ? 'same-school-group' : ''}">
                        <td>${escapeHtml(row.ticket_number)}</td>
                        <td>${escapeHtml(row.idf) || '-'}</td>
                        <td>
                            <span class="schedule-school-name">${escapeHtml(row.school_name)}</span>
                            ${schoolCounts[row.school_name] > 1 ? '<span class="school-group-flag">Same school</span>' : ''}
                        </td>
                        <td>${escapeHtml(row.install_contact)}</td>
                        <td>${escapeHtml(row.install_contact_number)}</td>
                        <td><input class="ups-inline-input noc-schedule-date" type="date" value="${row.proposed_install_date}"></td>
                        <td>${escapeHtml(row.type)}</td>
                        <td>${escapeHtml(row.equipment)}</td>
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function buildHtmlTable(columns, rows) {
    const headerHtml = columns
        .map(column => `<th style="border:1px solid #999;padding:6px;background:#f2f2f2;text-align:left;">${escapeHtml(column.label)}</th>`)
        .join('');
    const bodyHtml = rows.map(row => `
        <tr>
            ${columns.map(column => `<td style="border:1px solid #999;padding:6px;">${escapeHtml(row[column.key])}</td>`).join('')}
        </tr>
    `).join('');

    return `<table style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11pt;"><thead><tr>${headerHtml}</tr></thead><tbody>${bodyHtml}</tbody></table>`;
}

function buildPreviewTable(columns, rows) {
    return `
        <table class="ups-table schedule-results-table">
            <thead>
                <tr>${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}</tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>${columns.map(column => `<td>${escapeHtml(row[column.key]) || '-'}</td>`).join('')}</tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function buildPlainTable(columns, rows) {
    return [
        columns.map(column => column.label).join('\t'),
        ...rows.map(row => columns.map(column => row[column.key] || '').join('\t'))
    ].join('\n');
}

async function copyHtmlTableToClipboard(columns, rows, successMessage, promptTitle) {
    const html = buildHtmlTable(columns, rows);
    const text = buildPlainTable(columns, rows);

    try {
        if (window.ClipboardItem && navigator.clipboard.write) {
            await navigator.clipboard.write([
                new ClipboardItem({
                    'text/html': new Blob([html], { type: 'text/html' }),
                    'text/plain': new Blob([text], { type: 'text/plain' })
                })
            ]);
        } else {
            await navigator.clipboard.writeText(text);
        }
        showSuccess(successMessage);
    } catch (error) {
        window.prompt(promptTitle, text);
    }
}

function getScheduleTableColumns() {
    return [
        { key: 'ticket_number', label: 'Ticket #' },
        { key: 'idf', label: 'IDF' },
        { key: 'school_name', label: 'School Name' },
        { key: 'install_contact', label: 'Install Contact' },
        { key: 'install_contact_number', label: 'Install Contact #' },
        { key: 'proposed_install_date', label: 'Proposed Install Date' },
        { key: 'type', label: 'Type' },
        { key: 'equipment', label: 'Equipment' }
    ];
}

async function copyScheduleTableToClipboard(rows) {
    await copyHtmlTableToClipboard(
        getScheduleTableColumns(),
        rows,
        'NOC schedule table copied for Outlook',
        'Copy NOC schedule table:'
    );
}

function getSelectedScheduledInstalls() {
    return currentScheduledUpsInstallations
        .filter(install => selectedScheduledUpsInstallationIds.has(install.ups_installation_id))
        .map(install => ({
            ...install,
            ups_po: document.getElementById(`scheduled-ups-po-${install.ups_installation_id}`)?.value || install.ups_po || '',
            bp_po: document.getElementById(`scheduled-bp-po-${install.ups_installation_id}`)?.value || install.bp_po || ''
        }));
}

function openWarehouseEmailModal() {
    const installs = getSelectedScheduledInstalls();
    if (installs.length === 0) {
        showError('Select at least one in-progress UPS installation');
        return;
    }

    renderWarehouseEmailResults(installs);
    upsWarehouseModal.style.display = 'block';
}

function closeWarehouseEmailModal() {
    upsWarehouseModal.style.display = 'none';
    selectedScheduledUpsInstallationIds.clear();
    renderScheduledUpsInstallations(currentScheduledUpsInstallations);
}

function renderWarehouseEmailResults(installs) {
    const rows = buildWarehouseRows(installs);
    const columns = getWarehouseTableColumns();
    upsWarehouseResults.innerHTML = `
        <table class="ups-table schedule-results-table">
            <thead>
                <tr>
                    ${columns.map(column => `<th>${escapeHtml(column.label)}</th>`).join('')}
                </tr>
            </thead>
            <tbody>
                ${rows.map(row => `
                    <tr>
                        ${columns.map(column => `<td>${escapeHtml(row[column.key]) || '-'}</td>`).join('')}
                    </tr>
                `).join('')}
            </tbody>
        </table>
    `;
}

function buildWarehouseRows(installs) {
    return installs.map(install => ({
        ticket_number: String(install.external_ticket_number || install.ticket_number),
        idf: install.idf || '',
        school_name: install.school_name,
        install_date: install.approved_install_date || install.proposed_install_date || '',
        type: 'Replace',
        equipment: deriveEquipment(install),
        ups_serial: '',
        ups_po: install.ups_po || '',
        bp_serials: '',
        bp_po: install.bp_po || ''
    }));
}

function getWarehouseTableColumns() {
    return [
        { key: 'ticket_number', label: 'Ticket #' },
        { key: 'idf', label: 'IDF' },
        { key: 'school_name', label: 'School Name' },
        { key: 'install_date', label: 'Install Date' },
        { key: 'type', label: 'Type' },
        { key: 'equipment', label: 'Equipment' },
        { key: 'ups_serial', label: 'UPS Serial' },
        { key: 'ups_po', label: 'UPS PO' },
        { key: 'bp_serials', label: 'BP Serial(s)' },
        { key: 'bp_po', label: 'BP PO' }
    ];
}

async function copyGeneratedWarehouseEmail() {
    const rows = buildWarehouseRows(getSelectedScheduledInstalls());
    await copyHtmlTableToClipboard(
        getWarehouseTableColumns(),
        rows,
        'Warehouse table copied for Outlook',
        'Copy warehouse table:'
    );
    closeWarehouseEmailModal();
}

async function saveScheduledPo(upsInstallationId) {
    const data = {
        ups_po: document.getElementById(`scheduled-ups-po-${upsInstallationId}`).value || null,
        bp_po: document.getElementById(`scheduled-bp-po-${upsInstallationId}`).value || null
    };

    try {
        await apiRequest(`/ups-installations/${upsInstallationId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        showSuccess('PO fields saved successfully');
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to save PO fields');
    }
}

async function moveSelectedScheduledToCompleted() {
    const selectedIds = Array.from(selectedScheduledUpsInstallationIds);
    if (selectedIds.length === 0) {
        showError('Select at least one in-progress UPS installation');
        return;
    }

    if (!confirm(`Move ${selectedIds.length} UPS installation(s) to completed?`)) {
        return;
    }

    try {
        await Promise.all(selectedIds.map(upsInstallationId => apiRequest(`/ups-installations/${upsInstallationId}`, {
            method: 'PUT',
            body: JSON.stringify({
                status: 'fulfilled',
                ups_po: document.getElementById(`scheduled-ups-po-${upsInstallationId}`)?.value || null,
                bp_po: document.getElementById(`scheduled-bp-po-${upsInstallationId}`)?.value || null
            })
        })));
        selectedScheduledUpsInstallationIds.clear();
        showSuccess('Selected UPS installation(s) moved to completed');
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to move selected UPS installation(s) to completed');
    }
}

async function rollbackUpsInstallation(upsInstallationId) {
    try {
        await apiRequest(`/ups/${upsInstallationId}/rollback`, {
            method: 'PATCH'
        });
        showSuccess('UPS installation sent back to pending');
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to send UPS installation back to pending');
    }
}

function getTicketLabel(ticketNumber) {
    if (!ticketNumber) {
        return '';
    }

    const ticket = currentTickets.find(item => item.ticket_number === ticketNumber);
    return ticket ? `#${ticket.external_ticket_number || ticket.ticket_number}` : `#${ticketNumber}`;
}

async function copyRmaEmailPrompt(rma) {
    // RMA email clipboard helper for messages sent to the RMA admin.
    const emailPrompt = [
        'Hello,',
        '',
        'Please process the following RMA request:',
        '',
        `Customer: ${rma.customer}`,
        `Campus: ${rma.campus}`,
        `Dynamics Case #: ${rma.dynamics_case_number}`,
        `Part Number/Model: ${rma.part_number_model}`,
        `Defective SN: ${rma.defective_serial_number}`,
        `Issue: ${rma.issue}`,
        '',
        'Thank you,'
    ].filter(line => line !== null).join('\n');

    try {
        await navigator.clipboard.writeText(emailPrompt);
        showSuccess('RMA email prompt copied to clipboard!');
    } catch (error) {
        window.prompt('Copy RMA email prompt:', emailPrompt);
    }
}

async function copyTextToClipboard(text, successMessage, promptTitle = 'Copy email text:') {
    try {
        await navigator.clipboard.writeText(text);
        showSuccess(successMessage);
    } catch (error) {
        window.prompt(promptTitle, text);
    }
}

function populateRmaTicketOptions() {
    const openTickets = currentTickets.filter(ticket => ticket.status === 'open');
    const options = ['<option value="">None</option>'].concat(
        openTickets.map(ticket => {
            const label = `Ticket #${ticket.external_ticket_number || ticket.ticket_number} - ${ticket.school_name}`;
            return `<option value="${ticket.ticket_number}">${label}</option>`;
        })
    ).join('');

    rmaTicketSelect.innerHTML = options;
    editRmaTicketSelect.innerHTML = options;
}

function editTicket(ticketNumber) {
    const ticketCard = document.querySelector(`[onclick*="editTicket(${ticketNumber})"]`).closest('.ticket-card');
    const status = ticketCard.querySelector('.ticket-status').dataset.status;
    const note = ticketCard.querySelector('p') ? ticketCard.querySelector('p').textContent : '';

    document.getElementById('edit-ticket-number').value = ticketNumber;
    document.getElementById('edit-note').value = note;
    document.getElementById('edit-status').value = status;

    editModal.style.display = 'block';
}

function editRma(rmaId) {
    const rma = currentRmas.find(item => item.rma_id === rmaId);
    if (!rma) {
        showError('RMA data was not found');
        return;
    }

    document.getElementById('edit-rma-id').value = rma.rma_id;
    document.getElementById('edit-rma-ticket-number').value = rma.ticket_number || '';
    document.getElementById('edit-rma-customer').value = rma.customer;
    document.getElementById('edit-rma-campus').value = rma.campus;
    document.getElementById('edit-rma-dynamics-case-number').value = rma.dynamics_case_number;
    document.getElementById('edit-rma-part-number-model').value = rma.part_number_model;
    document.getElementById('edit-rma-defective-serial-number').value = rma.defective_serial_number;
    document.getElementById('edit-rma-issue').value = rma.issue;

    rmaEditModal.style.display = 'block';
}

function showLoading() {
    ticketsList.innerHTML = '<div class="loading">Loading tickets...</div>';
}

function hideLoading() {
    // Loading state is replaced by renderTickets
}

function showError(message) {
    const errorDiv = document.createElement('div');
    errorDiv.className = 'error';
    errorDiv.textContent = message;
    document.querySelector('main').prepend(errorDiv);
    setTimeout(() => errorDiv.remove(), 5000);
}

function showSuccess(message) {
    const successDiv = document.createElement('div');
    successDiv.className = 'success';
    successDiv.textContent = message;
    document.querySelector('main').prepend(successDiv);
    setTimeout(() => successDiv.remove(), 3000);
}

// Filter and search functions
function handleFilterChange() {
    currentStatusFilter = statusFilter.value;
    currentPage = 1;
    loadTickets();
}

function handleSearchChange() {
    currentSearch = searchInput.value.toLowerCase();
    // For now, we'll implement client-side search
    // In a production app, you'd send this to the server
    filterTicketsLocally();
}

function handleRmaSearchChange() {
    currentRmaSearch = rmaSearchInput.value.toLowerCase();
    renderRmas(currentRmas);
}

function handleUpsFilterChange() {
    currentUpsStatusFilter = upsStatusFilter.value;
    loadUpsInstallations();
}

function handleUpsSearchChange() {
    currentUpsSearch = upsSearchInput.value.toLowerCase();
    renderUpsInstallations(currentUpsInstallations);
}

function filterTicketsLocally() {
    const cards = document.querySelectorAll('.ticket-card');
    cards.forEach(card => {
        const text = card.textContent.toLowerCase();
        card.style.display = text.includes(currentSearch) ? 'block' : 'none';
    });
}

function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Pagination
function changePage(direction) {
    currentPage += direction;
    if (currentPage < 1) currentPage = 1;
    loadTickets();
}

function updatePagination() {
    pageInfo.textContent = `Page ${currentPage}`;
    // In a real app, you'd check if there are more pages
    prevPageBtn.disabled = currentPage === 1;
}

// Theme management
function toggleTheme() {
    const body = document.body;
    const isDark = body.classList.contains('light-mode');

    if (isDark) {
        body.classList.remove('light-mode');
        themeToggle.textContent = '🌙 Dark Mode';
        localStorage.setItem('theme', 'dark');
    } else {
        body.classList.add('light-mode');
        themeToggle.textContent = '☀️ Light Mode';
        localStorage.setItem('theme', 'light');
    }
}

function loadTheme() {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'light') {
        document.body.classList.add('light-mode');
        themeToggle.textContent = '☀️ Light Mode';
    } else {
        themeToggle.textContent = '🌙 Dark Mode';
    }
}

// UPS Detail Modal - 3 Phase Workflow
function deriveEquipment(install) {
    let equipment = 'UPS';
    if (install.new_battery_pack_serial || install.battery_pack_1_asset_tag) {
        equipment += ', 1 BP';
    }
    return equipment;
}

function openUpsDetailModal(upsInstallationId) {
    const install = currentUpsInstallations.find(item => item.ups_installation_id === upsInstallationId);
    if (!install) {
        showError('Unable to load UPS installation details');
        return;
    }

    currentDetailUpsId = upsInstallationId;
    
    // Phase 1: Read-only ticket info
    document.getElementById('detail-ticket-number').textContent = install.external_ticket_number || install.ticket_number;
    document.getElementById('detail-school-name').textContent = install.school_name;
    document.getElementById('detail-tea-code').textContent = install.tea_code;
    document.getElementById('detail-created-date').textContent = install.created_date;
    
    // Phase 2: Respond to Ticket fields
    document.getElementById('detail-model').value = install.model || '';
    document.getElementById('detail-serial').value = install.serial_number || '';
    document.getElementById('detail-snmp-ip').value = install.snmp_ip || '';
    document.getElementById('detail-hostname').value = install.hostname || '';
    document.getElementById('detail-asset-tag').value = install.asset_tag || '';
    document.getElementById('detail-mac').value = install.mac_address || '';
    document.getElementById('detail-room').value = install.room_number || '';
    document.getElementById('detail-bp1-sn').value = install.defective_battery_pack_serial || '';
    document.getElementById('detail-bp1-asset').value = install.battery_pack_1_asset_tag || '';
    
    // Phase 2: Internal tracking fields
    document.getElementById('detail-idf').value = install.idf || '';
    
    document.getElementById('phase-ups-id').value = upsInstallationId;
    
    upsDetailModal.style.display = 'block';
}

function openUpsPhase3Modal(upsInstallationId) {
    const install = currentScheduledUpsInstallations.find(item => item.ups_installation_id === upsInstallationId)
        || currentUpsInstallations.find(item => item.ups_installation_id === upsInstallationId);
    if (!install) {
        showError('Unable to load UPS phase 3 details');
        return;
    }

    currentDetailUpsId = upsInstallationId;

    document.getElementById('phase3-ticket-number').textContent = install.external_ticket_number || install.ticket_number;
    document.getElementById('phase3-school-name').textContent = install.school_name;
    document.getElementById('phase3-idf').textContent = install.idf || '-';
    document.getElementById('phase3-proposed-date').textContent = install.proposed_install_date || '-';
    document.getElementById('phase3-equipment').textContent = deriveEquipment(install);

    document.getElementById('device-asset-tag').value = install.asset_tag || '';
    document.getElementById('device-serial').value = install.new_serial_number || '';
    document.getElementById('device-webcard').value = install.new_webcard_serial || '';
    document.getElementById('device-snmp-ip').value = install.snmp_ip || '';
    document.getElementById('device-new-bp-sn').value = install.new_battery_pack_serial || '';
    document.getElementById('device-new-bp-asset').value = install.new_battery_pack_asset_tag || '';

    upsPhase3Modal.style.display = 'block';
}

async function savePhase2ServiceInfo() {
    const data = {
        model: document.getElementById('detail-model').value || null,
        serial_number: document.getElementById('detail-serial').value || null,
        snmp_ip: document.getElementById('detail-snmp-ip').value || null,
        hostname: document.getElementById('detail-hostname').value || null,
        asset_tag: document.getElementById('detail-asset-tag').value || null,
        mac_address: document.getElementById('detail-mac').value || null,
        room_number: document.getElementById('detail-room').value || null,
        defective_battery_pack_serial: document.getElementById('detail-bp1-sn').value || null,
        battery_pack_1_asset_tag: document.getElementById('detail-bp1-asset').value || null,
        idf: document.getElementById('detail-idf').value || null
    };

    try {
        await apiRequest(`/ups-installations/${currentDetailUpsId}/phase2`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        showSuccess('Phase 2 service info saved successfully');
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to save Phase 2 service info');
    }
}

async function savePhase3Devices() {
    const data = {
        asset_tag: document.getElementById('device-asset-tag').value || null,
        new_serial_number: document.getElementById('device-serial').value || null,
        new_webcard_serial: document.getElementById('device-webcard').value || null,
        snmp_ip: document.getElementById('device-snmp-ip').value || null,
        new_battery_pack_serial: document.getElementById('device-new-bp-sn').value || null,
        new_battery_pack_asset_tag: document.getElementById('device-new-bp-asset').value || null
    };

    try {
        await apiRequest(`/ups-installations/${currentDetailUpsId}/phase3-devices`, {
            method: 'PATCH',
            body: JSON.stringify(data)
        });
        showSuccess('Phase 3 (Device Setup) saved successfully');
        upsPhase3Modal.style.display = 'none';
        loadUpsInstallations();
    } catch (error) {
        showError('Failed to save Phase 3 (Device Setup)');
    }
}

// UPS phase email clipboard helpers.
async function copyPhase2RespondEmail() {
    const batteryPackSn = document.getElementById('detail-bp1-sn').value || '';
    const batteryPackAssetTag = document.getElementById('detail-bp1-asset').value || '';
    const lines = [
        'UPS Information:',
        `Model: ${document.getElementById('detail-model').value || ''}`,
        `SN: ${document.getElementById('detail-serial').value || ''}`,
        `SNMP IP: ${document.getElementById('detail-snmp-ip').value || ''}`,
        `Hostname: ${document.getElementById('detail-hostname').value || ''}`,
        `Asset Tag: ${document.getElementById('detail-asset-tag').value || ''}`,
        `MAC Address: ${document.getElementById('detail-mac').value || ''}`,
        `Room: ${document.getElementById('detail-room').value || ''}`
    ];

    if (batteryPackSn || batteryPackAssetTag) {
        lines.push(
            '',
            'Battery Pack 1:',
            `SN: ${batteryPackSn}`,
            `Asset Tag: ${batteryPackAssetTag}`
        );
    }

    const text = lines.join('\n');

    await copyTextToClipboard(text, 'Phase 2 ticket response copied to clipboard!');
}

// Make deleteTicket available globally for onclick handlers
window.deleteTicket = deleteTicket;
window.editTicket = editTicket;
window.deleteRma = deleteRma;
window.editRma = editRma;
window.deleteUpsInstallation = deleteUpsInstallation;
window.toggleUpsSelection = toggleUpsSelection;
window.toggleScheduledUpsSelection = toggleScheduledUpsSelection;
window.saveScheduledPo = saveScheduledPo;
window.moveSelectedScheduledToCompleted = moveSelectedScheduledToCompleted;
window.rollbackUpsInstallation = rollbackUpsInstallation;
window.openUpsDetailModal = openUpsDetailModal;
window.openUpsPhase3Modal = openUpsPhase3Modal;
window.savePhase2ServiceInfo = savePhase2ServiceInfo;
window.savePhase3Devices = savePhase3Devices;
window.copyPhase2RespondEmail = copyPhase2RespondEmail;
