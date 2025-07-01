// ui-renderer.js
import { capitalize } from './utils.js'; // Import capitalize from utils.js

/**
 * Renders the fetched order data into an HTML table for CSV preview.
 * Now includes 'Amount' and 'Total Amount' columns, and displays their individual grand totals.
 * @param {Array<Object>} orderData The processed order data (including serialNumber, baseOrderAmount, additionalTotalAmount, deliveryDate).
 * @param {number} grandBaseOrderAmount The sum of all 'amount' fields.
 * @param {number} grandAdditionalTotalAmount The sum of all 'totalAmount' fields.
 * @param {HTMLElement} csvTableContainer The container for the CSV table.
 */
function renderOrdersToTable(orderData, grandBaseOrderAmount, grandAdditionalTotalAmount, csvTableContainer) {
    if (!orderData || orderData.length === 0) {
        csvTableContainer.innerHTML = '<p class="text-center text-gray-500">No orders found for the selected criteria.</p>';
        csvTableContainer.classList.add('hidden');
        return;
    }

    let tableHtml = `
        <div class="mb-4 text-xl font-bold text-gray-800 text-center">
            Grand Total (Amount - without fees and discounts): €${grandBaseOrderAmount.toFixed(2)}
        </div>
        <div class="mb-4 text-xl font-bold text-gray-800 text-center">
            Grand Total (Total Amount): €${grandAdditionalTotalAmount.toFixed(2)}
        </div>
        <table class="min-w-full bg-white border border-gray-300 rounded-lg shadow-md mb-6">
            <thead>
                <tr class="bg-gray-200 text-gray-700">
                    <th class="py-2 px-4 border-b">S.No.</th>
                    <th class="py-2 px-4 border-b">Order Number</th>
                    <th class="py-2 px-4 border-b">Date</th>
                    <th class="py-2 px-4 border-b">Customer Name</th>
                    <th class="py-2 px-4 border-b">Amount (without fees and discounts)</th> <th class="py-2 px-4 border-b">Total Amount</th>
                </tr>
            </thead>
            <tbody>
    `;

    orderData.forEach(order => {
        tableHtml += `
            <tr class="hover:bg-gray-50">
                <td class="py-2 px-4 border-b text-center">${order.serialNumber}</td>
                <td class="py-2 px-4 border-b">${order.orderNumber}</td>
                <td class="py-2 px-4 border-b">${order.deliveryDate}</td>
                <td class="py-2 px-4 border-b">${order.customerName}</td>
                <td class="py-2 px-4 border-b">€${order.baseOrderAmount ? order.baseOrderAmount.toFixed(2) : '0.00'}</td>
                <td class="py-2 px-4 border-b">€${order.additionalTotalAmount ? order.additionalTotalAmount.toFixed(2) : '0.00'}</td>
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
    renderOrdersToTable
};