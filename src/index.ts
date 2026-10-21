interface HelloResponse {
  message: string;
  time: string;
}

interface Note {
  id: number;
  content: string;
  created_at: string;
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);

    // メモ一覧を取得するAPI
    if (url.pathname === '/api/notes') {
      if (request.method !== 'GET') {
        return new Response('Method Not Allowed', {
          status: 405,
          headers: { Allow: 'GET' },
        });
      }

      const statement = env.DB.prepare(
        'SELECT id, content, created_at FROM notes ORDER BY id DESC',
      );

      const result = await statement.all<Note>();

      return Response.json({ notes: result.results }, { headers: { 'Cache-Control': 'no-store' } });
    }

    // 前回作成したAPI
    if (url.pathname === '/api/hello') {
      const data: HelloResponse = {
        message: 'こんにちは、Cloudflare Workers！',
        time: new Date().toISOString(),
      };

      return Response.json(data, {
        headers: { 'Cache-Control': 'no-store' },
      });
    }

    return Response.json({ error: 'Not Found' }, { status: 404 });
  },
} satisfies ExportedHandler<Env>;
