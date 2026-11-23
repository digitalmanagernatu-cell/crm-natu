import { graphStore } from "./graph";
import { localStore } from "./local";
import type { Store } from "./store";
import { usaExcel } from "./source";

/** DATA_SOURCE=excel usa el Excel de SharePoint; cualquier otro valor, el JSON local. */
export const store: Store = usaExcel() ? graphStore : localStore;
