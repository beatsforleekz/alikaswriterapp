import Link from "next/link";
import PageHeader from "@/components/ui/PageHeader";
import SectionCard from "@/components/ui/SectionCard";

// Internal rule: Every future build pass must update the Help page if user-facing workflow, import/export behaviour, statuses, filters, required fields, or navigation changes.
export default function HelpPage() {
  return (
    <div>
      <PageHeader title="Help" subtitle="Practical guidance for reconstruction, imports, and evidence hygiene." actions={<Link className="button" href="/sessions?import=1">Import Calendar</Link>} />

      <SectionCard title="What this app is for"><p>This app tracks writing sessions, songs/works, evidence links, pitches, cuts, registrations, disputes, and follow-ups.</p></SectionCard>
      <SectionCard title="App Lock"><p>You can protect the whole internal app with a single password without setting up full user accounts.</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Set <code>APP_PASSWORD</code> in your environment to enable the login screen.</li><li>Optional: set <code>APP_SESSION_SECRET</code> to change the cookie signing secret.</li><li>The main app is password-gated, while shared public pitch pages can remain accessible separately.</li></ul></SectionCard>
      <SectionCard title="Settings Controls"><p>Use Settings to manage your profile/contact defaults, archive/evidence standards, session defaults, writer/split defaults, pitch defaults, storage preferences, and integrations status.</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Profile/contact defaults are single-user and saved in-app for this workspace.</li><li>Archive standards define your Strong/Complete expectations and review defaults.</li><li>Pitch defaults include contact email, expiry defaults, and public footer text.</li><li>Integrations section shows current setup status for Supabase, Spotify, and calendar/storage roadmap items.</li></ul></SectionCard>
      <SectionCard title="Sessions vs Songs/Works"><p>Sessions are the diary/calendar layer. Songs/works are where copyright/admin tracking lives. Session detail pages are the main enrichment workspace. Edits made there automatically update Songs/Works records, and evidence entered once is reused everywhere. Imported calendar events may start empty and should be enriched later.</p><p className="helper" style={{ marginTop: ".5rem" }}>Writers are saved as reusable records. In Session Workspace, roles can be selected or custom typed, and blank splits are assumed equal temporarily.</p></SectionCard>
      <SectionCard title="Shared Evidence Hub + Writer/Split Panel"><p>Archive Review, Session Workspace, and Song Detail now use a shared Evidence Hub and shared Writer/Split patterns for consistency.</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Evidence labels/types are normalised consistently (Bounce, Lyrics, Apple Note, etc.).</li><li>Duplicate evidence links for the same song/type are prevented where add flows are available.</li><li>Writer/split management uses the same add/edit/delete interaction style across pages.</li></ul></SectionCard>
      <SectionCard title="How to import your calendar"><p>The app currently supports calendar file import (.ics), not live Google sync yet. Manual sessions can be added from onboarding or from the Sessions page.</p><p className="helper" style={{ marginTop: ".5rem" }}>A shared Google calendar is embedded directly inside Sessions as a temporary reference while logging records manually.</p><p className="helper" style={{ marginTop: ".5rem" }}>Date fields use calendar picker inputs for faster and more accurate entry.</p></SectionCard>
      <SectionCard title="Calendar-to-Session Helper"><p>The embedded Google Calendar is reference-only for now, but Sessions includes a manual bridge to turn pasted calendar details into logged sessions.</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li><strong>Create Session from Calendar Event</strong> lets you paste an event title, date, location, and details, then create a session directly.</li><li>Writer suggestions are parsed from titles like <code>Alika x Alex Hosking x Karim Naas</code> and matched against saved writers where possible.</li><li><strong>Unlogged Calendar Sessions</strong> lets you paste multiple event lines, compare them against logged sessions, and create only the missing ones.</li></ul></SectionCard>

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
          <li>Songs/Works can be sorted by A-Z, Date (Oldest), or Most Recent.</li>
          <li>Filtered Songs/Works lists can be exported as CSV for catalogue/admin follow-up.</li>
        </ul>
      </SectionCard>
      <SectionCard title="Reports">
        <p>Reports is the central export hub for archive, catalogue, pitch, cuts, and evidence workflows.</p>
        <ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}>
          <li>Use Reports for CSV exports across Songs/Works, Sessions, Archive Review, Actions, Playlists, Cuts, and Writer/Split summaries.</li>
          <li>Browser print/save-to-PDF is available for printable summaries like Archive Review Summary, Evidence Gaps, No Bounce, No Acapella, Cuts, and Playlist Pitch Activity.</li>
          <li>Missing asset reports include No Bounce, No Acapella, No Lyrics, No Audio / Pitch Audio, Weak/Partial Evidence, Missing Writers/Splits, Unreviewed Sessions, and Open Follow-ups.</li>
          <li>Filters support practical combinations such as date range, reviewed status, evidence strength, writer, tag, missing asset type, cut status, pitch readiness, and playlist response status.</li>
        </ul>
      </SectionCard>
      <SectionCard title="List sorting"><p>Sessions, Songs/Works, and Actions support consistent sorting controls: <strong>A-Z</strong>, <strong>Z-A</strong>, <strong>Date (Oldest)</strong>, <strong>Most Recent</strong>, and <strong>Date Added</strong>.</p></SectionCard>
      <SectionCard title="Session Filters"><p>Sessions now support quick filtering by year and by date range.</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Use the <strong>Year</strong> filter for a fast annual view.</li><li>Use <strong>From</strong> and <strong>To</strong> to search between specific dates.</li><li><strong>Clear Filters</strong> resets the view back to the full session list.</li></ul></SectionCard>
      <SectionCard title="Evidence checklist basics"><p><strong>Required assets</strong></p><ul style={{ paddingLeft: "1.2rem" }}><li>Bounce link</li><li>Lyrics link</li></ul><p style={{ marginTop: "0.6rem" }}><strong>Optional assets</strong></p><ul style={{ paddingLeft: "1.2rem" }}><li>voice note link</li><li>Google Doc link</li><li>Apple Note reference/link</li><li>instrumental link</li><li>acapella link</li><li>Dropbox folder link</li><li>emails/messages</li><li>screenshots</li><li>session file/project link</li><li>other evidence</li></ul></SectionCard>
      <SectionCard title="Evidence Strength Levels">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li><strong>Not Set</strong>: no reliable evidence profile yet.</li>
          <li><strong>Weak</strong>: basic session/work info only, little or no corroborating evidence.</li>
          <li><strong>Partial</strong>: bounce or lyrics exists, with some supporting evidence.</li>
          <li><strong>Strong</strong>: bounce + lyrics and multiple corroborating items (writers/links/supporting material mostly in place).</li>
          <li><strong>Complete</strong>: admin/dispute-ready archive position with core evidence, writers/splits, and missing items resolved or tracked by follow-up.</li>
        </ul>
        <p className="helper" style={{ marginTop: ".6rem" }}>Evidence Strength is auto-calculated from checklist coverage and evidence/admin completeness in Archive Review workflow.</p>
        <p className="helper" style={{ marginTop: ".4rem" }}><strong>Apple Note Exists</strong> is useful even without a share link because note existence/history can still support evidence context.</p>
      </SectionCard>
      <SectionCard title="Recommended Backfill Workflow"><ul style={{ paddingLeft: "1.2rem" }}><li>Start recent-first.</li><li>Work backwards by year.</li><li>Prioritise commercially relevant songs first.</li><li>Recent sessions are easier to recover.</li><li>Calendar import can later fill gaps.</li><li>Use the Archive Review tool to process sessions chronologically by period.</li></ul></SectionCard>
      <SectionCard title="Recommended Next Features">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Add batch evidence tools (bulk add bounce/lyrics across selected songs).</li>
          <li>Add dashboard saved views by period (Current month, Quarter, Year).</li>
          <li>Add action reminders (due-soon digest with one-click Done).</li>
          <li>Add playlist response follow-up templates to create actions automatically.</li>
        </ul>
      </SectionCard>

      <SectionCard title="How to conduct an Archive Review"><ul style={{ paddingLeft: "1.2rem" }}><li>Open Archive Review and choose year/date range/filter.</li><li>Click Start Review to move through sessions one by one.</li><li>Use Back/Next/Mark Reviewed &amp; Next/Save Progress to keep your place.</li><li>Use the checklist/warnings to identify missing bounce, lyrics, writers, splits, and supporting links.</li><li>Add follow-up actions for anything missing.</li><li>Open full Session Workspace whenever deeper edits are needed.</li></ul><p className="helper" style={{ marginTop: ".6rem" }}>Reviewed means checked, not necessarily complete. Missing evidence can remain if follow-up actions are logged.</p><p className="helper" style={{ marginTop: ".4rem" }}>Evidence Strength indicates how defensible/admin-ready the archive currently is.</p></SectionCard>
      <SectionCard title="Archive Review Focus Mode"><p>Focus Mode is a simplified review view designed for fast processing and lower distraction.</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Shows core review fields, blockers, and next actions first.</li><li>Hides some secondary editing sections so the page feels lighter.</li><li>Keeps review navigation/actions visible so you can continue session-by-session.</li></ul><p className="helper" style={{ marginTop: ".5rem" }}>Use Focus Mode when you want to move quickly through reviews, then switch it off for full detail editing.</p></SectionCard>
      <SectionCard title="Readiness Pipeline"><p>Dashboard and Archive Review include readiness cues to show what needs next action:</p><ul style={{ paddingLeft: "1.2rem", marginTop: ".5rem" }}><li>Ready to Pitch</li><li>Needs Bounce</li><li>Needs Lyrics</li><li>Needs Writers/Splits</li><li>Needs Follow-up</li></ul><p className="helper" style={{ marginTop: ".5rem" }}>Use these as practical next-action prompts, not rigid grades.</p></SectionCard>

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
      <SectionCard title="Cuts Import + Achievement Tracking">
        <ul style={{ paddingLeft: "1.2rem" }}>
          <li>Cuts now include an <strong>Import Cut Metadata</strong> section for Spotify track links.</li>
          <li>Spotify URL import + Spotify search now use server-side API routes and build an editable preview (title, artist, release/project, artwork, release date, listen link, platform, ISRC when available).</li>
          <li>Manual cut entry still works and remains fully supported.</li>
          <li>Required env for Spotify import/search: <code>SPOTIFY_CLIENT_ID</code> and <code>SPOTIFY_CLIENT_SECRET</code> (server-side only).</li>
          <li>Apple Music import references are intentionally removed in this workflow.</li>
          <li>Achievement tracking is optional: use notes/status fields to log chart/editorial/radio/streams/sync/certification/highlights.</li>
          <li>Cuts reference playlist embed/link is saved in app until you replace or remove it, and shows a saved confirmation state.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
