// order-api.js
import config from './config.js'; // Import the default config object
import { displayMessage, capitalize } from './utils.js';
import { renderOrdersToTable } from './ui-renderer.js';

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
 * Now captures 'amount' as baseOrderAmount and 'totalAmount' as additionalTotalAmount,
 * and includes the deliverySlotDate formatted as DD.MM.YYYY.
 * @param {Array<Object>} orders The raw order array from an API response.
 * @returns {Array<Object>} The filtered and formatted order data including all required amounts and date.
 */
function processOrdersForDisplay(orders) {
    const processedOrders = [];
    const excludedStatuses = new Set(['cancelled', 'paymentfailed']);

    for (const order of orders) {
        const status = order.orderStatus?.toString().trim().toLowerCase();
        if (status && !excludedStatuses.has(status)) {
            const customerFirstName = order.userDetail?.firstName || '';
            const customerLastName = order.userDetail?.lastName || '';

            const baseOrderAmount = order.amount || 0;
            const additionalTotalAmount = order.totalAmount || 0; // Assuming 'totalAmount' is another field in the raw API response

            // Use deliverySlotDate field and format it as DD.MM.YYYY
            const deliverySlotDateString = order.deliverySlotDate;
            let formattedDate = 'N/A';
            if (deliverySlotDateString) {
                const dateObj = new Date(deliverySlotDateString);
                // Check if the date object is valid to avoid "Invalid Date" issues
                if (!isNaN(dateObj.getTime())) {
                    const day = String(dateObj.getDate()).padStart(2, '0');
                    const month = String(dateObj.getMonth() + 1).padStart(2, '0'); // Month is 0-indexed
                    const year = dateObj.getFullYear();
                    formattedDate = `${day}.${month}.${year}`;
                }
            }

            processedOrders.push({
                orderNumber: order.orderNumber || 'N/A',
                customerName: `${capitalize(customerFirstName)} ${capitalize(customerLastName)}`.trim(),
                deliveryDate: formattedDate, // Now using formatted deliverySlotDate
                baseOrderAmount: baseOrderAmount,
                additionalTotalAmount: additionalTotalAmount,
            });
        }
    }
    return processedOrders;
}

/**
 * Helper function to introduce a delay.
 * @param {number} ms The delay in milliseconds.
 * @returns {Promise<void>} A promise that resolves after the specified delay.
 */
const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * Performs a daily order fetch with retry logic and exponential backoff.
 * @param {string} idToken The authentication token.
 * @param {string} dateToFetch The date inYYYY-MM-DD format.
 * @param {number} [retries=3] Number of retry attempts.
 * @param {number} [initialDelay=1000] Initial delay in ms before first retry.
 * @returns {Promise<Array<Object>>} A promise that resolves with processed order data for the day.
 * @throws {Error} If fetching fails after all retries or for non-retryable errors.
 */
async function performDailyFetchWithRetry(idToken, dateToFetch, retries = 3, initialDelay = 1000) {
    let currentDelay = initialDelay;
    for (let attempt = 1; attempt <= retries; attempt++) {
        try {
            const ordersResponse = await fetch(`${config.baseUrl}/order-management/api/v1/orders?deliveryDateTimeFrom=${dateToFetch}T00:00:00.000Z&deliveryDateTimeTo=${dateToFetch}T23:59:59.000Z&pageSize=75`, {
                method: 'GET',
                headers: {
                    'Idtoken': idToken,
                    'Content-Type': 'application/json'
                }
            });

            if (ordersResponse.ok) {
                const ordersJson = await ordersResponse.json();
                return processOrdersForDisplay(ordersJson.data?.orders ?? []);
            } else if ([502, 503, 504, 429].includes(ordersResponse.status)) { // Retry for Gateway Timeout, Bad Gateway, Service Unavailable, Too Many Requests
                const errorText = await ordersResponse.text();
                console.warn(`Attempt ${attempt}: Failed to fetch orders for ${dateToFetch} with status ${ordersResponse.status}. Retrying in ${currentDelay}ms. Error: ${errorText}`);
                if (attempt < retries) {
                    await sleep(currentDelay);
                    currentDelay *= 2; // Exponential backoff
                } else {
                    throw new Error(`Failed to fetch orders for ${dateToFetch} after ${retries} attempts: ${ordersResponse.status} - ${errorText}`);
                }
            } else { // Non-retryable errors (e.g., 400 Bad Request, 401 Unauthorized, 404 Not Found)
                const errorText = await ordersResponse.text();
                throw new Error(`Non-retryable error fetching orders for ${dateToFetch}: ${ordersResponse.status} - ${errorText}`);
            }
        } catch (error) {
            // Also retry for network errors (e.g., no internet connection)
            if (error instanceof TypeError || error.message.includes('Failed to fetch') || error.message.includes('NetworkError')) {
                console.warn(`Attempt ${attempt}: Network error during fetch for ${dateToFetch}. Retrying in ${currentDelay}ms. Error:`, error);
                if (attempt < retries) {
                    await sleep(currentDelay);
                    currentDelay *= 2;
                } else {
                    throw new Error(`Network error fetching orders for ${dateToFetch} after ${retries} attempts: ${error.message}`);
                }
            } else {
                console.error(`Attempt ${attempt}: Unexpected error during fetch for ${dateToFetch}:`, error);
                throw error; // Re-throw other unexpected errors
            }
        }
    }
    // This line should ideally not be reached if retries are exhausted or successful
    return [];
}


/**
 * Fetches orders within a date range and prepares data for CSV and table.
 * Always fetches day by day, using controlled concurrency with retries for robustness.
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
    let serialCounter = 1; // Initialize serial counter
    let grandBaseOrderAmount = 0; // Grand total for 'amount'
    let grandAdditionalTotalAmount = 0; // Grand total for 'totalAmount'


    try {
        idToken = await refreshAuthToken();

        const timeDiff = endDate.getTime() - startDate.getTime();
        const diffDays = Math.ceil(timeDiff / (1000 * 3600 * 24)) + 1; // +1 to include both start and end day

        const dailyFetchFunctions = []; // This array will store functions that return promises

        displayMessage(`Preparing ${diffDays} daily fetch requests...`, 'info');
        let currentDate = new Date(startDate);
        while (currentDate <= endDate) {
            const formattedDate = currentDate.toISOString().split('T')[0];
            // Push a function that, when called, executes performDailyFetchWithRetry for a specific date
            dailyFetchFunctions.push(() => performDailyFetchWithRetry(idToken, formattedDate));
            currentDate.setDate(currentDate.getDate() + 1); // Move to the next day
        }

        if (dailyFetchFunctions.length === 0) {
            displayMessage('No valid days found in the selected date range to fetch orders.', 'info');
            csvGeneratingIndicator.classList.add('hidden');
            return null;
        }

        // --- Concurrency Control with Batching ---
        const concurrencyLimit = 5; // Adjust this value based on server capacity and desired speed
        const totalBatches = Math.ceil(dailyFetchFunctions.length / concurrencyLimit);

        displayMessage(`Starting fetch with concurrency limit of ${concurrencyLimit} requests in parallel (${totalBatches} batches total)...`, 'info');

        for (let i = 0; i < dailyFetchFunctions.length; i += concurrencyLimit) {
            const batchFunctions = dailyFetchFunctions.slice(i, i + concurrencyLimit);
            displayMessage(`Processing batch ${Math.floor(i / concurrencyLimit) + 1} of ${totalBatches} (${batchFunctions.length} requests)...`, 'info');

            // Execute the functions in the current batch to get the promises, then await them all
            const batchResults = await Promise.all(batchFunctions.map(fn => fn()));

            // Process results from this batch immediately
            batchResults.forEach(dailyOrders => {
                dailyOrders.forEach(order => {
                    if (order) {
                        allAggregatedOrders.push({ ...order, serialNumber: serialCounter++ });
                        grandBaseOrderAmount += order.baseOrderAmount || 0; // Sum base amount
                        grandAdditionalTotalAmount += order.additionalTotalAmount || 0; // Sum additional amount
                    }
                });
            });
        }

        if (allAggregatedOrders.length === 0) {
            displayMessage(`No valid orders found for the selected date range after filtering. Total count: 0. Grand Total (Amount - without fees): €0.00. Grand Total (Total Amount): €0.00.`, 'info');
            csvTableContainer.classList.add('hidden');
            return null;
        }

        displayMessage(`Successfully fetched and processed ${allAggregatedOrders.length} valid orders for the period. Total count: ${allAggregatedOrders.length}. Grand Total (Amount - without fees): €${grandBaseOrderAmount.toFixed(2)}. Grand Total (Total Amount): €${grandAdditionalTotalAmount.toFixed(2)}.`, 'success');
        copyTableContentsBtn.classList.remove('hidden'); // Show copy table contents button

        // Render to HTML table using the allAggregatedOrders array
        renderOrdersToTable(allAggregatedOrders, grandBaseOrderAmount, grandAdditionalTotalAmount, csvTableContainer);

        return allAggregatedOrders;

    } catch (error) {
        console.error('Error during order processing:', error);
        displayMessage(`Error: ${error.message}. Please ensure the tokens are valid and try again.`, 'error');
        return null;
    } finally {
        csvGeneratingIndicator.classList.add('hidden');
    }
}

export {
    fetchOrdersByDateRange
};