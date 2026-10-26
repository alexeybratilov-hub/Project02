import {
  LegalEntity,
  Department,
  Position,
  ContingentRecord,
  Employee,
  EmploymentHistoryRecord,
  AuditLogItem,
  ModuleItem,
  EntityStatus,
  WorkSchedule,
  ShiftPattern,
  WorkConditionSubclass,
  ElectricalSafetyGroup,
  DataIntegrityReport,
  SoutCard,
  SoutFamiliarization,
  SoutGuarantees,
  SoutHarmfulFactor,
  OprCard,
  OprHazard,
  OprMeasureItem,
  RiskLevel,
  RISK_LEVEL_LABELS_RU,
  MedicalExaminationCard,
  MedicalExamType,
  MedicalConclusion,
  MEDICAL_EXAM_TYPE_LABELS_RU,
  MEDICAL_CONCLUSION_LABELS_RU,
  PsychiatricExamination,
  PsychiatricConclusion,
  PSYCHIATRIC_CONCLUSION_LABELS_RU,
} from '../types';
import {
  normalizeText,
  validateInn,
  validateKpp,
  validateOgrn,
  findDuplicates,
  ciCompare,
  normalizeSnils,
  validateDateNotFuture,
  findEmployeeDuplicates,
} from './validation';

const STORAGE_KEYS = {
  LEGAL_ENTITIES: 'saot_legal_entities',
  DEPARTMENTS: 'saot_departments',
  POSITIONS: 'saot_positions',
  CONTINGENT: 'saot_contingent',
  EMPLOYEES: 'saot_employees',
  EMPLOYMENT_HISTORY: 'saot_employment_history',
  AUDIT_LOG: 'saot_audit_log',
  MODULES: 'saot_modules',
  CURRENT_LE: 'saot_current_le',
  WORK_SCHEDULES: 'saot_work_schedules',
  SHIFT_PATTERNS: 'saot_shift_patterns',
  WORK_CONDITION_SUBCLASSES: 'saot_work_condition_subclasses',
  ELECTRICAL_SAFETY_GROUPS: 'saot_electrical_safety_groups',
  SOUT_CARDS: 'saot_sout_cards',
  SOUT_FAMILIARIZATIONS: 'saot_sout_familiarizations',
  OPR_CARDS: 'saot_opr_cards',
  OPR_MEASURES: 'saot_opr_measures',
  MEDICAL_CARDS: 'saot_medical_cards',
  PSYCHIATRIC_EXAMS: 'saot_psychiatric_exams',
};


function generateUUID(): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

function nowISO(): string {
  return new Date().toISOString();
}

function loadFromStorage<T>(key: string, defaultValue: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultValue;
    return JSON.parse(raw);
  } catch (err) {
    console.error(`Error loading ${key} from storage:`, err);
    return defaultValue;
  }
}

function saveToStorage<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch (err) {
    console.error(`Error saving ${key} to storage:`, err);
  }
}

// Initial condition dictionaries
const DEFAULT_WORK_SCHEDULES: WorkSchedule[] = [
  { id: 'ws-1', name: '5-дневная 40-часовая рабочая неделя', status: 'active' },
  { id: 'ws-2', name: '6-дневная 40-часовая рабочая неделя', status: 'active' },
  { id: 'ws-3', name: 'Сменный график (2/2)', status: 'active' },
  { id: 'ws-4', name: 'Ненормированный рабочий день', status: 'active' },
  { id: 'ws-5', name: 'Сокращённое рабочее время (36 часов)', status: 'active' },
];

const DEFAULT_SHIFT_PATTERNS: ShiftPattern[] = [
  { id: 'sp-1', name: '1 смена (дневная)', status: 'active' },
  { id: 'sp-2', name: '2 смены', status: 'active' },
  { id: 'sp-3', name: '3 смены', status: 'active' },
  { id: 'sp-4', name: 'Суточный график (1/3)', status: 'active' },
  { id: 'sp-5', name: 'Вахтовый метод', status: 'active' },
];

const DEFAULT_WORK_CONDITION_SUBCLASSES: WorkConditionSubclass[] = [
  { id: 'wcs-1', code: '1', name: '1 (оптимальные)', status: 'active' },
  { id: 'wcs-2', code: '2', name: '2 (допустимые)', status: 'active' },
  { id: 'wcs-3', code: '3.1', name: '3.1 (вредные 1 степени)', status: 'active' },
  { id: 'wcs-4', code: '3.2', name: '3.2 (вредные 2 степени)', status: 'active' },
  { id: 'wcs-5', code: '3.3', name: '3.3 (вредные 3 степени)', status: 'active' },
  { id: 'wcs-6', code: '3.4', name: '3.4 (вредные 4 степени)', status: 'active' },
  { id: 'wcs-7', code: '4', name: '4 (опасные)', status: 'active' },
];

const DEFAULT_ELECTRICAL_SAFETY_GROUPS: ElectricalSafetyGroup[] = [
  { id: 'esg-1', name: 'I группа (неэлектротехнический персонал)', status: 'active' },
  { id: 'esg-2', name: 'II группа', status: 'active' },
  { id: 'esg-3', name: 'III группа', status: 'active' },
  { id: 'esg-4', name: 'IV группа', status: 'active' },
  { id: 'esg-5', name: 'V группа', status: 'active' },
];

// Initial modules definition
const DEFAULT_MODULES: ModuleItem[] = [
  {
    module_id: 'legal_entities',
    title: 'Юридические лица',
    description: 'Реестр юридических лиц: карточки, архив, импорт/экспорт Excel.',
    version: '0.1.0',
    enabled: true,
    requires_core: ['db', 'audit', 'errors'],
  },
  {
    module_id: 'contingent',
    title: 'Контингент',
    description: 'Реестр контингента работников: рабочие места, факторы, условия труда, приказы 29н/342н.',
    version: '0.2.0',
    enabled: true,
    requires_core: ['db', 'legal_entities'],
  },
  {
    module_id: 'employees',
    title: 'Работники',
    description: 'Поимённый список работников, учет СНИЛС, связь с контингентом.',
    version: '0.1.0',
    enabled: true,
    requires_core: ['db', 'legal_entities', 'contingent'],
  },
  {
    module_id: 'sout',
    title: 'СОУТ',
    description:
      'Специальная оценка условий труда (426-ФЗ): карты СОУТ, классы условий труда, вредные факторы, гарантии и компенсации по ТК РФ (ст. 92, 117, 147, 222), сроки действия и декларация (ст. 8, 11), ознакомление под роспись (ст. 5), импорт/экспорт.',
    version: '1.0.0',
    enabled: false,
    requires_core: ['db', 'legal_entities', 'contingent', 'employees'],
  },
  {
    module_id: 'opr',
    title: 'Оценка профессиональных рисков (ОПР)',
    description:
      'Идентификация опасностей (Приказ Минтруда 776н), матрица оценки рисков (тяжесть x вероятность), карты рисков рабочего места, план мероприятий по снижению рисков, импорт/экспорт.',
    version: '1.0.0',
    enabled: false,
    requires_core: ['db', 'legal_entities', 'contingent'],
  },
  {
    module_id: 'medical',
    title: 'Медосмотры и психиатрическое освидетельствование',
    description:
      'Учёт карт предварительных и периодических медосмотров (Приказ Минздрава 29н), актов психиатрического освидетельствования (Приказ Минздрава 342н), контроль сроков действия заключений, связь с контингентом и картами СОУТ, импорт/экспорт.',
    version: '1.0.0',
    enabled: false,
    requires_core: ['db', 'legal_entities', 'contingent', 'employees', 'sout'],
  },
];

export interface StandardHazardTemplate {
  code: string;
  category: string;
  name: string;
  danger_source?: string;
  default_severity: number;
  default_probability: number;
  recommended_measures: string;
}

export const DEFAULT_OPR_HAZARDS: StandardHazardTemplate[] = [
  {
    code: '01.01',
    category: 'Механические опасности',
    name: 'Опасность падения из-за потери равновесия / скользкий пол',
    default_severity: 2,
    default_probability: 3,
    recommended_measures: 'Уборка загрязнений, противоскользящие покрытия, нескользкая спецобувь',
  },
  {
    code: '01.02',
    category: 'Механические опасности',
    name: 'Опасность падения предметов и грузов с высоты',
    default_severity: 4,
    default_probability: 2,
    recommended_measures: 'Защитные каски, ограждение зоны перемещения грузов, защитные сетки',
  },
  {
    code: '01.03',
    category: 'Механические опасности',
    name: 'Опасность затягивания в подвижные детали оборудования и механизмов',
    default_severity: 4,
    default_probability: 2,
    recommended_measures: 'Защитные кожухи, блокировки пуска, концевые выключатели',
  },
  {
    code: '01.04',
    category: 'Механические опасности',
    name: 'Опасность пореза острыми кромками, заусенцами, режущим инструментом',
    default_severity: 2,
    default_probability: 3,
    recommended_measures: 'Защитные перчатки от порезов, регулярная отбраковка инструмента',
  },
  {
    code: '02.01',
    category: 'Электрические опасности',
    name: 'Опасность прямого прикосновения к токоведущим частям под напряжением',
    default_severity: 5,
    default_probability: 1,
    recommended_measures: 'Изоляция, защитные оболочки, предупреждающие знаки, УЗО',
  },
  {
    code: '02.02',
    category: 'Электрические опасности',
    name: 'Опасность косвенного прикосновения при повреждении изоляции (пробой на корпус)',
    default_severity: 4,
    default_probability: 2,
    recommended_measures: 'Защитное заземление и зануление, периодические замеры сопротивления изоляции',
  },
  {
    code: '03.01',
    category: 'Термические опасности',
    name: 'Опасность термического ожога от контакта с нагретыми поверхностями или жидкостями',
    default_severity: 3,
    default_probability: 2,
    recommended_measures: 'Теплоизоляция горячих трубопроводов, термостойкие перчатки',
  },
  {
    code: '04.01',
    category: 'Физические факторы',
    name: 'Воздействие повышенного уровня производственного шума',
    default_severity: 3,
    default_probability: 3,
    recommended_measures: 'Звукоизоляция оборудования, наушники/вкладыши противошумные',
  },
  {
    code: '04.02',
    category: 'Физические факторы',
    name: 'Воздействие недостаточной освещенности рабочей зоны',
    default_severity: 2,
    default_probability: 3,
    recommended_measures: 'Своевременная замена ламп, установка местного освещения',
  },
  {
    code: '05.01',
    category: 'Химические опасности',
    name: 'Вдыхание вредных паров, газов, аэрозолей или пыли',
    default_severity: 3,
    default_probability: 2,
    recommended_measures: 'Приточно-вытяжная вентиляция, фильтрующие респираторы',
  },
  {
    code: '06.01',
    category: 'Психофизиологические опасности',
    name: 'Физические перегрузки при подъеме и перемещении тяжестей вручную',
    default_severity: 3,
    default_probability: 3,
    recommended_measures: 'Механизация подъема (тележки, тали), соблюдение предельных норм подъема тяжестей',
  },
  {
    code: '06.02',
    category: 'Психофизиологические опасности',
    name: 'Длительное статическое напряжение и неудобная рабочая поза',
    default_severity: 2,
    default_probability: 4,
    recommended_measures: 'Эргономичные рабочие кресла, чередование поз, регламентированные перерывы',
  },
];

class StorageService {
  private getLegalEntitiesRaw(): LegalEntity[] {
    return loadFromStorage<LegalEntity[]>(STORAGE_KEYS.LEGAL_ENTITIES, []);
  }

  private saveLegalEntitiesRaw(items: LegalEntity[]): void {
    saveToStorage(STORAGE_KEYS.LEGAL_ENTITIES, items);
  }

  public getDepartmentsRaw(): Department[] {
    return loadFromStorage<Department[]>(STORAGE_KEYS.DEPARTMENTS, []);
  }

  public saveDepartmentsRaw(items: Department[]): void {
    saveToStorage(STORAGE_KEYS.DEPARTMENTS, items);
  }

  public getPositionsRaw(): Position[] {
    return loadFromStorage<Position[]>(STORAGE_KEYS.POSITIONS, []);
  }

  public savePositionsRaw(items: Position[]): void {
    saveToStorage(STORAGE_KEYS.POSITIONS, items);
  }

  public getContingentRaw(): ContingentRecord[] {
    return loadFromStorage<ContingentRecord[]>(STORAGE_KEYS.CONTINGENT, []);
  }

  public saveContingentRaw(items: ContingentRecord[]): void {
    saveToStorage(STORAGE_KEYS.CONTINGENT, items);
  }

  public getEmployeesRaw(): Employee[] {
    return loadFromStorage<Employee[]>(STORAGE_KEYS.EMPLOYEES, []);
  }

  public saveEmployeesRaw(items: Employee[]): void {
    saveToStorage(STORAGE_KEYS.EMPLOYEES, items);
  }

  public getEmploymentHistoryRaw(): EmploymentHistoryRecord[] {
    return loadFromStorage<EmploymentHistoryRecord[]>(STORAGE_KEYS.EMPLOYMENT_HISTORY, []);
  }

  public saveEmploymentHistoryRaw(items: EmploymentHistoryRecord[]): void {
    saveToStorage(STORAGE_KEYS.EMPLOYMENT_HISTORY, items);
  }

  public listEmploymentHistory(employeeId: string): EmploymentHistoryRecord[] {
    return this.getEmploymentHistoryRaw()
      .filter(h => h.employee_id === employeeId)
      .sort((a, b) => (b.start_date || b.created_at).localeCompare(a.start_date || a.created_at));
  }

  public getAuditLogs(): AuditLogItem[] {
    return loadFromStorage<AuditLogItem[]>(STORAGE_KEYS.AUDIT_LOG, []);
  }

  public getWorkSchedules(): WorkSchedule[] {
    return loadFromStorage<WorkSchedule[]>(STORAGE_KEYS.WORK_SCHEDULES, DEFAULT_WORK_SCHEDULES);
  }

  public getShiftPatterns(): ShiftPattern[] {
    return loadFromStorage<ShiftPattern[]>(STORAGE_KEYS.SHIFT_PATTERNS, DEFAULT_SHIFT_PATTERNS);
  }

  public getWorkConditionSubclasses(): WorkConditionSubclass[] {
    return loadFromStorage<WorkConditionSubclass[]>(
      STORAGE_KEYS.WORK_CONDITION_SUBCLASSES,
      DEFAULT_WORK_CONDITION_SUBCLASSES
    );
  }

  public getElectricalSafetyGroups(): ElectricalSafetyGroup[] {
    return loadFromStorage<ElectricalSafetyGroup[]>(
      STORAGE_KEYS.ELECTRICAL_SAFETY_GROUPS,
      DEFAULT_ELECTRICAL_SAFETY_GROUPS
    );
  }

  public addAudit(
    entity_type: string,
    entity_id: string,
    action: AuditLogItem['action'],
    before: Record<string, any> | null,
    after: Record<string, any> | null,
    comment?: string | null,
    actor: string = 'system'
  ): void {
    const logs = this.getAuditLogs();
    const item: AuditLogItem = {
      id: generateUUID(),
      entity_type,
      entity_id,
      action,
      changed_at: nowISO(),
      actor,
      before_data: before,
      after_data: after,
      comment: comment || null,
    };
    logs.unshift(item);
    saveToStorage(STORAGE_KEYS.AUDIT_LOG, logs);
  }

  // --- Current Selected Legal Entity ---
  public isModuleEnabled(moduleId: string): boolean {
    return this.getModules().some(m => m.module_id === moduleId && m.enabled);
  }

  public getCurrentLegalEntityId(): string | null {
    return localStorage.getItem(STORAGE_KEYS.CURRENT_LE);
  }

  public setCurrentLegalEntityId(id: string | null): void {
    if (id) {
      localStorage.setItem(STORAGE_KEYS.CURRENT_LE, id);
    } else {
      localStorage.removeItem(STORAGE_KEYS.CURRENT_LE);
    }
  }

  public getCurrentLegalEntity(): LegalEntity | null {
    const id = this.getCurrentLegalEntityId();
    if (!id) return null;
    const item = this.getLegalEntityById(id);
    if (!item || item.status !== 'active') {
      this.setCurrentLegalEntityId(null);
      return null;
    }
    return item;
  }

  // --- Legal Entities CRUD ---
  public listLegalEntities(params?: {
    search?: string;
    status?: EntityStatus;
    page?: number;
    pageSize?: number;
  }): { items: LegalEntity[]; total: number } {
    const all = this.getLegalEntitiesRaw();
    const status = params?.status || 'active';
    let filtered = all.filter(le => le.status === status);

    const term = (params?.search || '').trim();
    if (term) {
      const isNumeric = /^\d+$/.test(term);
      const needle = ciCompare(term);
      filtered = filtered.filter(le => {
        if (isNumeric && le.inn && le.inn.includes(term)) {
          return true;
        }
        return (
          ciCompare(le.full_name).includes(needle) ||
          ciCompare(le.short_name || '').includes(needle) ||
          (le.inn && le.inn.includes(term))
        );
      });
    }

    filtered.sort((a, b) => ciCompare(a.full_name).localeCompare(ciCompare(b.full_name)));

    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items, total };
  }

  public getLegalEntityById(id: string): LegalEntity | null {
    const all = this.getLegalEntitiesRaw();
    return all.find(le => le.id === id) || null;
  }

  public createLegalEntity(data: {
    full_name: string;
    short_name?: string | null;
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    legal_address?: string | null;
    actual_address?: string | null;
    extra_info?: string | null;
  }): LegalEntity {
    const full_name = normalizeText(data.full_name);
    if (!full_name) {
      throw new Error('Полное наименование обязательно для заполнения.');
    }

    const inn = validateInn(normalizeText(data.inn));
    const kpp = validateKpp(normalizeText(data.kpp));
    const ogrn = validateOgrn(normalizeText(data.ogrn));

    const all = this.getLegalEntitiesRaw();
    const { conflict } = findDuplicates(all, { inn, kpp, ogrn, full_name });
    if (conflict) {
      throw new Error(conflict);
    }

    const now = nowISO();
    const newEntity: LegalEntity = {
      id: generateUUID(),
      full_name,
      short_name: normalizeText(data.short_name),
      inn,
      kpp,
      ogrn,
      legal_address: normalizeText(data.legal_address),
      actual_address: normalizeText(data.actual_address),
      extra_info: normalizeText(data.extra_info),
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    all.push(newEntity);
    this.saveLegalEntitiesRaw(all);

    this.addAudit('legal_entity', newEntity.id, 'create', null, { ...newEntity });

    return newEntity;
  }

  public updateLegalEntity(
    id: string,
    data: {
      full_name: string;
      short_name?: string | null;
      inn?: string | null;
      kpp?: string | null;
      ogrn?: string | null;
      legal_address?: string | null;
      actual_address?: string | null;
      extra_info?: string | null;
    }
  ): LegalEntity {
    const all = this.getLegalEntitiesRaw();
    const index = all.findIndex(le => le.id === id);
    if (index === -1) {
      throw new Error('Юридическое лицо не найдено.');
    }

    const existing = all[index];
    const before = { ...existing };

    const full_name = normalizeText(data.full_name) || existing.full_name;
    if (!full_name) {
      throw new Error('Полное наименование обязательно для заполнения.');
    }

    const inn = validateInn(normalizeText(data.inn ?? existing.inn));
    const kpp = validateKpp(normalizeText(data.kpp ?? existing.kpp));
    const ogrn = validateOgrn(normalizeText(data.ogrn ?? existing.ogrn));

    const { conflict } = findDuplicates(all, {
      inn,
      kpp,
      ogrn,
      full_name,
      exclude_id: existing.id,
    });
    if (conflict) {
      throw new Error(conflict);
    }

    const updated: LegalEntity = {
      ...existing,
      full_name,
      short_name: normalizeText(data.short_name),
      inn,
      kpp,
      ogrn,
      legal_address: normalizeText(data.legal_address),
      actual_address: normalizeText(data.actual_address),
      extra_info: normalizeText(data.extra_info),
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.saveLegalEntitiesRaw(all);

    this.addAudit('legal_entity', updated.id, 'update', before, { ...updated });

    return updated;
  }

  public archiveLegalEntity(id: string): LegalEntity {
    const all = this.getLegalEntitiesRaw();
    const index = all.findIndex(le => le.id === id);
    if (index === -1) {
      throw new Error('Юридическое лицо не найдено.');
    }

    const existing = all[index];
    if (existing.status === 'archived') {
      throw new Error('Юридическое лицо уже в архиве.');
    }

    const before = { ...existing };
    const counts = this.getRelatedCounts(id);

    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveLegalEntitiesRaw(all);

    if (this.getCurrentLegalEntityId() === id) {
      this.setCurrentLegalEntityId(null);
    }

    const comment =
      counts.departments || counts.contingent_records || counts.employees
        ? `В архиве остались связанные записи: подразделения — ${counts.departments}, контингент — ${counts.contingent_records}, работники — ${counts.employees}`
        : null;

    this.addAudit('legal_entity', existing.id, 'archive', before, { ...existing }, comment);

    return existing;
  }

  public restoreLegalEntity(id: string): LegalEntity {
    const all = this.getLegalEntitiesRaw();
    const index = all.findIndex(le => le.id === id);
    if (index === -1) {
      throw new Error('Юридическое лицо не найдено.');
    }

    const existing = all[index];
    if (existing.status === 'active') {
      throw new Error('Юридическое лицо уже активно.');
    }

    const before = { ...existing };
    existing.status = 'active';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveLegalEntitiesRaw(all);

    this.addAudit('legal_entity', existing.id, 'restore_from_archive', before, { ...existing });

    return existing;
  }

  public getRelatedCounts(leId: string): {
    departments: number;
    contingent_records: number;
    employees: number;
  } {
    const depts = this.getDepartmentsRaw().filter(
      d => d.legal_entity_id === leId && d.status === 'active'
    ).length;
    const contingent = this.getContingentRaw().filter(
      c => c.legal_entity_id === leId && c.status === 'active'
    ).length;
    const employees = this.getEmployeesRaw().filter(
      e => e.legal_entity_id === leId && e.status === 'active'
    ).length;

    return {
      departments: depts,
      contingent_records: contingent,
      employees,
    };
  }

  public getStats(): { active: number; archived: number } {
    const all = this.getLegalEntitiesRaw();
    const active = all.filter(le => le.status === 'active').length;
    const archived = all.filter(le => le.status === 'archived').length;
    return { active, archived };
  }

  // --- Departments (FR-03, DATA_MODEL §1.2) ---
  public getDepartments(legalEntityId?: string, status: EntityStatus = 'active'): Department[] {
    const all = this.getDepartmentsRaw();
    return all.filter(
      d =>
        (!legalEntityId || d.legal_entity_id === legalEntityId) &&
        (!status || d.status === status)
    );
  }

  public getDepartmentById(id: string): Department | null {
    return this.getDepartmentsRaw().find(d => d.id === id) || null;
  }

  public createDepartment(data: {
    legal_entity_id: string;
    name: string;
    parent_id?: string | null;
  }): Department {
    const name = normalizeText(data.name);
    if (!name) throw new Error('Наименование подразделения обязательно.');

    const le = this.getLegalEntityById(data.legal_entity_id);
    if (!le) throw new Error('Юридическое лицо не найдено.');

    const all = this.getDepartmentsRaw();
    const dup = all.find(
      d =>
        d.legal_entity_id === data.legal_entity_id &&
        (d.parent_id || null) === (data.parent_id || null) &&
        ciCompare(d.name) === ciCompare(name) &&
        d.status === 'active'
    );
    if (dup) {
      throw new Error(`Подразделение «${name}» уже существует в данном подразделении/организации.`);
    }

    const now = nowISO();
    const newDept: Department = {
      id: generateUUID(),
      legal_entity_id: data.legal_entity_id,
      parent_id: data.parent_id || null,
      name,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    all.push(newDept);
    this.saveDepartmentsRaw(all);

    this.addAudit('department', newDept.id, 'create', null, { ...newDept });
    return newDept;
  }

  // --- Positions (FR-04, DATA_MODEL §1.3, D-013) ---
  public getPositions(status: EntityStatus = 'active'): Position[] {
    const all = this.getPositionsRaw();
    return all.filter(p => !status || p.status === status);
  }

  public getPositionById(id: string): Position | null {
    return this.getPositionsRaw().find(p => p.id === id) || null;
  }

  public createPosition(name: string): Position {
    const norm = normalizeText(name);
    if (!norm) throw new Error('Наименование должности обязательно.');

    const normalized_name = norm.toLowerCase().replace(/\s+/g, ' ').trim();
    const all = this.getPositionsRaw();
    const dup = all.find(p => p.normalized_name === normalized_name && p.status === 'active');
    if (dup) {
      return dup; // Returns existing global position according to D-013
    }

    const now = nowISO();
    const newPos: Position = {
      id: generateUUID(),
      name: norm,
      normalized_name,
      status: 'active',
      created_at: now,
      updated_at: now,
    };
    all.push(newPos);
    this.savePositionsRaw(all);

    this.addAudit('position', newPos.id, 'create', null, { ...newPos });
    return newPos;
  }

  // --- Contingent Records (FR-05, FR-06, DATA_MODEL §1.5, §1.6, D-004) ---
  public listContingentRecords(params?: {
    search?: string;
    legal_entity_id?: string;
    department_id?: string;
    status?: EntityStatus;
    page?: number;
    pageSize?: number;
  }): { items: ContingentRecord[]; total: number } {
    const all = this.getContingentRaw();
    const status = params?.status || 'active';
    let filtered = all.filter(c => c.status === status);

    if (params?.legal_entity_id) {
      filtered = filtered.filter(c => c.legal_entity_id === params.legal_entity_id);
    }
    if (params?.department_id) {
      filtered = filtered.filter(c => c.department_id === params.department_id);
    }

    const term = (params?.search || '').trim();
    if (term) {
      const needle = ciCompare(term);
      const positions = this.getPositionsRaw();
      const departments = this.getDepartmentsRaw();

      filtered = filtered.filter(c => {
        const pos = positions.find(p => p.id === c.position_id);
        const dept = departments.find(d => d.id === c.department_id);
        const label = c.workplace_label || '';
        const sout = c.sout_card_number || '';
        const risk = c.risk_card_number || '';
        const items29 = (c.medical_items_29n || []).join(' ');
        const items342 = (c.medical_items_342n || []).join(' ');

        return (
          (pos && ciCompare(pos.name).includes(needle)) ||
          (dept && ciCompare(dept.name).includes(needle)) ||
          ciCompare(label).includes(needle) ||
          sout.includes(term) ||
          risk.includes(term) ||
          items29.includes(term) ||
          items342.includes(term)
        );
      });
    }

    // Sort by department and position
    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    const items = filtered.slice(start, start + pageSize);

    return { items, total };
  }

  public getContingentRecordById(id: string): ContingentRecord | null {
    return this.getContingentRaw().find(c => c.id === id) || null;
  }

  public createContingentRecord(data: {
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
  }): ContingentRecord {
    if (!data.legal_entity_id) throw new Error('Юридическое лицо обязательно для заполнения.');
    if (!data.department_id) throw new Error('Подразделение обязательно для заполнения.');
    if (!data.position_id) throw new Error('Должность обязательна для заполнения.');

    // Integrity check: department must belong to legal entity
    const dept = this.getDepartmentById(data.department_id);
    if (!dept || dept.legal_entity_id !== data.legal_entity_id) {
      throw new Error('Подразделение не принадлежит выбранному юридическому лицу.');
    }

    const all = this.getContingentRaw();
    const now = nowISO();
    const newRecord: ContingentRecord = {
      id: generateUUID(),
      legal_entity_id: data.legal_entity_id,
      department_id: data.department_id,
      position_id: data.position_id,
      workplace_label: normalizeText(data.workplace_label),
      work_schedule_id: data.work_schedule_id || null,
      shift_pattern_id: data.shift_pattern_id || null,
      risk_card_number: normalizeText(data.risk_card_number),
      sout_card_number: normalizeText(data.sout_card_number),
      work_condition_subclass_id: data.work_condition_subclass_id || null,
      medical_items_29n: data.medical_items_29n || [],
      medical_items_342n: data.medical_items_342n || [],
      training_program: normalizeText(data.training_program),
      internship_program: normalizeText(data.internship_program),
      electrical_safety_group_id: data.electrical_safety_group_id || null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    all.push(newRecord);
    this.saveContingentRaw(all);

    this.addAudit('contingent', newRecord.id, 'contingent_create', null, { ...newRecord });
    return newRecord;
  }

  public updateContingentRecord(
    id: string,
    data: Partial<ContingentRecord>
  ): ContingentRecord {
    const all = this.getContingentRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Запись контингента не найдена.');

    const existing = all[index];
    const before = { ...existing };

    const deptId = data.department_id || existing.department_id;
    const leId = data.legal_entity_id || existing.legal_entity_id;
    const dept = this.getDepartmentById(deptId);
    if (dept && dept.legal_entity_id !== leId) {
      throw new Error('Подразделение не принадлежит выбранному юридическому лицу.');
    }

    const updated: ContingentRecord = {
      ...existing,
      ...data,
      workplace_label: data.workplace_label !== undefined ? normalizeText(data.workplace_label) : existing.workplace_label,
      risk_card_number: data.risk_card_number !== undefined ? normalizeText(data.risk_card_number) : existing.risk_card_number,
      sout_card_number: data.sout_card_number !== undefined ? normalizeText(data.sout_card_number) : existing.sout_card_number,
      training_program: data.training_program !== undefined ? normalizeText(data.training_program) : existing.training_program,
      internship_program: data.internship_program !== undefined ? normalizeText(data.internship_program) : existing.internship_program,
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.saveContingentRaw(all);

    this.addAudit('contingent', updated.id, 'contingent_update', before, { ...updated });
    return updated;
  }

  public archiveContingentRecord(id: string): ContingentRecord {
    const all = this.getContingentRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Запись контингента не найдена.');

    const existing = all[index];
    if (existing.status === 'archived') throw new Error('Запись уже в архиве.');

    const before = { ...existing };
    const empCount = this.getEmployeesRaw().filter(
      e => e.contingent_record_id === id && e.status === 'active'
    ).length;

    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveContingentRaw(all);

    const comment = empCount > 0 ? `С записью связаны работники: ${empCount} чел.` : null;
    this.addAudit('contingent', existing.id, 'contingent_archive', before, { ...existing }, comment);

    return existing;
  }

  public restoreContingentRecord(id: string): ContingentRecord {
    const all = this.getContingentRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Запись контингента не найдена.');

    const existing = all[index];
    if (existing.status === 'active') throw new Error('Запись уже активна.');

    const before = { ...existing };
    existing.status = 'active';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveContingentRaw(all);

    this.addAudit('contingent', existing.id, 'contingent_restore', before, { ...existing });
    return existing;
  }

  public getEmployeesByContingentId(contingentId: string): Employee[] {
    return this.getEmployeesRaw().filter(
      e => e.contingent_record_id === contingentId && e.status === 'active'
    );
  }

  // --- Contingent Bulk Import Transaction (IMPORT_EXPORT §4, D-004, D-010) ---
  public commitContingentImport(
    records: Array<{
      legal_entity_id: string;
      department_id: string;
      position_id: string;
      workplace_label?: string | null;
      work_schedule_id?: string | null;
      shift_pattern_id?: string | null;
      risk_card_number?: string | null;
      sout_card_number?: string | null;
      work_condition_subclass_id?: string | null;
      medical_items_29n?: string[];
      medical_items_342n?: string[];
      training_program?: string | null;
      internship_program?: string | null;
      electrical_safety_group_id?: string | null;
    }>,
    mode: 'add' | 'update'
  ): { added: number; updated: number; skipped: number; rejected: number } {
    if (records.length > 0) {
      this.createBackup('auto-import-contingent');
    }
    const all = [...this.getContingentRaw()];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let rejected = 0;

    for (const rec of records) {
      if (!rec.legal_entity_id || !rec.department_id || !rec.position_id) {
        rejected++;
        continue;
      }

      // D-004 identification candidate key:
      // (legal_entity_id, department_id, position_id, workplace_label)
      const existingIdx = all.findIndex(
        c =>
          c.status === 'active' &&
          c.legal_entity_id === rec.legal_entity_id &&
          c.department_id === rec.department_id &&
          c.position_id === rec.position_id &&
          (c.workplace_label || '') === (rec.workplace_label || '')
      );

      if (existingIdx >= 0) {
        if (mode === 'update') {
          const existing = all[existingIdx];
          const before = { ...existing };
          const updatedRecord: ContingentRecord = {
            ...existing,
            work_schedule_id: rec.work_schedule_id || existing.work_schedule_id,
            shift_pattern_id: rec.shift_pattern_id || existing.shift_pattern_id,
            risk_card_number: rec.risk_card_number !== undefined ? rec.risk_card_number : existing.risk_card_number,
            sout_card_number: rec.sout_card_number !== undefined ? rec.sout_card_number : existing.sout_card_number,
            work_condition_subclass_id: rec.work_condition_subclass_id || existing.work_condition_subclass_id,
            medical_items_29n: rec.medical_items_29n || existing.medical_items_29n,
            medical_items_342n: rec.medical_items_342n || existing.medical_items_342n,
            training_program: rec.training_program !== undefined ? rec.training_program : existing.training_program,
            internship_program: rec.internship_program !== undefined ? rec.internship_program : existing.internship_program,
            electrical_safety_group_id: rec.electrical_safety_group_id || existing.electrical_safety_group_id,
            updated_at: nowISO(),
          };
          all[existingIdx] = updatedRecord;
          this.addAudit('contingent', updatedRecord.id, 'contingent_update', before, { ...updatedRecord });
          updated++;
        } else {
          skipped++;
        }
      } else {
        const now = nowISO();
        const newRecord: ContingentRecord = {
          id: generateUUID(),
          legal_entity_id: rec.legal_entity_id,
          department_id: rec.department_id,
          position_id: rec.position_id,
          workplace_label: rec.workplace_label || null,
          work_schedule_id: rec.work_schedule_id || null,
          shift_pattern_id: rec.shift_pattern_id || null,
          risk_card_number: rec.risk_card_number || null,
          sout_card_number: rec.sout_card_number || null,
          work_condition_subclass_id: rec.work_condition_subclass_id || null,
          medical_items_29n: rec.medical_items_29n || [],
          medical_items_342n: rec.medical_items_342n || [],
          training_program: rec.training_program || null,
          internship_program: rec.internship_program || null,
          electrical_safety_group_id: rec.electrical_safety_group_id || null,
          status: 'active',
          created_at: now,
          updated_at: now,
        };
        all.push(newRecord);
        this.addAudit('contingent', newRecord.id, 'contingent_create', null, { ...newRecord });
        added++;
      }
    }

    this.saveContingentRaw(all);
    return { added, updated, skipped, rejected };
  }

  // --- Employee CRUD (Stage 4, FR-07…FR-09, D-004, D-005, D-007) ---
  public listEmployees(params?: {
    legal_entity_id?: string;
    department_id?: string;
    position_id?: string;
    status?: EntityStatus;
    search?: string;
    page?: number;
    pageSize?: number;
  }): { items: Employee[]; total: number } {
    let list = this.getEmployeesRaw();
    const currentStatus = params?.status || 'active';
    list = list.filter(e => e.status === currentStatus);

    if (params?.legal_entity_id) {
      list = list.filter(e => e.legal_entity_id === params.legal_entity_id);
    }
    if (params?.department_id) {
      list = list.filter(e => e.department_id === params.department_id);
    }
    if (params?.position_id) {
      list = list.filter(e => e.position_id === params.position_id);
    }

    const term = (params?.search || '').trim();
    if (term) {
      const needle = ciCompare(term);
      const depts = this.getDepartmentsRaw();
      const posList = this.getPositionsRaw();
      list = list.filter(e => {
        const fio = `${e.last_name} ${e.first_name} ${e.middle_name || ''}`;
        const snils = e.snils || '';
        const dept = depts.find(d => d.id === e.department_id);
        const pos = posList.find(p => p.id === e.position_id);
        return (
          ciCompare(fio).includes(needle) ||
          ciCompare(snils).includes(needle) ||
          (dept && ciCompare(dept.name).includes(needle)) ||
          (pos && ciCompare(pos.name).includes(needle))
        );
      });
    }

    // Sort by last_name, then first_name (Russian alphabetical)
    list.sort((a, b) => {
      const cmpLast = ciCompare(a.last_name).localeCompare(ciCompare(b.last_name), 'ru');
      if (cmpLast !== 0) return cmpLast;
      return ciCompare(a.first_name).localeCompare(ciCompare(b.first_name), 'ru');
    });

    const total = list.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    const items = list.slice(start, start + pageSize);

    return { items, total };
  }

  public getEmployeeById(id: string): Employee | null {
    return this.getEmployeesRaw().find(e => e.id === id) || null;
  }

  public createEmployee(data: {
    legal_entity_id: string;
    department_id: string;
    position_id: string;
    last_name: string;
    first_name: string;
    middle_name?: string | null;
    hire_date?: string | null;
    birth_date?: string | null;
    snils?: string | null;
    contingent_record_id?: string | null;
  }): { employee: Employee; warnings: string[] } {
    const lastName = normalizeText(data.last_name);
    const firstName = normalizeText(data.first_name);
    if (!lastName) throw new Error('Фамилия обязательна для заполнения.');
    if (!firstName) throw new Error('Имя обязательно для заполнения.');
    if (!data.legal_entity_id) throw new Error('Юридическое лицо обязательно для заполнения.');
    if (!data.department_id) throw new Error('Подразделение обязательно для заполнения.');
    if (!data.position_id) throw new Error('Должность обязательна для заполнения.');

    // Integrity: Department must belong to legal entity
    const dept = this.getDepartmentById(data.department_id);
    if (!dept || dept.legal_entity_id !== data.legal_entity_id) {
      throw new Error('Подразделение не принадлежит выбранному юридическому лицу.');
    }

    // Integrity: If contingent_record_id is given, it must belong to the same legal entity (FR-09)
    if (data.contingent_record_id) {
      const cr = this.getContingentRecordById(data.contingent_record_id);
      if (!cr || cr.legal_entity_id !== data.legal_entity_id) {
        throw new Error('Выбранная запись контингента не принадлежит выбранному юридическому лицу.');
      }
    }

    // Validate dates
    const hireDate = data.hire_date ? validateDateNotFuture(data.hire_date, 'Дата приёма') : null;
    const birthDate = data.birth_date ? validateDateNotFuture(data.birth_date, 'Дата рождения') : null;

    // Validate SNILS
    const snils = data.snils ? normalizeSnils(data.snils) : null;

    // Check duplicate warnings (without auto-merge)
    const allEmployees = this.getEmployeesRaw();
    const { warnings } = findEmployeeDuplicates(allEmployees, {
      legal_entity_id: data.legal_entity_id,
      last_name: lastName,
      first_name: firstName,
      middle_name: data.middle_name,
      birth_date: birthDate,
      snils: snils,
    });

    const now = nowISO();
    const newEmployee: Employee = {
      id: generateUUID(),
      legal_entity_id: data.legal_entity_id,
      department_id: data.department_id,
      position_id: data.position_id,
      contingent_record_id: data.contingent_record_id || null,
      last_name: lastName,
      first_name: firstName,
      middle_name: normalizeText(data.middle_name),
      hire_date: hireDate,
      birth_date: birthDate,
      snils: snils,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    allEmployees.push(newEmployee);
    this.saveEmployeesRaw(allEmployees);

    // Initial employment history record (D-005)
    const historyList = this.getEmploymentHistoryRaw();
    const historyRec: EmploymentHistoryRecord = {
      id: generateUUID(),
      employee_id: newEmployee.id,
      start_date: hireDate || now.split('T')[0],
      end_date: null,
      department_id: newEmployee.department_id,
      position_id: newEmployee.position_id,
      contingent_record_id: newEmployee.contingent_record_id || null,
      reason: 'Приём на работу',
      comment: null,
      created_at: now,
    };
    historyList.push(historyRec);
    this.saveEmploymentHistoryRaw(historyList);

    this.addAudit('employee', newEmployee.id, 'employee_create', null, { ...newEmployee });
    return { employee: newEmployee, warnings };
  }

  public updateEmployee(
    id: string,
    data: Partial<Employee> & { transfer_reason?: string; transfer_comment?: string }
  ): { employee: Employee; warnings: string[] } {
    const all = this.getEmployeesRaw();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Работник не найден.');

    const existing = all[idx];
    const before = { ...existing };

    const targetLeId = data.legal_entity_id || existing.legal_entity_id;
    const targetDeptId = data.department_id || existing.department_id;
    const targetPosId = data.position_id || existing.position_id;
    const targetContingentId =
      data.contingent_record_id !== undefined ? data.contingent_record_id : existing.contingent_record_id;

    // Check dept integrity
    const dept = this.getDepartmentById(targetDeptId);
    if (dept && dept.legal_entity_id !== targetLeId) {
      throw new Error('Подразделение не принадлежит выбранному юридическому лицу.');
    }

    // Check contingent integrity
    if (targetContingentId) {
      const cr = this.getContingentRecordById(targetContingentId);
      if (cr && cr.legal_entity_id !== targetLeId) {
        throw new Error('Выбранная запись контингента не принадлежит выбранному юридическому лицу.');
      }
    }

    const hireDate =
      data.hire_date !== undefined
        ? data.hire_date
          ? validateDateNotFuture(data.hire_date, 'Дата приёма')
          : null
        : existing.hire_date;
    const birthDate =
      data.birth_date !== undefined
        ? data.birth_date
          ? validateDateNotFuture(data.birth_date, 'Дата рождения')
          : null
        : existing.birth_date;
    const snils =
      data.snils !== undefined
        ? data.snils
          ? normalizeSnils(data.snils)
          : null
        : existing.snils;

    const lastName =
      data.last_name !== undefined ? normalizeText(data.last_name) || existing.last_name : existing.last_name;
    const firstName =
      data.first_name !== undefined ? normalizeText(data.first_name) || existing.first_name : existing.first_name;
    const middleName =
      data.middle_name !== undefined ? normalizeText(data.middle_name) : existing.middle_name;

    // Duplicate check warnings
    const { warnings } = findEmployeeDuplicates(all, {
      legal_entity_id: targetLeId,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      birth_date: birthDate,
      snils: snils,
      exclude_id: id,
    });

    // Check if transfer occurred (department, position, or contingent changed - D-005)
    const isTransferred =
      targetDeptId !== existing.department_id ||
      targetPosId !== existing.position_id ||
      (targetContingentId || null) !== (existing.contingent_record_id || null);

    const now = nowISO();
    const today = now.split('T')[0];

    if (isTransferred) {
      const historyList = this.getEmploymentHistoryRaw();
      const currentPeriod = historyList.find(h => h.employee_id === id && !h.end_date);
      if (currentPeriod) {
        currentPeriod.end_date = today;
        this.addAudit('employment_history', currentPeriod.id, 'employment_history_close', null, {
          ...currentPeriod,
        });
      }

      const newPeriod: EmploymentHistoryRecord = {
        id: generateUUID(),
        employee_id: id,
        start_date: today,
        end_date: null,
        department_id: targetDeptId,
        position_id: targetPosId,
        contingent_record_id: targetContingentId || null,
        reason: data.transfer_reason || 'Кадровое перемещение',
        comment: data.transfer_comment || null,
        created_at: now,
      };
      historyList.push(newPeriod);
      this.saveEmploymentHistoryRaw(historyList);
      this.addAudit('employment_history', newPeriod.id, 'employment_history_open', null, { ...newPeriod });
    }

    const updated: Employee = {
      ...existing,
      legal_entity_id: targetLeId,
      department_id: targetDeptId,
      position_id: targetPosId,
      contingent_record_id: targetContingentId || null,
      last_name: lastName,
      first_name: firstName,
      middle_name: middleName,
      hire_date: hireDate,
      birth_date: birthDate,
      snils: snils,
      updated_at: now,
    };

    all[idx] = updated;
    this.saveEmployeesRaw(all);

    this.addAudit('employee', updated.id, 'employee_update', before, { ...updated });
    return { employee: updated, warnings };
  }

  public archiveEmployee(id: string): Employee {
    const all = this.getEmployeesRaw();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Работник не найден.');

    const existing = all[idx];
    if (existing.status === 'archived') throw new Error('Работник уже в архиве.');

    const before = { ...existing };
    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[idx] = existing;
    this.saveEmployeesRaw(all);

    this.addAudit('employee', existing.id, 'employee_archive', before, { ...existing });
    return existing;
  }

  public restoreEmployee(id: string): Employee {
    const all = this.getEmployeesRaw();
    const idx = all.findIndex(e => e.id === id);
    if (idx === -1) throw new Error('Работник не найден.');

    const existing = all[idx];
    if (existing.status === 'active') throw new Error('Работник уже активен.');

    const before = { ...existing };
    existing.status = 'active';
    existing.updated_at = nowISO();
    all[idx] = existing;
    this.saveEmployeesRaw(all);

    this.addAudit('employee', existing.id, 'employee_restore', before, { ...existing });
    return existing;
  }

  public commitEmployeeImport(
    records: Array<{
      legal_entity_id: string;
      department_id: string;
      position_id: string;
      last_name: string;
      first_name: string;
      middle_name?: string | null;
      hire_date?: string | null;
      birth_date?: string | null;
      snils?: string | null;
      contingent_record_id?: string | null;
    }>,
    mode: 'add' | 'update'
  ): { added: number; updated: number; skipped: number; rejected: number } {
    if (records.length > 0) {
      this.createBackup('auto-import-employees');
    }
    const all = [...this.getEmployeesRaw()];
    const historyList = [...this.getEmploymentHistoryRaw()];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let rejected = 0;

    for (const rec of records) {
      if (!rec.legal_entity_id || !rec.department_id || !rec.position_id || !rec.last_name || !rec.first_name) {
        rejected++;
        continue;
      }

      const snilsNorm = rec.snils ? ciCompare(rec.snils) : '';

      // Identification according to IMPORT_EXPORT §5:
      // "Идентификация: СНИЛС + юридическое лицо. Без СНИЛС — только добавление с предупреждением по ФИО и дате рождения. Объединение только по ФИО запрещено."
      let existingIdx = -1;
      if (snilsNorm) {
        existingIdx = all.findIndex(
          e =>
            e.status === 'active' &&
            e.legal_entity_id === rec.legal_entity_id &&
            ciCompare(e.snils || '') === snilsNorm
        );
      }

      if (existingIdx >= 0) {
        if (mode === 'update') {
          const existing = all[existingIdx];
          const before = { ...existing };

          const isTransferred =
            rec.department_id !== existing.department_id ||
            rec.position_id !== existing.position_id ||
            (rec.contingent_record_id || null) !== (existing.contingent_record_id || null);

          const now = nowISO();
          const today = now.split('T')[0];

          if (isTransferred) {
            const currentPeriod = historyList.find(h => h.employee_id === existing.id && !h.end_date);
            if (currentPeriod) {
              currentPeriod.end_date = today;
              this.addAudit('employment_history', currentPeriod.id, 'employment_history_close', null, {
                ...currentPeriod,
              });
            }

            const newPeriod: EmploymentHistoryRecord = {
              id: generateUUID(),
              employee_id: existing.id,
              start_date: today,
              end_date: null,
              department_id: rec.department_id,
              position_id: rec.position_id,
              contingent_record_id: rec.contingent_record_id || null,
              reason: 'Кадровое перемещение (импорт)',
              comment: null,
              created_at: now,
            };
            historyList.push(newPeriod);
            this.addAudit('employment_history', newPeriod.id, 'employment_history_open', null, { ...newPeriod });
          }

          const updatedEmp: Employee = {
            ...existing,
            department_id: rec.department_id,
            position_id: rec.position_id,
            contingent_record_id:
              rec.contingent_record_id !== undefined ? rec.contingent_record_id : existing.contingent_record_id,
            last_name: rec.last_name || existing.last_name,
            first_name: rec.first_name || existing.first_name,
            middle_name: rec.middle_name !== undefined ? rec.middle_name : existing.middle_name,
            hire_date: rec.hire_date || existing.hire_date,
            birth_date: rec.birth_date || existing.birth_date,
            updated_at: now,
          };

          all[existingIdx] = updatedEmp;
          this.addAudit('employee', updatedEmp.id, 'employee_update', before, { ...updatedEmp });
          updated++;
        } else {
          skipped++;
        }
      } else {
        const now = nowISO();
        const newEmp: Employee = {
          id: generateUUID(),
          legal_entity_id: rec.legal_entity_id,
          department_id: rec.department_id,
          position_id: rec.position_id,
          contingent_record_id: rec.contingent_record_id || null,
          last_name: rec.last_name,
          first_name: rec.first_name,
          middle_name: rec.middle_name || null,
          hire_date: rec.hire_date || null,
          birth_date: rec.birth_date || null,
          snils: rec.snils || null,
          status: 'active',
          created_at: now,
          updated_at: now,
        };

        all.push(newEmp);

        const historyRec: EmploymentHistoryRecord = {
          id: generateUUID(),
          employee_id: newEmp.id,
          start_date: rec.hire_date || now.split('T')[0],
          end_date: null,
          department_id: newEmp.department_id,
          position_id: newEmp.position_id,
          contingent_record_id: newEmp.contingent_record_id || null,
          reason: 'Приём на работу (импорт)',
          comment: null,
          created_at: now,
        };
        historyList.push(historyRec);

        this.addAudit('employee', newEmp.id, 'employee_import', null, { ...newEmp });
        added++;
      }
    }

    this.saveEmployeesRaw(all);
    this.saveEmploymentHistoryRaw(historyList);
    return { added, updated, skipped, rejected };
  }

  // --- Bulk Import Transaction for Legal Entities ---
  public commitImport(records: Partial<LegalEntity>[], mode: 'add' | 'update'): {
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } {
    if (records.length > 0) {
      this.createBackup('auto-import-legal-entities');
    }
    const all = [...this.getLegalEntitiesRaw()];
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let rejected = 0;

    for (const rec of records) {
      if (!rec.full_name) {
        rejected++;
        continue;
      }

      let existingIndex = -1;
      if (rec.inn && rec.kpp) {
        existingIndex = all.findIndex(
          le => le.status === 'active' && le.inn === rec.inn && le.kpp === rec.kpp
        );
      }
      if (existingIndex === -1 && rec.ogrn) {
        existingIndex = all.findIndex(
          le => le.status === 'active' && le.ogrn === rec.ogrn
        );
      }

      if (existingIndex >= 0) {
        if (mode === 'update') {
          const existing = all[existingIndex];
          const before = { ...existing };
          const updatedEntity: LegalEntity = {
            ...existing,
            full_name: rec.full_name || existing.full_name,
            short_name: rec.short_name !== undefined ? rec.short_name : existing.short_name,
            inn: rec.inn !== undefined ? rec.inn : existing.inn,
            kpp: rec.kpp !== undefined ? rec.kpp : existing.kpp,
            ogrn: rec.ogrn !== undefined ? rec.ogrn : existing.ogrn,
            legal_address: rec.legal_address !== undefined ? rec.legal_address : existing.legal_address,
            actual_address: rec.actual_address !== undefined ? rec.actual_address : existing.actual_address,
            extra_info: rec.extra_info !== undefined ? rec.extra_info : existing.extra_info,
            updated_at: nowISO(),
          };
          all[existingIndex] = updatedEntity;
          this.addAudit('legal_entity', updatedEntity.id, 'import_update', before, { ...updatedEntity });
          updated++;
        } else {
          skipped++;
        }
      } else {
        const now = nowISO();
        const newEntity: LegalEntity = {
          id: generateUUID(),
          full_name: rec.full_name,
          short_name: rec.short_name || null,
          inn: rec.inn || null,
          kpp: rec.kpp || null,
          ogrn: rec.ogrn || null,
          legal_address: rec.legal_address || null,
          actual_address: rec.actual_address || null,
          extra_info: rec.extra_info || null,
          status: 'active',
          created_at: now,
          updated_at: now,
        };
        all.push(newEntity);
        this.addAudit('legal_entity', newEntity.id, 'import_create', null, { ...newEntity });
        added++;
      }
    }

    this.saveLegalEntitiesRaw(all);
    return { added, updated, skipped, rejected };
  }

  // --- Modules ---
  public getModules(): ModuleItem[] {
    const stored = loadFromStorage<ModuleItem[]>(STORAGE_KEYS.MODULES, DEFAULT_MODULES);
    // Миграция реестра: добавляем отсутствующие (новые) модули, сохраняя состояние существующих
    let changed = false;
    for (const def of DEFAULT_MODULES) {
      if (!stored.some(m => m.module_id === def.module_id)) {
        stored.push({ ...def });
        changed = true;
      }
    }
    if (changed) {
      saveToStorage(STORAGE_KEYS.MODULES, stored);
    }
    return stored;
  }

  public toggleModule(moduleId: string): void {
    const modules = this.getModules();
    const item = modules.find(m => m.module_id === moduleId);
    if (item) {
      item.enabled = !item.enabled;
      saveToStorage(STORAGE_KEYS.MODULES, modules);
      this.addAudit(
        'module',
        moduleId,
        'update',
        null,
        { module_id: moduleId, enabled: item.enabled },
        item.enabled ? `Модуль «${item.title}» включён` : `Модуль «${item.title}» отключён (данные сохранены)`
      );
    }
  }

  // ==============================
  // Модуль «СОУТ» (Этап 6+, 426-ФЗ)
  // ==============================

  public getSoutCardsRaw(): SoutCard[] {
    return loadFromStorage<SoutCard[]>(STORAGE_KEYS.SOUT_CARDS, []);
  }

  public saveSoutCardsRaw(items: SoutCard[]): void {
    saveToStorage(STORAGE_KEYS.SOUT_CARDS, items);
  }

  public getSoutFamiliarizationsRaw(): SoutFamiliarization[] {
    return loadFromStorage<SoutFamiliarization[]>(STORAGE_KEYS.SOUT_FAMILIARIZATIONS, []);
  }

  public saveSoutFamiliarizationsRaw(items: SoutFamiliarization[]): void {
    saveToStorage(STORAGE_KEYS.SOUT_FAMILIARIZATIONS, items);
  }

  public static readonly SOUT_VALID_CLASSES = ['1', '2', '3.1', '3.2', '3.3', '3.4', '4'];

  // Автоматический расчёт гарантий и компенсаций по ТК РФ для класса условий труда
  public static computeGuarantees(finalClass: string): SoutGuarantees {
    const c = finalClass;
    const isHarm = (min: string) => {
      const order = ['1', '2', '3.1', '3.2', '3.3', '3.4', '4'];
      return order.indexOf(c) >= order.indexOf(min) && c !== '1' && c !== '2';
    };
    return {
      // ст. 92 ТК РФ — сокращённая продолжительность рабочего времени (не более 36 ч) для 3.3, 3.4 и 4
      reduced_hours: c === '3.3' || c === '3.4' || c === '4',
      // ст. 117 ТК РФ — ежегодный дополнительный оплачиваемый отпуск не менее 7 календарных дней для 3.2–4
      extra_vacation_days: isHarm('3.2') ? 7 : 0,
      // ст. 147 ТК РФ — повышенная оплата труда не менее 4% для вредных (3.1–3.4) и опасных (4)
      pay_increase_percent: isHarm('3.1') ? 4 : 0,
      // ст. 222 ТК РФ — молоко/равноценные продукты при контакте с вредными веществами (химический фактор 3.1–4)
      milk_issue: isHarm('3.1'),
      early_pension: isHarm('3.2'),
      ppe_issue: isHarm('3.1'),
    };
  }

  // Расчёт срока действия карты: 5 лет со дня утверждения отчёта (ст. 8 426-ФЗ);
  // бессрочно при зарегистрированной декларации (ст. 11 426-ФЗ)
  public static computeSoutExpiry(
    reportApprovedAt: string | null | undefined,
    declarationActive: boolean
  ): string | null {
    if (declarationActive) return null; // бессрочная карта
    if (!reportApprovedAt) return null;
    const d = new Date(reportApprovedAt + 'T00:00:00');
    if (isNaN(d.getTime())) return null;
    d.setFullYear(d.getFullYear() + 5);
    return d.toISOString().slice(0, 10);
  }

  private validateSoutRefs(data: { legal_entity_id: string; department_id: string; position_id: string }): void {
    if (!data.legal_entity_id) throw new Error('Юридическое лицо обязательно для заполнения.');
    if (!data.department_id) throw new Error('Подразделение обязательно для заполнения.');
    if (!data.position_id) throw new Error('Должность обязательна для заполнения.');
    const le = this.getLegalEntityById(data.legal_entity_id);
    if (!le) throw new Error('Юридическое лицо не найдено.');
    const dept = this.getDepartmentById(data.department_id);
    if (!dept || dept.legal_entity_id !== data.legal_entity_id) {
      throw new Error('Подразделение не принадлежит выбранному юридическому лицу.');
    }
    if (!this.getPositionById(data.position_id)) {
      throw new Error('Должность не найдена в справочнике.');
    }
  }

  public listSoutCards(params?: {
    search?: string;
    legal_entity_id?: string;
    department_id?: string;
    final_class?: string;
    status?: EntityStatus;
    page?: number;
    pageSize?: number;
  }): { items: SoutCard[]; total: number } {
    const all = this.getSoutCardsRaw();
    const status = params?.status || 'active';
    let filtered = all.filter(c => c.status === status);

    if (params?.legal_entity_id) {
      filtered = filtered.filter(c => c.legal_entity_id === params.legal_entity_id);
    }
    if (params?.department_id) {
      filtered = filtered.filter(c => c.department_id === params.department_id);
    }
    if (params?.final_class) {
      filtered = filtered.filter(c => c.final_class === params.final_class);
    }

    const term = (params?.search || '').trim().toLowerCase();
    if (term) {
      const positions = this.getPositionsRaw();
      const departments = this.getDepartmentsRaw();
      filtered = filtered.filter(c => {
        const pos = positions.find(p => p.id === c.position_id);
        const dept = departments.find(d => d.id === c.department_id);
        return (
          c.card_number.toLowerCase().includes(term) ||
          (pos && pos.name.toLowerCase().includes(term)) ||
          (dept && dept.name.toLowerCase().includes(term)) ||
          (c.workplace_label || '').toLowerCase().includes(term) ||
          (c.protocol_number || '').toLowerCase().includes(term)
        );
      });
    }

    filtered.sort((a, b) => ciCompare(a.card_number).localeCompare(ciCompare(b.card_number)));

    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), total };
  }

  public getSoutCardById(id: string): SoutCard | null {
    return this.getSoutCardsRaw().find(c => c.id === id) || null;
  }

  public createSoutCard(data: {
    card_number: string;
    legal_entity_id: string;
    department_id: string;
    position_id: string;
    workplace_label?: string | null;
    is_analogous?: boolean;
    analogous_basis?: string | null;
    factors?: SoutHarmfulFactor[];
    final_class: string;
    employees_count?: number;
    women_count?: number;
    minors_count?: number;
    disabled_count?: number;
    guarantees?: Partial<SoutGuarantees>;
    measurement_org?: string | null;
    protocol_number?: string | null;
    report_approved_at?: string | null;
    declaration_active?: boolean;
    declaration_number?: string | null;
  }): SoutCard {
    if (!this.isModuleEnabled('sout')) {
      throw new Error('Модуль СОУТ отключён. Включите модуль в реестре модулей.');
    }
    const card_number = normalizeText(data.card_number);
    if (!card_number) throw new Error('Номер карты СОУТ обязателен для заполнения.');
    if (!StorageService.SOUT_VALID_CLASSES.includes(data.final_class)) {
      throw new Error(`Недопустимый класс условий труда «${data.final_class}». Допустимы: ${StorageService.SOUT_VALID_CLASSES.join(', ')}.`);
    }
    this.validateSoutRefs(data);

    const all = this.getSoutCardsRaw();
    const dup = all.find(
      c => c.status === 'active' && c.legal_entity_id === data.legal_entity_id && ciCompare(c.card_number) === ciCompare(card_number)
    );
    if (dup) {
      throw new Error(`Карта СОУТ № «${card_number}» уже зарегистрирована в данном юридическом лице.`);
    }

    const now = nowISO();
    const auto = StorageService.computeGuarantees(data.final_class);
    const guarantees: SoutGuarantees = { ...auto, ...(data.guarantees || {}) };
    const declarationActive = Boolean(data.declaration_active);

    const card: SoutCard = {
      id: generateUUID(),
      card_number,
      legal_entity_id: data.legal_entity_id,
      department_id: data.department_id,
      position_id: data.position_id,
      workplace_label: normalizeText(data.workplace_label),
      is_analogous: Boolean(data.is_analogous),
      analogous_basis: normalizeText(data.analogous_basis),
      factors: Array.isArray(data.factors) ? data.factors : [],
      final_class: data.final_class,
      employees_count: Math.max(0, Number(data.employees_count) || 0),
      women_count: Math.max(0, Number(data.women_count) || 0),
      minors_count: Math.max(0, Number(data.minors_count) || 0),
      disabled_count: Math.max(0, Number(data.disabled_count) || 0),
      guarantees,
      measurement_org: normalizeText(data.measurement_org),
      protocol_number: normalizeText(data.protocol_number),
      report_approved_at: data.report_approved_at || null,
      expires_at: StorageService.computeSoutExpiry(data.report_approved_at, declarationActive),
      declaration_active: declarationActive,
      declaration_number: declarationActive ? normalizeText(data.declaration_number) : null,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    all.push(card);
    this.saveSoutCardsRaw(all);
    this.addAudit('sout_card', card.id, 'sout_create', null, { ...card });
    return card;
  }

  public updateSoutCard(
    id: string,
    data: Partial<{
      card_number: string;
      legal_entity_id: string;
      department_id: string;
      position_id: string;
      workplace_label?: string | null;
      is_analogous: boolean;
      analogous_basis?: string | null;
      factors: SoutHarmfulFactor[];
      final_class: string;
      employees_count: number;
      women_count: number;
      minors_count: number;
      disabled_count: number;
      guarantees: Partial<SoutGuarantees>;
      measurement_org?: string | null;
      protocol_number?: string | null;
      report_approved_at?: string | null;
      declaration_active: boolean;
      declaration_number?: string | null;
    }>
  ): SoutCard {
    const all = this.getSoutCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта СОУТ не найдена.');
    const existing = all[index];
    const before = { ...existing };

    if (data.final_class !== undefined && !StorageService.SOUT_VALID_CLASSES.includes(data.final_class)) {
      throw new Error(`Недопустимый класс условий труда «${data.final_class}».`);
    }

    const mergedRefs = {
      legal_entity_id: data.legal_entity_id ?? existing.legal_entity_id,
      department_id: data.department_id ?? existing.department_id,
      position_id: data.position_id ?? existing.position_id,
    };
    this.validateSoutRefs(mergedRefs);

    const card_number = data.card_number !== undefined ? normalizeText(data.card_number) : existing.card_number;
    if (!card_number) throw new Error('Номер карты СОУТ обязателен для заполнения.');
    const dup = all.find(
      c => c.id !== id && c.status === 'active' && c.legal_entity_id === mergedRefs.legal_entity_id && ciCompare(c.card_number) === ciCompare(card_number)
    );
    if (dup) throw new Error(`Карта СОУТ № «${card_number}» уже зарегистрирована в данном юридическом лице.`);

    const finalClass = data.final_class ?? existing.final_class;
    const auto = StorageService.computeGuarantees(finalClass);
    let guarantees: SoutGuarantees;
    if (data.final_class !== undefined && data.final_class !== existing.final_class) {
      // при смене класса гарантии пересчитываются автоматически
      guarantees = { ...auto, ...(data.guarantees || {}) };
    } else {
      guarantees = { ...existing.guarantees, ...(data.guarantees || {}) };
    }

    const declarationActive = data.declaration_active ?? existing.declaration_active;
    const reportApprovedAt = data.report_approved_at !== undefined ? data.report_approved_at : existing.report_approved_at;

    const updated: SoutCard = {
      ...existing,
      ...mergedRefs,
      card_number,
      workplace_label: data.workplace_label !== undefined ? normalizeText(data.workplace_label) : existing.workplace_label,
      is_analogous: data.is_analogous ?? existing.is_analogous,
      analogous_basis: data.analogous_basis !== undefined ? normalizeText(data.analogous_basis) : existing.analogous_basis,
      factors: Array.isArray(data.factors) ? data.factors : existing.factors,
      final_class: finalClass,
      employees_count: data.employees_count !== undefined ? Math.max(0, Number(data.employees_count) || 0) : existing.employees_count,
      women_count: data.women_count !== undefined ? Math.max(0, Number(data.women_count) || 0) : existing.women_count,
      minors_count: data.minors_count !== undefined ? Math.max(0, Number(data.minors_count) || 0) : existing.minors_count,
      disabled_count: data.disabled_count !== undefined ? Math.max(0, Number(data.disabled_count) || 0) : existing.disabled_count,
      guarantees,
      measurement_org: data.measurement_org !== undefined ? normalizeText(data.measurement_org) : existing.measurement_org,
      protocol_number: data.protocol_number !== undefined ? normalizeText(data.protocol_number) : existing.protocol_number,
      report_approved_at: reportApprovedAt || null,
      declaration_active: declarationActive,
      declaration_number: declarationActive
        ? (data.declaration_number !== undefined ? normalizeText(data.declaration_number) : existing.declaration_number)
        : null,
      expires_at: StorageService.computeSoutExpiry(reportApprovedAt, declarationActive),
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.saveSoutCardsRaw(all);
    this.addAudit('sout_card', updated.id, 'sout_update', before, { ...updated });
    return updated;
  }

  public archiveSoutCard(id: string): SoutCard {
    const all = this.getSoutCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта СОУТ не найдена.');
    const existing = all[index];
    if (existing.status === 'archived') throw new Error('Карта СОУТ уже в архиве.');
    const before = { ...existing };
    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveSoutCardsRaw(all);
    this.addAudit('sout_card', existing.id, 'sout_archive', before, { ...existing });
    return existing;
  }

  public restoreSoutCard(id: string): SoutCard {
    const all = this.getSoutCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта СОУТ не найдена.');
    const existing = all[index];
    if (existing.status === 'active') throw new Error('Карта СОУТ уже активна.');
    const before = { ...existing };
    existing.status = 'active';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveSoutCardsRaw(all);
    this.addAudit('sout_card', existing.id, 'sout_restore', before, { ...existing });
    return existing;
  }

  // --- Ознакомление работников под роспись (ст. 5 426-ФЗ) ---
  public listSoutFamiliarizations(cardId: string): SoutFamiliarization[] {
    return this.getSoutFamiliarizationsRaw()
      .filter(f => f.sout_card_id === cardId)
      .sort((a, b) => (b.signed_at || '').localeCompare(a.signed_at || ''));
  }

  public familiarizeSoutCard(cardId: string, employeeId: string, signedAt?: string, comment?: string | null): SoutFamiliarization {
    if (!this.isModuleEnabled('sout')) {
      throw new Error('Модуль СОУТ отключён. Включите модуль в реестре модулей.');
    }
    const card = this.getSoutCardById(cardId);
    if (!card) throw new Error('Карта СОУТ не найдена.');
    const employee = this.getEmployeesRaw().find(e => e.id === employeeId);
    if (!employee) throw new Error('Работник не найден.');
    if (employee.legal_entity_id !== card.legal_entity_id) {
      throw new Error('Работник относится к другому юридическому лицу — ознакомление запрещено (изоляция организаций).');
    }

    const all = this.getSoutFamiliarizationsRaw();
    const dup = all.find(f => f.sout_card_id === cardId && f.employee_id === employeeId);
    if (dup) throw new Error('Работник уже ознакомлен с картой СОУТ под роспись.');

    const date = signedAt || new Date().toISOString().slice(0, 10);
    validateDateNotFuture(date, 'Дата ознакомления');

    const rec: SoutFamiliarization = {
      id: generateUUID(),
      sout_card_id: cardId,
      employee_id: employeeId,
      signed_at: date,
      comment: normalizeText(comment),
      created_at: nowISO(),
    };
    all.push(rec);
    this.saveSoutFamiliarizationsRaw(all);

    const empName = `${employee.last_name} ${employee.first_name}`;
    this.addAudit('sout_familiarization', rec.id, 'sout_familiarize', null, { ...rec }, `Ознакомление работника «${empName}» с картой СОУТ № ${card.card_number} (ст. 5 426-ФЗ)`);
    return rec;
  }

  public removeSoutFamiliarization(id: string): void {
    const all = this.getSoutFamiliarizationsRaw();
    const index = all.findIndex(f => f.id === id);
    if (index === -1) throw new Error('Запись ознакомления не найдена.');
    const before = { ...all[index] };
    all.splice(index, 1);
    this.saveSoutFamiliarizationsRaw(all);
    this.addAudit('sout_familiarization', before.id, 'update', before, null, 'Отмена отметки об ознакомлении с картой СОУТ');
  }

  // --- Транзакционное применение импорта карт СОУТ ---
  public commitSoutImport(
    records: Array<{
      card_number: string;
      legal_entity_id: string;
      department_id: string;
      position_id: string;
      workplace_label?: string | null;
      is_analogous?: boolean;
      analogous_basis?: string | null;
      factors?: SoutHarmfulFactor[];
      final_class: string;
      employees_count?: number;
      women_count?: number;
      minors_count?: number;
      disabled_count?: number;
      measurement_org?: string | null;
      protocol_number?: string | null;
      report_approved_at?: string | null;
      declaration_active?: boolean;
      declaration_number?: string | null;
    }>,
    mode: 'add' | 'update'
  ): { added: number; updated: number; skipped: number; rejected: number } {
    if (!this.isModuleEnabled('sout')) {
      throw new Error('Модуль СОУТ отключён. Включите модуль в реестре модулей.');
    }
    if (records.length > 0) {
      this.createBackup('auto-import-sout');
    }
    let added = 0;
    let updated = 0;
    let skipped = 0;
    let rejected = 0;

    for (const rec of records) {
      try {
        const existing = this.getSoutCardsRaw().find(
          c =>
            c.status === 'active' &&
            c.legal_entity_id === rec.legal_entity_id &&
            ciCompare(c.card_number) === ciCompare(rec.card_number)
        );
        if (existing) {
          if (mode === 'update') {
            this.updateSoutCard(existing.id, { ...rec });
            updated++;
          } else {
            skipped++;
          }
        } else {
          this.createSoutCard(rec);
          added++;
        }
      } catch {
        rejected++;
      }
    }

    this.addAudit('database', 'local', 'sout_import', null, { added, updated, skipped, rejected },
      `Импорт карт СОУТ: добавлено ${added}, обновлено ${updated}, пропущено ${skipped}, отклонено ${rejected}`);

    return { added, updated, skipped, rejected };
  }

  // ===============================================
  // Модуль «Оценка профессиональных рисков (ОПР)» (Этап 7, Приказ 776н)
  // ===============================================

  public getOprCardsRaw(): OprCard[] {
    return loadFromStorage<OprCard[]>(STORAGE_KEYS.OPR_CARDS, []);
  }

  public saveOprCardsRaw(items: OprCard[]): void {
    saveToStorage(STORAGE_KEYS.OPR_CARDS, items);
  }

  public getOprMeasuresRaw(): OprMeasureItem[] {
    return loadFromStorage<OprMeasureItem[]>(STORAGE_KEYS.OPR_MEASURES, []);
  }

  public saveOprMeasuresRaw(items: OprMeasureItem[]): void {
    saveToStorage(STORAGE_KEYS.OPR_MEASURES, items);
  }

  public static computeRiskScore(severity: number, probability: number): number {
    const s = Number(severity);
    const p = Number(probability);
    if (isNaN(s) || s < 1 || s > 5) {
      throw new Error('Тяжесть должна быть в диапазоне от 1 до 5.');
    }
    if (isNaN(p) || p < 1 || p > 5) {
      throw new Error('Вероятность должна быть в диапазоне от 1 до 5.');
    }
    return Math.round(s) * Math.round(p);
  }

  public computeRiskScore(severity: number, probability: number): number {
    return StorageService.computeRiskScore(severity, probability);
  }

  public static computeRiskLevel(score: number): RiskLevel {
    if (score >= 16) return 'unacceptable';
    if (score >= 10) return 'high';
    if (score >= 5) return 'moderate';
    return 'low';
  }

  public computeRiskLevel(score: number): RiskLevel {
    return StorageService.computeRiskLevel(score);
  }

  public static computeOverallRisk(hazards: OprHazard[]): { score: number; level: RiskLevel } {
    if (!hazards || hazards.length === 0) {
      return { score: 1, level: 'low' };
    }
    let maxScore = 1;
    for (const h of hazards) {
      const s = Math.max(1, Math.min(5, Math.round(Number(h.severity) || 1)));
      const p = Math.max(1, Math.min(5, Math.round(Number(h.probability) || 1)));
      const sc = s * p;
      if (sc > maxScore) maxScore = sc;
    }
    return { score: maxScore, level: StorageService.computeRiskLevel(maxScore) };
  }

  public computeOverallRisk(hazards: OprHazard[]): { score: number; level: RiskLevel } {
    return StorageService.computeOverallRisk(hazards);
  }

  private validateOprRefs(data: { legal_entity_id: string; department_id: string; position_id: string }): void {
    if (!data.legal_entity_id) throw new Error('Юридическое лицо обязательно для заполнения.');
    if (!data.department_id) throw new Error('Подразделение обязательно для заполнения.');
    if (!data.position_id) throw new Error('Должность обязательна для заполнения.');
    const le = this.getLegalEntityById(data.legal_entity_id);
    if (!le) throw new Error('Юридическое лицо не найдено.');
    const dept = this.getDepartmentById(data.department_id);
    if (!dept || dept.legal_entity_id !== data.legal_entity_id) {
      throw new Error('Подразделение не принадлежит выбранному юридическому лицу.');
    }
    if (!this.getPositionById(data.position_id)) {
      throw new Error('Должность не найдена в справочнике.');
    }
  }

  public listOprCards(params?: {
    search?: string;
    legal_entity_id?: string;
    department_id?: string;
    risk_level?: RiskLevel;
    status?: EntityStatus;
    page?: number;
    pageSize?: number;
  }): { items: OprCard[]; total: number } {
    const all = this.getOprCardsRaw();
    const status = params?.status || 'active';
    let filtered = all.filter(c => c.status === status);

    if (params?.legal_entity_id) {
      filtered = filtered.filter(c => c.legal_entity_id === params.legal_entity_id);
    }
    if (params?.department_id) {
      filtered = filtered.filter(c => c.department_id === params.department_id);
    }
    if (params?.risk_level) {
      filtered = filtered.filter(c => c.overall_risk_level === params.risk_level);
    }

    const term = (params?.search || '').trim().toLowerCase();
    if (term) {
      const positions = this.getPositionsRaw();
      const departments = this.getDepartmentsRaw();
      filtered = filtered.filter(c => {
        const pos = positions.find(p => p.id === c.position_id);
        const dept = departments.find(d => d.id === c.department_id);
        return (
          c.card_number.toLowerCase().includes(term) ||
          (pos && pos.name.toLowerCase().includes(term)) ||
          (dept && dept.name.toLowerCase().includes(term)) ||
          (c.workplace_label || '').toLowerCase().includes(term) ||
          c.hazards.some(h => h.name.toLowerCase().includes(term) || h.category.toLowerCase().includes(term))
        );
      });
    }

    filtered.sort((a, b) => ciCompare(a.card_number).localeCompare(ciCompare(b.card_number)));
    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), total };
  }

  public getOprCardById(id: string): OprCard | null {
    return this.getOprCardsRaw().find(c => c.id === id) || null;
  }

  public createOprCard(data: {
    card_number: string;
    legal_entity_id: string;
    department_id: string;
    position_id: string;
    contingent_record_id?: string | null;
    workplace_label?: string | null;
    assessment_date?: string | null;
    assessment_method?: string;
    commission_members?: string | null;
    hazards?: OprHazard[];
  }): OprCard {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const card_number = normalizeText(data.card_number);
    if (!card_number) throw new Error('Номер карты ОПР обязателен для заполнения.');

    this.validateOprRefs(data);

    const all = this.getOprCardsRaw();
    const dup = all.find(
      c => c.status === 'active' && c.legal_entity_id === data.legal_entity_id && ciCompare(c.card_number) === ciCompare(card_number)
    );
    if (dup) {
      throw new Error(`Карта ОПР № «${card_number}» уже зарегистрирована в данном юридическом лице.`);
    }

    const now = nowISO();
    const rawHazards = Array.isArray(data.hazards) ? data.hazards : [];
    const normalizedHazards: OprHazard[] = rawHazards.map(h => {
      const score = StorageService.computeRiskScore(h.severity, h.probability);
      return {
        id: h.id || generateUUID(),
        code: normalizeText(h.code),
        category: normalizeText(h.category) || 'Прочая',
        name: normalizeText(h.name) || 'Не указана',
        danger_source: normalizeText(h.danger_source),
        severity: Math.max(1, Math.min(5, Math.round(Number(h.severity) || 1))),
        probability: Math.max(1, Math.min(5, Math.round(Number(h.probability) || 1))),
        risk_score: score,
        risk_level: StorageService.computeRiskLevel(score),
        existing_measures: normalizeText(h.existing_measures),
        recommended_measures: normalizeText(h.recommended_measures),
      };
    });

    const overall = StorageService.computeOverallRisk(normalizedHazards);

    const card: OprCard = {
      id: generateUUID(),
      card_number,
      legal_entity_id: data.legal_entity_id,
      department_id: data.department_id,
      position_id: data.position_id,
      contingent_record_id: data.contingent_record_id || null,
      workplace_label: normalizeText(data.workplace_label),
      assessment_date: data.assessment_date || now.split('T')[0],
      assessment_method: normalizeText(data.assessment_method) || 'Матричный метод 5х5 (Приказ Минтруда 776н)',
      commission_members: normalizeText(data.commission_members),
      hazards: normalizedHazards,
      overall_risk_score: overall.score,
      overall_risk_level: overall.level,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    all.push(card);
    this.saveOprCardsRaw(all);
    this.addAudit('opr_card', card.id, 'opr_create' as any, null, { ...card }, `Создание карты ОПР № ${card.card_number}`);
    return card;
  }

  public updateOprCard(
    id: string,
    data: Partial<OprCard>
  ): OprCard {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getOprCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта ОПР не найдена.');

    const existing = all[index];
    const before = { ...existing };

    const mergedRefs = {
      legal_entity_id: data.legal_entity_id || existing.legal_entity_id,
      department_id: data.department_id || existing.department_id,
      position_id: data.position_id || existing.position_id,
    };
    this.validateOprRefs(mergedRefs);

    const card_number = data.card_number !== undefined ? normalizeText(data.card_number) : existing.card_number;
    if (!card_number) throw new Error('Номер карты ОПР обязателен для заполнения.');

    const dup = all.find(
      c => c.id !== id && c.status === 'active' && c.legal_entity_id === mergedRefs.legal_entity_id && ciCompare(c.card_number) === ciCompare(card_number)
    );
    if (dup) {
      throw new Error(`Карта ОПР № «${card_number}» уже зарегистрирована в данном юридическом лице.`);
    }

    let normalizedHazards = existing.hazards;
    if (Array.isArray(data.hazards)) {
      normalizedHazards = data.hazards.map(h => {
        const score = StorageService.computeRiskScore(h.severity, h.probability);
        return {
          id: h.id || generateUUID(),
          code: normalizeText(h.code),
          category: normalizeText(h.category) || 'Прочая',
          name: normalizeText(h.name) || 'Не указана',
          danger_source: normalizeText(h.danger_source),
          severity: Math.max(1, Math.min(5, Math.round(Number(h.severity) || 1))),
          probability: Math.max(1, Math.min(5, Math.round(Number(h.probability) || 1))),
          risk_score: score,
          risk_level: StorageService.computeRiskLevel(score),
          existing_measures: normalizeText(h.existing_measures),
          recommended_measures: normalizeText(h.recommended_measures),
        };
      });
    }

    const overall = StorageService.computeOverallRisk(normalizedHazards);

    const updated: OprCard = {
      ...existing,
      ...mergedRefs,
      card_number,
      contingent_record_id: data.contingent_record_id !== undefined ? data.contingent_record_id : existing.contingent_record_id,
      workplace_label: data.workplace_label !== undefined ? normalizeText(data.workplace_label) : existing.workplace_label,
      assessment_date: data.assessment_date !== undefined ? data.assessment_date : existing.assessment_date,
      assessment_method: data.assessment_method !== undefined ? (normalizeText(data.assessment_method) || existing.assessment_method) : existing.assessment_method,
      commission_members: data.commission_members !== undefined ? normalizeText(data.commission_members) : existing.commission_members,
      hazards: normalizedHazards,
      overall_risk_score: overall.score,
      overall_risk_level: overall.level,
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.saveOprCardsRaw(all);
    this.addAudit('opr_card', updated.id, 'opr_update' as any, before, { ...updated }, `Обновление карты ОПР № ${updated.card_number}`);
    return updated;
  }

  public archiveOprCard(id: string): OprCard {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getOprCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта ОПР не найдена.');
    const existing = all[index];
    if (existing.status === 'archived') throw new Error('Карта ОПР уже в архиве.');
    const before = { ...existing };
    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveOprCardsRaw(all);
    this.addAudit('opr_card', existing.id, 'opr_archive' as any, before, { ...existing }, `Архивирование карты ОПР № ${existing.card_number}`);
    return existing;
  }

  public restoreOprCard(id: string): OprCard {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getOprCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта ОПР не найдена.');
    const existing = all[index];
    if (existing.status === 'active') throw new Error('Карта ОПР уже активна.');
    const before = { ...existing };
    existing.status = 'active';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveOprCardsRaw(all);
    this.addAudit('opr_card', existing.id, 'opr_restore' as any, before, { ...existing }, `Восстановление карты ОПР № ${existing.card_number}`);
    return existing;
  }

  // --- План мероприятий по снижению рисков (Приказ 776н) ---
  public listOprMeasures(cardId?: string): OprMeasureItem[] {
    const all = this.getOprMeasuresRaw();
    if (!cardId) return all;
    return all.filter(m => m.opr_card_id === cardId);
  }

  public createOprMeasure(
    cardIdOrData:
      | string
      | {
          opr_card_id: string;
          hazard_id?: string | null;
          measure_title: string;
          deadline?: string | null;
          responsible_person?: string | null;
          cost_estimate?: string | null;
          comment?: string | null;
          status?: 'planned' | 'in_progress' | 'completed';
        },
    maybeData?: {
      hazard_id?: string | null;
      measure_title: string;
      deadline?: string | null;
      responsible_person?: string | null;
      cost_estimate?: string | null;
      comment?: string | null;
      status?: 'planned' | 'in_progress' | 'completed';
    }
  ): OprMeasureItem {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const cardId = typeof cardIdOrData === 'string' ? cardIdOrData : cardIdOrData.opr_card_id;
    const data = typeof cardIdOrData === 'string' ? maybeData! : cardIdOrData;

    const card = this.getOprCardById(cardId);
    if (!card) throw new Error('Карта ОПР не найдена.');
    const title = normalizeText(data?.measure_title);
    if (!title) throw new Error('Укажите наименование мероприятия по снижению риска.');

    const now = nowISO();
    const item: OprMeasureItem = {
      id: generateUUID(),
      opr_card_id: cardId,
      hazard_id: data.hazard_id || null,
      measure_title: title,
      deadline: data.deadline || null,
      responsible_person: normalizeText(data.responsible_person),
      status: data.status || 'planned',
      cost_estimate: normalizeText(data.cost_estimate),
      comment: normalizeText(data.comment),
      created_at: now,
      updated_at: now,
    };

    const all = this.getOprMeasuresRaw();
    all.push(item);
    this.saveOprMeasuresRaw(all);
    this.addAudit('opr_measure', item.id, 'opr_measure_create' as any, null, { ...item }, `Добавление мероприятия по снижению рисков к карте № ${card.card_number}`);
    return item;
  }

  public updateOprMeasure(id: string, data: Partial<OprMeasureItem>): OprMeasureItem {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getOprMeasuresRaw();
    const index = all.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Мероприятие не найдено.');
    const existing = all[index];
    const before = { ...existing };

    const updated: OprMeasureItem = {
      ...existing,
      measure_title: data.measure_title !== undefined ? (normalizeText(data.measure_title) || existing.measure_title) : existing.measure_title,
      deadline: data.deadline !== undefined ? data.deadline : existing.deadline,
      responsible_person: data.responsible_person !== undefined ? normalizeText(data.responsible_person) : existing.responsible_person,
      status: data.status || existing.status,
      cost_estimate: data.cost_estimate !== undefined ? normalizeText(data.cost_estimate) : existing.cost_estimate,
      comment: data.comment !== undefined ? normalizeText(data.comment) : existing.comment,
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.saveOprMeasuresRaw(all);
    this.addAudit('opr_measure', updated.id, 'opr_measure_update' as any, before, { ...updated }, `Обновление мероприятия «${updated.measure_title}»`);
    return updated;
  }

  public deleteOprMeasure(id: string): void {
    if (!this.isModuleEnabled('opr')) {
      throw new Error('Модуль ОПР отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getOprMeasuresRaw();
    const index = all.findIndex(m => m.id === id);
    if (index === -1) throw new Error('Мероприятие не найдено.');
    const before = { ...all[index] };
    all.splice(index, 1);
    this.saveOprMeasuresRaw(all);
    this.addAudit('opr_measure', before.id, 'delete' as any, before, null, `Удаление мероприятия «${before.measure_title}»`);
  }

  // ===============================================
  // Модуль «Медосмотры и психиатрическое освидетельствование» (Этап 8, 29н/342н)
  // ===============================================

  public getMedicalCardsRaw(): MedicalExaminationCard[] {
    return loadFromStorage<MedicalExaminationCard[]>(STORAGE_KEYS.MEDICAL_CARDS, []);
  }

  public saveMedicalCardsRaw(items: MedicalExaminationCard[]): void {
    saveToStorage(STORAGE_KEYS.MEDICAL_CARDS, items);
  }

  public getPsychiatricExamsRaw(): PsychiatricExamination[] {
    return loadFromStorage<PsychiatricExamination[]>(STORAGE_KEYS.PSYCHIATRIC_EXAMS, []);
  }

  public savePsychiatricExamsRaw(items: PsychiatricExamination[]): void {
    saveToStorage(STORAGE_KEYS.PSYCHIATRIC_EXAMS, items);
  }

  private validateDateOrNull(value: string | null | undefined, fieldLabel: string): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
      throw new Error(`${fieldLabel}: дата должна быть в формате ГГГГ-ММ-ДД.`);
    }
    const d = new Date(value + 'T00:00:00');
    if (isNaN(d.getTime())) {
      throw new Error(`${fieldLabel}: указана некорректная дата.`);
    }
    return value;
  }

  private validateMedicalRefs(data: {
    legal_entity_id: string;
    employee_id: string;
    contingent_record_id?: string | null;
    sout_card_id?: string | null;
  }): void {
    if (!data.legal_entity_id) throw new Error('Юридическое лицо обязательно для заполнения.');
    const le = this.getLegalEntityById(data.legal_entity_id);
    if (!le) throw new Error('Юридическое лицо не найдено.');
    if (!data.employee_id) throw new Error('Работник обязателен для заполнения.');
    const emp = this.getEmployeeById(data.employee_id);
    if (!emp) throw new Error('Работник не найден.');
    if (emp.legal_entity_id !== data.legal_entity_id) {
      throw new Error('Работник относится к другому юридическому лицу.');
    }
    if (data.contingent_record_id) {
      const cr = this.getContingentRecordById(data.contingent_record_id);
      if (!cr) throw new Error('Запись контингента не найдена.');
      if (cr.legal_entity_id !== data.legal_entity_id) {
        throw new Error('Запись контингента относится к другому юридическому лицу.');
      }
    }
    if (data.sout_card_id) {
      const sc = this.getSoutCardById(data.sout_card_id);
      if (!sc) throw new Error('Карта СОУТ не найдена.');
      if (sc.legal_entity_id !== data.legal_entity_id) {
        throw new Error('Карта СОУТ относится к другому юридическому лицу.');
      }
    }
  }

  public listMedicalCards(params?: {
    search?: string;
    legal_entity_id?: string;
    exam_type?: MedicalExamType;
    conclusion?: MedicalConclusion;
    overdue?: boolean;
    status?: EntityStatus;
    page?: number;
    pageSize?: number;
  }): { items: MedicalExaminationCard[]; total: number } {
    const all = this.getMedicalCardsRaw();
    const status = params?.status || 'active';
    let filtered = all.filter(c => c.status === status);

    if (params?.legal_entity_id) {
      filtered = filtered.filter(c => c.legal_entity_id === params.legal_entity_id);
    }
    if (params?.exam_type) {
      filtered = filtered.filter(c => c.exam_type === params.exam_type);
    }
    if (params?.conclusion) {
      filtered = filtered.filter(c => c.conclusion === params.conclusion);
    }
    if (params?.overdue) {
      const today = nowISO().split('T')[0];
      filtered = filtered.filter(c => !!c.next_due_date && c.next_due_date < today);
    }

    const term = (params?.search || '').trim().toLowerCase();
    if (term) {
      const employees = this.getEmployeesRaw();
      filtered = filtered.filter(c => {
        const emp = employees.find(e => e.id === c.employee_id);
        const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}` : '';
        return (
          c.card_number.toLowerCase().includes(term) ||
          fio.toLowerCase().includes(term) ||
          (c.clinic_name || '').toLowerCase().includes(term) ||
          (c.doctor_fio || '').toLowerCase().includes(term)
        );
      });
    }

    filtered.sort((a, b) => ciCompare(a.card_number).localeCompare(ciCompare(b.card_number)));
    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), total };
  }

  public getMedicalCardById(id: string): MedicalExaminationCard | null {
    return this.getMedicalCardsRaw().find(c => c.id === id) || null;
  }

  public createMedicalCard(data: {
    card_number: string;
    legal_entity_id: string;
    employee_id: string;
    contingent_record_id?: string | null;
    sout_card_id?: string | null;
    exam_type: MedicalExamType;
    referral_date?: string | null;
    exam_date?: string | null;
    next_due_date?: string | null;
    clinic_name?: string | null;
    doctor_fio?: string | null;
    conclusion: MedicalConclusion;
    conclusion_details?: string | null;
    contraindications_found?: boolean;
  }): MedicalExaminationCard {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    const card_number = normalizeText(data.card_number);
    if (!card_number) throw new Error('Номер карты медосмотра обязателен для заполнения.');
    if (!MEDICAL_EXAM_TYPE_LABELS_RU[data.exam_type]) {
      throw new Error('Недопустимый вид медосмотра.');
    }
    if (!MEDICAL_CONCLUSION_LABELS_RU[data.conclusion]) {
      throw new Error('Недопустимое заключение по результатам медосмотра.');
    }

    this.validateMedicalRefs(data);

    const referralDate = this.validateDateOrNull(data.referral_date, 'Дата направления');
    const examDate = this.validateDateOrNull(data.exam_date, 'Дата медосмотра');
    const nextDueDate = this.validateDateOrNull(data.next_due_date, 'Срок следующего медосмотра');

    if (referralDate && examDate && examDate < referralDate) {
      throw new Error('Дата медосмотра не может быть раньше даты выдачи направления.');
    }
    if (examDate && nextDueDate && nextDueDate <= examDate) {
      throw new Error('Срок следующего медосмотра должен быть позже даты пройденного медосмотра.');
    }
    if (data.conclusion !== 'pending' && !examDate) {
      throw new Error('Укажите дату прохождения медосмотра для полученного заключения.');
    }

    const all = this.getMedicalCardsRaw();
    const dup = all.find(
      c => c.status === 'active' && c.legal_entity_id === data.legal_entity_id && ciCompare(c.card_number) === ciCompare(card_number)
    );
    if (dup) {
      throw new Error(`Карта медосмотра № «${card_number}» уже зарегистрирована в данном юридическом лице.`);
    }

    const now = nowISO();
    const card: MedicalExaminationCard = {
      id: generateUUID(),
      card_number,
      legal_entity_id: data.legal_entity_id,
      employee_id: data.employee_id,
      contingent_record_id: data.contingent_record_id || null,
      sout_card_id: data.sout_card_id || null,
      exam_type: data.exam_type,
      referral_date: referralDate,
      exam_date: examDate,
      next_due_date: nextDueDate,
      clinic_name: normalizeText(data.clinic_name),
      doctor_fio: normalizeText(data.doctor_fio),
      conclusion: data.conclusion,
      conclusion_details: normalizeText(data.conclusion_details),
      contraindications_found: !!data.contraindications_found,
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    all.push(card);
    this.saveMedicalCardsRaw(all);
    this.addAudit('medical_card', card.id, 'medical_create' as any, null, { ...card }, `Создание карты медосмотра № ${card.card_number}`);
    return card;
  }

  public updateMedicalCard(id: string, data: Partial<MedicalExaminationCard>): MedicalExaminationCard {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getMedicalCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта медосмотра не найдена.');

    const existing = all[index];
    const before = { ...existing };

    const mergedRefs = {
      legal_entity_id: data.legal_entity_id || existing.legal_entity_id,
      employee_id: data.employee_id || existing.employee_id,
      contingent_record_id:
        data.contingent_record_id !== undefined ? data.contingent_record_id : existing.contingent_record_id,
      sout_card_id: data.sout_card_id !== undefined ? data.sout_card_id : existing.sout_card_id,
    };
    this.validateMedicalRefs(mergedRefs);

    const card_number = data.card_number !== undefined ? normalizeText(data.card_number) : existing.card_number;
    if (!card_number) throw new Error('Номер карты медосмотра обязателен для заполнения.');

    if (data.exam_type !== undefined && !MEDICAL_EXAM_TYPE_LABELS_RU[data.exam_type]) {
      throw new Error('Недопустимый вид медосмотра.');
    }
    const conclusion = data.conclusion !== undefined ? data.conclusion : existing.conclusion;
    if (!MEDICAL_CONCLUSION_LABELS_RU[conclusion]) {
      throw new Error('Недопустимое заключение по результатам медосмотра.');
    }

    const referralDate =
      data.referral_date !== undefined ? this.validateDateOrNull(data.referral_date, 'Дата направления') : existing.referral_date || null;
    const examDate =
      data.exam_date !== undefined ? this.validateDateOrNull(data.exam_date, 'Дата медосмотра') : existing.exam_date || null;
    const nextDueDate =
      data.next_due_date !== undefined ? this.validateDateOrNull(data.next_due_date, 'Срок следующего медосмотра') : existing.next_due_date || null;

    if (referralDate && examDate && examDate < referralDate) {
      throw new Error('Дата медосмотра не может быть раньше даты выдачи направления.');
    }
    if (examDate && nextDueDate && nextDueDate <= examDate) {
      throw new Error('Срок следующего медосмотра должен быть позже даты пройденного медосмотра.');
    }
    if (conclusion !== 'pending' && !examDate) {
      throw new Error('Укажите дату прохождения медосмотра для полученного заключения.');
    }

    const dup = all.find(
      c => c.id !== id && c.status === 'active' && c.legal_entity_id === mergedRefs.legal_entity_id && ciCompare(c.card_number) === ciCompare(card_number)
    );
    if (dup) {
      throw new Error(`Карта медосмотра № «${card_number}» уже зарегистрирована в данном юридическом лице.`);
    }

    const updated: MedicalExaminationCard = {
      ...existing,
      ...mergedRefs,
      card_number,
      exam_type: data.exam_type !== undefined ? data.exam_type : existing.exam_type,
      referral_date: referralDate,
      exam_date: examDate,
      next_due_date: nextDueDate,
      clinic_name: data.clinic_name !== undefined ? normalizeText(data.clinic_name) : existing.clinic_name,
      doctor_fio: data.doctor_fio !== undefined ? normalizeText(data.doctor_fio) : existing.doctor_fio,
      conclusion,
      conclusion_details:
        data.conclusion_details !== undefined ? normalizeText(data.conclusion_details) : existing.conclusion_details,
      contraindications_found:
        data.contraindications_found !== undefined ? !!data.contraindications_found : existing.contraindications_found,
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.saveMedicalCardsRaw(all);
    this.addAudit('medical_card', updated.id, 'medical_update' as any, before, { ...updated }, `Обновление карты медосмотра № ${updated.card_number}`);
    return updated;
  }

  public archiveMedicalCard(id: string): MedicalExaminationCard {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getMedicalCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта медосмотра не найдена.');
    const existing = all[index];
    if (existing.status === 'archived') throw new Error('Карта медосмотра уже в архиве.');
    const before = { ...existing };
    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveMedicalCardsRaw(all);
    this.addAudit('medical_card', existing.id, 'medical_archive' as any, before, { ...existing }, `Архивирование карты медосмотра № ${existing.card_number}`);
    return existing;
  }

  public restoreMedicalCard(id: string): MedicalExaminationCard {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getMedicalCardsRaw();
    const index = all.findIndex(c => c.id === id);
    if (index === -1) throw new Error('Карта медосмотра не найдена.');
    const existing = all[index];
    if (existing.status === 'active') throw new Error('Карта медосмотра уже активна.');
    const before = { ...existing };
    existing.status = 'active';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.saveMedicalCardsRaw(all);
    this.addAudit('medical_card', existing.id, 'medical_restore' as any, before, { ...existing }, `Восстановление карты медосмотра № ${existing.card_number}`);
    return existing;
  }

  // --- Акты психиатрического освидетельствования (342н) ---

  public listPsychiatricExams(params?: {
    search?: string;
    legal_entity_id?: string;
    conclusion?: PsychiatricConclusion;
    expired?: boolean;
    status?: EntityStatus;
    page?: number;
    pageSize?: number;
  }): { items: PsychiatricExamination[]; total: number } {
    const all = this.getPsychiatricExamsRaw();
    const status = params?.status || 'active';
    let filtered = all.filter(e => e.status === status);

    if (params?.legal_entity_id) {
      filtered = filtered.filter(e => e.legal_entity_id === params.legal_entity_id);
    }
    if (params?.conclusion) {
      filtered = filtered.filter(e => e.conclusion === params.conclusion);
    }
    if (params?.expired) {
      const today = nowISO().split('T')[0];
      filtered = filtered.filter(e => !!e.valid_until && e.valid_until < today);
    }

    const term = (params?.search || '').trim().toLowerCase();
    if (term) {
      const employees = this.getEmployeesRaw();
      filtered = filtered.filter(e => {
        const emp = employees.find(x => x.id === e.employee_id);
        const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}` : '';
        return (
          fio.toLowerCase().includes(term) ||
          (e.conclusion_protocol_number || '').toLowerCase().includes(term) ||
          (e.commission_members || '').toLowerCase().includes(term)
        );
      });
    }

    filtered.sort((a, b) => (b.exam_date || '').localeCompare(a.exam_date || ''));
    const total = filtered.length;
    const page = Math.max(1, params?.page || 1);
    const pageSize = params?.pageSize || 30;
    const start = (page - 1) * pageSize;
    return { items: filtered.slice(start, start + pageSize), total };
  }

  public getPsychiatricExamById(id: string): PsychiatricExamination | null {
    return this.getPsychiatricExamsRaw().find(e => e.id === id) || null;
  }

  public createPsychiatricExam(data: {
    legal_entity_id: string;
    employee_id: string;
    exam_date?: string | null;
    commission_members?: string | null;
    conclusion: PsychiatricConclusion;
    conclusion_protocol_number?: string | null;
    valid_until?: string | null;
    basis?: string | null;
    comment?: string | null;
  }): PsychiatricExamination {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    if (!PSYCHIATRIC_CONCLUSION_LABELS_RU[data.conclusion]) {
      throw new Error('Недопустимое заключение комиссии.');
    }
    const empOnlyRefs = { legal_entity_id: data.legal_entity_id, employee_id: data.employee_id };
    this.validateMedicalRefs({ ...empOnlyRefs, contingent_record_id: null, sout_card_id: null });

    const examDate = this.validateDateOrNull(data.exam_date, 'Дата освидетельствования');
    const validUntil = this.validateDateOrNull(data.valid_until, 'Срок действия заключения');
    if (examDate && validUntil && validUntil <= examDate) {
      throw new Error('Срок действия заключения должен быть позже даты освидетельствования.');
    }

    const now = nowISO();
    const item: PsychiatricExamination = {
      id: generateUUID(),
      legal_entity_id: data.legal_entity_id,
      employee_id: data.employee_id,
      exam_date: examDate,
      commission_members: normalizeText(data.commission_members),
      conclusion: data.conclusion,
      conclusion_protocol_number: normalizeText(data.conclusion_protocol_number),
      valid_until: validUntil,
      basis: normalizeText(data.basis),
      comment: normalizeText(data.comment),
      status: 'active',
      created_at: now,
      updated_at: now,
    };

    const all = this.getPsychiatricExamsRaw();
    all.push(item);
    this.savePsychiatricExamsRaw(all);
    this.addAudit('psychiatric_exam', item.id, 'psych_create' as any, null, { ...item }, 'Создание акта психиатрического освидетельствования');
    return item;
  }

  public updatePsychiatricExam(id: string, data: Partial<PsychiatricExamination>): PsychiatricExamination {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getPsychiatricExamsRaw();
    const index = all.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Акт психиатрического освидетельствования не найден.');

    const existing = all[index];
    const before = { ...existing };

    const mergedRefs = {
      legal_entity_id: data.legal_entity_id || existing.legal_entity_id,
      employee_id: data.employee_id || existing.employee_id,
    };
    this.validateMedicalRefs({ ...mergedRefs, contingent_record_id: null, sout_card_id: null });

    const conclusion = data.conclusion !== undefined ? data.conclusion : existing.conclusion;
    if (!PSYCHIATRIC_CONCLUSION_LABELS_RU[conclusion]) {
      throw new Error('Недопустимое заключение комиссии.');
    }

    const examDate =
      data.exam_date !== undefined ? this.validateDateOrNull(data.exam_date, 'Дата освидетельствования') : existing.exam_date || null;
    const validUntil =
      data.valid_until !== undefined ? this.validateDateOrNull(data.valid_until, 'Срок действия заключения') : existing.valid_until || null;
    if (examDate && validUntil && validUntil <= examDate) {
      throw new Error('Срок действия заключения должен быть позже даты освидетельствования.');
    }

    const updated: PsychiatricExamination = {
      ...existing,
      ...mergedRefs,
      exam_date: examDate,
      valid_until: validUntil,
      conclusion,
      commission_members:
        data.commission_members !== undefined ? normalizeText(data.commission_members) : existing.commission_members,
      conclusion_protocol_number:
        data.conclusion_protocol_number !== undefined
          ? normalizeText(data.conclusion_protocol_number)
          : existing.conclusion_protocol_number,
      basis: data.basis !== undefined ? normalizeText(data.basis) : existing.basis,
      comment: data.comment !== undefined ? normalizeText(data.comment) : existing.comment,
      updated_at: nowISO(),
    };

    all[index] = updated;
    this.savePsychiatricExamsRaw(all);
    this.addAudit('psychiatric_exam', updated.id, 'psych_update' as any, before, { ...updated }, 'Обновление акта психиатрического освидетельствования');
    return updated;
  }

  public archivePsychiatricExam(id: string): PsychiatricExamination {
    if (!this.isModuleEnabled('medical')) {
      throw new Error('Модуль «Медосмотры» отключён. Включите модуль в реестре модулей.');
    }
    const all = this.getPsychiatricExamsRaw();
    const index = all.findIndex(e => e.id === id);
    if (index === -1) throw new Error('Акт психиатрического освидетельствования не найден.');
    const existing = all[index];
    if (existing.status === 'archived') throw new Error('Акт уже в архиве.');
    const before = { ...existing };
    existing.status = 'archived';
    existing.updated_at = nowISO();
    all[index] = existing;
    this.savePsychiatricExamsRaw(all);
    this.addAudit('psychiatric_exam', existing.id, 'psych_archive' as any, before, { ...existing }, 'Архивирование акта психиатрического освидетельствования');
    return existing;
  }

  // --- Backup & Restore ---
  public createBackup(label?: string): string {
    const manifest = {
      id: generateUUID(),
      created_at: nowISO(),
      label: label || 'manual',
      counts: {
        legal_entities: this.getLegalEntitiesRaw().length,
        departments: this.getDepartmentsRaw().length,
        positions: this.getPositionsRaw().length,
        contingent: this.getContingentRaw().length,
        employees: this.getEmployeesRaw().length,
        employment_history: this.getEmploymentHistoryRaw().length,
        sout_cards: this.getSoutCardsRaw().length,
        sout_familiarizations: this.getSoutFamiliarizationsRaw().length,
        opr_cards: this.getOprCardsRaw().length,
        opr_measures: this.getOprMeasuresRaw().length,
        medical_cards: this.getMedicalCardsRaw().length,
        psychiatric_exams: this.getPsychiatricExamsRaw().length,
        audit_logs: this.getAuditLogs().length,
      },
      data: {
        legal_entities: this.getLegalEntitiesRaw(),
        departments: this.getDepartmentsRaw(),
        positions: this.getPositionsRaw(),
        contingent: this.getContingentRaw(),
        employees: this.getEmployeesRaw(),
        employment_history: this.getEmploymentHistoryRaw(),
        sout_cards: this.getSoutCardsRaw(),
        sout_familiarizations: this.getSoutFamiliarizationsRaw(),
        opr_cards: this.getOprCardsRaw(),
        opr_measures: this.getOprMeasuresRaw(),
        medical_cards: this.getMedicalCardsRaw(),
        psychiatric_exams: this.getPsychiatricExamsRaw(),
        audit_logs: this.getAuditLogs(),
      },
    };

    const backups = loadFromStorage<any[]>('saot_backups_list', []);
    backups.unshift({
      id: manifest.id,
      created_at: manifest.created_at,
      label: manifest.label,
      counts: manifest.counts,
      jsonString: JSON.stringify(manifest),
    });
    saveToStorage('saot_backups_list', backups);

    return JSON.stringify(manifest, null, 2);
  }

  public getBackupsList(): any[] {
    return loadFromStorage<any[]>('saot_backups_list', []);
  }

  public checkPeriodicAutoBackup(): void {
    try {
      const last = localStorage.getItem('saot_last_auto_backup');
      const now = Date.now();
      if (!last || now - Number(last) > 24 * 60 * 60 * 1000) {
        this.createBackup('auto-daily');
        localStorage.setItem('saot_last_auto_backup', String(now));
      }
    } catch {
      // Ignore if localStorage unavailable
    }
  }

  public restoreFromBackup(backupJson: string): DataIntegrityReport {
    const parsed = JSON.parse(backupJson);
    if (!parsed || !parsed.data) {
      throw new Error('Некорректный формат файла резервной копии.');
    }

    this.createBackup('pre-restore');

    if (Array.isArray(parsed.data.legal_entities)) {
      this.saveLegalEntitiesRaw(parsed.data.legal_entities);
    }
    if (Array.isArray(parsed.data.departments)) {
      saveToStorage(STORAGE_KEYS.DEPARTMENTS, parsed.data.departments);
    }
    if (Array.isArray(parsed.data.positions)) {
      saveToStorage(STORAGE_KEYS.POSITIONS, parsed.data.positions);
    }
    if (Array.isArray(parsed.data.contingent)) {
      saveToStorage(STORAGE_KEYS.CONTINGENT, parsed.data.contingent);
    }
    if (Array.isArray(parsed.data.employees)) {
      saveToStorage(STORAGE_KEYS.EMPLOYEES, parsed.data.employees);
    }
    if (Array.isArray(parsed.data.employment_history)) {
      saveToStorage(STORAGE_KEYS.EMPLOYMENT_HISTORY, parsed.data.employment_history);
    }
    if (Array.isArray(parsed.data.sout_cards)) {
      saveToStorage(STORAGE_KEYS.SOUT_CARDS, parsed.data.sout_cards);
    }
    if (Array.isArray(parsed.data.sout_familiarizations)) {
      saveToStorage(STORAGE_KEYS.SOUT_FAMILIARIZATIONS, parsed.data.sout_familiarizations);
    }
    if (Array.isArray(parsed.data.opr_cards)) {
      saveToStorage(STORAGE_KEYS.OPR_CARDS, parsed.data.opr_cards);
    }
    if (Array.isArray(parsed.data.opr_measures)) {
      saveToStorage(STORAGE_KEYS.OPR_MEASURES, parsed.data.opr_measures);
    }
    if (Array.isArray(parsed.data.medical_cards)) {
      saveToStorage(STORAGE_KEYS.MEDICAL_CARDS, parsed.data.medical_cards);
    }
    if (Array.isArray(parsed.data.psychiatric_exams)) {
      saveToStorage(STORAGE_KEYS.PSYCHIATRIC_EXAMS, parsed.data.psychiatric_exams);
    }
    if (Array.isArray(parsed.data.audit_logs)) {
      saveToStorage(STORAGE_KEYS.AUDIT_LOG, parsed.data.audit_logs);
    }


    const integrityReport = this.verifyDataIntegrity();

    this.addAudit(
      'database',
      'local',
      'restore',
      null,
      {
        backup_id: parsed.id,
        created_at: parsed.created_at,
        integrity_valid: integrityReport.valid,
        integrity_errors: integrityReport.errors.length,
      },
      'Восстановление из резервной копии'
    );

    return integrityReport;
  }

  // --- Data Integrity Verification (Stage 5, FR-14, Scenario 18) ---
  public verifyDataIntegrity(): DataIntegrityReport {
    const les = this.getLegalEntitiesRaw();
    const depts = this.getDepartmentsRaw();
    const positions = this.getPositionsRaw();
    const contingent = this.getContingentRaw();
    const employees = this.getEmployeesRaw();
    const history = this.getEmploymentHistoryRaw();
    const soutCards = this.getSoutCardsRaw();
    const soutFam = this.getSoutFamiliarizationsRaw();
    const oprCards = this.getOprCardsRaw();
    const oprMeasures = this.getOprMeasuresRaw();
    const medicalCards = this.getMedicalCardsRaw();
    const psychExams = this.getPsychiatricExamsRaw();
    const logs = this.getAuditLogs();

    const errors: string[] = [];
    const warnings: string[] = [];

    const leMap = new Map(les.map(l => [l.id, l]));
    const deptMap = new Map(depts.map(d => [d.id, d]));
    const posMap = new Map(positions.map(p => [p.id, p]));
    const contMap = new Map(contingent.map(c => [c.id, c]));
    const empMap = new Map(employees.map(e => [e.id, e]));

    // 1. Legal entities verification
    const activeInnKpp = new Set<string>();
    const activeOgrn = new Set<string>();
    for (const le of les) {
      if (!le.id || !le.full_name) {
        errors.push(`Юридическое лицо с некорректным идентификатором или пустым наименованием (ID: ${le.id || 'отсутствует'}).`);
      }
      if (le.status === 'active') {
        if (le.inn && le.kpp) {
          const key = `${le.inn}_${le.kpp}`;
          if (activeInnKpp.has(key)) {
            errors.push(`Обнаружен дубликат активного юридического лица по ИНН/КПП: ${le.inn}/${le.kpp} («${le.full_name}»).`);
          } else {
            activeInnKpp.add(key);
          }
        }
        if (le.ogrn) {
          if (activeOgrn.has(le.ogrn)) {
            errors.push(`Обнаружен дубликат активного юридического лица по ОГРН: ${le.ogrn} («${le.full_name}»).`);
          } else {
            activeOgrn.add(le.ogrn);
          }
        }
      }
    }

    // 2. Departments verification (referential integrity & hierarchy cycle detection)
    for (const d of depts) {
      if (!d.legal_entity_id || !leMap.has(d.legal_entity_id)) {
        errors.push(`Подразделение «${d.name}» (ID: ${d.id}) ссылается на несуществующее юридическое лицо (ID: ${d.legal_entity_id}).`);
      }
      if (d.parent_id) {
        const parent = deptMap.get(d.parent_id);
        if (!parent) {
          errors.push(`Подразделение «${d.name}» (ID: ${d.id}) ссылается на несуществующее родительское подразделение (ID: ${d.parent_id}).`);
        } else if (parent.legal_entity_id !== d.legal_entity_id) {
          errors.push(`Подразделение «${d.name}» (ID: ${d.id}) и его родитель относятся к разным юридическим лицам.`);
        }

        // Cycle check
        let curr: Department | undefined = parent;
        const visited = new Set<string>([d.id]);
        while (curr) {
          if (visited.has(curr.id)) {
            errors.push(`Обнаружен цикл в иерархии подразделений: «${d.name}» (ID: ${d.id}).`);
            break;
          }
          visited.add(curr.id);
          curr = curr.parent_id ? deptMap.get(curr.parent_id) : undefined;
        }
      }
    }

    // 3. Positions verification
    for (const p of positions) {
      if (!p.id || !p.name) {
        errors.push(`Должность с пустым наименованием или ID (ID: ${p.id || 'отсутствует'}).`);
      }
    }

    // 4. Contingent verification
    for (const c of contingent) {
      if (!c.legal_entity_id || !leMap.has(c.legal_entity_id)) {
        errors.push(`Запись контингента (ID: ${c.id}) ссылается на несуществующее юридическое лицо (ID: ${c.legal_entity_id}).`);
      }
      const dept = deptMap.get(c.department_id);
      if (!dept) {
        errors.push(`Запись контингента (ID: ${c.id}) ссылается на несуществующее подразделение (ID: ${c.department_id}).`);
      } else if (c.legal_entity_id && dept.legal_entity_id !== c.legal_entity_id) {
        errors.push(`Запись контингента (ID: ${c.id}) ссылается на подразделение другого юридического лица.`);
      }

      if (!c.position_id || !posMap.has(c.position_id)) {
        errors.push(`Запись контингента (ID: ${c.id}) ссылается на несуществующую должность (ID: ${c.position_id}).`);
      }
    }

    // 5. Employees verification
    for (const e of employees) {
      if (!e.legal_entity_id || !leMap.has(e.legal_entity_id)) {
        errors.push(`Работник «${e.last_name} ${e.first_name}» (ID: ${e.id}) ссылается на несуществующее юридическое лицо (ID: ${e.legal_entity_id}).`);
      }
      const dept = deptMap.get(e.department_id);
      if (!dept) {
        errors.push(`Работник «${e.last_name} ${e.first_name}» (ID: ${e.id}) ссылается на несуществующее подразделение (ID: ${e.department_id}).`);
      } else if (e.legal_entity_id && dept.legal_entity_id !== e.legal_entity_id) {
        errors.push(`Работник «${e.last_name} ${e.first_name}» (ID: ${e.id}) ссылается на подразделение другого юридического лица.`);
      }

      if (!e.position_id || !posMap.has(e.position_id)) {
        errors.push(`Работник «${e.last_name} ${e.first_name}» (ID: ${e.id}) ссылается на несуществующую должность (ID: ${e.position_id}).`);
      }

      if (e.contingent_record_id) {
        const cont = contMap.get(e.contingent_record_id);
        if (!cont) {
          errors.push(`Работник «${e.last_name} ${e.first_name}» (ID: ${e.id}) ссылается на несуществующую позицию контингента (ID: ${e.contingent_record_id}).`);
        } else if (e.legal_entity_id && cont.legal_entity_id !== e.legal_entity_id) {
          errors.push(`Работник «${e.last_name} ${e.first_name}» (ID: ${e.id}) привязан к позиции контингента другого юридического лица.`);
        }
      }
    }

    // 6. Employment history verification (D-005)
    const empActiveHistoryCount = new Map<string, number>();
    for (const h of history) {
      if (!h.employee_id || !empMap.has(h.employee_id)) {
        errors.push(`Запись истории перемещений (ID: ${h.id}) ссылается на несуществующего работника (ID: ${h.employee_id}).`);
      }
      if (h.department_id && !deptMap.has(h.department_id)) {
        errors.push(`Запись истории (ID: ${h.id}) ссылается на несуществующее подразделение (ID: ${h.department_id}).`);
      }
      if (h.position_id && !posMap.has(h.position_id)) {
        errors.push(`Запись истории (ID: ${h.id}) ссылается на несуществующую должность (ID: ${h.position_id}).`);
      }
      if (h.contingent_record_id && !contMap.has(h.contingent_record_id)) {
        errors.push(`Запись истории (ID: ${h.id}) ссылается на несуществующую позицию контингента (ID: ${h.contingent_record_id}).`);
      }
      if (h.start_date && h.end_date && h.start_date > h.end_date) {
        errors.push(`В истории перемещений (ID: ${h.id}) дата начала ${h.start_date} позже даты окончания ${h.end_date}.`);
      }

      if (h.end_date === null) {
        const count = (empActiveHistoryCount.get(h.employee_id) || 0) + 1;
        empActiveHistoryCount.set(h.employee_id, count);
        if (count > 1) {
          warnings.push(`У работника ID: ${h.employee_id} обнаружено более одного открытого периода в истории перемещений.`);
        }
      }
    }

    // 7. СОУТ verification (Stage 6+, module 'sout')
    const soutCardMap = new Map(soutCards.map(c => [c.id, c]));
    for (const c of soutCards) {
      if (!c.card_number) {
        errors.push(`Карта СОУТ (ID: ${c.id}) имеет пустой номер карты.`);
      }
      if (!c.legal_entity_id || !leMap.has(c.legal_entity_id)) {
        errors.push(`Карта СОУТ № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующее юридическое лицо (ID: ${c.legal_entity_id}).`);
      }
      const dept = deptMap.get(c.department_id);
      if (!dept) {
        errors.push(`Карта СОУТ № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующее подразделение (ID: ${c.department_id}).`);
      } else if (c.legal_entity_id && dept.legal_entity_id !== c.legal_entity_id) {
        errors.push(`Карта СОУТ № «${c.card_number}» (ID: ${c.id}) ссылается на подразделение другого юридического лица.`);
      }
      if (!c.position_id || !posMap.has(c.position_id)) {
        errors.push(`Карта СОУТ № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующую должность (ID: ${c.position_id}).`);
      }
      if (!StorageService.SOUT_VALID_CLASSES.includes(c.final_class)) {
        errors.push(`Карта СОУТ № «${c.card_number}» (ID: ${c.id}) содержит недопустимый класс условий труда «${c.final_class}».`);
      }
    }

    // 8. SOUT familiarizations verification
    const empMapForSout = empMap;
    for (const f of soutFam) {
      if (!f.sout_card_id || !soutCardMap.has(f.sout_card_id)) {
        errors.push(`Запись ознакомления с картой СОУТ (ID: ${f.id}) ссылается на несуществующую карту (ID: ${f.sout_card_id}).`);
      }
      const emp = empMapForSout.get(f.employee_id);
      if (!emp) {
        errors.push(`Запись ознакомления с картой СОУТ (ID: ${f.id}) ссылается на несуществующего работника (ID: ${f.employee_id}).`);
      } else {
        const card = soutCardMap.get(f.sout_card_id);
        if (card && emp.legal_entity_id !== card.legal_entity_id) {
          errors.push(`Работник «${emp.last_name} ${emp.first_name}» ознакомлен с картой СОУТ другого юридического лица (запись ID: ${f.id}).`);
        }
      }
    }

    // 9. ОПР cards verification (Stage 7, module 'opr')
    const oprCardMap = new Map(oprCards.map(c => [c.id, c]));
    for (const c of oprCards) {
      if (!c.card_number) {
        errors.push(`Карта ОПР (ID: ${c.id}) имеет пустой номер карты.`);
      }
      if (!c.legal_entity_id || !leMap.has(c.legal_entity_id)) {
        errors.push(`Карта ОПР № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующее юридическое лицо (ID: ${c.legal_entity_id}).`);
      }
      const dept = deptMap.get(c.department_id);
      if (!dept) {
        errors.push(`Карта ОПР № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующее подразделение (ID: ${c.department_id}).`);
      } else if (c.legal_entity_id && dept.legal_entity_id !== c.legal_entity_id) {
        errors.push(`Карта ОПР № «${c.card_number}» (ID: ${c.id}) ссылается на подразделение другого юридического лица.`);
      }
      if (!c.position_id || !posMap.has(c.position_id)) {
        errors.push(`Карта ОПР № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующую должность (ID: ${c.position_id}).`);
      }
    }

    // 10. ОПР measures verification
    for (const m of oprMeasures) {
      if (!m.opr_card_id || !oprCardMap.has(m.opr_card_id)) {
        errors.push(`Мероприятие ОПР по снижению рисков (ID: ${m.id}) ссылается на несуществующую карту ОПР (ID: ${m.opr_card_id}).`);
      }
    }

    // 11. Медосмотры verification (Stage 8, module 'medical')
    for (const c of medicalCards) {
      if (!c.card_number) {
        errors.push(`Карта медосмотра (ID: ${c.id}) имеет пустой номер карты.`);
      }
      if (!c.legal_entity_id || !leMap.has(c.legal_entity_id)) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующее юридическое лицо (ID: ${c.legal_entity_id}).`);
      }
      const emp = empMap.get(c.employee_id);
      if (!emp) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующего работника (ID: ${c.employee_id}).`);
      } else if (c.legal_entity_id && emp.legal_entity_id !== c.legal_entity_id) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}): работник относится к другому юридическому лицу.`);
      }
      if (c.contingent_record_id && !contMap.has(c.contingent_record_id)) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующую позицию контингента (ID: ${c.contingent_record_id}).`);
      }
      if (c.sout_card_id && !soutCardMap.has(c.sout_card_id)) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}) ссылается на несуществующую карту СОУТ (ID: ${c.sout_card_id}).`);
      }
      if (c.referral_date && c.exam_date && c.exam_date < c.referral_date) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}): дата медосмотра ${c.exam_date} раньше даты направления ${c.referral_date}.`);
      }
      if (c.exam_date && c.next_due_date && c.next_due_date <= c.exam_date) {
        errors.push(`Карта медосмотра № «${c.card_number}» (ID: ${c.id}): срок следующего медосмотра ${c.next_due_date} не позже даты пройденного ${c.exam_date}.`);
      }
      if (c.conclusion === 'unfit') {
        warnings.push(`Работник (карта медосмотра № «${c.card_number}», ID: ${c.id}) имеет заключение «Не годен» — требуется отстранение от работ.`);
      }
    }

    // 12. Психиатрические освидетельствования verification (Stage 8, module 'medical')
    for (const e of psychExams) {
      if (!e.legal_entity_id || !leMap.has(e.legal_entity_id)) {
        errors.push(`Акт психиатрического освидетельствования (ID: ${e.id}) ссылается на несуществующее юридическое лицо (ID: ${e.legal_entity_id}).`);
      }
      const emp = empMap.get(e.employee_id);
      if (!emp) {
        errors.push(`Акт психиатрического освидетельствования (ID: ${e.id}) ссылается на несуществующего работника (ID: ${e.employee_id}).`);
      } else if (e.legal_entity_id && emp.legal_entity_id !== e.legal_entity_id) {
        errors.push(`Акт психиатрического освидетельствования (ID: ${e.id}): работник относится к другому юридическому лицу.`);
      }
      if (e.exam_date && e.valid_until && e.valid_until <= e.exam_date) {
        errors.push(`Акт психиатрического освидетельствования (ID: ${e.id}): срок действия ${e.valid_until} не позже даты освидетельствования ${e.exam_date}.`);
      }
      if (e.conclusion === 'unfit') {
        warnings.push(`Работник (акт психиатрического освидетельствования ID: ${e.id}) имеет заключение «Не годен» — недопуск к соответствующим работам.`);
      }
    }

    return {
      valid: errors.length === 0,
      timestamp: nowISO(),
      errors,
      warnings,
      stats: {
        legal_entities: les.length,
        departments: depts.length,
        positions: positions.length,
        contingent: contingent.length,
        employees: employees.length,
        employment_history: history.length,
        sout_cards: soutCards.length,
        sout_familiarizations: soutFam.length,
        opr_cards: oprCards.length,
        opr_measures: oprMeasures.length,
        medical_cards: medicalCards.length,
        psychiatric_exams: psychExams.length,
        audit_logs: logs.length,
      },
    };
  }
}

export { StorageService };
export const storage = new StorageService();

