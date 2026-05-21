import {
  ActionItem,
  AssetLink,
  ContractRecord,
  CutRecord,
  PitchRecord,
  Session,
  SongWork,
  SongWriterSplit,
  Writer,
} from "@/types";

export const writers: Writer[] = [];
export const sessions: Session[] = [];
export const songs: SongWork[] = [];
export const splits: SongWriterSplit[] = [];
export const assets: AssetLink[] = [];
export const pitches: PitchRecord[] = [];
export const cuts: CutRecord[] = [];
export const contracts: ContractRecord[] = [];
export const actions: ActionItem[] = [];

// TODO: Replace mock exports with Supabase queries.
export const db = { writers, sessions, songs, splits, assets, pitches, cuts, contracts, actions };
