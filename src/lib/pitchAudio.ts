import { supabase } from "@/lib/supabase";
import { logSupabaseError } from "@/lib/supabaseError";

const ALLOWED_TYPES = ["audio/mpeg", "audio/wav", "audio/x-wav", "audio/mp4", "audio/aac"];
const ALLOWED_EXT = [".mp3", ".wav", ".m4a", ".aac"];

type StorageLikeError = { message?: string; statusCode?: string | number; error?: string; name?: string };

function stringifyStorageError(error: unknown) {
  const typed = (error ?? {}) as StorageLikeError;
  return JSON.stringify(
    {
      message: typed?.message ?? "No message",
      statusCode: typed?.statusCode ?? "No statusCode",
      error: typed?.error ?? "No error",
      name: typed?.name ?? "No name",
      raw: error,
    },
    null,
    2,
  );
}

function classifyUploadError(error: unknown) {
  const typed = (error ?? {}) as StorageLikeError;
  const message = (typed?.message || "").toLowerCase();
  const details = (typed?.error || "").toLowerCase();
  const all = `${message} ${details}`;
  const status = String(typed?.statusCode || "");

  if (all.includes("bucket") && (all.includes("not found") || all.includes("does not exist"))) {
    return "Bucket pitch-audio was not found.";
  }
  if (status === "413" || all.includes("too large") || all.includes("entity too large") || all.includes("payload too large")) {
    return "Audio file is too large for the bucket limit.";
  }
  if (status === "415" || all.includes("mime") || all.includes("content type") || all.includes("invalid file type") || all.includes("not allowed") || all.includes("unsupported")) {
    return "This audio format is not allowed.";
  }
  if (status === "401" || status === "403" || all.includes("permission") || all.includes("not authorized") || all.includes("unauthorized") || all.includes("forbidden") || all.includes("policy")) {
    return "Storage permission denied.";
  }
  return null;
}

function toUploadMessage(error: unknown) {
  const typed = (error ?? {}) as StorageLikeError;
  const classified = classifyUploadError(error);
  if (classified) return classified;
  return `Could not upload audio: ${typed?.message || typed?.statusCode || "unknown error"}`;
}

export function isAllowedPitchAudio(file: File) {
  const lower = file.name.toLowerCase();
  return ALLOWED_TYPES.includes(file.type) || ALLOWED_EXT.some((ext) => lower.endsWith(ext));
}

export async function uploadPitchAudio(songId: string, file: File) {
  if (!isAllowedPitchAudio(file)) {
    throw new Error("This audio format is not allowed.");
  }

  const safe = file.name.replace(/[^a-zA-Z0-9._-]/g, "_");
  const path = `song-works/${songId}/${Date.now()}-${safe}`;

  console.log(
    "Pitch audio upload metadata",
    JSON.stringify(
      {
        fileName: file.name,
        fileSize: file.size,
        fileType: file.type,
        storagePath: path,
      },
      null,
      2,
    ),
  );

  const { error: upErr } = await supabase.storage.from("pitch-audio").upload(path, file, {
    upsert: true,
    contentType: file.type || "audio/mpeg",
  });

  if (upErr) {
    console.error("Failed to upload pitch audio", stringifyStorageError(upErr));
    throw new Error(toUploadMessage(upErr));
  }

  const update = {
    audio_storage_path: path,
    audio_file_name: file.name,
    audio_mime_type: file.type || null,
    audio_uploaded_at: new Date().toISOString(),
  };
  const { error: dbErr } = await supabase.from("song_works").update(update).eq("id", songId);
  if (dbErr) {
    logSupabaseError("Failed to save pitch audio metadata", dbErr);
    throw dbErr;
  }
  return path;
}

export async function removePitchAudio(songId: string, path?: string | null) {
  if (path) {
    const { error: rmErr } = await supabase.storage.from("pitch-audio").remove([path]);
    if (rmErr) logSupabaseError("Failed to remove pitch audio object", rmErr);
  }
  const { error: dbErr } = await supabase
    .from("song_works")
    .update({
      audio_storage_path: null,
      audio_file_name: null,
      audio_mime_type: null,
      audio_uploaded_at: null,
      audio_source_note: null,
    })
    .eq("id", songId);
  if (dbErr) throw dbErr;
}

export async function getPlayableAudioUrl(path?: string | null) {
  if (!path) return "";
  const { data, error } = await supabase.storage.from("pitch-audio").createSignedUrl(path, 60 * 60);
  if (!error && data?.signedUrl) return data.signedUrl;

  console.error("Failed to create signed URL for pitch audio", stringifyStorageError(error));
  const fallback = supabase.storage.from("pitch-audio").getPublicUrl(path);
  return fallback.data.publicUrl || "";
}
