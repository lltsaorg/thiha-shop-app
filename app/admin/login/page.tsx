"use client";
import { useSearchParams } from "next/navigation";
import { useState } from "react";

export default function AdminLoginPage() {
  const searchParams = useSearchParams();
  const next = searchParams.get("next") || "/admin";
  const error = searchParams.get("error");
  const [pass, setPass] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [showPass, setShowPass] = useState(false);

  return (
    <div style={{ maxWidth: 420, margin: "64px auto", padding: 24 }}>
      <h1 style={{ fontSize: 20, fontWeight: 600, marginBottom: 8 }}>
        Admin Gate
      </h1>
      <p style={{ color: "#666", marginBottom: 16 }}>
        パスワードを入力してください。
      </p>
      {error && (
        <div style={{ color: "#b91c1c", marginBottom: 8 }}>
          パスワードが違います。
        </div>
      )}
      <form
        method="POST"
        action="/api/admin/login"
        onSubmit={() => setSubmitting(true)}
      >
        <input type="hidden" name="next" value={next} />
        <div style={{ position: "relative", marginBottom: 12 }}>
          <input
            type={showPass ? "text" : "password"}
            name="pass"
            value={pass}
            onChange={(e) => setPass(e.target.value)}
            placeholder="パスワード"
            style={{
              width: "100%",
              padding: "10px 12px",
              paddingRight: 88,
              border: "1px solid #ccc",
              borderRadius: 6,
            }}
            autoFocus
          />
          <button
            type="button"
            onClick={() => setShowPass((v) => !v)}
            aria-label={showPass ? "パスワードを隠す" : "パスワードを表示"}
            style={{
              position: "absolute",
              right: 8,
              top: "50%",
              transform: "translateY(-50%)",
              padding: "6px 10px",
              borderRadius: 6,
              border: "1px solid #ccc",
              background: "#f9fafb",
              cursor: "pointer",
            }}
          >
            {showPass ? "隠す" : "表示"}
          </button>
        </div>
        <button
          type="submit"
          disabled={submitting || pass.length === 0}
          style={{
            width: "100%",
            padding: "10px 12px",
            borderRadius: 6,
            background: "#111827",
            color: "#fff",
            border: 0,
            cursor: submitting ? "not-allowed" : "pointer",
          }}
        >
          {submitting ? "送信中..." : "ログイン"}
        </button>
      </form>
    </div>
  );
}
