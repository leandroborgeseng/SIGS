export const PERMISSIONS = {
  ALL: '*',
  PATIENTS_READ: 'patients.read',
  PATIENTS_WRITE: 'patients.write',
  APPOINTMENTS: 'appointments.manage',
  ENCOUNTERS: 'encounters.manage',
  VACCINATIONS: 'vaccinations.manage',
  REPORTS: 'reports.read',
  USERS: 'users.manage',
  AUDIT: 'audit.read',
  ORG: 'organization.manage',
  PRODUCTION: 'production.manage',
} as const;

export const ROLE_SEEDS = [
  {
    code: 'TI',
    name: 'TI municipal',
    description: 'Administração total',
    permissions: [PERMISSIONS.ALL],
  },
  {
    code: 'GESTOR_UBS',
    name: 'Gestor UBS',
    description: 'Gestão da unidade e relatórios',
    permissions: [
      PERMISSIONS.PATIENTS_READ,
      PERMISSIONS.PATIENTS_WRITE,
      PERMISSIONS.APPOINTMENTS,
      PERMISSIONS.ENCOUNTERS,
      PERMISSIONS.VACCINATIONS,
      PERMISSIONS.REPORTS,
      PERMISSIONS.ORG,
      PERMISSIONS.AUDIT,
      PERMISSIONS.PRODUCTION,
    ],
  },
  {
    code: 'CLINICO',
    name: 'Enfermagem / Médico',
    description: 'Atendimento e vacinação',
    permissions: [
      PERMISSIONS.PATIENTS_READ,
      PERMISSIONS.PATIENTS_WRITE,
      PERMISSIONS.APPOINTMENTS,
      PERMISSIONS.ENCOUNTERS,
      PERMISSIONS.VACCINATIONS,
      PERMISSIONS.REPORTS,
    ],
  },
  {
    code: 'RECEPCAO',
    name: 'Recepção',
    description: 'Cadastro, agenda e fila',
    permissions: [
      PERMISSIONS.PATIENTS_READ,
      PERMISSIONS.PATIENTS_WRITE,
      PERMISSIONS.APPOINTMENTS,
      PERMISSIONS.ENCOUNTERS,
    ],
  },
] as const;
