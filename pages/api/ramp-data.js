export default function handler(req, res) {
  res.status(200).json({
    message: 'Ramp data endpoint working!',
    timestamp: new Date().toISOString(),
    transactions: [],
    expenses: [],
    spendCategories: [],
    spendPrograms: [],
    receipts: [],
    memos: [],
    lastUpdated: new Date().toISOString()
  })
}
