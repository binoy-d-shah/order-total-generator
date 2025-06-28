// order-api.js
import config from './config.js'; // Import the default config object
import { displayMessage, capitalize } from './utils.js';
import { renderOrdersToTable } from './ui-renderer.js';
// Removed generateHtmlFromJson import as it's no longer used here.
// import { generateHtmlFromJson } from './ui-renderer.js';

/**
 * Refreshes the authentication token.
 * @returns {Promise<string>} The new ID token.
 * @throws {Error} If token refresh fails.
 */
async function refreshAuthToken() {
    displayMessage('Refreshing authentication authentication token...', 'info');
    const refreshResponse = await fetch(`${config.baseUrl}/user-management/api/v1/users/6/refreshToken`, {
        method: 'POST',
        headers: {
            'Idtoken': config.currentIdToken,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ refreshToken: config.refreshToken })
    });

    if (!refreshResponse.ok) {
        const errorText = await refreshResponse.text();
        throw new Error(`Token refresh failed: ${refreshResponse.status} - ${errorText}`);
    }

    const refreshJsonData = await refreshResponse.json();
    config.currentIdToken = refreshJsonData.data.idToken.trim(); // Update the token in config
    displayMessage('Token refreshed successfully.', 'info');
    return config.currentIdToken;
}

/**
 * Processes a list of orders to filter by status and format for CSV/table display.
 * This function no longer adds serial numbers, as they are added after aggregation.
 * @param {Array<Object>} orders The raw order array from an API response.
 * @returns {Array<Object>} The filtered and formatted order data without serial numbers.
 */
function processOrdersForDisplay(orders) {
    const processedOrders = [];
    const excludedStatuses = new Set(['cancelled', 'paymentfailed']);

    for (const order of orders) {
        const status = order.orderStatus?.toString().trim().toLowerCase();
        if (status && !excludedStatuses.has(status)) {
            const customerFirstName = order.userDetail?.firstName || '';
            const customerLastName = order.userDetail?.lastName || '';

            processedOrders.push({
                orderNumber: order.orderNumber || 'N/A',
                customerName: `${capitalize(customerFirstName)} ${capitalize(customerLastName)}`.trim(),
                totalAmount: order.amount || 0
            });
        }
    }
    return processedOrders;
}

/**
 * Fetches orders within a date range and prepares data for CSV and table.
 * Implements mixed logic: daily parallel fetches for <= 7 days, weekly parallel fetches for > 7 days.
 * @param {string} startDateString Start date inYYYY-MM-DD format.
 * @param {string} endDateString End date inYYYY-MM-DD format.
 * @param {HTMLElement} csvGeneratingIndicator The CSV generating indicator HTML element.
 * @param {HTMLElement} copyTableContentsBtn The copy table contents button.
 * @param {HTMLElement} csvTableContainer The container for the CSV table.
 * @returns {Promise<Array<Object>>} A promise that resolves with the processed order data for CSV, including serial numbers.
 */
async function fetchOrdersByDateRange(startDateString, endDateString, csvGeneratingIndicator, copyTableContentsBtn, csvTableContainer) {
    displayMessage('', 'info').classList.add('hidden');
    csvGeneratingIndicator.classList.remove('hidden');
    copyTableContentsBtn.classList.add('hidden'); // Hide copy button initially
    csvTableContainer.classList.add('hidden');
    // csvTableBody is now rendered dynamically inside csvTableContainer
    // csvTableBody.innerHTML = ''; 

    if (!startDateString || !endDateString) {
        displayMessage('Please provide both Start Date and End Date.', 'error');
        csvGeneratingIndicator.classList.add('hidden');
        return null;
    }

    const startDate = new Date(startDateString);
    const endDate = new Date(endDateString);

    if (startDate > endDate) {
        displayMessage('Start Date cannot be after End Date.', 'error');
        csvGeneratingIndicator.classList.add('hidden');
        return null;
    }

    let allAggregatedOrders = [];
    let idToken;

    try {
        idToken = await refreshAuthToken();

        const timeDiff = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end day

        const fetchPromises = [];

        if (diffDays <= 7) {
            // Case 1: Period is 7 days or less, fetch day by day (Monday-Saturday only)
            displayMessage(`Period is ${diffDays} day(s). Fetching daily data in parallel...`, 'info');
            let currentDate = new Date(startDate);
            while (currentDate <= endDate) {
                const dayOfWeek = currentDate.getDay(); // 0 for Sunday, 1 for Monday, ..., 6 for Saturday
                if (dayOfWeek >= 1 && dayOfWeek <= 6) { // Only Mon-Sat
                    const formattedDate = currentDate.toISOString().split('T')[0];
                    fetchPromises.push((async (dateToFetch) => {
                        try {
                            const ordersResponse = await fetch(`${config.baseUrl}/order-management/api/v1/orders?deliveryDateTimeFrom=${dateToFetch}T00:00:00.000Z&deliveryDateTimeTo=${dateToFetch}T23:59:59.000Z&pageSize=75`, {
                                method: 'GET',
                                headers: {
                                    'Idtoken': idToken,
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (!ordersResponse.ok) {
                                const errorText = await ordersResponse.text();
                                console.error(`Failed to fetch orders for ${dateToFetch}: ${ordersResponse.status} - ${errorText}`);
                                return []; // Return empty array on error
                            }
                            const ordersJson = await ordersResponse.json();
                            return processOrdersForDisplay(ordersJson.data?.orders ?? []);
                        } catch (error) {
                            console.error(`Error fetching/processing orders for ${dateToFetch}:`, error);
                            return [];
                        }
                    })(formattedDate));
                }
                currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
            }
        } else {
            // Case 2: Period is more than 7 days, fetch week by week (Monday-Saturday segments)
            displayMessage(`Period is ${diffDays} days. Fetching weekly data in parallel...`, 'info');
            let currentSegmentStart = new Date(startDate);

            while (currentSegmentStart <= endDate) {
                // Find the Monday for the current segment
                let segmentMonday = new Date(currentSegmentStart);
                while (segmentMonday.getDay() !== 1 && segmentMonday.getDay() !== 0) { // Adjust to Monday, avoiding Sunday skip
                    segmentMonday.setDate(segmentMonday.getDate() - 1);
                }
                if (segmentMonday.getDay() === 0) { // If it landed on Sunday, push to next Monday
                    segmentMonday.setDate(segmentMonday.getDate() + 1);
                }

                // Calculate Saturday of that week
                let segmentSaturday = new Date(segmentMonday);
                segmentSaturday.setDate(segmentSaturday.getDate() + 5); // Monday + 5 days = Saturday

                // Cap the segment end date at the overall endDate
                if (segmentSaturday > endDate) {
                    segmentSaturday = new Date(endDate);
                }

                const formattedSegmentStart = segmentMonday.toISOString().split('T')[0];
                const formattedSegmentEnd = segmentSaturday.toISOString().split('T')[0];

                if (new Date(formattedSegmentStart) <= new Date(formattedSegmentEnd)) { // Ensure valid range
                    fetchPromises.push((async (start, end) => {
                        try {
                            const ordersResponse = await fetch(`${config.baseUrl}/order-management/api/v1/orders?deliveryDateTimeFrom=${start}T00:00:00.000Z&deliveryDateTimeTo=${end}T23:59:59.000Z&pageSize=75`, {
                                method: 'GET',
                                headers: {
                                    'Idtoken': idToken,
                                    'Content-Type': 'application/json'
                                }
                            });

                            if (!ordersResponse.ok) {
                                const errorText = await ordersResponse.text();
                                console.error(`Failed to fetch orders for week ${start} to ${end}: ${ordersResponse.status} - ${errorText}`);
                                return []; // Return empty array on error
                            }
                            const ordersJson = await ordersResponse.json();
                            // Process all orders returned for this week directly
                            return processOrdersForDisplay(ordersJson.data?.orders ?? []);
                        } catch (error) {
                            console.error(`Error fetching/processing orders for week ${start} to ${end}:`, error);
                            return [];
                        }
                    })(formattedSegmentStart, formattedSegmentEnd));
                }

                // Move to the day after segmentSaturday for the next segment
                currentSegmentStart.setDate(segmentSaturday.getDate() + 1); 
            }
        }

        if (fetchPromises.length === 0) {
            displayMessage('No valid weekdays (Monday-Saturday) found in the selected date range to fetch orders.', 'info');
            csvGeneratingIndicator.classList.add('hidden');
            return null;
        }

        // Display a more general message before Promise.all starts
        displayMessage(`Starting parallel fetch for ${fetchPromises.length} segments...`, 'info');

        const results = await Promise.all(fetchPromises);

        // Aggregate all results and add serial numbers
        let serialCounter = 1;
        let grandTotalAmount = 0;
        results.forEach(segmentOrders => {
            segmentOrders.forEach(order => {
                // Ensure order is not null/undefined before pushing
                if (order) {
                    allAggregatedOrders.push({ ...order, serialNumber: serialCounter++ });
                    grandTotalAmount += order.totalAmount || 0;
                }
            });
        });

        if (allAggregatedOrders.length === 0) {
            displayMessage(`No valid orders found for the selected date range after filtering. Total count: 0. Grand Total: €0.00.`, 'info');
            csvTableContainer.classList.add('hidden');
            return null;
        }

        displayMessage(`Successfully fetched and processed ${allAggregatedOrders.length} valid orders for the period. Total count: ${allAggregatedOrders.length}. Grand Total: €${grandTotalAmount.toFixed(2)}.`, 'success');
        copyTableContentsBtn.classList.remove('hidden'); // Show copy table contents button

        // Render to HTML table using the allAggregatedOrders array
        renderOrdersToTable(allAggregatedOrders, grandTotalAmount, csvTableContainer); // Removed csvTableBody as it's part of container

        return allAggregatedOrders;

    } catch (error) {
        console.error('Error during order processing:', error);
        displayMessage(`Error: ${error.message}. Please ensure the tokens are valid and try again.`, 'error');
        return null;
    } finally {
        csvGeneratingIndicator.classList.add('hidden');
    }
}

// Removed the entire fetchSingleOrderDetails function
/*
async function fetchSingleOrderDetails(...) { ... }
*/

export {
    fetchOrdersByDateRange
    // Removed fetchSingleOrderDetails from export
    // fetchSingleOrderDetails
};