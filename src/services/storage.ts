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
        audit_logs: logs.length,
      },
    };
  }
}

export const storage = new StorageService();
