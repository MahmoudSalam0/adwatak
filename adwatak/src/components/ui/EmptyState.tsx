import { cn } from "@/lib/utils";
import { PackageOpen } from "lucide-react";

interface EmptyStateProps {
  title?: string;
  description?: string;
  className?: string;
}

export default function EmptyState({
  title = "لا توجد أدوات متاحة",
  description = "ستتم إضافة الأدوات قريبًا.",
  className,
}: EmptyStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center py-20 text-center",
        className
      )}
    >
      <PackageOpen className="h-16 w-16 text-gray-600 mb-4" />
      <h3 className="text-xl font-semibold text-gray-300 mb-2">{title}</h3>
      <p className="text-gray-500">{description}</p>
    </div>
  );
}
