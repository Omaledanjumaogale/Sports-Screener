/* eslint-disable */
/**
 * Generated code for Convex.
 *
 * If you're using `convex dev` this file should be written within a few
 * seconds of saving Convex functions. If not, or if you have any other
 * trouble with this file, run `npx convex codegen`.
 */
import type {
  ActionBuilderForAPI,
  MutationBuilderForAPI,
  QueryBuilderForAPI,
  GenericActionCtx,
  GenericMutationCtx,
  GenericQueryCtx,
  FunctionVisibility,
} from "convex/server";

/**
 * The type of the Convex functions in this module.
 */
export type API = {
  savedScreeners: {
    list: {
      args: { sportId?: "football" | "basketball" | "tennis" | "rally"; sessionId: string };
      returns: { _id: any; sportId: "football" | "basketball" | "tennis" | "rally"; title: string; notes?: string; scopes: any; verdict?: any; sessionId: string; createdAt: number; updatedAt: number }[];
      visibility: FunctionVisibility;
    };
    save: {
      args: { sportId: "football" | "basketball" | "tennis" | "rally"; title: string; notes?: string; scopes: any; verdict?: any; sessionId: string; _id?: any };
      returns: any;
      visibility: FunctionVisibility;
    };
    remove: {
      args: { id: any; sessionId: string };
      returns: null;
      visibility: FunctionVisibility;
    };
    update: {
      args: { id: any; sessionId: string; title?: string; notes?: string; scopes?: any; verdict?: any };
      returns: null;
      visibility: FunctionVisibility;
    };
    get: {
      args: { id: any };
      returns: { _id: any; sportId: "football" | "basketball" | "tennis" | "rally"; title: string; notes?: string; scopes: any; verdict?: any; sessionId: string; createdAt: number; updatedAt: number } | null;
      visibility: FunctionVisibility;
    };
  };
};

/**
 * Get a typesafe Convex client to use in components.
 */
export declare const api: {
  savedScreeners: {
    list: ((args: { sportId?: "football" | "basketball" | "tennis" | "rally"; sessionId: string }) => any) & { isConvexQuery: true; exportPath: string };
    save: ((args: { sportId: "football" | "basketball" | "tennis" | "rally"; title: string; notes?: string; scopes: any; verdict?: any; sessionId: string; _id?: any }) => any) & { isConvexMutation: true; exportPath: string };
    remove: ((args: { id: any; sessionId: string }) => any) & { isConvexMutation: true; exportPath: string };
    update: ((args: { id: any; sessionId: string; title?: string; notes?: string; scopes?: any; verdict?: any }) => any) & { isConvexMutation: true; exportPath: string };
    get: ((args: { id: any }) => any) & { isConvexQuery: true; exportPath: string };
  };
};
