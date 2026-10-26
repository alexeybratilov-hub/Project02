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
    | 'employment_history_open'
    | 'integrity_check'
    | 'sout_create'
    | 'sout_update'
    | 'sout_archive'
    | 'sout_restore'
    | 'sout_familiarize'
    | 'sout_import';
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

// ==============================
// Модуль «СОУТ» (Этап 6+, 426-ФЗ)
// ==============================

export type SoutHarmfulFactorType =
  | 'noise' // шум
  | 'vibration_general' // общая вибрация
  | 'vibration_local' // локальная вибрация
  | 'chemical' // химический фактор
  | 'microclimate' // микроклимат
  | 'illumination' // освещённость
  | 'gravity' // тяжесть трудового процесса
  | 'stress' // напряжённость трудового процесса
  | 'biological' // биологический фактор
  | 'other'; // прочее

export const SOUT_FACTOR_LABELS_RU: Record<SoutHarmfulFactorType, string> = {
  noise: 'Шум',
  vibration_general: 'Общая вибрация',
  vibration_local: 'Локальная вибрация',
  chemical: 'Химический фактор',
  microclimate: 'Микроклимат',
  illumination: 'Освещённость',
  gravity: 'Тяжесть трудового процесса',
  stress: 'Напряжённость трудового процесса',
  biological: 'Биологический фактор',
  other: 'Прочие факторы',
};

export interface SoutHarmfulFactor {
  type: SoutHarmfulFactorType;
  class: string; // класс условий труда по фактору: '1', '2', '3.1', '3.2', '3.3', '3.4', '4'
  note?: string | null; // примечание (результаты измерений, ПДК/ПДУ и т.п.)
}

// Гарантии и компенсации по ТК РФ, назначаемые по итогам СОУТ
export interface SoutGuarantees {
  reduced_hours: boolean; // ст. 92 ТК РФ: сокращённая продолжительность рабочего времени (36 ч) — классы 3.3, 3.4, 4
  extra_vacation_days: number; // ст. 117 ТК РФ: ежегодный дополнительный оплачиваемый отпуск, дней (>=7 для 3.2–4)
  pay_increase_percent: number; // ст. 147 ТК РФ: повышенная оплата труда, % (не менее 4% для 3.1–4)
  milk_issue: boolean; // ст. 222 ТК РФ: бесплатная выдача молока или равноценных продуктов
  early_pension: boolean; // право на досрочное пенсионное обеспечение (Списки № 1/№ 2, п. 1 ст. 30 400-ФЗ)
  ppe_issue: boolean; // обеспечение СИЗ (ст. 221 ТК РФ)
}

export interface SoutCard {
  id: string;
  card_number: string; // номер карты СОУТ
  legal_entity_id: string;
  department_id: string;
  position_id: string;
  workplace_label?: string | null; // уточнение рабочего места
  is_analogous: boolean; // рабочее место признано аналогичным
  analogous_basis?: string | null; // основание/реквизиты карты основного рабочего места
  factors: SoutHarmfulFactor[]; // идентифицированные вредные и опасные производственные факторы
  final_class: string; // итоговый класс условий труда: 1, 2, 3.1, 3.2, 3.3, 3.4, 4
  employees_count: number; // численность занятых работников
  women_count: number; // из них женщин
  minors_count: number; // из них несовершеннолетних
  disabled_count: number; // из них инвалидов
  guarantees: SoutGuarantees;
  measurement_org?: string | null; // организация, проводившая измерения
  protocol_number?: string | null; // номер протокола исследований (испытаний) и измерений
  report_approved_at?: string | null; // дата утверждения отчёта КОУТ (YYYY-MM-DD)
  expires_at?: string | null; // плановая дата окончания действия (5 лет, ст. 8 426-ФЗ), пусто при бессрочной
  declaration_active: boolean; // декларация соответствия условий труда зарегистрирована (ст. 11 426-ФЗ)
  declaration_number?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface SoutFamiliarization {
  id: string;
  sout_card_id: string;
  employee_id: string;
  signed_at: string; // YYYY-MM-DD — дата ознакомления под роспись (ст. 5 426-ФЗ)
  comment?: string | null;
  created_at: string;
}

export interface SoutImportRowResult {
  row: number;
  action: 'add' | 'update' | 'skip' | 'reject';
  title: string;
  errors: string[];
  warnings: string[];
  changes: string[];
  data: Record<string, string>;
}

export interface SoutImportPreviewData {
  results: SoutImportRowResult[];
  structure_errors: string[];
  summary: {
    total: number;
    add: number;
    update: number;
    skip: number;
    reject: number;
  };
}

// ===============================================
// Модуль «Оценка профессиональных рисков (ОПР)» (Этап 7, Приказ Минтруда 776н)
// ===============================================

export type RiskLevel = 'low' | 'moderate' | 'high' | 'unacceptable';

export const RISK_LEVEL_LABELS_RU: Record<RiskLevel, { name: string; badgeClass: string; desc: string }> = {
  low: {
    name: 'Низкий (приемлемый)',
    badgeClass: 'bg-emerald-100 text-emerald-800 border-emerald-300',
    desc: 'Риск под контролем, срочных мероприятий не требуется.',
  },
  moderate: {
    name: 'Умеренный (допустимый)',
    badgeClass: 'bg-amber-100 text-amber-800 border-amber-300',
    desc: 'Требуется периодический контроль и соблюдение правил безопасности.',
  },
  high: {
    name: 'Высокий (существенный)',
    badgeClass: 'bg-orange-100 text-orange-800 border-orange-300',
    desc: 'Требуется разработка и реализация плана мероприятий по снижению риска.',
  },
  unacceptable: {
    name: 'Недопустимый (критический)',
    badgeClass: 'bg-rose-100 text-rose-800 border-rose-300',
    desc: 'Требуются неотложные меры или приостановка работ до устранения опасности.',
  },
};

export interface OprHazard {
  id: string;
  code?: string | null;
  category: string; // Механическая, Электрическая, Термическая, Падение, Физическая, Химическая, Биологическая, Психофизиологическая, Прочая
  name: string;
  danger_source?: string | null;
  severity: number; // 1..5
  probability: number; // 1..5
  risk_score: number; // 1..25
  risk_level: RiskLevel;
  existing_measures?: string | null;
  recommended_measures?: string | null;
}

export interface OprCard {
  id: string;
  card_number: string; // Номер карты ОПР («ОПР-001»)
  legal_entity_id: string;
  department_id: string;
  position_id: string;
  contingent_record_id?: string | null;
  workplace_label?: string | null;
  assessment_date?: string | null; // YYYY-MM-DD
  assessment_method: string; // Матричный метод 5х5 / Файна-Кинни
  commission_members?: string | null;
  hazards: OprHazard[];
  overall_risk_score: number;
  overall_risk_level: RiskLevel;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export interface OprMeasureItem {
  id: string;
  opr_card_id: string;
  hazard_id?: string | null;
  measure_title: string;
  deadline?: string | null; // YYYY-MM-DD
  responsible_person?: string | null;
  status: 'planned' | 'in_progress' | 'completed';
  cost_estimate?: string | null;
  comment?: string | null;
  created_at: string;
  updated_at: string;
}

export interface OprImportRowResult {
  row: number;
  action: 'add' | 'update' | 'skip' | 'reject';
  title: string;
  errors: string[];
  warnings: string[];
  changes: string[];
  data: Record<string, string>;
}

export interface OprImportPreviewData {
  results: OprImportRowResult[];
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
    sout_cards?: number;
    sout_familiarizations?: number;
    opr_cards?: number;
    opr_measures?: number;
    audit_logs: number;
  };
  data: {
    legal_entities: LegalEntity[];
    departments: Department[];
    positions: Position[];
    contingent: ContingentRecord[];
    employees: Employee[];
    employment_history?: EmploymentHistoryRecord[];
    sout_cards?: SoutCard[];
    sout_familiarizations?: SoutFamiliarization[];
    opr_cards?: OprCard[];
    opr_measures?: OprMeasureItem[];
    medical_cards?: MedicalExaminationCard[];
    psychiatric_exams?: PsychiatricExamination[];
    audit_logs: AuditLogItem[];
  };
}

export interface DataIntegrityReport {
  valid: boolean;
  timestamp: string;
  errors: string[];
  warnings: string[];
  stats: {
    legal_entities: number;
    departments: number;
    positions: number;
    contingent: number;
    employees: number;
    employment_history: number;
    sout_cards: number;
    sout_familiarizations: number;
    opr_cards?: number;
    opr_measures?: number;
    medical_cards?: number;
    psychiatric_exams?: number;
    audit_logs: number;
  };
}


// ==================== ЭТАП 8: МЕДОСМОТРЫ И ПСИХИАТРИЧЕСКОЕ ОСВИДЕТЕЛЬСТВОВАНИЕ (29н/342н) ====================

export type MedicalExamType = 'preliminary' | 'periodic' | 'pre_shift';

export const MEDICAL_EXAM_TYPE_LABELS_RU: Record<MedicalExamType, string> = {
  preliminary: 'Предварительный (при поступлении на работу)',
  periodic: 'Периодический',
  pre_shift: 'Предсменный (предрейсовый)',
};

export type MedicalConclusion = 'fit' | 'fit_restrictions' | 'unfit' | 'pending';

export const MEDICAL_CONCLUSION_LABELS_RU: Record<MedicalConclusion, { name: string; badgeClass: string }> = {
  fit: { name: 'Годен', badgeClass: 'badge-green' },
  fit_restrictions: { name: 'Годен с ограничениями', badgeClass: 'badge-yellow' },
  unfit: { name: 'Не годен', badgeClass: 'badge-red' },
  pending: { name: 'Заключение не получено', badgeClass: 'badge-gray' },
};

export interface MedicalExaminationCard {
  id: string;
  card_number: string; // «МЕД-001», уникальна в пределах юрлица
  legal_entity_id: string;
  employee_id: string;
  contingent_record_id?: string | null;
  sout_card_id?: string | null; // основание направления (карта СОУТ)
  exam_type: MedicalExamType;
  referral_date?: string | null; // YYYY-MM-DD — дата выдачи направления
  exam_date?: string | null; // YYYY-MM-DD — дата прохождения медосмотра
  next_due_date?: string | null; // YYYY-MM-DD — срок следующего периодического медосмотра
  clinic_name?: string | null;
  doctor_fio?: string | null;
  conclusion: MedicalConclusion;
  conclusion_details?: string | null;
  contraindications_found?: boolean;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}

export type PsychiatricConclusion = 'fit' | 'unfit' | 'fit_restricted';

export const PSYCHIATRIC_CONCLUSION_LABELS_RU: Record<PsychiatricConclusion, { name: string; badgeClass: string }> = {
  fit: { name: 'Годен', badgeClass: 'badge-green' },
  fit_restricted: { name: 'Годен с ограничениями', badgeClass: 'badge-yellow' },
  unfit: { name: 'Не годен', badgeClass: 'badge-red' },
};

export interface PsychiatricExamination {
  id: string;
  legal_entity_id: string;
  employee_id: string;
  exam_date?: string | null; // YYYY-MM-DD
  commission_members?: string | null;
  conclusion: PsychiatricConclusion;
  conclusion_protocol_number?: string | null;
  valid_until?: string | null; // YYYY-MM-DD
  basis?: string | null; // перечень работ (Приложение к 342н)
  comment?: string | null;
  status: EntityStatus;
  created_at: string;
  updated_at: string;
}


export interface MedicalImportRowResult {
  row: number;
  action: 'add' | 'update' | 'skip' | 'reject';
  title: string;
  errors: string[];
  warnings: string[];
  changes: string[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: Record<string, any>;
}

export interface MedicalImportPreviewData {
  results: MedicalImportRowResult[];
  structure_errors: string[];
  summary: {
    total: number;
    add: number;
    update: number;
    skip: number;
    reject: number;
  };
}
