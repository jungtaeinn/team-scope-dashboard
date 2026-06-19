import { CHANGELOG } from '@/lib/changelog';

export default function ChangelogPage() {
  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Changelog</h1>
        <p className="mt-1 text-sm text-[var(--muted-foreground)]">버전별 변경 사항을 확인할 수 있습니다.</p>
      </div>

      <div className="space-y-4">
        {CHANGELOG.map((release) => (
          <article key={`${release.version}-${release.date}`} className="rounded-xl border bg-[var(--card)] p-5 shadow-sm">
            <div className="mb-4">
              <p className="text-xs font-medium text-[var(--muted-foreground)]">{release.date}</p>
              <h2 className="text-lg font-semibold text-[var(--card-foreground)]">
                v{release.version} · {release.title}
              </h2>
            </div>

            <div className="space-y-4 text-sm text-[var(--muted-foreground)]">
              {release.added.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-[var(--card-foreground)]">Added</h3>
                  <ul className="space-y-1">
                    {release.added.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {release.changed.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-[var(--card-foreground)]">Changed</h3>
                  <ul className="space-y-1">
                    {release.changed.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </section>
              )}

              {release.fixed.length > 0 && (
                <section className="space-y-2">
                  <h3 className="font-semibold text-[var(--card-foreground)]">Fixed</h3>
                  <ul className="space-y-1">
                    {release.fixed.map((item) => (
                      <li key={item}>• {item}</li>
                    ))}
                  </ul>
                </section>
              )}
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
