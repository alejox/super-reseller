import { Suspense } from "react";
import { DeliveryWorkspace } from "./delivery-workspace";

export default function DeliveryPage({ params }: { params: { id: string } }) {
  return (
    <Suspense fallback={<div className="p-10 text-[#cbc3d7]">Loading delivery details...</div>}>
      <DeliveryWorkspace accountId={params.id} />
    </Suspense>
  );
}
