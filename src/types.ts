export type EntityStatus = 'active' | 'archived';

export interface LegalEntity {
  id: string;
  full_name: string;
  short_name?: string | null;
  inn?: string | null;
  kpp?: string | null;
  ogrn?: string | null;
  legal_address?: string | null;
  actual_address?: string | null;
  extra_info?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Department {
  id: string;
  legal_entity_id: string;
  parent_id?: string | null;
  name: string;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Position {
  id: string;
  name: string;
  normalized_name: string;
  legal_entity_id?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface WorkSchedule {
  id: string;
  name: string;
  status: EntityStatus;
}

export interface ShiftPattern {
  id: string;
  name: string;
  status: EntityStatus;
}

export interface WorkConditionSubclass {
  id: string;
  code: string;
  name: string;
  status: EntityStatus;
}

export interface ElectricalSafetyGroup {
  id: string;
  name: string;
  status: EntityStatus;
}

export interface ContingentRecord {
  id: string;
  legal_entity_id: string;
  department_id: string;
  position_id: string;
  workplace_label?: string | null;
  work_schedule_id?: string | null;
  shift_pattern_id?: string | null;
  risk_card_number?: string | null;
  sout_card_number?: string | null;
  work_condition_subclass_id?: string | null;
  medical_items_29n?: string[] | null;
  medical_items_342n?: string[] | null;
  training_program?: string | null;
  internship_program?: string | null;
  electrical_safety_group_id?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface Employee {
  id: string;
  legal_entity_id: string;
  department_id: string;
  position_id: string;
  contingent_record_id?: string | null;
  last_name: string;
  first_name: string;
  middle_name?: string | null;
  hire_date?: string | null;
  birth_date?: string | null;
  snils?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

// История кадровых перемещений работников (D-005, DATA_MODEL §1.12)
export interface EmploymentHistoryRecord {
  id: string;
  employee_id: string;
  start_date?: string | null;
  end_date?: string | null; // NULL = текущий период
  department_id?: string | null;
  position_id?: string | null;
  contingent_record_id?: string | null;
  reason?: string | null;
  comment?: string | null;
  created_at: string;
}

export interface AuditLogItem {
  id: string;
  entity_type: string;
  entity_id: string;
  action:
    | 'create'
    | 'update'
    | 'archive'
    | 'restore_from_archive'
    | 'import_create'
    | 'import_update'
    | 'restore'
    | 'contingent_create'
    | 'contingent_update'
    | 'contingent_archive'
    | 'contingent_restore'
    | 'contingent_import'
    | 'employee_create'
    | 'employee_update'
    | 'employee_archive'
    | 'employee_restore'
    | 'employee_import'
    | 'employment_history_close'
    | 'employment_history_open';
  changed_at: string;
  actor: string;
  before_data?: Record<string, any> | null;
  after_data?: Record<string, any> | null;
  comment?: string | null;
}

export interface ModuleItem {
  module_id: string;
  title: string;
  description: string;
  version: string;
  enabled: boolean;
  requires_core: string[];
}

export interface ImportRowResult {
  row: number;
  action: 'add' | 'update' | 'skip' | 'reject';
  name: string;
  errors: string[];
  warnings: string[];
  changes: string[];
  data: Partial<LegalEntity>;
}

export interface ImportPreviewData {
  results: ImportRowResult[];
  structure_errors: string[];
  summary: {
    total: number;
    add: number;
    update: number;
    skip: number;
    reject: number;
  };
}

export interface ContingentImportRowResult {
  row: number;
  action: 'add' | 'update' | 'skip' | 'reject';
  title: string;
  errors: string[];
  warnings: string[];
  changes: string[];
  data: {
    legal_entity_name: string;
    department_name: string;
    position_name: string;
    workplace_label?: string;
    work_schedule_name?: string;
    shift_pattern_name?: string;
    risk_card_number?: string;
    sout_card_number?: string;
    work_condition_subclass_name?: string;
    items_29n?: string;
    items_342n?: string;
    training_program?: string;
    internship_program?: string;
    electrical_safety_group_name?: string;
  };
}

export interface ContingentImportPreviewData {
  results: ContingentImportRowResult[];
  structure_errors: string[];
  summary: {
    total: number;
    add: number;
    update: number;
    skip: number;
    reject: number;
  };
}

export interface EmployeeImportRowResult {
  row: number;
  action: 'add' | 'update' | 'skip' | 'reject';
  title: string;
  errors: string[];
  warnings: string[];
  changes: string[];
  data: {
    legal_entity_name: string;
    department_name: string;
    position_name: string;
    last_name: string;
    first_name: string;
    middle_name?: string;
    hire_date?: string;
    birth_date?: string;
    snils?: string;
    contingent_label?: string;
  };
}

export interface EmployeeImportPreviewData {
  results: EmployeeImportRowResult[];
  structure_errors: string[];
  summary: {
    total: number;
    add: number;
    update: number;
    skip: number;
    reject: number;
  };
}

export interface BackupManifest {
  id: string;
  created_at: string;
  label?: string;
  counts: {
    legal_entities: number;
    departments: number;
    positions: number;
    contingent: number;
    employees: number;
    employment_history?: number;
    audit_logs: number;
  };
  data: {
    legal_entities: LegalEntity[];
    departments: Department[];
    positions: Position[];
    contingent: ContingentRecord[];
    employees: Employee[];
    employment_history?: EmploymentHistoryRecord[];
    audit_logs: AuditLogItem[];
  };
}
