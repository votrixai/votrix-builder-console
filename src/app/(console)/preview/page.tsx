"use client";

import { PreviewChat } from "@/components/preview/preview-chat";

export default function PreviewPage() {
  return (
    <div className="flex h-full min-h-0 w-full flex-1 flex-col overflow-hidden">
      <PreviewChat />
    </div>
  );
}
