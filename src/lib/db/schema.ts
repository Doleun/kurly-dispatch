import { relations, sql } from "drizzle-orm";
import { integer, sqliteTable, text, uniqueIndex } from "drizzle-orm/sqlite-core";

export type UserRole = "super_admin" | "center_manager";
export type IdBorrowPolicy = "fixed_1_1" | "daily_override";
export type TimeSlot = "first" | "second";
export type AccountType = "regular" | "spare";
/** 휴무표 권역 (센터별 의미 다름) */
export type CoverageArea = "daegu" | "gumi" | "ulsan" | "busan";
/** 지입 / 화성(알바) — 휴무표 그룹용 */
export type EmploymentType = "jiip" | "hwaseong";
/** 월=0 … 일=6 (휴무표 요일 열과 동일) */
export type Weekday = 0 | 1 | 2 | 3 | 4 | 5 | 6;
export type LeaveExceptionKind = "leave" | "work";

export const centers = sqliteTable("centers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  name: text("name").notNull(),
  useSubZones: integer("use_sub_zones", { mode: "boolean" }).notNull().default(false),
  idBorrowPolicy: text("id_borrow_policy")
    .$type<IdBorrowPolicy>()
    .notNull()
    .default("fixed_1_1"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const centerSubCodes = sqliteTable(
  "center_sub_codes",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    centerId: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    label: text("label").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("center_sub_codes_center_label").on(table.centerId, table.label)],
);

export const users = sqliteTable("users", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  username: text("username").notNull().unique(),
  passwordHash: text("password_hash").notNull(),
  role: text("role").$type<UserRole>().notNull().default("super_admin"),
  centerId: integer("center_id").references(() => centers.id, { onDelete: "set null" }),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const zones = sqliteTable(
  "zones",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    centerId: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    baseCode: text("base_code").notNull(),
    subCode: text("sub_code").notNull().default(""),
    code: text("code").notNull(),
    name: text("name"),
    description: text("description"),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("zones_center_base_sub").on(table.centerId, table.baseCode, table.subCode),
  ],
);

export const drivers = sqliteTable("drivers", {
  id: integer("id").primaryKey({ autoIncrement: true }),
  centerId: integer("center_id")
    .notNull()
    .references(() => centers.id, { onDelete: "cascade" }),
  name: text("name").notNull(),
  kurlyId: text("kurly_id"),
  kurlyAccountName: text("kurly_account_name"),
  accountType: text("account_type").$type<AccountType>().notNull().default("regular"),
  defaultTimeSlot: text("default_time_slot").$type<TimeSlot>(),
  coverageArea: text("coverage_area").$type<CoverageArea>(),
  employmentType: text("employment_type").$type<EmploymentType>(),
  maxCapacity: integer("max_capacity"),
  capabilityNote: text("capability_note"),
  isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
  createdAt: text("created_at")
    .notNull()
    .default(sql`(datetime('now'))`),
  updatedAt: text("updated_at")
    .notNull()
    .default(sql`(datetime('now'))`),
});

export const driverIdBorrowRules = sqliteTable(
  "driver_id_borrow_rules",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    centerId: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    actualDriverId: integer("actual_driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    kurlyDriverId: integer("kurly_driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    isActive: integer("is_active", { mode: "boolean" }).notNull().default(true),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("borrow_rules_center_actual").on(table.centerId, table.actualDriverId),
  ],
);

export const zoneMappings = sqliteTable(
  "zone_mappings",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    zoneId: integer("zone_id")
      .notNull()
      .references(() => zones.id, { onDelete: "cascade" }),
    timeSlot: text("time_slot").$type<TimeSlot>().notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("zone_mappings_driver_zone_slot").on(
      table.driverId,
      table.zoneId,
      table.timeSlot,
    ),
  ],
);

export const randomPoolMembers = sqliteTable(
  "random_pool_members",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    timeSlot: text("time_slot").$type<TimeSlot>().notNull(),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [uniqueIndex("random_pool_driver_slot").on(table.driverId, table.timeSlot)],
);

/** 요일별 고정 휴무 (센터·타임 공통 모델, 데이터만 center_id로 분리) */
export const driverWeeklyLeaves = sqliteTable(
  "driver_weekly_leaves",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    centerId: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    timeSlot: text("time_slot").$type<TimeSlot>().notNull(),
    weekday: integer("weekday").$type<Weekday>().notNull(),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("weekly_leave_driver_slot_day").on(
      table.driverId,
      table.timeSlot,
      table.weekday,
    ),
  ],
);

/** 특정일 휴무/출근 override (1일 단위) */
export const driverLeaveExceptions = sqliteTable(
  "driver_leave_exceptions",
  {
    id: integer("id").primaryKey({ autoIncrement: true }),
    centerId: integer("center_id")
      .notNull()
      .references(() => centers.id, { onDelete: "cascade" }),
    driverId: integer("driver_id")
      .notNull()
      .references(() => drivers.id, { onDelete: "cascade" }),
    timeSlot: text("time_slot").$type<TimeSlot>().notNull(),
    leaveDate: text("leave_date").notNull(),
    kind: text("kind").$type<LeaveExceptionKind>().notNull().default("leave"),
    note: text("note"),
    createdAt: text("created_at")
      .notNull()
      .default(sql`(datetime('now'))`),
    updatedAt: text("updated_at")
      .notNull()
      .default(sql`(datetime('now'))`),
  },
  (table) => [
    uniqueIndex("leave_exception_driver_slot_date").on(
      table.driverId,
      table.timeSlot,
      table.leaveDate,
    ),
  ],
);

export const centersRelations = relations(centers, ({ many }) => ({
  subCodes: many(centerSubCodes),
  zones: many(zones),
  drivers: many(drivers),
  users: many(users),
}));

export const centerSubCodesRelations = relations(centerSubCodes, ({ one }) => ({
  center: one(centers, { fields: [centerSubCodes.centerId], references: [centers.id] }),
}));

export const usersRelations = relations(users, ({ one }) => ({
  center: one(centers, { fields: [users.centerId], references: [centers.id] }),
}));

export const zonesRelations = relations(zones, ({ one, many }) => ({
  center: one(centers, { fields: [zones.centerId], references: [centers.id] }),
  mappings: many(zoneMappings),
}));

export const driversRelations = relations(drivers, ({ one, many }) => ({
  center: one(centers, { fields: [drivers.centerId], references: [centers.id] }),
  zoneMappings: many(zoneMappings),
  randomPoolMemberships: many(randomPoolMembers),
  weeklyLeaves: many(driverWeeklyLeaves),
  leaveExceptions: many(driverLeaveExceptions),
  borrowRulesAsActual: many(driverIdBorrowRules, { relationName: "actualDriver" }),
  borrowRulesAsKurly: many(driverIdBorrowRules, { relationName: "kurlyDriver" }),
}));

export const driverIdBorrowRulesRelations = relations(driverIdBorrowRules, ({ one }) => ({
  center: one(centers, { fields: [driverIdBorrowRules.centerId], references: [centers.id] }),
  actualDriver: one(drivers, {
    fields: [driverIdBorrowRules.actualDriverId],
    references: [drivers.id],
    relationName: "actualDriver",
  }),
  kurlyDriver: one(drivers, {
    fields: [driverIdBorrowRules.kurlyDriverId],
    references: [drivers.id],
    relationName: "kurlyDriver",
  }),
}));

export const zoneMappingsRelations = relations(zoneMappings, ({ one }) => ({
  driver: one(drivers, { fields: [zoneMappings.driverId], references: [drivers.id] }),
  zone: one(zones, { fields: [zoneMappings.zoneId], references: [zones.id] }),
}));

export const driverWeeklyLeavesRelations = relations(driverWeeklyLeaves, ({ one }) => ({
  center: one(centers, { fields: [driverWeeklyLeaves.centerId], references: [centers.id] }),
  driver: one(drivers, { fields: [driverWeeklyLeaves.driverId], references: [drivers.id] }),
}));

export const driverLeaveExceptionsRelations = relations(driverLeaveExceptions, ({ one }) => ({
  center: one(centers, {
    fields: [driverLeaveExceptions.centerId],
    references: [centers.id],
  }),
  driver: one(drivers, {
    fields: [driverLeaveExceptions.driverId],
    references: [drivers.id],
  }),
}));

export type Center = typeof centers.$inferSelect;
export type CenterSubCode = typeof centerSubCodes.$inferSelect;
export type User = typeof users.$inferSelect;
export type Zone = typeof zones.$inferSelect;
export type Driver = typeof drivers.$inferSelect;
export type DriverIdBorrowRule = typeof driverIdBorrowRules.$inferSelect;
export type ZoneMapping = typeof zoneMappings.$inferSelect;
export type RandomPoolMember = typeof randomPoolMembers.$inferSelect;
export type DriverWeeklyLeave = typeof driverWeeklyLeaves.$inferSelect;
export type DriverLeaveException = typeof driverLeaveExceptions.$inferSelect;
