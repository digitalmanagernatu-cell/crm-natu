import { graphStore } from "./graph";
import { localStore } from "./local";
import type { Store } from "./store";

/** DATA_SOURCE=excel usa el Excel de SharePoint; cualquier otro valor, el JSON local. */
export const store: Store = process.env.DATA_SOURCE === "excel" ? graphStore : localStore;
