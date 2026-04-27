import { z } from "zod";

export const UF_LIST = [
  "AC","AL","AP","AM","BA","CE","DF","ES","GO","MA","MT","MS","MG","PA","PB",
  "PR","PE","PI","RJ","RN","RS","RO","RR","SC","SP","SE","TO",
] as const;

export const loginSchema = z.object({
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z.string().min(8, { message: "Mínimo de 8 caracteres" }).max(72),
});

const baseSignup = {
  email: z.string().trim().email({ message: "E-mail inválido" }).max(255),
  password: z
    .string()
    .min(8, { message: "Mínimo de 8 caracteres" })
    .max(72, { message: "Máximo de 72 caracteres" })
    .regex(/[A-Z]/, { message: "Inclua ao menos uma letra maiúscula" })
    .regex(/[a-z]/, { message: "Inclua ao menos uma letra minúscula" })
    .regex(/[0-9]/, { message: "Inclua ao menos um número" }),
  full_name: z.string().trim().min(3, { message: "Nome muito curto" }).max(120),
  phone: z.string().trim().max(20).optional().or(z.literal("")),
  terms: z.literal(true, { errorMap: () => ({ message: "Aceite obrigatório" }) }),
  lgpd: z.literal(true, { errorMap: () => ({ message: "Aceite obrigatório" }) }),
};

export const doctorSignupSchema = z.object({
  ...baseSignup,
  account_type: z.literal("medico"),
  crm: z.string().trim().min(3, { message: "CRM inválido" }).max(20),
  crm_uf: z.enum(UF_LIST, { errorMap: () => ({ message: "Selecione a UF" }) }),
  specialty: z.string().trim().min(3, { message: "Informe a especialidade" }).max(120),
  institution: z.string().trim().max(160).optional().or(z.literal("")),
});

export const patientSignupSchema = z.object({
  ...baseSignup,
  account_type: z.literal("paciente"),
  doctor_crm: z.string().trim().max(20).optional().or(z.literal("")),
  doctor_crm_uf: z
    .union([z.enum(UF_LIST), z.literal("")])
    .optional(),
});

export type DoctorSignupInput = z.infer<typeof doctorSignupSchema>;
export type PatientSignupInput = z.infer<typeof patientSignupSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
