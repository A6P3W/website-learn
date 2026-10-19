interface HelloResponse {
  message: string;
  time: string;
}

export default {
  async fetch(request: Request): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/hello') {
      const data: HelloResponse = {
        message: 'こんにちは、Cloudflare Workers！',
        time: new Date().toISOString(),
      };

      return Response.json(data, {
        headers: {
          'Cache-Control': 'no-store',
        },
      });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
} satisfies ExportedHandler;
