import {
  createHtmlFromOpenApi,
  createMarkdownFromOpenApi,
} from "@scalar/openapi-to-markdown";
import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Context, Env, Hono, Schema } from "hono";

export function registerLLMRoutes<
  E extends Env,
  S extends Schema,
  BasePath extends string,
>(
  app: Hono<E, S, BasePath>,
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): void {
  class LLMsMarkdown extends OpenAPIRoute {
    override schema: OpenAPIRouteSchema = {
      security: [],
      responses: {
        200: {
          description: "OK",
          content: {
            "text/markdown": {
              schema: {
                type: "string",
              },
            },
          },
        },
      },
    };

    override async handle(c: Context): Promise<Response> {
      const response = await app.request("/openapi.json");
      const content: string = await response.text();
      const markdown: string = await createMarkdownFromOpenApi(content);
      return c.text(markdown);
    }
  }

  class LLMsHTML extends OpenAPIRoute {
    override schema: OpenAPIRouteSchema = {
      security: [],
      responses: {
        200: {
          description: "OK",
          content: {
            "text/html": {
              schema: { type: "string" },
            },
          },
        },
      },
    };

    override async handle(c: Context): Promise<Response> {
      const response = await app.request("/openapi.json");
      const content: string = await response.text();
      const html: string = await createHtmlFromOpenApi(content);
      return c.html(html);
    }
  }

  openapi.get("/llms.html", LLMsHTML);
  openapi.get("/llms.md", LLMsMarkdown);
}
