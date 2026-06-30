import { z } from "zod";

const zoneCodeSchema = z
  .string()
  .trim()
  .min(1, "구역번호를 입력하세요")
  .max(20, "20자 이내입니다");

export const zoneCreateSchema = z.object({
  centerId: z.number().int().positive("센터를 선택하세요"),
  code: zoneCodeSchema,
  name: z.string().trim().max(100).optional().nullable(),
  description: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const zoneUpdateSchema = zoneCreateSchema.partial();

export type ZoneCreateInput = z.infer<typeof zoneCreateSchema>;
export type ZoneUpdateInput = z.infer<typeof zoneUpdateSchema>;

export const loginSchema = z.object({
  username: z.string().trim().min(1, "아이디를 입력하세요"),
  password: z.string().min(1, "비밀번호를 입력하세요"),
});

export const centerCreateSchema = z.object({
  name: z.string().trim().min(1, "센터명을 입력하세요").max(50),
  isActive: z.boolean().optional().default(true),
});

export const centerUpdateSchema = centerCreateSchema.partial();

export const subCodeCreateSchema = z.object({
  label: z.string().trim().min(1, "코드를 입력하세요").max(10),
  sortOrder: z.number().int().min(0).optional(),
});

export const driverCreateSchema = z.object({
  centerId: z.number().int().positive("센터를 선택하세요"),
  name: z.string().trim().min(1, "실명을 입력하세요").max(50),
  kurlyId: z.string().trim().max(50).optional().nullable(),
  kurlyAccountName: z.string().trim().max(50).optional().nullable(),
  accountType: z.enum(["regular", "spare"]).optional().default("regular"),
  defaultTimeSlot: z.enum(["first", "second"]).optional().nullable(),
  coverageArea: z.enum(["daegu", "gumi", "ulsan", "busan"]).optional().nullable(),
  employmentType: z.enum(["jiip", "hwaseong"]).optional().nullable(),
  maxCapacity: z.number().int().min(0).optional().nullable(),
  capabilityNote: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const driverUpdateSchema = driverCreateSchema.partial();

export const borrowRuleCreateSchema = z.object({
  centerId: z.number().int().positive(),
  actualDriverId: z.number().int().positive(),
  kurlyDriverId: z.number().int().positive(),
  note: z.string().trim().max(200).optional().nullable(),
  isActive: z.boolean().optional().default(true),
});

export const borrowRuleUpdateSchema = borrowRuleCreateSchema
  .omit({ centerId: true, actualDriverId: true })
  .partial();

export const zoneMappingCreateSchema = z.object({
  centerId: z.number().int().positive(),
  driverId: z.number().int().positive(),
  zoneId: z.number().int().positive(),
  timeSlot: z.enum(["first", "second"]),
});

export const randomPoolCreateSchema = z.object({
  centerId: z.number().int().positive(),
  driverId: z.number().int().positive(),
  timeSlot: z.enum(["first", "second"]),
});

export const adminUserCreateSchema = z.object({
  username: z.string().trim().min(2, "아이디 2자 이상").max(50),
  password: z.string().min(6, "비밀번호 6자 이상"),
  role: z.enum(["super_admin", "center_manager"]),
  centerId: z.number().int().positive().optional().nullable(),
});

export const adminUserUpdateSchema = z.object({
  password: z.string().min(6).optional(),
  role: z.enum(["super_admin", "center_manager"]).optional(),
  centerId: z.number().int().positive().optional().nullable(),
});

export const weeklyLeavesBulkSchema = z.object({
  centerId: z.number().int().positive(),
  timeSlot: z.enum(["first", "second"]),
  leaves: z.array(
    z.object({
      driverId: z.number().int().positive(),
      weekday: z.number().int().min(0).max(6),
      note: z.string().trim().max(50).optional().nullable(),
    }),
  ),
});

export const leaveExceptionCreateSchema = z.object({
  centerId: z.number().int().positive(),
  driverId: z.number().int().positive(),
  timeSlot: z.enum(["first", "second"]),
  leaveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "YYYY-MM-DD 형식"),
  kind: z.enum(["leave", "work"]).optional().default("leave"),
  note: z.string().trim().max(200).optional().nullable(),
});

export const leaveExceptionUpdateSchema = leaveExceptionCreateSchema
  .omit({ centerId: true, driverId: true, timeSlot: true, leaveDate: true })
  .partial();
