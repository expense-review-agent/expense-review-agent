import { AppShell } from "./AppShell";
import { useRoute, closeCase } from "./router";
import { QueuePage } from "../features/queue/QueuePage";
import { CaseDrawer } from "../features/detail/CaseDrawer";

export function App() {
  const route = useRoute();

  return (
    <AppShell>
      <QueuePage activeCaseId={route.caseId} />
      {route.caseId && <CaseDrawer key={route.caseId} caseId={route.caseId} onClose={closeCase} />}
    </AppShell>
  );
}
