"use client";

import { type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { ArrowUpDown, ChevronLeft, ChevronRight } from "lucide-react";

interface Column<T> {
  key: string;
  header: string;
  accessor: (row: T) => ReactNode;
  sortable?: boolean;
  className?: string;
}

interface DataTableProps<T> {
  columns: Column<T>[];
  data: T[];
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  onSort?: (key: string, direction: "asc" | "desc") => void;
  sortKey?: string;
  sortDirection?: "asc" | "desc";
  loading?: boolean;
  emptyMessage?: string;
  className?: string;
}

function DataTable<T>({
  columns,
  data,
  page = 1,
  totalPages = 1,
  onPageChange,
  onSort,
  sortKey,
  sortDirection,
  loading = false,
  emptyMessage = "No data found.",
  className,
}: DataTableProps<T>) {
  if (loading) {
    return (
      <div className={cn("w-full overflow-hidden rounded-xl border border-border-default", className)}>
        <div className="bg-bg-secondary p-6">
          <div className="space-y-4">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-10 animate-pulse rounded-lg bg-bg-tertiary"
              />
            ))}
          </div>
        </div>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-xl border border-border-default bg-bg-secondary px-4 py-16",
          className
        )}
      >
        <p className="text-body text-text-tertiary">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className={cn("w-full overflow-hidden rounded-xl border border-border-default", className)}>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border-muted bg-bg-tertiary">
              {columns.map((col) => (
                <th
                  key={col.key}
                  className={cn(
                    "px-4 py-3 text-left text-label text-text-tertiary",
                    col.sortable && "cursor-pointer select-none hover:text-text-primary",
                    col.className
                  )}
                  onClick={() => {
                    if (col.sortable && onSort) {
                      const direction =
                        sortKey === col.key && sortDirection === "asc"
                          ? "desc"
                          : "asc";
                      onSort(col.key, direction);
                    }
                  }}
                >
                  <div className="flex items-center gap-1.5">
                    {col.header}
                    {col.sortable && (
                      <ArrowUpDown
                        className={cn(
                          "h-3.5 w-3.5",
                          sortKey === col.key
                            ? "text-accent-gold"
                            : "text-text-disabled"
                        )}
                      />
                    )}
                  </div>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.map((row, rowIndex) => (
              <tr
                key={rowIndex}
                className={cn(
                  "border-b border-border-muted transition-colors hover:bg-bg-tertiary/50",
                  rowIndex === data.length - 1 && "border-b-0"
                )}
              >
                {columns.map((col) => (
                  <td
                    key={col.key}
                    className={cn("px-4 py-3 text-body text-text-primary", col.className)}
                  >
                    {col.accessor(row)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between border-t border-border-muted bg-bg-secondary px-4 py-3">
          <p className="text-body-sm text-text-tertiary">
            Page {page} of {totalPages}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => onPageChange?.(page - 1)}
              disabled={page <= 1}
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-50"
              aria-label="Previous page"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button
              onClick={() => onPageChange?.(page + 1)}
              disabled={page >= totalPages}
              className="rounded-md p-1.5 text-text-tertiary transition-colors hover:text-text-primary disabled:opacity-50"
              aria-label="Next page"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export { DataTable };
export type { DataTableProps, Column };
