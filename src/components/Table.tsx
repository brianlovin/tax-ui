import {
  type ColumnDef,
  type ColumnSizingState,
  flexRender,
  getCoreRowModel,
  useReactTable,
} from "@tanstack/react-table";
import { useState, useEffect, useRef, useCallback } from "react";
import { cn } from "../lib/cn";

export interface ColumnMeta {
  align?: "left" | "right";
  borderLeft?: boolean;
  sticky?: boolean;
}

interface TableProps<TData> {
  data: TData[];
  columns: ColumnDef<TData, unknown>[];
  storageKey?: string;
  getRowClassName?: (row: TData, index: number) => string;
  isRowHoverDisabled?: (row: TData) => boolean;
}

export function Table<TData>({ data, columns, storageKey, getRowClassName, isRowHoverDisabled }: TableProps<TData>) {
  const [isScrolled, setIsScrolled] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const updateScrollState = useCallback(() => {
    if (containerRef.current) {
      setIsScrolled(containerRef.current.scrollLeft > 0);
    }
  }, []);

  useEffect(() => {
    const container = containerRef.current;
    if (container) {
      container.addEventListener("scroll", updateScrollState);
      // Check initial scroll state
      updateScrollState();
      return () => container.removeEventListener("scroll", updateScrollState);
    }
  }, [updateScrollState, data]); // Re-run when data changes

  // Mobile detection
  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth < 768);
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  // Lock scroll direction on mobile to prevent disorienting diagonal scrolling
  useEffect(() => {
    const container = containerRef.current;
    if (!container || !isMobile) return;

    let touchStartPos: { x: number; y: number } | null = null;
    let lockedAxis: "x" | "y" | null = null;
    let lockedScrollValue: number | null = null;
    const THRESHOLD = 5;

    const handleTouchStart = (e: TouchEvent) => {
      const touch = e.touches[0];
      if (touch) {
        touchStartPos = { x: touch.clientX, y: touch.clientY };
        lockedAxis = null;
        lockedScrollValue = null;
      }
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!touchStartPos) return;

      const touch = e.touches[0];
      if (!touch) return;

      if (lockedAxis === null) {
        const deltaX = Math.abs(touch.clientX - touchStartPos.x);
        const deltaY = Math.abs(touch.clientY - touchStartPos.y);

        if (deltaX > THRESHOLD || deltaY > THRESHOLD) {
          lockedAxis = deltaX > deltaY ? "x" : "y";
          lockedScrollValue =
            lockedAxis === "x" ? container.scrollTop : container.scrollLeft;
        }
      }
    };

    const handleScroll = () => {
      if (lockedAxis === null || lockedScrollValue === null) return;

      if (lockedAxis === "x" && container.scrollTop !== lockedScrollValue) {
        container.scrollTop = lockedScrollValue;
      } else if (
        lockedAxis === "y" &&
        container.scrollLeft !== lockedScrollValue
      ) {
        container.scrollLeft = lockedScrollValue;
      }
    };

    const handleTouchEnd = () => {
      touchStartPos = null;
    };

    container.addEventListener("touchstart", handleTouchStart, {
      passive: true,
    });
    container.addEventListener("touchmove", handleTouchMove, { passive: true });
    container.addEventListener("touchend", handleTouchEnd);
    container.addEventListener("scroll", handleScroll);

    return () => {
      container.removeEventListener("touchstart", handleTouchStart);
      container.removeEventListener("touchmove", handleTouchMove);
      container.removeEventListener("touchend", handleTouchEnd);
      container.removeEventListener("scroll", handleScroll);
    };
  }, [isMobile]);

  const [columnSizing, setColumnSizing] = useState<ColumnSizingState>(() => {
    if (storageKey && typeof window !== "undefined") {
      const saved = localStorage.getItem(`${storageKey}-column-sizes`);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // ignore
        }
      }
    }
    return {};
  });

  useEffect(() => {
    if (storageKey && Object.keys(columnSizing).length > 0) {
      localStorage.setItem(
        `${storageKey}-column-sizes`,
        JSON.stringify(columnSizing)
      );
    }
  }, [columnSizing, storageKey]);

  const table = useReactTable({
    data,
    columns,
    state: {
      columnSizing,
    },
    onColumnSizingChange: setColumnSizing,
    getCoreRowModel: getCoreRowModel(),
    enableColumnResizing: true,
    columnResizeMode: "onChange",
  });

  return (
    <div ref={containerRef} className="overflow-auto w-full h-full [-webkit-overflow-scrolling:touch] overscroll-contain">
      <table className="w-full border-collapse" style={{ minWidth: "max-content" }}>
        <thead className="sticky top-0 z-20">
          {table.getHeaderGroups().map((headerGroup) => (
            <tr key={headerGroup.id}>
              {headerGroup.headers.map((header) => {
                const meta = header.column.columnDef.meta as ColumnMeta | undefined;
                const alignClass = meta?.align === "right" ? "text-right" : "text-left";
                const stickyClass = meta?.sticky ? "sticky left-0 z-30" : "";

                const shadows = ["inset 0 -1px 0 var(--color-border)"];
                if (meta?.sticky && isScrolled) {
                  shadows.push("inset -1px 0 0 var(--color-border)");
                }
                if (meta?.borderLeft) {
                  shadows.push("inset 1px 0 0 var(--color-border)");
                }
                const headerShadow = shadows.join(", ");

                return (
                  <th
                    key={header.id}
                    colSpan={header.colSpan}
                    className={cn(
                      alignClass,
                      stickyClass,
                      "py-2 px-4 text-xs text-(--color-text-muted) font-normal relative bg-(--color-bg)",
                    )}
                    style={{
                      width: header.getSize(),
                      boxShadow: headerShadow,
                    }}
                  >
                    {header.isPlaceholder
                      ? null
                      : flexRender(header.column.columnDef.header, header.getContext())}
                    {header.column.getCanResize() && (
                      <div
                        onMouseDown={header.getResizeHandler()}
                        onTouchStart={header.getResizeHandler()}
                        className={cn("resizer", header.column.getIsResizing() && "isResizing")}
                      />
                    )}
                  </th>
                );
              })}
            </tr>
          ))}
        </thead>
        <tbody>
          {table.getRowModel().rows.map((row, index) => {
            const customClassName = getRowClassName?.(row.original, index) ?? "";
            const hoverDisabled = isRowHoverDisabled?.(row.original) ?? false;
            const rowHoverClass = hoverDisabled ? "" : "hover:bg-(--color-row-hover)";
            const noZebraClass = hoverDisabled ? "no-zebra" : "";
            return (
            <tr
              key={row.id}
              className={cn("group", rowHoverClass, noZebraClass, customClassName)}
            >
              {row.getVisibleCells().map((cell) => {
                const meta = cell.column.columnDef.meta as ColumnMeta | undefined;
                const stickyCellHover = hoverDisabled ? "" : "group-hover:bg-(--color-row-hover)";
                const stickyClass = meta?.sticky
                  ? `sticky left-0 z-10 sticky-cell ${stickyCellHover}`
                  : "";
                const truncateClass = meta?.sticky ? "truncate max-w-[160px]" : "";

                const cellShadows: string[] = [];
                if (meta?.sticky && isScrolled) {
                  cellShadows.push("inset -1px 0 0 var(--color-border)");
                }
                if (meta?.borderLeft) {
                  cellShadows.push("inset 1px 0 0 var(--color-border)");
                }

                return (
                  <td
                    key={cell.id}
                    className={cn("py-2 px-4 text-sm", stickyClass, truncateClass)}
                    style={{
                      width: cell.column.getSize(),
                      ...(cellShadows.length > 0 ? { boxShadow: cellShadows.join(", ") } : {}),
                    }}
                  >
                    {flexRender(cell.column.columnDef.cell, cell.getContext())}
                  </td>
                );
              })}
            </tr>
          );
          })}
        </tbody>
      </table>
    </div>
  );
}

export { type ColumnDef } from "@tanstack/react-table";
export { createColumnHelper } from "@tanstack/react-table";
