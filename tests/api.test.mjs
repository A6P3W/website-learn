import test from 'node:test';
import assert from 'node:assert/strict';
import { randomUUID } from 'node:crypto';

const baseURL = 'http://127.0.0.1:8787';

test('メモAPIのCRUDと異常系', async () => {
  // テストごとに重複しない文章を作る
  const original = `test-${randomUUID()}`;
  const updated = `updated-${randomUUID()}`;

  try {
    // ① POST：メモを追加
    const createResponse = await fetch(`${baseURL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: original }),
    });

    assert.equal(createResponse.status, 201);

    // ② GET：追加したメモを探す
    const listResponse = await fetch(`${baseURL}/api/notes`);

    assert.equal(listResponse.status, 200);

    const list = await listResponse.json();
    const createdNote = list.notes.find((note) => note.content === original);

    assert.ok(createdNote, 'メモが保存されていません');

    const id = createdNote.id;

    // ③ PATCH：メモを更新
    const updateResponse = await fetch(`${baseURL}/api/notes/${id}`, {
      method: 'PATCH',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: updated }),
    });

    assert.equal(updateResponse.status, 200);

    // 更新結果をGETで確認
    const updatedListResponse = await fetch(`${baseURL}/api/notes`);

    const updatedList = await updatedListResponse.json();
    const updatedNote = updatedList.notes.find((note) => note.id === id);

    assert.equal(updatedNote?.content, updated);

    // ④ 不正な入力は400
    const invalidResponse = await fetch(`${baseURL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ content: '   ' }),
    });

    assert.equal(invalidResponse.status, 400);

    // ⑤ 501文字も400
    const longResponse = await fetch(`${baseURL}/api/notes`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        content: 'あ'.repeat(501),
      }),
    });

    assert.equal(longResponse.status, 400);

    // ⑥ DELETE：メモを削除
    const deleteResponse = await fetch(`${baseURL}/api/notes/${id}`, { method: 'DELETE' });

    assert.equal(deleteResponse.status, 204);

    // 削除結果をGETで確認
    const afterDeleteResponse = await fetch(`${baseURL}/api/notes`);
    const afterDelete = await afterDeleteResponse.json();

    assert.equal(
      afterDelete.notes.some((note) => note.id === id),
      false,
    );

    // ⑦ 削除済みのIDは404
    const missingResponse = await fetch(`${baseURL}/api/notes/${id}`, { method: 'DELETE' });

    assert.equal(missingResponse.status, 404);

    // ⑧ 許可されていないメソッドは405
    const methodResponse = await fetch(`${baseURL}/api/notes`, { method: 'PUT' });

    assert.equal(methodResponse.status, 405);
  } finally {
    // テスト途中で失敗しても残ったテストデータを掃除
    try {
      const response = await fetch(`${baseURL}/api/notes`);

      if (response.ok) {
        const data = await response.json();

        for (const note of data.notes) {
          if (note.content === original || note.content === updated) {
            await fetch(`${baseURL}/api/notes/${note.id}`, { method: 'DELETE' });
          }
        }
      }
    } catch {
      // サーバー停止中などは掃除できない
    }
  }
});
