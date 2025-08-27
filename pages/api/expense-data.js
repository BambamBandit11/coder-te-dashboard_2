export default function handler(req, res) {
  res.status(200).json({
    message: 'Expense data endpoint working!',
    timestamp: new Date().toISOString(),
    endpoint: 'expense-data',
    transactions: [],
    expenses: [],
    lastUpdated: new Date().toISOString()
  })
}
