'use client';

type InstagramInsightsTabProps = {
  onOpenLogin: () => void;
};

export function InstagramInsightsTab({ onOpenLogin }: InstagramInsightsTabProps): JSX.Element {
  return (
    <div className="space-y-6">
      <section className="rounded-2xl border border-deepGreen/15 bg-offWhite/90 p-6">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.3em] text-deepGreen/60">Instagram</p>
            <h3 className="text-lg font-semibold text-deepGreen">Instagram Insights (preview)</h3>
            <p className="text-sm text-deepGreen/70">
              This tab will show profile and media insights fetched from the consolidated integrations project. For Meta
              review, all labels and scopes remain in English.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={onOpenLogin}
              className="rounded-full bg-terracota px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-terracota/90"
            >
              Connect Instagram
            </button>
            <div className="flex items-center gap-2 text-xs text-deepGreen/70">
              <span className="rounded-full bg-white px-3 py-1 font-semibold text-deepGreen">
                Scopes: instagram_business_basic, instagram_basic, instagram_business_manage_insights
              </span>
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-2xl border border-deepGreen/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-deepGreen">Account overview</h4>
          <span className="rounded-full bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">Waiting API</span>
        </div>
        <p className="mt-1 text-sm text-deepGreen/70">
          We will display profile info (name, username, media count) and connection status once the Instagram endpoints
          are live.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-3">
          {["Profile", "Followers", "Media count"].map((item) => (
            <div key={item} className="rounded-xl border border-deepGreen/10 bg-offWhite/70 p-4">
              <p className="text-xs uppercase tracking-[0.2em] text-deepGreen/60">{item}</p>
              <div className="mt-2 h-4 w-24 animate-pulse rounded-full bg-deepGreen/10" />
              <div className="mt-2 h-3 w-32 animate-pulse rounded-full bg-deepGreen/5" />
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-2xl border border-deepGreen/10 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h4 className="text-base font-semibold text-deepGreen">Recent media (coming soon)</h4>
          <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700">Placeholder</span>
        </div>
        <p className="mt-1 text-sm text-deepGreen/70">
          The first version will list media items with reach, impressions, likes, and comments when the backend agent
          exposes the Instagram endpoints.
        </p>
        <div className="mt-4 grid gap-4 md:grid-cols-2">
          {[1, 2, 3, 4].map((index) => (
            <div key={index} className="rounded-xl border border-deepGreen/10 bg-offWhite/70 p-4">
              <div className="flex items-center justify-between">
                <div className="h-3 w-24 animate-pulse rounded-full bg-deepGreen/15" />
                <div className="h-3 w-12 animate-pulse rounded-full bg-deepGreen/10" />
              </div>
              <div className="mt-3 h-2 w-full animate-pulse rounded-full bg-deepGreen/10" />
              <div className="mt-2 h-2 w-3/4 animate-pulse rounded-full bg-deepGreen/10" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
