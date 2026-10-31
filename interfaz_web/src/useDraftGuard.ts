import { useEffect } from "react";
import { registerTeamDraft } from "./teamDraftGuard";

export function useDraftGuard(dirty:boolean) {
  useEffect(() => {
    if (!dirty) return;
    const unregister=registerTeamDraft();
    const warn=(event:BeforeUnloadEvent)=>{event.preventDefault();event.returnValue="";};
    window.addEventListener("beforeunload",warn);
    return ()=>{unregister();window.removeEventListener("beforeunload",warn);};
  },[dirty]);
}
