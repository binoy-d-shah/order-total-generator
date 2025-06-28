// ui-renderer.js
import { capitalize } from './utils.js'; // Import capitalize from utils.js

// Removed generateHtmlFromJson as it's no longer used by the application
/*
function generateHtmlFromJson(order, weekday) {
    const customerFirstName = order.userDetail?.firstName || '';
    const customerLastName = order.userDetail?.lastName || '';
    const formattedName = `${capitalize(customerFirstName)} ${capitalize(customerLastName)}`;

    const subOrder = order.subOrders && order.subOrders.length > 0 ? order.subOrders[0] : null;

    const itemsRows = subOrder && subOrder.orderItems ? subOrder.orderItems
        .map(
            (item) =>
                `<tr>
                    <td>${item.brandName || 'N/A'}</td>
                    <td>${item.productName || 'N/A'}</td>
                    <td>${item.weight || 'N/A'}</td>
                    <td>${item.quantity || 'N/A'}</td>
                    <td>€${item.amount ? item.amount.toFixed(2) : '0.00'}</td>
                </tr>`
        )
        .join('') : '<tr><td colspan="5" class="text-center text-gray-500">No items found for this sub-order.</td></tr>';

    const deliveryInstruction = order.deliveryInstruction || 'None';

    const cardId = `order-card-${order.orderNumber}`;

    return `
        <div class="order-card" id="${cardId}">
            <div class="download-btn-container">
                <button class="download-image-btn bg-gray-200 hover:bg-gray-300 text-gray-800 font-bold py-2 px-4 rounded-lg text-sm"
                        data-order-number="${order.orderNumber}"
                        data-target-id="${cardId}">
                    Download Image
                </button>
            </div>
            <h2 class="text-xl font-bold text-gray-700 mb-4">Order Summary - #${order.orderNumber}</h2>
            <p class="text-sm text-gray-600 mb-1"><strong>Customer:</strong> ${formattedName}</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Delivery Date:</strong> ${order.deliverySlotDate} (${weekday})</p>
            <p class="text-sm text-gray-600 mb-1"><strong>Total Amount:</strong> €${order.amount ? order.amount.toFixed(2) : '0.00'}</p>
            <p class="text-sm text-gray-600 mb-4"><strong>Special Instructions:</strong> ${deliveryInstruction}</p>

            <h3 class="text-lg font-semibold text-gray-700 mb-2">Items</h3>
            <table>
                <thead>
                    <tr><th>Brand</th><th>Product</th><th>Weight</th><th>Quantity</th><th>Amount</th></tr>
                </thead>
                <tbody>
                    ${itemsRows}
                </tbody>
            </table>
        </div>
    `;
}
*/

/**
 * Renders the fetched order data into an HTML table for CSV preview.
 * @param {Array<Object>} orderData The processed order data (including serialNumber).
 * @param {number} grandTotalAmount The sum of all order total amounts.
 * @param {HTMLElement} csvTableContainer The container for the CSV table.
 */
function renderOrdersToTable(orderData, grandTotalAmount, csvTableContainer) {
    if (!orderData || orderData.length === 0) {
        csvTableContainer.innerHTML = '<p class="text-center text-gray-500">No orders found for the selected criteria.</p>';
        csvTableContainer.classList.add('hidden');
        return;
    }

    let tableHtml = `
        <div class="mb-4 text-xl font-bold text-gray-800 text-center">
            Grand Total: €${grandTotalAmount.toFixed(2)}
        </div>
        <table class="min-w-full bg-white border border-gray-300 rounded-lg shadow-md mb-6">
            <thead>
                <tr class="bg-gray-200 text-gray-700">
                    <th class="py-2 px-4 border-b">S.No.</th>
                    <th class="py-2 px-4 border-b">Order Number</th>
                    <th class="py-2 px-4 border-b">Customer Name</th>
                    <th class="py-2 px-4 border-b">Total Amount</th>
                </tr>
            </thead>
            <tbody>
    `;

    orderData.forEach(order => {
        tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-4 border-b text-center">${order.serialNumber}</td>
                <td class="py-2 px-4 border-b">${order.orderNumber}</td>
                <td class="py-2 px-4 border-b">${order.customerName}</td>
                <td class="py-2 px-4 border-b">€${order.totalAmount ? order.totalAmount.toFixed(2) : '0.00'}</td>
            </tr>
        `;
    });

    tableHtml += `
            </tbody>
        </table>
    `;

    csvTableContainer.innerHTML = tableHtml;
    csvTableContainer.classList.remove('hidden');
}


export {
    // Removed generateHtmlFromJson from export
    // generateHtmlFromJson,
    renderOrdersToTable
};