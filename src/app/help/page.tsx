import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";

// Internal rule: Every future build pass must update the Help page if user-facing workflow, import/export behaviour, statuses, filters, required fields, or navigation changes.
export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" subtitle="Practical guidance for reconstruction, imports, and evidence hygiene." actions={<Link className="button" href="/sessions?import=1">Import Calendar</Link>} />

      <SectionCard title="What this app is for"><p>This app tracks writing sessions, songs/works, evidence links, pitches, cuts, registrations, disputes, and follow-ups.</p></SectionCard>
      <SectionCard title="Sessions vs Songs/Works"><p>Sessions are the diary/calendar layer. Songs/works are where copyright/admin tracking lives. Session detail pages are the main enrichment workspace. Edits made there automatically update Songs/Works records, and evidence entered once is reused everywhere. Imported calendar events may start empty and should be enriched later.</p></SectionCard>
      <SectionCard title="How to import your calendar"><p>The app currently supports calendar file import (.ics), not live Google sync yet. Manual sessions can be added from onboarding or from the Sessions page.</p><p className="helper" style={{ marginTop: ".5rem" }}>Date fields use calendar picker inputs for faster and more accurate entry.</p></SectionCard>

      <SectionCard title="How to export from Google Calendar">
        <details open><summary>Instructions</summary><ol style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Open Google Calendar on desktop.</li><li>Click Settings.</li><li>Go to Import &amp; export.</li><li>Choose Export.</li><li>Google downloads a .zip file.</li><li>Unzip it.</li><li>Find the .ics file for the calendar you want.</li><li>Upload that .ics file into this app using Import Calendar.</li></ol></details>
        <p style={{ marginTop: "0.7rem" }}>If the calendar is shared with you and does not appear in your export zip, ask the calendar owner to export the calendar or provide an ICS link/export file.</p>
      </SectionCard>

      <SectionCard title="How to export from Apple Calendar / iCal">
        <details open><summary>Instructions</summary><ol style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Open Apple Calendar on Mac.</li><li>Select the calendar.</li><li>Go to File &gt; Export &gt; Export.</li><li>Save the .ics file.</li><li>Upload that .ics file into this app using Import Calendar.</li></ol></details>
      </SectionCard>

      <SectionCard title="What happens after import"><ul style={{ paddingLeft: "1.2rem" }}><li>Events become session records.</li><li>Imported records can be edited/deleted.</li><li>Songs/works and assets can be added afterwards.</li><li>Duplicates are only warned, not automatically overwritten.</li></ul></SectionCard>
      <SectionCard title="Evidence checklist basics"><p><strong>Required assets</strong></p><ul style={{ paddingLeft: "1.2rem" }}><li>Bounce link</li><li>Lyrics link</li></ul><p style={{ marginTop: "0.6rem" }}><strong>Optional assets</strong></p><ul style={{ paddingLeft: "1.2rem" }}><li>voice note link</li><li>Google Doc link</li><li>Apple Note reference/link</li><li>instrumental link</li><li>acapella link</li><li>Dropbox folder link</li><li>emails/messages</li><li>screenshots</li><li>session file/project link</li><li>other evidence</li></ul></SectionCard>
      <SectionCard title="Recommended Backfill Workflow"><ul style={{ paddingLeft: "1.2rem" }}><li>Start recent-first.</li><li>Work backwards by year.</li><li>Prioritise commercially relevant songs first.</li><li>Recent sessions are easier to recover.</li><li>Calendar import can later fill gaps.</li><li>Use Archive Progress to track what date ranges are complete.</li></ul></SectionCard>

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
    </div>
  );
}
