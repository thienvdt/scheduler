import { handleApi, type Env } from "../../server/api";

// Cloudflare Pages Function: mọi request /api/* được chuyển vào router.
export const onRequest: PagesFunction<Env> = (context) => handleApi(context.request, context.env);
