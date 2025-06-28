// app.js
import { displayMessage } from './utils.js'; // downloadDataUrlAsFile is no longer needed
import { fetchOrdersByDateRange } from './order-api.js';

// Removed imports related to single order:
// import { fetchSingleOrderDetails } from './order-api.js';
// import { generateHtmlFromJson } from './ui-renderer.js';

// Get references to HTML elements
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const fetchOrdersByRangeBtn = document.getElementById('fetchOrdersByRangeBtn');

// Removed elements related to single order:
// const orderIdInput = document.getElementById('orderIdInput');
// const fetchSingleOrderBtn = document.getElementById('fetchSingleOrderBtn');
// const downloadAllImagesBtn = document.getElementById('downloadAllImagesBtn');
// const loadingIndicator = document.getElementById('loadingIndicator'); // This indicator was for single order and general loading, renaming csvGeneratingIndicator for general use.
// const imageGeneratingIndicator = document.getElementById('imageGeneratingIndicator'); // Removed
// const ordersContainer = document.getElementById('ordersContainer'); // Removed

const csvGeneratingIndicator = document.getElementById('csvGeneratingIndicator'); // Used for date range fetch loading
const copyTableContentsBtn = document.getElementById('copyTableContentsBtn');
const csvTableContainer = document.getElementById('csvTableContainer');

let lastFetchedOrdersData = null; // Store fetched data for copying

// Set default range dates for CSV export (e.g., last 7 days)
const defaultEndDate = new Date();
const defaultStartDate = new Date();
defaultStartDate.setDate(defaultEndDate.getDate() - 6); // Default to a week range

startDateInput.value = `${defaultStartDate.getFullYear()}-${String(defaultStartDate.getMonth() + 1).padStart(2, '0')}-${String(defaultStartDate.getDate()).padStart(2, '0')}`;
endDateInput.value = `${defaultEndDate.getFullYear()}-${String(defaultEndDate.getMonth() + 1).padStart(2, '0')}-${String(defaultEndDate.getDate()).padStart(2, '0')}`;

// Event Listener for Fetch Orders for Table button
fetchOrdersByRangeBtn.addEventListener('click', async () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    const ordersData = await fetchOrdersByDateRange(startDate, endDate, csvGeneratingIndicator, copyTableContentsBtn, csvTableContainer); // csvTableBody is implicitly part of csvTableContainer

    // Store data for copying
    if (ordersData) {
        lastFetchedOrdersData = ordersData;
        copyTableContentsBtn.classList.remove('hidden'); // Show copy button if data exists
    } else {
        lastFetchedOrdersData = null;
        copyTableContentsBtn.classList.add('hidden');
    }
});

// Event Listener for Copy Table Contents button
copyTableContentsBtn.addEventListener('click', () => {
    if (!lastFetchedOrdersData || lastFetchedOrdersData.length === 0) {
        displayMessage('No data to copy. Please fetch orders first.', 'warning');
        return;
    }

    let tableContent = "S.No.\tOrder Number\tCustomer Name\tTotal Amount\n"; // Headers, tab-separated

    lastFetchedOrdersData.forEach(row => {
        // Ensure values are strings to handle any non-string types gracefully
        const serialNumber = String(row.serialNumber || '');
        const orderNumber = String(row.orderNumber || '');
        const customerName = String(row.customerName || '');
        const totalAmount = (row.totalAmount !== undefined && row.totalAmount !== null) ? row.totalAmount.toFixed(2) : '0.00';

        tableContent += `${serialNumber}\t"${orderNumber}"\t"${customerName}"\t"${totalAmount}"\n`;
    });

    // Use the Clipboard API to copy
    navigator.clipboard.writeText(tableContent)
        .then(() => {
            displayMessage('Table contents copied to clipboard. You can now paste into Excel.', 'success');
        })
        .catch(err => {
            console.error('Failed to copy table contents: ', err);
            displayMessage('Failed to copy table contents. Please try again or copy manually.', 'error');
        });
});

// Removed Event Listener for Fetch Single Order button
// Removed Event Listener for Download All Images button