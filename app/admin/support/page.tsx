import { Suspense } from "react";
import { SupportWorkspace } from "./support-workspace";

export const metadata = {
  title: "Soporte | StreamPanel",
};

export default function SupportPage() {
  return (
    <Suspense fallback={<div className="p-10 text-white">Cargando tickets...</div>}>
      <SupportWorkspace />
    </Suspense>
  );
}
