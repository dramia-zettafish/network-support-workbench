// API base URL
const API_BASE = '';

// DOM elements
const ticketForm = document.getElementById('ticket-form');
const ticketsList = document.getElementById('tickets-list');
const statusFilter = document.getElementById('status-filter');
const searchInput = document.getElementById('search-input');
const prevPageBtn = document.getElementById('prev-page');
const nextPageBtn = document.getElementById('next-page');
const pageInfo = document.getElementById('page-info');
const themeToggle = document.getElementById('theme-toggle');

// Modal elements
const editModal = document.getElementById('edit-modal');
const editForm = document.getElementById('edit-form');
const closeModal = document.querySelector('.close');

// State
let currentPage = 1;
const limit = 12;
let currentStatusFilter = '';
let currentSearch = '';

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

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    loadTickets();
    setupEventListeners();
    loadTheme();
});

// Event listeners
function setupEventListeners() {
    ticketForm.addEventListener('submit', handleCreateTicket);
    statusFilter.addEventListener('change', handleFilterChange);
    searchInput.addEventListener('input', debounce(handleSearchChange, 300));
    prevPageBtn.addEventListener('click', () => changePage(-1));
    nextPageBtn.addEventListener('click', () => changePage(1));
    themeToggle.addEventListener('click', toggleTheme);

    // Modal events
    closeModal.addEventListener('click', () => editModal.style.display = 'none');
    window.addEventListener('click', (e) => {
        if (e.target === editModal) {
            editModal.style.display = 'none';
        }
    });
    editForm.addEventListener('submit', handleUpdateTicket);
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
        renderTickets(tickets);
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
    } catch (error) {
        showError('Failed to create ticket');
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

// UI functions
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

function editTicket(ticketNumber) {
    const ticketCard = document.querySelector(`[onclick*="editTicket(${ticketNumber})"]`).closest('.ticket-card');
    const status = ticketCard.querySelector('.ticket-status').dataset.status;
    const note = ticketCard.querySelector('p') ? ticketCard.querySelector('p').textContent : '';

    document.getElementById('edit-ticket-number').value = ticketNumber;
    document.getElementById('edit-note').value = note;
    document.getElementById('edit-status').value = status;

    editModal.style.display = 'block';
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

// Make deleteTicket available globally for onclick handlers
window.deleteTicket = deleteTicket;
window.editTicket = editTicket;
