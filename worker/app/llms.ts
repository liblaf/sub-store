import {
  createHtmlFromOpenApi,
  createMarkdownFromOpenApi,
} from "@scalar/openapi-to-markdown";
import type { HonoOpenAPIRouterType, OpenAPIRouteSchema } from "chanfana";
import { OpenAPIRoute } from "chanfana";
import type { Context, Env, Schema } from "hono";
import z from "zod";

export function registerLlmsRoutes<
  E extends Env,
  S extends Schema,
  BasePath extends string,
>(
  openapi: HonoOpenAPIRouterType<E, S, BasePath>,
): HonoOpenAPIRouterType<E, S, BasePath> {
  class LlmsMarkdown extends OpenAPIRoute {
    override schema: OpenAPIRouteSchema = {
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
    };

    override async handle(c: Context): Promise<Response> {
      const response = await openapi.request("/openapi.json");
      const content: string = await response.text();
      const markdown: string = await createMarkdownFromOpenApi(content);
      return c.text(markdown, 200, { "Content-Type": "text/markdown" });
    }
  }

  class LlmsHtml extends OpenAPIRoute {
    override schema: OpenAPIRouteSchema = {
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
    };

    override async handle(c: Context): Promise<Response> {
      const response = await openapi.request("/openapi.json");
      const content: string = await response.text();
      const html: string = await createHtmlFromOpenApi(content);
      return c.html(html);
    }
  }

  openapi.get("/llms.html", LlmsHtml);
  openapi.get("/llms.md", LlmsMarkdown);
  return openapi;
}
