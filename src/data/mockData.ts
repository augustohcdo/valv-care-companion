// Médicos fictícios e casos mock — apenas para demonstração na página inicial
export interface MockDoctor {
  id: string;
  name: string;
  crm: string;
  uf: string;
  specialty: string;
  institution: string;
}

export const mockDoctors: MockDoctor[] = [
  { id: "d1", name: "Dra. Helena Marquez", crm: "123456", uf: "SP", specialty: "Cardiologia / Imagem", institution: "Hospital Albert Coração" },
  { id: "d2", name: "Dr. Rafael Andrade", crm: "234567", uf: "RJ", specialty: "Cardiologia Intervencionista", institution: "Instituto Cardio Rio" },
  { id: "d3", name: "Dra. Marina Yoshida", crm: "345678", uf: "MG", specialty: "Cirurgia Cardiovascular", institution: "Centro Cardio BH" },
  { id: "d4", name: "Dr. Bruno Carvalho", crm: "456789", uf: "RS", specialty: "Cardiologia Clínica", institution: "Hospital São Lucas POA" },
];

export interface MockCase {
  id: string;
  patientCode: string;
  age: number;
  sex: "M" | "F";
  diagnosis: string;
  nyha: "I" | "II" | "III" | "IV";
  status: "rascunho" | "avaliacao" | "heart_team" | "tratado" | "follow_up";
  createdAt: string;
}

export const mockCases: MockCase[] = [
  { id: "c1", patientCode: "VP-0142", age: 78, sex: "F", diagnosis: "Estenose aórtica grave", nyha: "III", status: "heart_team", createdAt: "2025-04-12" },
  { id: "c2", patientCode: "VP-0143", age: 64, sex: "M", diagnosis: "Insuficiência mitral primária", nyha: "II", status: "avaliacao", createdAt: "2025-04-15" },
  { id: "c3", patientCode: "VP-0144", age: 81, sex: "F", diagnosis: "Insuficiência tricúspide secundária", nyha: "III", status: "follow_up", createdAt: "2025-04-08" },
  { id: "c4", patientCode: "VP-0145", age: 56, sex: "M", diagnosis: "Insuficiência aórtica + dilatação aorta", nyha: "II", status: "avaliacao", createdAt: "2025-04-18" },
  { id: "c5", patientCode: "VP-0146", age: 72, sex: "F", diagnosis: "Estenose aórtica grave low-flow", nyha: "III", status: "tratado", createdAt: "2025-03-28" },
  { id: "c6", patientCode: "VP-0147", age: 45, sex: "F", diagnosis: "Estenose mitral reumática", nyha: "II", status: "avaliacao", createdAt: "2025-04-20" },
];
