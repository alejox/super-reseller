import { logout } from "@/modules/identity/application/actions";
import { Button } from "./_components/ui/button";

/**
 * A plain form, not an onClick handler: logging out is a mutation, and a
 * form POST keeps it working without JavaScript.
 */
export function LogoutButton() {
  return (
    <form action={logout}>
      <Button type="submit" variant="outline">
        Cerrar sesión
      </Button>
    </form>
  );
}
