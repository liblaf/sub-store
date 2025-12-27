import {
  createHtmlFromOpenApi,
  createMarkdownFromOpenApi,
} from "@scalar/openapi-to-markdown";
import type { RequestMethod } from "@worker/utils/route";
import { register } from "@worker/utils/route";
import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Context, Env, Schema } from "hono";
import z from "zod/v3";

export function registerLlmsRoutes<
  E extends Env,
  S extends Schema = Schema,
  BasePath extends string = "/",
>(openapi: HonoOpenAPIRouterType<E, S, BasePath>): void {
  class LlmsMarkdown extends OpenAPIRoute {
    static method: RequestMethod = "get";
    static path: string = "/llms.md";

    override schema = {
      tags: ["LLMs"],
      summary: "Markdown for LLMs",
      description: "Markdown version of the API reference (for LLMs)",
      responses: {
        200: {
          description: "OK",
          content: {
            "text/markdown": {
              schema: z.string(),
            },
          },
        },
      },
    } satisfies OpenAPIRouteSchema;

    override async handle(c: Context): Promise<Response> {
      const response = await openapi.request("/openapi.json");
      const content: string = await response.text();
      const markdown: string = await createMarkdownFromOpenApi(content);
      c.header("Content-Type", "text/markdown");
      return c.text(markdown);
    }
  }

  class LlmsHtml extends OpenAPIRoute {
    static method: RequestMethod = "get";
    static path: string = "/llms.html";

    override schema = {
      tags: ["LLMs"],
      summary: "HTML for LLMs",
      description: "HTML version of the API reference (for LLMs)",
      responses: {
        200: {
          description: "OK",
          content: {
            "text/html": {
              schema: z.string(),
            },
          },
        },
      },
    } satisfies OpenAPIRouteSchema;

    override async handle(c: Context): Promise<Response> {
      const response = await openapi.request("/openapi.json");
      const content: string = await response.text();
      const html: string = await createHtmlFromOpenApi(content);
      return c.html(html);
    }
  }

  register(openapi, LlmsMarkdown);
  register(openapi, LlmsHtml);
}
