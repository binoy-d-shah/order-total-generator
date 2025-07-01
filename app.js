// app.js
import { displayMessage } from './utils.js';
import { fetchOrdersByDateRange } from './order-api.js';

// Get references to HTML elements
const startDateInput = document.getElementById('startDate');
const endDateInput = document.getElementById('endDate');
const fetchOrdersByRangeBtn = document.getElementById('fetchOrdersByRangeBtn');

const csvGeneratingIndicator = document.getElementById('csvGeneratingIndicator');
const copyTableContentsBtn = document.getElementById('copyTableContentsBtn');
const csvTableContainer = document.getElementById('csvTableContainer');

let lastFetchedDataForDownload = null;

// --- Pre-fill date inputs with the current date ---
const today = new Date();
const year = today.getFullYear();
const month = String(today.getMonth() + 1).padStart(2, '0'); // Months are 0-indexed (0-11)
const day = String(today.getDate()).padStart(2, '0');
const formattedCurrentDate = `${year}-${month}-${day}`;

startDateInput.value = formattedCurrentDate;
endDateInput.value = formattedCurrentDate;
// --- End pre-fill ---


// Event Listener for Fetch Orders By Range button
fetchOrdersByRangeBtn.addEventListener('click', async () => {
    const startDate = startDateInput.value;
    const endDate = endDateInput.value;

    // Reset previous fetch data
    lastFetchedDataForDownload = null;
    csvTableContainer.innerHTML = ''; // Clear previous table
    csvTableContainer.classList.add('hidden');

    try {
        // fetchOrdersByDateRange now returns an object { orders: [], grandBaseOrderAmount, grandAdditionalTotalAmount }
        const fetchedResult = await fetchOrdersByDateRange(startDate, endDate, csvGeneratingIndicator, copyTableContentsBtn, csvTableContainer);
        if (fetchedResult) {
            lastFetchedDataForDownload = fetchedResult; // Store the entire result object
        } else {
            // If fetchOrdersByDateRange returns null (e.g., no orders found or error), ensure data is cleared
            lastFetchedDataForDownload = null;
        }
    } catch (error) {
        console.error("Error fetching orders:", error);
        displayMessage('Failed to fetch orders. Please check your network and try again.', 'error');
        lastFetchedDataForDownload = null;
    } finally {
        csvGeneratingIndicator.classList.add('hidden');
    }
});

// Event Listener for Download Excel File button
copyTableContentsBtn.addEventListener('click', () => {
    if (!lastFetchedDataForDownload || lastFetchedDataForDownload.orders.length === 0) {
        displayMessage('No data to download. Please fetch orders first.', 'warning');
        return;
    }

    let tsvContent = "";

    // Add grand totals as the first rows in TSV
    // Ensure grand totals are numeric before toFixed
    const grandBaseAmount = lastFetchedDataForDownload.grandBaseOrderAmount !== undefined && lastFetchedDataForDownload.grandBaseOrderAmount !== null
        ? lastFetchedDataForDownload.grandBaseOrderAmount : 0;
    const grandTotalAmount = lastFetchedDataForDownload.grandAdditionalTotalAmount !== undefined && lastFetchedDataForDownload.grandAdditionalTotalAmount !== null
        ? lastFetchedDataForDownload.grandAdditionalTotalAmount : 0;

    tsvContent += `Grand Total (Amount - without fees):\t${grandBaseAmount.toFixed(2)}\n`;
    tsvContent += `Grand Total (Total Amount):\t${grandTotalAmount.toFixed(2)}\n`;
    tsvContent += "\n"; // Add an empty line for separation

    // Headers for the table data, matching the HTML table order and content
    tsvContent += "S.No.\tOrder Number\tDate\tCustomer Name\tAmount\tTotal Amount\n";

    lastFetchedDataForDownload.orders.forEach(row => {
        const serialNumber = String(row.serialNumber || '');
        const orderNumber = String(row.orderNumber || '');
        const deliveryDate = String(row.deliveryDate || 'N/A'); // Already formatted as DD.MM.YYYY
        const customerName = String(row.customerName || '');
        const baseOrderAmount = (row.baseOrderAmount !== undefined && row.baseOrderAmount !== null) ? row.baseOrderAmount.toFixed(2) : '0.00';
        const additionalTotalAmount = (row.additionalTotalAmount !== undefined && row.additionalTotalAmount !== null) ? row.additionalTotalAmount.toFixed(2) : '0.00';

        // Use double quotes for fields that might contain special characters (like tabs or newlines, though less likely in this data)
        // For TSV, simply tab-separating is usually enough, but quoting provides robustness.
        tsvContent += `${serialNumber}\t"${orderNumber}"\t"${deliveryDate}"\t"${customerName}"\t"${baseOrderAmount}"\t"${additionalTotalAmount}"\n`;
    });

    // Create a Blob from the TSV content
    const blob = new Blob([tsvContent], { type: 'text/tab-separated-values;charset=utf-8;' });
    const url = URL.createObjectURL(blob);

    // Create a temporary anchor element to trigger the download
    const a = document.createElement('a');
    a.href = url;
    a.download = 'orders_data.tsv'; // Suggested filename for the download
    document.body.appendChild(a); // Append to body is good practice for cross-browser compatibility
    a.click(); // Programmatically click the anchor to trigger download
    document.body.removeChild(a); // Clean up the temporary element

    URL.revokeObjectURL(url); // Release the object URL to free memory

    displayMessage('Orders data downloaded as orders_data.tsv (opens with Excel).', 'success');
});