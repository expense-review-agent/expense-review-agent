import { AppShell } from "./AppShell";
import { useSelectedCaseNumber } from "./router";
import { WorkbenchPage } from "../features/workbench/WorkbenchPage";

export function App() {
  const selectedCaseNumber = useSelectedCaseNumber();
  return (
    <AppShell caseOpen={selectedCaseNumber !== null}>
      <WorkbenchPage selectedCaseNumber={selectedCaseNumber} />
    </AppShell>
  );
}
