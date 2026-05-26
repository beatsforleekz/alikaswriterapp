"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { logSupabaseError } from "@/lib/supabaseError";
import { getPlayableAudioUrl } from "@/lib/pitchAudio";

type Playlist = {
  id: string;
  title: string;
  description?: string | null;
  recipient_name?: string | null;
  recipient_company?: string | null;
  password?: string | null;
  is_active?: boolean | null;
  expires_at?: string | null;
};

type Track = {
  id: string;
  title: string;
  audio_url: string;
  notes?: string | null;
  unavailable?: boolean;
};

type FeedbackState = "interested" | "hold" | "pass" | "feedback" | null;

const formatTime = (secs: number) => {
  if (!Number.isFinite(secs) || secs < 0) return "0:00";
  const m = Math.floor(secs / 60);
  const s = Math.floor(secs % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
};

export default function PublicPitchPage() {
  const params = useParams<{ share_token: string }>();
  const [playlist, setPlaylist] = useState<Playlist | null>(null);
  const [tracks, setTracks] = useState<Track[]>([]);
  const [locked, setLocked] = useState(true);
  const [passwordInput, setPasswordInput] = useState("");
  const [message, setMessage] = useState("Loading...");

  const [activeIndex, setActiveIndex] = useState<number>(-1);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);

  const [feedbackByTrack, setFeedbackByTrack] = useState<Record<string, FeedbackState>>({});
  const [holdNotice, setHoldNotice] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [modalTrack, setModalTrack] = useState<Track | null>(null);
  const [modalAction, setModalAction] = useState<FeedbackState>(null);
  const [senderName, setSenderName] = useState("");
  const [senderCompany, setSenderCompany] = useState("");
  const [senderArtist, setSenderArtist] = useState("");
  const [senderMessage, setSenderMessage] = useState("");

  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeTrack = activeIndex >= 0 ? tracks[activeIndex] : null;
  const progress = duration > 0 ? Math.min(100, (currentTime / duration) * 100) : 0;
  const trackCount = tracks.length;

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from("pitch_playlists").select("*").eq("share_token", params.share_token).single();
      if (error || !data) {
        setMessage("Playlist not found.");
        return;
      }

      const p = data as Playlist;
      if (!p.is_active) {
        setMessage("This playlist is inactive.");
        return;
      }
      if (p.expires_at && new Date(p.expires_at) < new Date()) {
        setMessage("This playlist has expired.");
        return;
      }

      setPlaylist(p);
      if (!p.password) setLocked(false);
      else setMessage("Password required.");
    };
    load();
  }, [params.share_token]);

  useEffect(() => {
    if (!params.share_token) return;
    try {
      const raw = window.localStorage.getItem(`pitch-feedback-${params.share_token}`);
      if (raw) setFeedbackByTrack(JSON.parse(raw));
    } catch {
      // ignore localStorage parse issues
    }
  }, [params.share_token]);

  useEffect(() => {
    if (!params.share_token) return;
    try {
      window.localStorage.setItem(`pitch-feedback-${params.share_token}`, JSON.stringify(feedbackByTrack));
    } catch {
      // ignore localStorage write issues
    }
  }, [feedbackByTrack, params.share_token]);

  useEffect(() => {
    if (!playlist || locked) return;
    const loadTracks = async () => {
      const { data: trackRows, error: trackErr } = await supabase
        .from("pitch_playlist_tracks")
        .select("id,song_work_id,notes,sort_order,song_works(title,audio_storage_path)")
        .eq("playlist_id", playlist.id)
        .order("sort_order", { ascending: true });

      if (trackErr) {
        logSupabaseError("Failed to load public pitch tracks", trackErr);
        setMessage("Could not load tracks.");
        return;
      }

      const mapped: Track[] = [];
      for (const row of trackRows ?? []) {
        const r = row as { id: string; notes?: string | null; song_works?: { title?: string; audio_storage_path?: string | null } | null };
        const storagePath = r.song_works?.audio_storage_path;
        const audioUrl = storagePath ? await getPlayableAudioUrl(storagePath) : "";
        mapped.push({
          id: String(r.id),
          title: String(r.song_works?.title || "Untitled Song"),
          audio_url: audioUrl,
          notes: r.notes ?? null,
          unavailable: !storagePath || !audioUrl,
        });
      }

      setTracks(mapped);
      setMessage(mapped.length && mapped.every((t) => t.unavailable) ? "All tracks are currently unavailable." : "");
      await supabase.from("pitch_playlist_views").insert({ playlist_id: playlist.id, user_agent: navigator.userAgent });
      await supabase.from("pitch_playlist_events").insert({
        playlist_id: playlist.id,
        event_type: "view",
        user_agent: navigator.userAgent,
      });
    };

    loadTracks();
  }, [playlist, locked]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;

    const onTime = () => setCurrentTime(audio.currentTime || 0);
    const onDuration = () => setDuration(audio.duration || 0);
    const onEnded = async () => {
      if (playlist && activeIndex >= 0 && tracks[activeIndex]) {
        await supabase.from("pitch_playlist_events").insert({
          playlist_id: playlist.id,
          playlist_track_id: tracks[activeIndex].id,
          event_type: "finish",
          user_agent: navigator.userAgent,
        });
      }
      const nextPlayable = tracks.findIndex((t, i) => i > activeIndex && !t.unavailable && !!t.audio_url);
      if (nextPlayable >= 0) {
        playTrack(nextPlayable);
      } else {
        setIsPlaying(false);
      }
    };
    const onPause = () => setIsPlaying(false);
    const onPlay = () => setIsPlaying(true);

    audio.addEventListener("timeupdate", onTime);
    audio.addEventListener("loadedmetadata", onDuration);
    audio.addEventListener("ended", onEnded);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("play", onPlay);

    return () => {
      audio.removeEventListener("timeupdate", onTime);
      audio.removeEventListener("loadedmetadata", onDuration);
      audio.removeEventListener("ended", onEnded);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("play", onPlay);
    };
  }, [activeIndex, tracks, playlist]);

  const unlock = () => {
    if (!playlist?.password) return;
    if (passwordInput === playlist.password) {
      setLocked(false);
      setMessage("");
      return;
    }
    setMessage("Incorrect password.");
  };

  const playTrack = (index: number) => {
    const track = tracks[index];
    const audio = audioRef.current;
    if (!audio || !track || track.unavailable || !track.audio_url) return;

    if (activeIndex !== index) {
      audio.pause();
      audio.src = track.audio_url;
      audio.load();
      setActiveIndex(index);
      setCurrentTime(0);
      setDuration(0);
    }

    audio.play().then(async () => {
      if (!playlist) return;
      await supabase.from("pitch_playlist_events").insert({
        playlist_id: playlist.id,
        playlist_track_id: track.id,
        event_type: "play",
        user_agent: navigator.userAgent,
      });
    }).catch(() => {
      setMessage("Playback could not start on this device.");
    });
  };

  const toggleTrack = (index: number) => {
    const audio = audioRef.current;
    if (!audio) return;

    if (activeIndex !== index) {
      playTrack(index);
      return;
    }

    if (isPlaying) audio.pause();
    else {
      audio.play().catch(() => setMessage("Playback could not start on this device."));
    }
  };

  const seekTo = (percent: number) => {
    const audio = audioRef.current;
    if (!audio || !duration) return;
    const next = (percent / 100) * duration;
    audio.currentTime = next;
    setCurrentTime(next);
  };

  const playPrev = () => {
    const prev = [...tracks.keys()].reverse().find((i) => i < activeIndex && !tracks[i].unavailable);
    if (prev !== undefined) playTrack(prev);
  };

  const playNext = () => {
    const next = tracks.findIndex((t, i) => i > activeIndex && !t.unavailable);
    if (next >= 0) playTrack(next);
  };

  const playPlaylist = () => {
    const firstPlayable = tracks.findIndex((t) => !t.unavailable);
    if (firstPlayable >= 0) playTrack(firstPlayable);
  };

  const openEnquiry = (track: Track, action: FeedbackState) => {
    const current = feedbackByTrack[track.id] || null;
    if (current === action) {
      setFeedbackByTrack((prev) => ({ ...prev, [track.id]: null }));
      return;
    }
    setFeedbackByTrack((prev) => ({ ...prev, [track.id]: action }));
    setModalTrack(track);
    setModalAction(action);
    setSenderName("");
    setSenderCompany("");
    setSenderArtist("");
    setSenderMessage(action === "hold" ? "Please place this track on hold." : "");
    setModalOpen(true);
    if (action === "hold") {
      setHoldNotice("Please send hold details via email enquiry.");
      setTimeout(() => setHoldNotice(""), 2200);
    }
  };

  const submitEnquiry = async () => {
    if (!playlist || !modalTrack || !modalAction) return;
    const actionLabel = modalAction === "interested" ? "Interested" : modalAction === "hold" ? "Hold" : modalAction === "pass" ? "Pass" : "Feedback";
    const subject = `[${modalTrack.title}] Pitch Enquiry`;
    const body = [
      `Track Title: ${modalTrack.title}`,
      `Action Type: ${actionLabel}`,
      `Sender Name: ${senderName || ""}`,
      `Company / Management / Label: ${senderCompany || ""}`,
      `Artist Interested in Cutting: ${senderArtist || ""}`,
      `Message: ${senderMessage || ""}`,
      `Playlist: ${playlist?.title || ""}`,
    ].join("\n");

    await supabase.from("pitch_playlist_responses").insert({
      playlist_id: playlist.id,
      playlist_track_id: modalTrack.id,
      response_type: modalAction,
      sender_name: senderName || null,
      sender_company: senderCompany || null,
      sender_artist: senderArtist || null,
      sender_message: senderMessage || null,
    });
    window.location.href = `mailto:info@pittbuhl.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    setModalOpen(false);
  };

  const availabilityNote = useMemo(() => {
    if (!playlist?.expires_at) return null;
    const dt = new Date(playlist.expires_at);
    return Number.isNaN(dt.getTime()) ? null : `Available until ${dt.toLocaleString()}`;
  }, [playlist?.expires_at]);

  if (!playlist) {
    return <div className="pitchPage"><div className="pitchWrap pitchCentered"><h1 className="pitchTitle">Private Pitch</h1><p className="helper">{message}</p></div></div>;
  }

  if (locked) {
    return (
      <div className="pitchPage">
        <div className="pitchWrap pitchCentered pitchLockedCard">
          <h1 className="pitchTitle">{playlist.title}</h1>
          {playlist.description ? <p className="pitchDescription">{playlist.description}</p> : null}
          <div className="pitchLockRow">
            <input type="password" value={passwordInput} onChange={(e) => setPasswordInput(e.target.value)} placeholder="Password" />
            <button className="button primary" onClick={unlock}>Unlock Playlist</button>
          </div>
          {message ? <p className="helper" style={{ marginTop: ".7rem" }}>{message}</p> : null}
        </div>
      </div>
    );
  }

  return (
    <div className="pitchPage">
      <audio ref={audioRef} preload="metadata" style={{ display: "none" }} />

      <div className="pitchWrap pitchCentered">
        <header className="pitchHeader pitchHeroClean">
          <p className="pitchEyebrow">Private Pitch Playlist</p>
          <h1 className="pitchTitle">{playlist.title}</h1>
          {playlist.description ? <p className="pitchDescription">{playlist.description}</p> : null}
          <div className="pitchMeta">
            <span>{trackCount} {trackCount === 1 ? "track" : "tracks"}</span>
            {(playlist.recipient_name || playlist.recipient_company) ? <span>For {playlist.recipient_name || "Recipient"}{playlist.recipient_company ? ` - ${playlist.recipient_company}` : ""}</span> : null}
            {availabilityNote ? <span>{availabilityNote}</span> : null}
          </div>
          <div style={{ marginTop: "1rem" }}>
            <button className="button primary pitchPlayHeroBtn" onClick={playPlaylist} disabled={!tracks.some((t) => !t.unavailable)}>
              <span style={{ marginRight: ".45rem" }}>▶</span>Play Playlist
            </button>
          </div>
        </header>

        {holdNotice ? <p className="helper" style={{ margin: "0 0 .8rem", color: "#6d4d2e" }}>{holdNotice}</p> : null}

        {tracks.length === 0 ? <p className="helper">No tracks available.</p> : (
          <section className="pitchTracklist pitchTracklistWide">
            {tracks.map((track, index) => {
              const isActive = index === activeIndex;
              const feedback = feedbackByTrack[track.id] || null;
              return (
                <article key={track.id} className={`pitchTrack pitchTrackRow ${isActive ? "active" : ""} ${feedback === "hold" ? "onHold" : ""}`}>
                  <div className="pitchTrackNo">{index + 1}</div>
                  <button
                    className="pitchPlayBtn"
                    onClick={() => toggleTrack(index)}
                    disabled={Boolean(track.unavailable)}
                    aria-label={isActive && isPlaying ? `Pause ${track.title}` : `Play ${track.title}`}
                  >
                    {track.unavailable ? "-" : isActive && isPlaying ? "❚❚" : "▶"}
                  </button>
                  <div className="pitchTrackMain">
                    <div className="pitchTrackTitleRow">
                      <h3 className="pitchTrackTitle">{track.title}</h3>
                      {isActive ? <span className="pitchNowPlaying">Now playing</span> : null}
                      {feedback === "hold" ? <span className="pitchHoldBadge">On Hold</span> : null}
                    </div>
                    {track.notes ? <p className="pitchTrackNotes">{track.notes}</p> : <p className="pitchTrackNotes">No pitch notes provided.</p>}
                    {track.unavailable ? <p className="helper">Audio currently unavailable</p> : null}
                  </div>
                  <div className="pitchTrackAside">
                    <div className="pitchTrackTime">{isActive ? `${formatTime(currentTime)} / ${formatTime(duration)}` : ""}</div>
                  </div>
                  <div className="pitchFeedbackRow pitchFeedbackRowInline">
                    <button className={`pitchPill ${feedback === "interested" ? "active" : ""}`} onClick={() => openEnquiry(track, "interested")}>Interested</button>
                    <button className={`pitchPill ${feedback === "hold" ? "active" : ""}`} onClick={() => openEnquiry(track, "hold")}>Hold</button>
                    <button className={`pitchPill ${feedback === "pass" ? "active" : ""}`} onClick={() => openEnquiry(track, "pass")}>Pass</button>
                    <button className={`pitchPill ${feedback === "feedback" ? "active" : ""}`} onClick={() => openEnquiry(track, "feedback")}>Feedback</button>
                  </div>
                </article>
              );
            })}
          </section>
        )}

        {message ? <p className="helper" style={{ marginTop: ".7rem" }}>{message}</p> : null}
      </div>

      <div className="pitchMiniPlayer">
        <div className="pitchMiniMain">
          <div className="pitchMiniTrack">{activeTrack ? activeTrack.title : "Select a track to play"}</div>
          <div className="pitchMiniControls">
            <button className="button compact" onClick={playPrev} disabled={tracks.length === 0 || activeIndex <= 0} aria-label="Previous">⏮</button>
            <button
              className="button primary compact"
              onClick={() => {
                if (activeIndex < 0) {
                  playPlaylist();
                  return;
                }
                toggleTrack(activeIndex);
              }}
              disabled={!tracks.some((t) => !t.unavailable)}
              aria-label={isPlaying ? "Pause" : "Play"}
            >
              {isPlaying ? "❚❚" : "▶"}
            </button>
            <button className="button compact" onClick={playNext} disabled={tracks.length === 0 || activeIndex < 0 || activeIndex >= tracks.length - 1} aria-label="Next">⏭</button>
          </div>
        </div>
        <div className="pitchProgressWrap">
          <input
            type="range"
            min={0}
            max={100}
            step={0.1}
            value={progress}
            onChange={(e) => seekTo(Number(e.target.value))}
            disabled={!duration}
          />
          <div className="pitchProgressTime">
            <span>{formatTime(currentTime)}</span>
            <span>{formatTime(duration)}</span>
          </div>
        </div>
      </div>

      {modalOpen ? (
        <div className="pitchModalOverlay" role="dialog" aria-modal="true">
          <div className="pitchModalCard">
            <h3 style={{ marginBottom: ".5rem" }}>
              {modalAction === "interested" ? "Interested" : modalAction === "hold" ? "Hold" : modalAction === "pass" ? "Pass" : "Feedback"} - {modalTrack?.title}
            </h3>
            <div className="pitchModalGrid">
              <input placeholder="Name" value={senderName} onChange={(e) => setSenderName(e.target.value)} />
              <input placeholder="Company / Management / Label" value={senderCompany} onChange={(e) => setSenderCompany(e.target.value)} />
              <input placeholder="Artist interested in cutting the song" value={senderArtist} onChange={(e) => setSenderArtist(e.target.value)} />
              <textarea placeholder="Optional message" value={senderMessage} onChange={(e) => setSenderMessage(e.target.value)} />
            </div>
            <div className="rowActions" style={{ marginTop: ".7rem", justifyContent: "flex-end" }}>
              <button className="button" onClick={() => setModalOpen(false)}>Cancel</button>
              <button className="button primary" onClick={submitEnquiry}>Send Enquiry</button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
