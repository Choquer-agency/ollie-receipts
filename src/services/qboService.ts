import { QuickBooksAccount, PaymentAccount, Receipt } from "../types";

// Mock Data for Expense Categories (Chart of Accounts)
const MOCK_EXPENSE_ACCOUNTS: QuickBooksAccount[] = [
  { id: '6415', name: '6415 - Client meals and entertainment', type: 'Expense' },
  { id: '6418', name: '6418 - Food', type: 'Expense' },
  { id: '6000', name: '6000 - Advertising', type: 'Expense' },
  { id: '6100', name: '6100 - Auto', type: 'Expense' },
  { id: '6200', name: '6200 - Office Supplies', type: 'Expense' },
  { id: '6300', name: '6300 - Professional Fees', type: 'Expense' },
  { id: '6400', name: '6400 - Travel', type: 'Expense' },
];

// Mock Data for Payment Methods (Asset/Liability Accounts)
const MOCK_PAYMENT_ACCOUNTS: PaymentAccount[] = [
  { id: '1001', name: 'Chequing (1001)', type: 'Bank' },
  { id: '1002', name: 'Amex Business CC (1002)', type: 'Credit Card' },
  { id: '1003', name: 'Visa Infinite (1003)', type: 'Credit Card' },
  { id: '1004', name: 'Petty Cash', type: 'Bank' },
];

export const connectToQuickBooks = async (): Promise<boolean> => {
  // Simulate OAuth flow
  return new Promise((resolve) => {
    setTimeout(() => {
      console.log("Connected to QuickBooks Sandbox");
      resolve(true);
    }, 1500);
  });
};

export const fetchAccounts = async (): Promise<QuickBooksAccount[]> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_EXPENSE_ACCOUNTS), 600);
  });
};

export const fetchPaymentAccounts = async (): Promise<PaymentAccount[]> => {
  return new Promise((resolve) => {
    setTimeout(() => resolve(MOCK_PAYMENT_ACCOUNTS), 600);
  });
};

export const publishReceipt = async (receipt: Receipt, accountId: string): Promise<string> => {
  // Simulate API call to create Expense/Bill in QBO
  console.log(`Publishing receipt ${receipt.id}`);
  console.log(`  Target: ${receipt.publish_target || 'Expense'}`);
  console.log(`  Category Account: ${accountId}`);
  console.log(`  Payment Account: ${receipt.payment_account_id}`);
  
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(`txn_${Math.floor(Math.random() * 100000)}`);
    }, 2000);
  });
};

