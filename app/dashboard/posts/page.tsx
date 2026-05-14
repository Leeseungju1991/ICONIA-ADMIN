import { readSession } from "@/lib/authCookie";
import { listPosts, type PostRow } from "@/lib/adminApi";
import { hidePostAction, unhidePostAction } from "@/lib/actions/posts";
import { ConfirmActionForm } from "@/app/components/ConfirmActionForm";
import { messageForCode } from "@/lib/errorMessages";

export const dynamic = "force-dynamic";

function StatusBadge({ status }: { status: string }) {
  if (status === "hidden") return <span className="badge warn">숨김</span>;
  if (status === "taken_down") return <span className="badge err">내림</span>;
  return <span className="badge ok">공개</span>;
}

export default async function PostsPage({
  searchParams,
}: {
  searchParams: { filter?: "all" | "reported" | "hidden" };
}) {
  const jwt = readSession()!;
  const filter = searchParams.filter ?? "reported";
  const res = await listPosts({ jwt, filter, limit: 50 });

  return (
    <div className="page">
      <h1>게시물 모더레이션</h1>
      <p className="muted">신고 누적, 숨김, 내림 처리. 일반 공개 게시물은 &ldquo;전체&rdquo; 필터에서 조회. 액션은 사전 확인 + 사유 필수.</p>

      <form className="toolbar">
        <select name="filter" defaultValue={filter}>
          <option value="reported">신고됨</option>
          <option value="hidden">숨김</option>
          <option value="all">전체</option>
        </select>
        <button className="btn small" type="submit">적용</button>
      </form>

      {!res.ok ? (
        <div className="error" role="alert">{messageForCode(res.code, res.message)}</div>
      ) : res.data.items.length === 0 ? (
        <div className="empty">결과 없음</div>
      ) : (
        <table className="list">
          <thead>
            <tr>
              <th>post_id</th>
              <th>author</th>
              <th>excerpt</th>
              <th>신고</th>
              <th>반응</th>
              <th>댓글</th>
              <th>status</th>
              <th>created</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {res.data.items.map((p: PostRow) => (
              <tr key={p.post_id}>
                <td><code>{p.post_id.slice(0, 8)}…</code></td>
                <td>{p.author_handle ?? p.author_user_id.slice(0, 8)}</td>
                <td style={{ maxWidth: 320 }}>{p.body_excerpt}</td>
                <td style={{ color: p.reported_count > 0 ? "var(--error-fg)" : "inherit" }}>{p.reported_count}</td>
                <td>{p.reaction_count}</td>
                <td>{p.comment_count}</td>
                <td><StatusBadge status={p.status} /></td>
                <td>{new Date(p.created_at).toLocaleString("ko-KR")}</td>
                <td className="cell-actions">
                  {p.status === "visible" ? (
                    <ConfirmActionForm
                      action={hidePostAction}
                      hidden={{ post_id: p.post_id }}
                      confirmMessage={`이 게시물을 숨기시겠어요?\n\npost_id=${p.post_id.slice(0, 8)}…`}
                      reasonRequired
                      buttonLabel="숨김"
                      buttonClassName="btn small danger"
                    />
                  ) : p.status === "hidden" ? (
                    <ConfirmActionForm
                      action={unhidePostAction}
                      hidden={{ post_id: p.post_id }}
                      confirmMessage={`숨김을 해제하시겠어요? 게시물이 다시 공개됩니다.\n\npost_id=${p.post_id.slice(0, 8)}…`}
                      reasonRequired={false}
                      buttonLabel="숨김 해제"
                      buttonClassName="btn small secondary"
                    />
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}
