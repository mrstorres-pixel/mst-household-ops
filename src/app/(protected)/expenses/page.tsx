import { deleteExpense, recordExpense, updateExpense } from "@/app/actions";
import { PageHeader } from "@/components/page-header";
import { PageNotice } from "@/components/page-notice";
import { SubmitButton } from "@/components/submit-button";
import { listExpenses } from "@/lib/data";
import { money, todayISO } from "@/lib/format";

export default async function ExpensesPage({ searchParams }: { searchParams: Promise<{ error?: string; success?: string }> }) {
  const params = await searchParams;
  const expenses = await listExpenses();

  return (
    <>
      <PageHeader title="Expenses" description="Expenses subtract from physical in-store cash flow." />
      <PageNotice error={params.error} success={params.success} />
      <section className="grid gap-5 lg:grid-cols-[360px_1fr]">
        <form action={recordExpense} className="card grid gap-4 p-5">
          <h3 className="text-xl font-bold">Record Expense</h3>
          <div className="field"><label>Description</label><input className="input" name="description" required /></div>
          <div className="field"><label>Category</label><input className="input" name="category" defaultValue="general" /></div>
          <div className="field"><label>Amount</label><input className="input" name="amount" type="number" step="0.01" required /></div>
          <div className="field"><label>Date</label><input className="input" name="expense_date" type="date" defaultValue={todayISO()} /></div>
          <SubmitButton pendingText="Saving expense...">Save Expense</SubmitButton>
        </form>
        <div className="card table-wrap">
          <table>
            <thead><tr><th>Date</th><th>Description</th><th>Category</th><th>Amount</th><th>Edit / Delete</th></tr></thead>
            <tbody>
              {expenses.map((expense) => <tr key={expense.id}><td>{expense.expense_date}</td><td>{expense.description}</td><td>{expense.category}</td><td>{money(expense.amount)}</td><td><details><summary className="cursor-pointer font-bold text-[color:var(--primary)]">Edit</summary><form action={updateExpense} className="mt-3 grid min-w-72 gap-2"><input type="hidden" name="expense_id" value={expense.id} /><input className="input" name="description" defaultValue={expense.description} /><input className="input" name="category" defaultValue={expense.category} /><input className="input" name="amount" type="number" step="0.01" defaultValue={expense.amount} /><input className="input" name="expense_date" type="date" defaultValue={expense.expense_date} /><SubmitButton className="btn btn-secondary" pendingText="Saving...">Save</SubmitButton></form><form action={deleteExpense} className="mt-2"><input type="hidden" name="expense_id" value={expense.id} /><SubmitButton className="btn" pendingText="Deleting...">Delete</SubmitButton></form></details></td></tr>)}
              {!expenses.length ? <tr><td colSpan={5}>No expenses yet.</td></tr> : null}
            </tbody>
          </table>
        </div>
      </section>
    </>
  );
}
