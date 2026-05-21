import { SongWork } from "@/types";

export const hasBounce = (song: Pick<SongWork, "bounceLink">) => Boolean(song.bounceLink);
export const hasLyrics = (song: Pick<SongWork, "lyricsLink">) => Boolean(song.lyricsLink);
