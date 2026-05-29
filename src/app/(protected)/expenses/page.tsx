import { recordExpense } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { listExpenses } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function ExpensesPage() {
  const expenses = await listExpenses();

  return (
    <>
      <PageHeader title="Expenses" description="Expenses subtract from physical in-store cash flow." />
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form action={recordExpense} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Record Expense</h3>
          <div className="field"><label>Description</label><input className="input" name="description" required /></div>
          <div className="field"><label>Category</label><input className="input" name="category" defaultValue="general" /></div>
          <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required /></div>
          <div className="field"><label>Date</label><input className="input" name="expense_date" type="date" defaultValue={todayISO()} /></div>
          <button className="btn" type="submit">Save Expense</button>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th></tr></thead>
            <tbody>
              {expenses.map((expense) => <tr key={expense.id}><td>{expense.expense_date}</td><td>{expense.description}</td><td>{expense.category}</td><td>{money(expense.amount)}</td></tr>)}
              {!expenses.length ? <tr><td colSpan={4}>No expenses yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
