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

    // 認証・認可の学習用API
    if (url.pathname === '/api/auth-demo') {
      // 設定の不備を確認
      if (
        !env.DEMO_READ_TOKEN ||
        !env.DEMO_WRITE_TOKEN ||
        env.DEMO_READ_TOKEN === env.DEMO_WRITE_TOKEN
      ) {
        return Response.json({ error: 'トークンの設定が不正です' }, { status: 503 });
      }

      // Authorizationヘッダーを取得
      const authorization = request.headers.get('Authorization');

      // トークンを確認する
      const isReader = authorization === `Bearer ${env.DEMO_READ_TOKEN}`;

      const isWriter = authorization === `Bearer ${env.DEMO_WRITE_TOKEN}`;

      // 認証失敗
      if (!isReader && !isWriter) {
        return Response.json(
          { error: '認証が必要です' },
          {
            status: 401,
            headers: {
              'WWW-Authenticate': 'Bearer realm="auth-demo"',
            },
          },
        );
      }

      // GETは閲覧者・編集者の両方を許可
      if (request.method === 'GET') {
        return Response.json({
          message: '閲覧を許可しました',
          role: isWriter ? 'writer' : 'reader',
        });
      }

      // POSTは編集者だけを許可
      if (request.method === 'POST') {
        if (!isWriter) {
          return Response.json({ error: '書き込み権限がありません' }, { status: 403 });
        }

        return Response.json({
          message: '書き込みを許可しました（学習用：DB変更なし）',
        });
      }

      return Response.json(
        { error: 'Method Not Allowed' },
        {
          status: 405,
          headers: { Allow: 'GET, POST' },
        },
      );
    }

    if (url.pathname === '/api/notes') {
      // GET：メモ一覧を取得
      if (request.method === 'GET') {
        const result = await env.DB.prepare(
          'SELECT id, content, created_at FROM notes ORDER BY id DESC',
        ).all<Note>();

        return Response.json(
          { notes: result.results },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      // POST：新しいメモを保存
      if (request.method === 'POST') {
        let body: unknown;

        try {
          body = await request.json();
        } catch {
          return Response.json({ error: '正しいJSONを送信してください' }, { status: 400 });
        }

        // 受信したデータの型を確認
        if (
          typeof body !== 'object' ||
          body === null ||
          !('content' in body) ||
          typeof body.content !== 'string'
        ) {
          return Response.json({ error: 'contentには文字列を指定してください' }, { status: 400 });
        }

        const content = body.content.trim();

        // 空文字列や長すぎるメモを拒否
        if (content.length === 0 || content.length > 500) {
          return Response.json({ error: 'メモは1〜500文字で入力してください' }, { status: 400 });
        }

        // D1にメモを保存
        await env.DB.prepare('INSERT INTO notes (content) VALUES (?)').bind(content).run();

        return Response.json(
          { message: 'メモを保存しました' },
          {
            status: 201,
            headers: { 'Cache-Control': 'no-store' },
          },
        );
      }

      // GETとPOST以外は拒否
      return Response.json(
        { error: 'Method Not Allowed' },
        {
          status: 405,
          headers: { Allow: 'GET, POST' },
        },
      );
    }

    // IDを指定したメモの更新・削除
    if (url.pathname.startsWith('/api/notes/')) {
      const idText = url.pathname.slice('/api/notes/'.length);
      const id = Number(idText);

      // 正しいIDか確認
      if (!/^[1-9]\d*$/.test(idText) || !Number.isSafeInteger(id)) {
        return Response.json({ error: 'IDが不正です' }, { status: 400 });
      }

      // PATCH：メモを更新する
      if (request.method === 'PATCH') {
        let body: unknown;

        try {
          body = await request.json();
        } catch {
          return Response.json({ error: '正しいJSONを送信してください' }, { status: 400 });
        }

        if (
          typeof body !== 'object' ||
          body === null ||
          !('content' in body) ||
          typeof body.content !== 'string'
        ) {
          return Response.json({ error: 'contentには文字列を指定してください' }, { status: 400 });
        }

        const content = body.content.trim();

        if (content.length === 0 || content.length > 500) {
          return Response.json({ error: 'メモは1〜500文字で入力してください' }, { status: 400 });
        }

        const result = await env.DB.prepare('UPDATE notes SET content = ? WHERE id = ?')
          .bind(content, id)
          .run();

        if (result.meta.changes === 0) {
          return Response.json({ error: 'メモが見つかりません' }, { status: 404 });
        }

        return Response.json(
          { message: '更新しました', id, content },
          { headers: { 'Cache-Control': 'no-store' } },
        );
      }

      // DELETE：メモを削除する
      if (request.method === 'DELETE') {
        const result = await env.DB.prepare('DELETE FROM notes WHERE id = ?').bind(id).run();

        if (result.meta.changes === 0) {
          return Response.json({ error: 'メモが見つかりません' }, { status: 404 });
        }

        return new Response(null, { status: 204 });
      }

      return Response.json(
        { error: 'Method Not Allowed' },
        {
          status: 405,
          headers: { Allow: 'PATCH, DELETE' },
        },
      );
    }

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
