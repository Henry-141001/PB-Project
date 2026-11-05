import { boolean, index, integer, jsonb, pgTable, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import type { MatchState, MatchType, Role, Src, Stage, TournamentType } from "../lib/tournament";

const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();

export const users = pgTable("users", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull(),
  phone: text("phone").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<Role>().notNull(),
  createdAt: createdAt(),
});

export const tournaments = pgTable(
  "tournaments",
  {
    id: text("id").primaryKey(),
    code: text("code").notNull().unique(), // join code players type in
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }),
    name: text("name").notNull(),
    location: text("location").notNull(),
    organizer: text("organizer").notNull(),
    orgPhone: text("org_phone").notNull(),
    type: text("type").$type<TournamentType>().notNull(),
    matchType: text("match_type").$type<MatchType>().notNull(),
    category: text("category").notNull(),
    maxTeams: integer("max_teams").notNull(),
    gameTo: integer("game_to").notNull().default(11),
    bestOf: integer("best_of").notNull().default(3),
    startDate: text("start_date").notNull(), // YYYY-MM-DD
    endDate: text("end_date").notNull(),
    startTime: text("start_time").notNull(), // HH:MM
    endTime: text("end_time").notNull(),
    generated: boolean("generated").notNull().default(false),
    groups: jsonb("groups").$type<string[][]>(), // team ids per group (group stage only)
    draw: jsonb("draw").$type<string[]>(), // random draw order of team ids
    drawnAt: text("drawn_at"),
    createdAt: createdAt(),
  },
  (t) => [index("tournaments_owner_idx").on(t.ownerId)],
);

export const teams = pgTable(
  "teams",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    ownerId: text("owner_id").notNull().references(() => users.id, { onDelete: "cascade" }), // the player who joined
    players: jsonb("players").$type<string[]>().notNull(), // 1 or 2 names
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("teams_tournament_owner_uq").on(t.tournamentId, t.ownerId), // one team per player per tournament
    index("teams_owner_idx").on(t.ownerId),
  ],
);

export const matches = pgTable(
  "matches",
  {
    id: text("id").primaryKey(),
    tournamentId: text("tournament_id").notNull().references(() => tournaments.id, { onDelete: "cascade" }),
    no: integer("no").notNull(),
    code: text("code").notNull().unique(), // umpire code
    stage: text("stage").$type<Stage>().notNull(),
    groupNo: integer("group_no"),
    round: integer("round").notNull(),
    slot: integer("slot"),
    label: text("label").notNull(),
    sideA: jsonb("side_a").$type<Src>().notNull(),
    sideB: jsonb("side_b").$type<Src>().notNull(),
    date: text("date"),
    time: text("time"),
    state: jsonb("state").$type<MatchState>(),
    updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [index("matches_tournament_idx").on(t.tournamentId)],
);
