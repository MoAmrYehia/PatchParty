import { createRoot } from "react-dom/client";
import PatchParty from "../app/components/PatchParty";
import "../app/globals.css";

const root = document.getElementById("root");
if (!root) throw new Error("Patch Party root element is missing.");
createRoot(root).render(<PatchParty initialStage={new URLSearchParams(location.search).has("stage")} />);
