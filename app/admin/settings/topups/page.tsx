import type { Metadata } from "next";
import { Suspense } from "react";

import {
  TopUpSettingsWorkspace,
  TopUpSettingsWorkspaceFallback,
} from "./topup-settings-workspace";

export const metadata: Metadata = {
  title: "Límites de recarga",
};

export default function TopUpSettingsPage() {
  return (
    <Suspense fallback={<TopUpSettingsWorkspaceFallback />}>
      <TopUpSettingsWorkspace />
    </Suspense>
  );
}
