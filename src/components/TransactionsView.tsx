import { CheckIcon, PencilIcon, TrashIcon, XMarkIcon } from "@heroicons/react/24/outline";
import { type ColumnDef } from "@tanstack/react-table";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../lib/cn";
import { formatCurrency } from "../lib/format";
import {
  EXPENSE_CATEGORIES,
  getCategoryName,
  getIncomeCategoryName,
  INCOME_CATEGORIES,
  type Transaction,
} from "../lib/schema";
import { Button } from "./Button";
import { DatePicker } from "./DatePicker";
import { Input } from "./Input";
import { Menu, MenuItem } from "./Menu";
import { type ColumnMeta, Table } from "./Table";

interface Props {
  year?: number;
  onImport?: () => void;
}

type TransactionType = "income" | "expense";

// Simple category colors - green for income, neutral for expenses
function getCategoryColor(
  _categoryId: string,
  type: TransactionType,
): { bg: string; text: string } {
  if (type === "income") {
    return { bg: "bg-green-500/10", text: "text-green-600" };
  }
  return { bg: "", text: "text-(--color-text-muted)" };
}

interface TransactionRow {
  id: string;
  date: string;
  description: string;
  category: string;
  type: TransactionType;
  amount: number;
}

function collectTransactionRows(
  transactions: Transaction[],

  selectedYear?: number,
): TransactionRow[] {
  const filtered = selectedYear
    ? transactions.filter((t) => new Date(t.date).getFullYear() === selectedYear)
    : transactions;

  return filtered
    .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
    .map((t) => ({
      id: t.id,
      date: t.date,
      description: t.description || "",
      category: t.category,
      type: t.type,
      amount: t.amount,
    }));
}

export function TransactionsView({ year, onImport }: Props) {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editAmount, setEditAmount] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editCategory, setEditCategory] = useState<string | null>(null);
  const [editType, setEditType] = useState<TransactionType>("expense");

  const [newType, setNewType] = useState<TransactionType>("expense");
  const [newCategory, setNewCategory] = useState<string | null>(null);
  const [newAmount, setNewAmount] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newDate, setNewDate] = useState<Date>(new Date());

  const [isImporting, setIsImporting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetch("/api/transactions")
      .then((res) => res.json())
      .then((data) => setTransactions(data))
      .catch(console.error);
  }, []);

  const rows = useMemo(() => collectTransactionRows(transactions, year), [transactions, year]);

  const handleAddTransaction = useCallback(async () => {
    if (!newCategory || !newAmount) return;

    const numAmount = parseFloat(newAmount);
    if (isNaN(numAmount)) return;

    const transaction: Transaction = {
      id: crypto.randomUUID(),
      date: newDate.toISOString().split("T")[0] || newDate.toISOString(),
      amount: numAmount,
      category: newCategory,
      type: newType,
      description: newDescription || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    try {
      const res = await fetch("/api/transactions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(transaction),
      });
      const saved = await res.json();
      setTransactions((prev) => [...prev, saved]);
      setNewAmount("");
      setNewDescription("");
      setNewCategory(null);
    } catch (err) {
      console.error("Failed to add transaction:", err);
    }
  }, [newType, newCategory, newAmount, newDescription, newDate]);

  const handleUpdateTransaction = useCallback(
    async (id: string) => {
      const numAmount = parseFloat(editAmount);
      if (isNaN(numAmount)) return;

      try {
        const res = await fetch(`/api/transactions/${id}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            amount: numAmount,
            description: editDescription || undefined,
            category: editCategory,
            type: editType,
          }),
        });
        const updated = await res.json();
        setTransactions((prev) => prev.map((t) => (t.id === id ? updated : t)));
        setEditingId(null);
        setEditAmount("");
        setEditDescription("");
      } catch (err) {
        console.error("Failed to update transaction:", err);
      }
    },
    [editAmount, editDescription, editCategory, editType],
  );

  const handleDeleteTransaction = useCallback(async (id: string) => {
    try {
      await fetch(`/api/transactions/${id}`, { method: "DELETE" });
      setTransactions((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      console.error("Failed to delete transaction:", err);
    }
  }, []);

  const startEdit = (row: TransactionRow) => {
    setEditingId(row.id);
    setEditAmount(row.amount.toString());
    setEditDescription(row.description);
    setEditCategory(row.category);
    setEditType(row.type);
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditAmount("");
    setEditDescription("");
    setEditCategory(null);
    setEditType("expense");
  };

  const handleImportBankStatement = useCallback(
    async (file: File) => {
      setIsImporting(true);
      const formData = new FormData();
      formData.append("pdf", file);

      try {
        const res = await fetch("/api/bank-statements/upload", {
          method: "POST",
          body: formData,
        });
        if (!res.ok) {
          const { error } = await res.json();
          throw new Error(error || `HTTP ${res.status}`);
        }
        // The API now returns { statement, transactions } directly
        const { transactions: newTransactions } = await res.json();
        setTransactions((prev) => [...prev, ...newTransactions]);
        onImport?.();
      } catch (err) {
        console.error("Failed to import bank statement:", err);
        alert("Failed to import bank statement. Make sure you have an API key configured.");
      } finally {
        setIsImporting(false);
      }
    },
    [onImport],
  );

  const handleFileSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (file) {
        handleImportBankStatement(file);
      }
      e.target.value = "";
    },
    [handleImportBankStatement],
  );

  const categories =
    newType === "expense"
      ? Object.entries(EXPENSE_CATEGORIES).flatMap(([parentKey, parent]) => [
          { id: parentKey, name: parent.name, isParent: true },
          ...parent.children.map((c) => ({ id: c.id, name: `  ${c.name}`, isParent: false })),
        ])
      : Object.entries(INCOME_CATEGORIES).flatMap(([parentKey, parent]) => [
          { id: parentKey, name: parent.name, isParent: true },
          ...parent.children.map((c) => ({ id: c.id, name: `  ${c.name}`, isParent: false })),
        ]);

  const getCategoryDisplayName = (categoryId: string, type: TransactionType) => {
    if (type === "expense") {
      return getCategoryName(categoryId as never);
    }
    return getIncomeCategoryName(categoryId as never);
  };

  const columns = useMemo<ColumnDef<TransactionRow>[]>(() => {
    const cols: ColumnDef<TransactionRow>[] = [
      {
        accessorKey: "date",
        header: "Date",
        cell: (info) => {
          const row = info.row.original;
          const date = new Date(row.date);
          return <span className="tabular-nums">{date.toLocaleDateString()}</span>;
        },
        size: 220,
        meta: {
          sticky: true,
        } satisfies ColumnMeta,
      },
      {
        accessorKey: "type",
        header: "Type",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            return (
              <div className="flex gap-0.5">
                <button
                  onClick={() => setEditType("expense")}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-medium",
                    editType === "expense"
                      ? "bg-gray-500/10 text-(--color-text)"
                      : "text-(--color-text-muted) hover:text-(--color-text)",
                  )}
                >
                  Expense
                </button>
                <button
                  onClick={() => setEditType("income")}
                  className={cn(
                    "rounded px-1.5 py-0.5 text-xs font-medium",
                    editType === "income"
                      ? "bg-green-500/10 text-green-600"
                      : "text-(--color-text-muted) hover:text-green-600",
                  )}
                >
                  Income
                </button>
              </div>
            );
          }
          return (
            <span
              className={cn(
                "rounded px-1.5 py-0.5 text-xs font-medium",
                row.type === "income"
                  ? "bg-green-500/10 text-green-600"
                  : "bg-gray-500/10 text-(--color-text-muted)",
              )}
            >
              {row.type === "income" ? "Income" : "Expense"}
            </span>
          );
        },
        size: 80,
      },
      {
        accessorKey: "category",
        header: "Category",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            const editCategories =
              editType === "expense"
                ? Object.entries(EXPENSE_CATEGORIES).flatMap(([parentKey, parent]) => [
                    { id: parentKey, name: parent.name, isParent: true },
                    ...parent.children.map((c) => ({
                      id: c.id,
                      name: `  ${c.name}`,
                      isParent: false,
                    })),
                  ])
                : Object.entries(INCOME_CATEGORIES).flatMap(([parentKey, parent]) => [
                    { id: parentKey, name: parent.name, isParent: true },
                    ...parent.children.map((c) => ({
                      id: c.id,
                      name: `  ${c.name}`,
                      isParent: false,
                    })),
                  ]);
            return (
              <Menu
                triggerClassName="px-2 py-0.5 text-xs font-medium rounded border border-(--color-border) bg-(--color-bg) text-(--color-text-muted) hover:text-(--color-text)"
                popupClassName="min-w-[150px] max-h-48 overflow-y-auto"
                side="right"
                trigger={editCategory ? getCategoryDisplayName(editCategory, editType) : "Category"}
              >
                {editCategories.map((cat) => (
                  <MenuItem
                    key={cat.id}
                    onClick={() => !cat.isParent && setEditCategory(cat.id)}
                    selected={editCategory === cat.id}
                    className={
                      cat.isParent ? "cursor-default font-medium text-(--color-text-muted)" : ""
                    }
                  >
                    {cat.name}
                  </MenuItem>
                ))}
              </Menu>
            );
          }
          const color = getCategoryColor(row.category, row.type);
          return (
            <span className={cn("text-sm font-medium", color.text)}>
              {getCategoryDisplayName(row.category, row.type)}
            </span>
          );
        },
        size: 150,
      },
      {
        accessorKey: "description",
        header: "Description",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            return (
              <Input
                value={editDescription}
                onChange={(e) => setEditDescription(e.target.value)}
                placeholder="Description"
                className="w-full"
              />
            );
          }
          return (
            <span className="text-sm text-(--color-text-muted)">{row.description || "—"}</span>
          );
        },
        size: 200,
      },
      {
        accessorKey: "amount",
        header: "Amount",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            return (
              <Input
                type="number"
                value={editAmount}
                onChange={(e) => setEditAmount(e.target.value)}
                prefix="$"
                className="w-24"
              />
            );
          }
          return (
            <span
              className={cn(
                "font-medium tabular-nums",
                row.type === "income" ? "text-green-600" : "text-(--color-text)",
              )}
            >
              {row.type === "income" ? "+" : "-"}
              {formatCurrency(row.amount)}
            </span>
          );
        },
        meta: {
          align: "right" as const,
        } satisfies ColumnMeta,
        size: 100,
      },
      {
        id: "actions",
        header: "",
        cell: (info) => {
          const row = info.row.original;
          if (editingId === row.id) {
            return (
              <div className="flex gap-1">
                <Button
                  variant="secondary"
                  size="sm"
                  onClick={() => handleUpdateTransaction(row.id)}
                  className="px-2"
                >
                  <CheckIcon className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="sm" onClick={cancelEdit} className="px-2">
                  <XMarkIcon className="h-4 w-4" />
                </Button>
              </div>
            );
          }
          return (
            <div className="flex gap-0.5 opacity-0 transition-opacity group-hover:opacity-100">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => startEdit(row)}
                className="px-1.5 py-1"
              >
                <PencilIcon className="h-4 w-4" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="px-1.5 py-1 text-red-500 hover:bg-red-500/10 hover:text-red-600"
                onClick={() => handleDeleteTransaction(row.id)}
              >
                <TrashIcon className="h-4 w-4" />
              </Button>
            </div>
          );
        },
        size: 60,
      },
    ];

    return cols;
  }, [editingId, editAmount, editDescription, handleUpdateTransaction, handleDeleteTransaction]);

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {/* Inline add form */}
      <div className="flex flex-wrap items-center gap-1.5 border-b border-(--color-border) px-3 py-1.5">
        <div className="flex gap-1">
          <Button
            variant={newType === "expense" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setNewType("expense");
              setNewCategory(null);
            }}
          >
            Expense
          </Button>
          <Button
            variant={newType === "income" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => {
              setNewType("income");
              setNewCategory(null);
            }}
          >
            Income
          </Button>
        </div>

        <Menu
          triggerClassName="px-3 py-1.5 text-sm font-medium rounded-lg border border-(--color-border) bg-(--color-bg) text-(--color-text-muted) hover:text-(--color-text) hover:bg-(--color-bg-muted)"
          popupClassName="min-w-[180px]"
          side="right"
          trigger={newCategory ? getCategoryDisplayName(newCategory, newType) : "Category"}
        >
          {categories.map((cat) => (
            <MenuItem
              key={cat.id}
              onClick={() => !cat.isParent && setNewCategory(cat.id)}
              selected={newCategory === cat.id}
              className={cat.isParent ? "cursor-default font-medium text-(--color-text-muted)" : ""}
            >
              {cat.name}
            </MenuItem>
          ))}
        </Menu>

        <Input
          type="number"
          placeholder="Amount"
          value={newAmount}
          onChange={(e) => setNewAmount(e.target.value)}
          prefix="$"
          className="w-28"
        />

        <Input
          placeholder="Description (optional)"
          value={newDescription}
          onChange={(e) => setNewDescription(e.target.value)}
          className="w-48"
        />

        <DatePicker value={newDate} onChange={(date) => setNewDate(date)} placeholder="Date" />

        <Button
          variant={!newCategory || !newAmount ? "outline" : "secondary"}
          size="sm"
          onClick={handleAddTransaction}
          disabled={!newCategory || !newAmount}
        >
          Add
        </Button>

        <div className="flex-1" />

        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf"
          onChange={handleFileSelect}
          className="hidden"
        />
        <Button
          variant="ghost"
          size="sm"
          onClick={() => fileInputRef.current?.click()}
          disabled={isImporting}
        >
          {isImporting ? "Importing..." : "Import PDF"}
        </Button>
      </div>

      {rows.length === 0 ? (
        <div className="flex flex-1 items-center justify-center text-(--color-text-muted)">
          No transactions recorded yet
        </div>
      ) : (
        <div className="min-h-0 flex-1 overflow-hidden">
          <Table
            data={rows}
            columns={columns}
            storageKey={`transactions-table-${year ?? "all"}`}
            getRowClassName={() => "group"}
          />
        </div>
      )}
    </div>
  );
}
