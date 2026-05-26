import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";

// Internal rule: Every future build pass must update the Help page if user-facing workflow, import/export behaviour, statuses, filters, required fields, or navigation changes.
export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" subtitle="Practical guidance for reconstruction, imports, and evidence hygiene." actions={<Link className="button" href="/sessions?import=1">Import Calendar</Link>} />

      <SectionCard title="What this app is for"><p>This app tracks writing sessions, songs/works, evidence links, pitches, cuts, registrations, disputes, and follow-ups.</p></SectionCard>
      <SectionCard title="Sessions vs Songs/Works"><p>Sessions are the diary/calendar layer. Songs/works are where copyright/admin tracking lives. Session detail pages are the main enrichment workspace. Edits made there automatically update Songs/Works records, and evidence entered once is reused everywhere. Imported calendar events may start empty and should be enriched later.</p><p className="helper" style={{ marginTop: ".5rem" }}>Writers are saved as reusable records. In Session Workspace, roles can be selected or custom typed, and blank splits are assumed equal temporarily.</p></SectionCard>
      <SectionCard title="How to import your calendar"><p>The app currently supports calendar file import (.ics), not live Google sync yet. Manual sessions can be added from onboarding or from the Sessions page.</p><p className="helper" style={{ marginTop: ".5rem" }}>A shared Google calendar is embedded directly inside Sessions as a temporary reference while logging records manually.</p><p className="helper" style={{ marginTop: ".5rem" }}>Date fields use calendar picker inputs for faster and more accurate entry.</p></SectionCard>

      <SectionCard title="How to export from Google Calendar">
        <details open><summary>Instructions</summary><ol style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Open Google Calendar on desktop.</li><li>Click Settings.</li><li>Go to Import &amp; export.</li><li>Choose Export.</li><li>Google downloads a .zip file.</li><li>Unzip it.</li><li>Find the .ics file for the calendar you want.</li><li>Upload that .ics file into this app using Import Calendar.</li></ol></details>
        <p style={{ marginTop: "0.7rem" }}>If the calendar is shared with you and does not appear in your export zip, ask the calendar owner to export the calendar or provide an ICS link/export file.</p>
      </SectionCard>

      <SectionCard title="How to export from Apple Calendar / iCal">
        <details open><summary>Instructions</summary><ol style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Open Apple Calendar on Mac.</li><li>Select the calendar.</li><li>Go to File &gt; Export &gt; Export.</li><li>Save the .ics file.</li><li>Upload that .ics file into this app using Import Calendar.</li></ol></details>
      </SectionCard>

      <SectionCard title="What happens after import"><ul style={{ paddingLeft: "1.2rem" }}><li>Events become session records.</li><li>Imported records can be edited/deleted.</li><li>Songs/works and assets can be added afterwards.</li><li>Duplicates are only warned, not automatically overwritten.</li></ul></SectionCard>
      <SectionCard title="Song Tags & Exports">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Tags can be typed new or reused from saved suggestions.</li>
          <li>New tags become future suggestions automatically.</li>
          <li>Use tags for genre, vocal type, mood, pitch use, and workflow markers.</li>
          <li>Songs/Works search includes title, status, writers, and tags.</li>
          <li>Filtered Songs/Works lists can be exported as CSV for catalogue/admin follow-up.</li>
        </ul>
      </SectionCard>
      <SectionCard title="Evidence checklist basics"><p><strong>Required assets</strong></p><ul style={{ paddingLeft: "1.2rem" }}><li>Bounce link</li><li>Lyrics link</li></ul><p style={{ marginTop: "0.6rem" }}><strong>Optional assets</strong></p><ul style={{ paddingLeft: "1.2rem" }}><li>voice note link</li><li>Google Doc link</li><li>Apple Note reference/link</li><li>instrumental link</li><li>acapella link</li><li>Dropbox folder link</li><li>emails/messages</li><li>screenshots</li><li>session file/project link</li><li>other evidence</li></ul></SectionCard>
      <SectionCard title="Evidence Strength Levels">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li><strong>Not Set</strong>: no reliable evidence profile yet.</li>
          <li><strong>Weak</strong>: basic session/work info only, little or no corroborating evidence.</li>
          <li><strong>Partial</strong>: bounce or lyrics exists, with some supporting evidence.</li>
          <li><strong>Strong</strong>: bounce + lyrics and multiple corroborating items (writers/links/supporting material mostly in place).</li>
          <li><strong>Complete</strong>: admin/dispute-ready archive position with core evidence, writers/splits, and missing items resolved or tracked by follow-up.</li>
        </ul>
        <p className="helper" style={{ marginTop: ".6rem" }}>Evidence Strength is auto-calculated from checklist coverage, but can be manually overridden when needed.</p>
        <p className="helper" style={{ marginTop: ".4rem" }}><strong>Apple Note Exists</strong> is useful even without a share link because note existence/history can still support evidence context.</p>
      </SectionCard>
      <SectionCard title="Recommended Backfill Workflow"><ul style={{ paddingLeft: "1.2rem" }}><li>Start recent-first.</li><li>Work backwards by year.</li><li>Prioritise commercially relevant songs first.</li><li>Recent sessions are easier to recover.</li><li>Calendar import can later fill gaps.</li><li>Use Archive Progress to track what date ranges are complete.</li></ul></SectionCard>

      <SectionCard title="How to conduct an Archive Review"><ul style={{ paddingLeft: "1.2rem" }}><li>Work by date/year and open each session workspace.</li><li>Add known songs, writers, and assets/evidence links.</li><li>Use the checklist/warnings to identify missing bounce, lyrics, writers, splits, and supporting links.</li><li>Add follow-up actions for anything missing.</li><li>Use auto Evidence Strength as baseline, override only when context requires it.</li><li>Mark Archive Reviewed only once you have checked what is reasonably available.</li></ul><p className="helper" style={{ marginTop: ".6rem" }}>Reviewed does not mean complete. It means the session has been checked at least once.</p></SectionCard>

      <SectionCard title="How to connect Supabase">
        <ol style={{ paddingLeft: "1.2rem" }}>
          <li>Create a Supabase project.</li>
          <li>Copy the Project URL from project settings.</li>
          <li>Copy the anon public key.</li>
          <li>Add both values to <code>.env.local</code>:</li>
        </ol>
        <pre style={{ marginTop: ".6rem", padding: ".7rem", background: "#f4eee8", borderRadius: "10px", overflowX: "auto" }}><code>{`NEXT_PUBLIC_SUPABASE_URL=your_project_url\nNEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key`}</code></pre>
        <p className="helper" style={{ marginTop: ".6rem" }}>If writes fail after setup, re-run the latest <code>schema.sql</code> in Supabase to apply updated dev policies.</p>
        <p className="helper" style={{ marginTop: ".4rem" }}>Dev policies are temporary and must be replaced with authenticated user policies before production.</p>
      </SectionCard>

      <SectionCard title="Supabase Storage setup">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Create a private bucket named <code>pitch-audio</code> in Supabase Storage.</li>
          <li>Run the storage policy SQL from <code>supabase/schema.sql</code>.</li>
          <li>For pitching, compressed MP3/M4A is recommended.</li>
        </ul>
        <p className="helper" style={{ marginTop: ".6rem" }}>Pitch audio is stored once on the Song/Work. Removing pitch audio affects playlists using that Song/Work.</p>
        <p className="helper" style={{ marginTop: ".4rem" }}>A playlist track may remain, but playback will be unavailable until audio is re-uploaded.</p>
        <p className="helper" style={{ marginTop: ".4rem" }}>Dropbox remains your archive. Supabase audio is the pitch playback copy.</p>
      </SectionCard>

      <SectionCard title="Private Pitch Playlists">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Create private playlists for pitching from saved Songs/Works only.</li>
          <li>Audio upload is optional until pitching.</li>
          <li>When a selected song has no pitch audio, select a file first, then click Upload & Add to Playlist to confirm upload.</li>
          <li>Dropbox can remain your archive/master storage location.</li>
          <li>Generate a share link for recipients.</li>
          <li>Recipients can stream through a custom playlist player with hidden download UX.</li>
          <li>Playlist views, track plays, completed listens, and recipient responses are tracked internally for follow-up.</li>
          <li>Interested/Hold/Pass/Feedback form responses are saved internally and also prepared as an email enquiry.</li>
          <li>Password and expiry controls are available.</li>
          <li>Direct uploads may be added later.</li>
        </ul>
        <p className="helper" style={{ marginTop: ".6rem" }}>Dropbox remains your archive. Supabase audio is only the pitch playback copy used for private playlists.</p>
        <p className="helper" style={{ marginTop: ".4rem" }}>Public pitch pages now use a custom streaming playlist player with lightweight Interested/Hold/Pass/Feedback actions and hidden download buttons, but browser audio can still technically be captured.</p>
      </SectionCard>
    </div>
  );
}
