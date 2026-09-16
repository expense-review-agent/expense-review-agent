import { AppShell } from "./AppShell";
import { useRoute, closeCase } from "./router";
import { QueuePage } from "../features/queue/QueuePage";
import { ClosedCasesPage } from "../features/closed/ClosedCasesPage";
import { PoliciesPage } from "../features/policies/PoliciesPage";
import { CaseDrawer } from "../features/detail/CaseDrawer";

export function App() {
  const route = useRoute();

  return (
    <AppShell page={route.name}>
      {route.name === "policies" ? (
        <PoliciesPage />
      ) : route.name === "closed" ? (
        <ClosedCasesPage activeCaseId={route.caseId} />
      ) : (
        <QueuePage activeCaseId={route.caseId} />
      )}
      {route.caseId && (
        <CaseDrawer
          key={route.caseId}
          caseId={route.caseId}
          page={route.name}
          onClose={() => closeCase(route.name)}
        />
      )}
    </AppShell>
  );
}
