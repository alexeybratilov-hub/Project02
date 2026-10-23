import {
  LegalEntity,
  Department,
  Position,
  ContingentRecord,
  Employee,
  AuditLogItem,
  ModuleItem,
  EntityStatus,
  WorkSchedule,
  ShiftPattern,
  WorkConditionSubclass,
  ElectricalSafetyGroup,
} from '../types';
import {
  normalizeText,
  validateInn,
  validateKpp,
  validateOgrn,
  findDuplicates,
  ciCompare,
} from './validation';

const STORAGE_KEYS = {
  LEGAL_ENTITIES: 'saot_legal_entities',
  DEPARTMENTS: 'saot_departments',
  POSITIONS: 'saot_positions',
  CONTINGENT: 'saot_contingent',
  EMPLOYEES: 'saot_employees',
  AUDIT_LOG: 'saot_audit_log',
  MODULES: 'saot_modules',
  CURRENT_LE: 'saot_current_le',
  WORK_SCHEDULES: 'saot_work_schedules',
  SHIFT_PATTERNS: 'saot_shift_patterns',
  WORK_CONDITION_SUBCLASSES: 'saot_work_condition_subclasses',
  ELECTRICAL_SAFETY_GROUPS: 'saot_electrical_safety_groups',
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

  // --- Bulk Import Transaction for Legal Entities ---
  public commitImport(records: Partial<LegalEntity>[], mode: 'add' | 'update'): {
    added: number;
    updated: number;
    skipped: number;
    rejected: number;
  } {
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
    return loadFromStorage<ModuleItem[]>(STORAGE_KEYS.MODULES, DEFAULT_MODULES);
  }

  public toggleModule(moduleId: string): void {
    const modules = this.getModules();
    const item = modules.find(m => m.module_id === moduleId);
    if (item) {
      item.enabled = !item.enabled;
      saveToStorage(STORAGE_KEYS.MODULES, modules);
    }
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
        audit_logs: this.getAuditLogs().length,
      },
      data: {
        legal_entities: this.getLegalEntitiesRaw(),
        departments: this.getDepartmentsRaw(),
        positions: this.getPositionsRaw(),
        contingent: this.getContingentRaw(),
        employees: this.getEmployeesRaw(),
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

  public restoreFromBackup(backupJson: string): void {
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
    if (Array.isArray(parsed.data.audit_logs)) {
      saveToStorage(STORAGE_KEYS.AUDIT_LOG, parsed.data.audit_logs);
    }

    this.addAudit(
      'database',
      'local',
      'restore',
      null,
      { backup_id: parsed.id, created_at: parsed.created_at },
      'Восстановление из резервной копии'
    );
  }
}

export const storage = new StorageService();
