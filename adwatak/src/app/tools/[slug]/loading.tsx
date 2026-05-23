import { Loader2 } from "lucide-react";

export default function ToolLoading() {
  return (
    <div className="flex min-h-screen items-center justify-center">
      <Loader2 className="h-10 w-10 animate-spin text-primary-500" />
    </div>
  );
}
