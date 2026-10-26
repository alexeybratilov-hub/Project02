import * as XLSX from 'xlsx';
import {
  LegalEntity,
  ImportPreviewData,
  ImportRowResult,
  ContingentRecord,
  ContingentImportPreviewData,
  ContingentImportRowResult,
  Employee,
  EmployeeImportPreviewData,
  EmployeeImportRowResult,
  Department,
  Position,
  SoutCard,
  SoutHarmfulFactor,
  SoutHarmfulFactorType,
  SoutImportRowResult,
  SoutImportPreviewData,
  SOUT_FACTOR_LABELS_RU,
} from '../types';
import {
  validateInn,
  validateKpp,
  validateOgrn,
  checksumWarning,
  normalizeText,
  ciCompare,
  normalizeSnils,
  validateDateNotFuture,
} from './validation';
import { storage } from './storage';

export const LE_HEADERS = [
  'Полное наименование',
  'Сокращённое наименование',
  'ИНН',
  'КПП',
  'ОГРН',
  'Юридический адрес',
  'Фактический адрес',
  'Дополнительные сведения',
];

export const LE_ALIASES: Record<string, keyof LegalEntity> = {
  'полное наименование': 'full_name',
  'наименование': 'full_name',
  'название': 'full_name',
  'сокращённое наименование': 'short_name',
  'сокращенное наименование': 'short_name',
  'сокращённое': 'short_name',
  'сокращенное': 'short_name',
  'инн': 'inn',
  'кпп': 'kpp',
  'огрн': 'ogrn',
  'юридический адрес': 'legal_address',
  'адрес': 'legal_address',
  'фактический адрес': 'actual_address',
  'дополнительные сведения': 'extra_info',
  'доп сведения': 'extra_info',
  'примечание': 'extra_info',
};

export const FIELDS_RU: Record<keyof LegalEntity, string> = {
  id: 'Идентификатор',
  full_name: 'Полное наименование',
  short_name: 'Сокращённое наименование',
  inn: 'ИНН',
  kpp: 'КПП',
  ogrn: 'ОГРН',
  legal_address: 'Юридический адрес',
  actual_address: 'Фактический адрес',
  extra_info: 'Дополнительные сведения',
  status: 'Статус',
  created_at: 'Создано',
  updated_at: 'Изменено',
};

// Contingent headers according to IMPORT_EXPORT.md §4
export const CONTINGENT_HEADERS = [
  'Юридическое лицо',
  'Структурное подразделение',
  'Должность',
  'Рабочее место (уточнение)',
  'График работы',
  'Сменность',
  'Номер карты оценки профессиональных рисков',
  'Номер карты СОУТ',
  'Подкласс условий труда',
  'Пункты приказа № 29н',
  'Пункты приказа № 342н',
  'Программа инструктажа',
  'Программа стажировки',
  'Группа по электробезопасности',
];

export const CONTINGENT_ALIASES: Record<string, string> = {
  'юридическое лицо': 'legal_entity',
  'юрлицо': 'legal_entity',
  'организация': 'legal_entity',
  'структурное подразделение': 'department',
  'подразделение': 'department',
  'отдел': 'department',
  'цех': 'department',
  'должность': 'position',
  'профессия': 'position',
  'рабочее место (уточнение)': 'workplace_label',
  'рабочее место': 'workplace_label',
  'уточнение': 'workplace_label',
  'график работы': 'work_schedule',
  'график': 'work_schedule',
  'сменность': 'shift_pattern',
  'смена': 'shift_pattern',
  'номер карты оценки профессиональных рисков': 'risk_card_number',
  'номер карты опр': 'risk_card_number',
  'карта опр': 'risk_card_number',
  'опр': 'risk_card_number',
  'номер карты соут': 'sout_card_number',
  'карта соут': 'sout_card_number',
  'соут': 'sout_card_number',
  'подкласс условий труда': 'work_condition_subclass',
  'подкласс соут': 'work_condition_subclass',
  'класс соут': 'work_condition_subclass',
  'пункты приказа № 29н': 'items_29n',
  'пункты 29н': 'items_29n',
  'приказ 29н': 'items_29n',
  '29н': 'items_29n',
  'пункты приказа № 342н': 'items_342n',
  'пункты 342н': 'items_342n',
  'приказ 342н': 'items_342n',
  '342н': 'items_342n',
  'программа инструктажа': 'training_program',
  'инструктаж': 'training_program',
  'программа стажировки': 'internship_program',
  'стажировка': 'internship_program',
  'группа по электробезопасности': 'electrical_safety_group',
  'электробезопасность': 'electrical_safety_group',
  'эб': 'electrical_safety_group',
};

// Employee headers according to IMPORT_EXPORT.md §5
export const EMPLOYEE_HEADERS = [
  'Юридическое лицо',
  'Структурное подразделение',
  'Должность',
  'Фамилия',
  'Имя',
  'Отчество',
  'Дата приёма',
  'Дата рождения',
  'СНИЛС',
  'Запись контингента',
];

export const EMPLOYEE_ALIASES: Record<string, string> = {
  'юридическое лицо': 'legal_entity',
  'юрлицо': 'legal_entity',
  'организация': 'legal_entity',
  'структурное подразделение': 'department',
  'подразделение': 'department',
  'отдел': 'department',
  'цех': 'department',
  'должность': 'position',
  'профессия': 'position',
  'фамилия': 'last_name',
  'имя': 'first_name',
  'отчество': 'middle_name',
  'дата приёма': 'hire_date',
  'дата приема': 'hire_date',
  'дата трудоустройства': 'hire_date',
  'дата рождения': 'birth_date',
  'рождение': 'birth_date',
  'снилс': 'snils',
  'запись контингента': 'contingent_label',
  'контингент': 'contingent_label',
  'рабочее место': 'contingent_label',
};

// Formula injection protection (IMPORT_EXPORT §6)
export function sanitizeCell(val: any): any {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/^[=+\-@]/.test(s)) {
    return `'${s}`;
  }
  return s;
}

export function downloadTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([LE_HEADERS]);
  ws['!cols'] = LE_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 15) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Юридические лица');
  XLSX.writeFile(wb, 'template_legal_entities.xlsx');
}

export function downloadContingentTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([CONTINGENT_HEADERS]);
  ws['!cols'] = CONTINGENT_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Контингент');
  XLSX.writeFile(wb, 'template_contingent.xlsx');
}

export function downloadEmployeeTemplate(): void {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([EMPLOYEE_HEADERS]);
  ws['!cols'] = EMPLOYEE_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Работники');
  XLSX.writeFile(wb, 'template_employees.xlsx');
}

export function exportToXLSX(entities: LegalEntity[], filename = 'legal_entities.xlsx'): void {
  const rows: any[][] = [LE_HEADERS];
  for (const le of entities) {
    rows.push([
      sanitizeCell(le.full_name),
      sanitizeCell(le.short_name || ''),
      sanitizeCell(le.inn || ''),
      sanitizeCell(le.kpp || ''),
      sanitizeCell(le.ogrn || ''),
      sanitizeCell(le.legal_address || ''),
      sanitizeCell(le.actual_address || ''),
      sanitizeCell(le.extra_info || ''),
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = LE_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 15) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Юридические лица');
  XLSX.writeFile(wb, filename);
}

export function exportToCSV(entities: LegalEntity[], filename = 'legal_entities.csv'): void {
  const lines: string[] = [];
  lines.push(LE_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));

  for (const le of entities) {
    const row = [
      sanitizeCell(le.full_name),
      sanitizeCell(le.short_name || ''),
      sanitizeCell(le.inn || ''),
      sanitizeCell(le.kpp || ''),
      sanitizeCell(le.ogrn || ''),
      sanitizeCell(le.legal_address || ''),
      sanitizeCell(le.actual_address || ''),
      sanitizeCell(le.extra_info || ''),
    ];
    lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'));
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function exportContingentToXLSX(
  records: ContingentRecord[],
  filename = 'contingent.xlsx'
): void {
  const rows: any[][] = [CONTINGENT_HEADERS];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const wsList = storage.getWorkSchedules();
  const spList = storage.getShiftPatterns();
  const wcsList = storage.getWorkConditionSubclasses();
  const esgList = storage.getElectricalSafetyGroups();

  for (const c of records) {
    const le = les.find(l => l.id === c.legal_entity_id);
    const dept = depts.find(d => d.id === c.department_id);
    const pos = positions.find(p => p.id === c.position_id);
    const ws = wsList.find(w => w.id === c.work_schedule_id);
    const sp = spList.find(s => s.id === c.shift_pattern_id);
    const wcs = wcsList.find(w => w.id === c.work_condition_subclass_id);
    const esg = esgList.find(e => e.id === c.electrical_safety_group_id);

    rows.push([
      sanitizeCell(le?.full_name || ''),
      sanitizeCell(dept?.name || ''),
      sanitizeCell(pos?.name || ''),
      sanitizeCell(c.workplace_label || ''),
      sanitizeCell(ws?.name || ''),
      sanitizeCell(sp?.name || ''),
      sanitizeCell(c.risk_card_number || ''),
      sanitizeCell(c.sout_card_number || ''),
      sanitizeCell(wcs?.code || wcs?.name || ''),
      sanitizeCell((c.medical_items_29n || []).join('; ')),
      sanitizeCell((c.medical_items_342n || []).join('; ')),
      sanitizeCell(c.training_program || ''),
      sanitizeCell(c.internship_program || ''),
      sanitizeCell(esg?.name || ''),
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = CONTINGENT_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Контингент');
  XLSX.writeFile(wb, filename);
}

export function exportContingentToCSV(
  records: ContingentRecord[],
  filename = 'contingent.csv'
): void {
  const lines: string[] = [];
  lines.push(CONTINGENT_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));

  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const wsList = storage.getWorkSchedules();
  const spList = storage.getShiftPatterns();
  const wcsList = storage.getWorkConditionSubclasses();
  const esgList = storage.getElectricalSafetyGroups();

  for (const c of records) {
    const le = les.find(l => l.id === c.legal_entity_id);
    const dept = depts.find(d => d.id === c.department_id);
    const pos = positions.find(p => p.id === c.position_id);
    const ws = wsList.find(w => w.id === c.work_schedule_id);
    const sp = spList.find(s => s.id === c.shift_pattern_id);
    const wcs = wcsList.find(w => w.id === c.work_condition_subclass_id);
    const esg = esgList.find(e => e.id === c.electrical_safety_group_id);

    const row = [
      sanitizeCell(le?.full_name || ''),
      sanitizeCell(dept?.name || ''),
      sanitizeCell(pos?.name || ''),
      sanitizeCell(c.workplace_label || ''),
      sanitizeCell(ws?.name || ''),
      sanitizeCell(sp?.name || ''),
      sanitizeCell(c.risk_card_number || ''),
      sanitizeCell(c.sout_card_number || ''),
      sanitizeCell(wcs?.code || wcs?.name || ''),
      sanitizeCell((c.medical_items_29n || []).join('; ')),
      sanitizeCell((c.medical_items_342n || []).join('; ')),
      sanitizeCell(c.training_program || ''),
      sanitizeCell(c.internship_program || ''),
      sanitizeCell(esg?.name || ''),
    ];
    lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'));
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function formatDateForDisplay(d?: string | null): string {
  if (!d) return '';
  const parts = d.split('-');
  if (parts.length === 3) {
    return `${parts[2]}.${parts[1]}.${parts[0]}`;
  }
  return d;
}

export function exportEmployeesToXLSX(
  employees: Employee[],
  filename = 'employees.xlsx'
): void {
  const rows: any[][] = [EMPLOYEE_HEADERS];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const contingent = storage.getContingentRaw();

  for (const emp of employees) {
    const le = les.find(l => l.id === emp.legal_entity_id);
    const dept = depts.find(d => d.id === emp.department_id);
    const pos = positions.find(p => p.id === emp.position_id);
    let contingentLabel = '';
    if (emp.contingent_record_id) {
      const cr = contingent.find(c => c.id === emp.contingent_record_id);
      if (cr) {
        contingentLabel = cr.workplace_label || 'Основное рабочее место';
      }
    }

    rows.push([
      sanitizeCell(le?.full_name || ''),
      sanitizeCell(dept?.name || ''),
      sanitizeCell(pos?.name || ''),
      sanitizeCell(emp.last_name),
      sanitizeCell(emp.first_name),
      sanitizeCell(emp.middle_name || ''),
      sanitizeCell(formatDateForDisplay(emp.hire_date)),
      sanitizeCell(formatDateForDisplay(emp.birth_date)),
      sanitizeCell(emp.snils || ''),
      sanitizeCell(contingentLabel),
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = EMPLOYEE_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Работники');
  XLSX.writeFile(wb, filename);
}

export function exportEmployeesToCSV(
  employees: Employee[],
  filename = 'employees.csv'
): void {
  const lines: string[] = [];
  lines.push(EMPLOYEE_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));

  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const contingent = storage.getContingentRaw();

  for (const emp of employees) {
    const le = les.find(l => l.id === emp.legal_entity_id);
    const dept = depts.find(d => d.id === emp.department_id);
    const pos = positions.find(p => p.id === emp.position_id);
    let contingentLabel = '';
    if (emp.contingent_record_id) {
      const cr = contingent.find(c => c.id === emp.contingent_record_id);
      if (cr) {
        contingentLabel = cr.workplace_label || 'Основное рабочее место';
      }
    }

    const row = [
      sanitizeCell(le?.full_name || ''),
      sanitizeCell(dept?.name || ''),
      sanitizeCell(pos?.name || ''),
      sanitizeCell(emp.last_name),
      sanitizeCell(emp.first_name),
      sanitizeCell(emp.middle_name || ''),
      sanitizeCell(formatDateForDisplay(emp.hire_date)),
      sanitizeCell(formatDateForDisplay(emp.birth_date)),
      sanitizeCell(emp.snils || ''),
      sanitizeCell(contingentLabel),
    ];
    lines.push(row.map(val => `"${String(val).replace(/"/g, '""')}"`).join(';'));
  }

  const blob = new Blob(['\uFEFF' + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function normalizeHeader(h: any): string {
  if (!h) return '';
  return String(h).toLowerCase().trim().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function parseExcelFile(
  fileBuffer: ArrayBuffer
): { headers: string[]; rows: any[][]; structuralErrors: string[] } {
  const wb = XLSX.read(fileBuffer, { type: 'array' });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) {
    return { headers: [], rows: [], structuralErrors: ['Файл не содержит листов'] };
  }

  const ws = wb.Sheets[sheetName];
  const data: any[][] = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  if (data.length === 0) {
    return { headers: [], rows: [], structuralErrors: ['Файл пуст'] };
  }

  const headers = (data[0] || []).map(h => String(h || '').trim());
  const rows = data.slice(1).filter(r => r.some(cell => String(cell || '').trim() !== ''));

  return { headers, rows, structuralErrors: [] };
}

export function mapHeaders(
  headers: string[]
): { mapping: Record<number, keyof LegalEntity>; problems: string[] } {
  const mapping: Record<number, keyof LegalEntity> = {};
  const problems: string[] = [];
  const used = new Set<string>();

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const key = LE_ALIASES[norm];
    if (key) {
      if (used.has(key)) {
        problems.push(`Столбец «${h}» повторяется — лишние столбцы игнорируются.`);
      } else {
        used.add(key);
        mapping[idx] = key;
      }
    } else {
      problems.push(`Неизвестный столбец «${h}» — будет пропущен.`);
    }
  });

  if (!used.has('full_name')) {
    problems.unshift('Отсутствует обязательный столбец «Полное наименование».');
  }

  return { mapping, problems };
}

export function mapContingentHeaders(
  headers: string[]
): { mapping: Record<number, string>; problems: string[] } {
  const mapping: Record<number, string> = {};
  const problems: string[] = [];
  const used = new Set<string>();

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const key = CONTINGENT_ALIASES[norm];
    if (key) {
      if (used.has(key)) {
        problems.push(`Столбец «${h}» повторяется — лишние столбцы игнорируются.`);
      } else {
        used.add(key);
        mapping[idx] = key;
      }
    } else {
      problems.push(`Неизвестный столбец «${h}» — будет пропущен.`);
    }
  });

  if (!used.has('legal_entity')) {
    problems.unshift('Отсутствует обязательный столбец «Юридическое лицо».');
  }
  if (!used.has('department')) {
    problems.unshift('Отсутствует обязательный столбец «Структурное подразделение».');
  }
  if (!used.has('position')) {
    problems.unshift('Отсутствует обязательный столбец «Должность».');
  }

  return { mapping, problems };
}

export function mapEmployeeHeaders(
  headers: string[]
): { mapping: Record<number, string>; problems: string[] } {
  const mapping: Record<number, string> = {};
  const problems: string[] = [];
  const used = new Set<string>();

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const key = EMPLOYEE_ALIASES[norm];
    if (key) {
      if (used.has(key)) {
        problems.push(`Столбец «${h}» повторяется — лишние столбцы игнорируются.`);
      } else {
        used.add(key);
        mapping[idx] = key;
      }
    } else {
      problems.push(`Неизвестный столбец «${h}» — будет пропущен.`);
    }
  });

  if (!used.has('legal_entity')) {
    problems.unshift('Отсутствует обязательный столбец «Юридическое лицо».');
  }
  if (!used.has('department')) {
    problems.unshift('Отсутствует обязательный столбец «Структурное подразделение».');
  }
  if (!used.has('position')) {
    problems.unshift('Отсутствует обязательный столбец «Должность».');
  }
  if (!used.has('last_name')) {
    problems.unshift('Отсутствует обязательный столбец «Фамилия».');
  }
  if (!used.has('first_name')) {
    problems.unshift('Отсутствует обязательный столбец «Имя».');
  }

  return { mapping, problems };
}

export function generatePreview(
  rawRows: any[][],
  mapping: Record<number, keyof LegalEntity>,
  existingEntities: LegalEntity[],
  mode: 'add' | 'update'
): ImportPreviewData {
  const results: ImportRowResult[] = [];
  const seenKeys = new Set<string>();

  const activeEntities = existingEntities.filter(le => le.status === 'active');

  rawRows.forEach((row, i) => {
    const rowNum = i + 2;
    const rec: Partial<LegalEntity> = {};

    Object.entries(mapping).forEach(([colIdx, key]) => {
      const idx = parseInt(colIdx, 10);
      const val = row[idx];
      rec[key] = normalizeText(val) as any;
    });

    const name = rec.full_name || '(без наименования)';
    const res: ImportRowResult = {
      row: rowNum,
      action: 'add',
      name,
      errors: [],
      warnings: [],
      changes: [],
      data: rec,
    };

    if (!rec.full_name) {
      res.action = 'reject';
      res.errors.push('Обязательное поле «Полное наименование» не заполнено.');
      results.push(res);
      return;
    }

    try {
      if (rec.inn) validateInn(rec.inn);
    } catch (e: any) {
      res.errors.push(e.message);
    }
    try {
      if (rec.kpp) validateKpp(rec.kpp);
    } catch (e: any) {
      res.errors.push(e.message);
    }
    try {
      if (rec.ogrn) validateOgrn(rec.ogrn);
    } catch (e: any) {
      res.errors.push(e.message);
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    let existingMatch: LegalEntity | undefined;
    if (rec.inn && rec.kpp) {
      existingMatch = activeEntities.find(
        le => le.inn === rec.inn && le.kpp === rec.kpp
      );
    }
    if (!existingMatch && rec.ogrn) {
      existingMatch = activeEntities.find(le => le.ogrn === rec.ogrn);
    }

    if (existingMatch) {
      const changes: string[] = [];
      const keysToCheck: (keyof LegalEntity)[] = [
        'full_name',
        'short_name',
        'inn',
        'kpp',
        'ogrn',
        'legal_address',
        'actual_address',
        'extra_info',
      ];

      for (const k of keysToCheck) {
        const newVal = rec[k] || '';
        const oldVal = (existingMatch[k] as string) || '';
        if (newVal && String(newVal) !== String(oldVal)) {
          changes.push(`${FIELDS_RU[k]}: «${oldVal || '—'}» → «${newVal}»`);
        }
      }

      if (mode === 'update') {
        res.action = 'update';
        res.changes = changes;
      } else {
        res.action = 'skip';
        res.warnings.push('Совпадение по ИНН+КПП/ОГРН — запись будет пропущена.');
      }
    } else {
      const fileKey = `${rec.inn || ''}|${rec.kpp || ''}|${rec.ogrn || ''}`;
      if (fileKey !== '||' && seenKeys.has(fileKey)) {
        res.action = 'skip';
        res.warnings.push('Дубликат внутри файла — строка будет пропущена.');
      } else {
        if (fileKey !== '||') {
          seenKeys.add(fileKey);
        } else {
          res.warnings.push(
            'Нет ИНН/ОГРН для идентификации — запись будет добавлена; возможен дубликат по наименованию.'
          );
        }

        const chk = checksumWarning(rec.inn);
        if (chk) {
          res.warnings.push(chk);
        }

        const nameNorm = ciCompare(rec.full_name);
        const nameDup = activeEntities.find(le => ciCompare(le.full_name) === nameNorm);
        if (nameDup) {
          res.warnings.push('Такое полное наименование уже существует — возможен дубликат.');
        }
      }
    }

    results.push(res);
  });

  const summary = {
    total: results.length,
    add: results.filter(r => r.action === 'add').length,
    update: results.filter(r => r.action === 'update').length,
    skip: results.filter(r => r.action === 'skip').length,
    reject: results.filter(r => r.action === 'reject').length,
  };

  return {
    results,
    structure_errors: [],
    summary,
  };
}

export function generateContingentPreview(
  rawRows: any[][],
  mapping: Record<number, string>,
  existingContingent: ContingentRecord[],
  mode: 'add' | 'update'
): ContingentImportPreviewData {
  const results: ContingentImportRowResult[] = [];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const wsList = storage.getWorkSchedules();
  const spList = storage.getShiftPatterns();
  const wcsList = storage.getWorkConditionSubclasses();
  const esgList = storage.getElectricalSafetyGroups();

  rawRows.forEach((row, i) => {
    const rowNum = i + 2;
    const rec: Record<string, string> = {};

    Object.entries(mapping).forEach(([colIdx, key]) => {
      const idx = parseInt(colIdx, 10);
      rec[key] = String(row[idx] || '').trim();
    });

    const leQuery = rec.legal_entity || '';
    const deptQuery = rec.department || '';
    const posQuery = rec.position || '';
    const label = rec.workplace_label || '';

    const title = `${posQuery || '?'}, ${deptQuery || '?'}${label ? ' (' + label + ')' : ''}`;

    const res: ContingentImportRowResult = {
      row: rowNum,
      action: 'add',
      title,
      errors: [],
      warnings: [],
      changes: [],
      data: {
        legal_entity_name: leQuery,
        department_name: deptQuery,
        position_name: posQuery,
        workplace_label: label,
        work_schedule_name: rec.work_schedule,
        shift_pattern_name: rec.shift_pattern,
        risk_card_number: rec.risk_card_number,
        sout_card_number: rec.sout_card_number,
        work_condition_subclass_name: rec.work_condition_subclass,
        items_29n: rec.items_29n,
        items_342n: rec.items_342n,
        training_program: rec.training_program,
        internship_program: rec.internship_program,
        electrical_safety_group_name: rec.electrical_safety_group,
      },
    };

    if (!leQuery) {
      res.errors.push('Не указано юридическое лицо.');
    }
    if (!deptQuery) {
      res.errors.push('Не указано структурное подразделение.');
    }
    if (!posQuery) {
      res.errors.push('Не указана должность.');
    }

    // Match Legal Entity
    let targetLe: LegalEntity | undefined;
    if (leQuery) {
      targetLe = les.find(
        l =>
          l.status === 'active' &&
          (l.inn === leQuery ||
            ciCompare(l.full_name) === ciCompare(leQuery) ||
            ciCompare(l.short_name || '') === ciCompare(leQuery))
      );
      if (!targetLe) {
        res.errors.push(`Юридическое лицо «${leQuery}» не найдено в базе.`);
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    // Check Department & Position
    const targetDept = targetLe
      ? depts.find(
          d =>
            d.legal_entity_id === targetLe!.id &&
            ciCompare(d.name) === ciCompare(deptQuery) &&
            d.status === 'active'
        )
      : undefined;

    if (!targetDept) {
      res.warnings.push(`Подразделение «${deptQuery}» отсутствует — будет создано автоматически.`);
    }

    const posNorm = posQuery.toLowerCase().replace(/\s+/g, ' ').trim();
    const targetPos = positions.find(
      p => p.normalized_name === posNorm && p.status === 'active'
    );
    if (!targetPos) {
      res.warnings.push(`Должность «${posQuery}» отсутствует в справочнике — будет создана.`);
    }

    // Candidate match by D-004:
    // (legal_entity_id, department_id, position_id, workplace_label)
    if (targetLe && targetDept && targetPos) {
      const existingMatch = existingContingent.find(
        c =>
          c.status === 'active' &&
          c.legal_entity_id === targetLe!.id &&
          c.department_id === targetDept.id &&
          c.position_id === targetPos.id &&
          ciCompare(c.workplace_label || '') === ciCompare(label)
      );

      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push('Найдена запись по ключу (юрлицо, отдел, должность, раб. место). Будет обновлена.');
        } else {
          res.action = 'skip';
          res.warnings.push('Запись уже существует — строка будет пропущена.');
        }
      }
    }

    results.push(res);
  });

  const summary = {
    total: results.length,
    add: results.filter(r => r.action === 'add').length,
    update: results.filter(r => r.action === 'update').length,
    skip: results.filter(r => r.action === 'skip').length,
    reject: results.filter(r => r.action === 'reject').length,
  };

  return {
    results,
    structure_errors: [],
    summary,
  };
}

export function parseExcelDate(val: any): string | null {
  if (val === null || val === undefined || val === '') return null;
  if (typeof val === 'number') {
    const date = XLSX.SSF.parse_date_code(val);
    if (date) {
      const y = String(date.y).padStart(4, '0');
      const m = String(date.m).padStart(2, '0');
      const d = String(date.d).padStart(2, '0');
      return `${y}-${m}-${d}`;
    }
  }
  const s = String(val).trim();
  if (!s) return null;
  const ruMatch = /^(\d{1,2})\.(\d{1,2})\.(\d{4})$/.exec(s);
  if (ruMatch) {
    const d = ruMatch[1].padStart(2, '0');
    const m = ruMatch[2].padStart(2, '0');
    const y = ruMatch[3];
    return `${y}-${m}-${d}`;
  }
  const isoMatch = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (isoMatch) {
    const y = isoMatch[1];
    const m = isoMatch[2].padStart(2, '0');
    const d = isoMatch[3].padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
  return s;
}

export function generateEmployeePreview(
  rawRows: any[][],
  mapping: Record<number, string>,
  existingEmployees: Employee[],
  mode: 'add' | 'update'
): EmployeeImportPreviewData {
  const results: EmployeeImportRowResult[] = [];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const contingent = storage.getContingentRaw();

  rawRows.forEach((row, i) => {
    const rowNum = i + 2;
    const rec: Record<string, any> = {};

    Object.entries(mapping).forEach(([colIdx, key]) => {
      const idx = parseInt(colIdx, 10);
      rec[key] = row[idx];
    });

    const leQuery = String(rec.legal_entity || '').trim();
    const deptQuery = String(rec.department || '').trim();
    const posQuery = String(rec.position || '').trim();
    const lastName = String(rec.last_name || '').trim();
    const firstName = String(rec.first_name || '').trim();
    const middleName = String(rec.middle_name || '').trim();
    const contingentLabel = String(rec.contingent_label || '').trim();
    const rawHireDate = rec.hire_date;
    const rawBirthDate = rec.birth_date;
    const rawSnils = rec.snils;

    const title = `${lastName} ${firstName}${middleName ? ' ' + middleName : ''} (${posQuery || '?'})`;

    const res: EmployeeImportRowResult = {
      row: rowNum,
      action: 'add',
      title,
      errors: [],
      warnings: [],
      changes: [],
      data: {
        legal_entity_name: leQuery,
        department_name: deptQuery,
        position_name: posQuery,
        last_name: lastName,
        first_name: firstName,
        middle_name: middleName || undefined,
        contingent_label: contingentLabel || undefined,
      },
    };

    if (!leQuery) res.errors.push('Не указано юридическое лицо.');
    if (!deptQuery) res.errors.push('Не указано структурное подразделение.');
    if (!posQuery) res.errors.push('Не указана должность.');
    if (!lastName) res.errors.push('Не указана фамилия.');
    if (!firstName) res.errors.push('Не указано имя.');

    // Dates parsing & validation
    let parsedHireDate: string | null = null;
    if (rawHireDate !== null && rawHireDate !== undefined && String(rawHireDate).trim() !== '') {
      parsedHireDate = parseExcelDate(rawHireDate);
      if (parsedHireDate) {
        try {
          validateDateNotFuture(parsedHireDate, 'Дата приёма');
          res.data.hire_date = parsedHireDate;
        } catch (e: any) {
          res.errors.push(e.message);
        }
      }
    }

    let parsedBirthDate: string | null = null;
    if (rawBirthDate !== null && rawBirthDate !== undefined && String(rawBirthDate).trim() !== '') {
      parsedBirthDate = parseExcelDate(rawBirthDate);
      if (parsedBirthDate) {
        try {
          validateDateNotFuture(parsedBirthDate, 'Дата рождения');
          res.data.birth_date = parsedBirthDate;
        } catch (e: any) {
          res.errors.push(e.message);
        }
      }
    }

    // SNILS validation & normalization
    let normalizedSnils: string | null = null;
    if (rawSnils !== null && rawSnils !== undefined && String(rawSnils).trim() !== '') {
      try {
        normalizedSnils = normalizeSnils(String(rawSnils));
        res.data.snils = normalizedSnils || undefined;
      } catch (e: any) {
        res.warnings.push(`СНИЛС «${rawSnils}»: ${e.message}`);
        const digits = String(rawSnils).replace(/\D/g, '');
        if (digits.length === 11) {
          res.data.snils = `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)} ${digits[9]}${digits[10]}`;
        }
      }
    } else {
      res.warnings.push('СНИЛС не указан. Запись будет добавлена без идентификации (объединение по ФИО запрещено).');
    }

    // Match Legal Entity
    let targetLe: LegalEntity | undefined;
    if (leQuery) {
      targetLe = les.find(
        l =>
          l.status === 'active' &&
          (l.inn === leQuery ||
            ciCompare(l.full_name) === ciCompare(leQuery) ||
            ciCompare(l.short_name || '') === ciCompare(leQuery))
      );
      if (!targetLe) {
        res.errors.push(`Юридическое лицо «${leQuery}» не найдено в базе.`);
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    // Department & Position warnings
    if (targetLe) {
      const targetDept = depts.find(
        d =>
          d.legal_entity_id === targetLe!.id &&
          ciCompare(d.name) === ciCompare(deptQuery) &&
          d.status === 'active'
      );
      if (!targetDept) {
        res.warnings.push(`Подразделение «${deptQuery}» отсутствует — будет создано автоматически.`);
      }

      const posNorm = posQuery.toLowerCase().replace(/\s+/g, ' ').trim();
      const targetPos = positions.find(
        p => p.normalized_name === posNorm && p.status === 'active'
      );
      if (!targetPos) {
        res.warnings.push(`Должность «${posQuery}» отсутствует в справочнике — будет создана.`);
      }

      if (contingentLabel) {
        const cr = contingent.find(
          c =>
            c.legal_entity_id === targetLe!.id &&
            c.status === 'active' &&
            ciCompare(c.workplace_label || '') === ciCompare(contingentLabel)
        );
        if (!cr) {
          res.warnings.push(`Запись контингента «${contingentLabel}» не найдена для этого юридического лица.`);
        }
      }

      // Identification according to IMPORT_EXPORT §5:
      // "Идентификация: СНИЛС + юридическое лицо. Без СНИЛС — только добавление с предупреждением по ФИО и дате рождения. Объединение только по ФИО запрещено."
      const snilsForMatch = res.data.snils ? ciCompare(res.data.snils) : '';
      let matchBySnils: Employee | undefined;
      if (snilsForMatch) {
        matchBySnils = existingEmployees.find(
          e =>
            e.status === 'active' &&
            e.legal_entity_id === targetLe!.id &&
            ciCompare(e.snils || '') === snilsForMatch
        );
      }

      if (matchBySnils) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(
            `Найден работник по СНИЛС (${matchBySnils.last_name} ${matchBySnils.first_name}). Данные будут обновлены.`
          );
        } else {
          res.action = 'skip';
          res.warnings.push(
            `Работник с таким СНИЛС уже существует (${matchBySnils.last_name} ${matchBySnils.first_name}) — строка будет пропущена.`
          );
        }
      } else {
        res.action = 'add';
        const fioMatch = existingEmployees.find(
          e =>
            e.status === 'active' &&
            e.legal_entity_id === targetLe!.id &&
            ciCompare(e.last_name) === ciCompare(lastName) &&
            ciCompare(e.first_name) === ciCompare(firstName)
        );
        if (fioMatch) {
          if (parsedBirthDate && fioMatch.birth_date === parsedBirthDate) {
            res.warnings.push(
              `Совпадение ФИО и даты рождения: ${fioMatch.last_name} ${fioMatch.first_name}. Будет создана отдельная запись (объединение по ФИО запрещено).`
            );
          } else {
            res.warnings.push(
              `Похожее ФИО уже есть в организации: ${fioMatch.last_name} ${fioMatch.first_name}. Будет создана отдельная запись.`
            );
          }
        }
      }
    }

    results.push(res);
  });

  const summary = {
    total: results.length,
    add: results.filter(r => r.action === 'add').length,
    update: results.filter(r => r.action === 'update').length,
    skip: results.filter(r => r.action === 'skip').length,
    reject: results.filter(r => r.action === 'reject').length,
  };

  return {
    results,
    structure_errors: [],
    summary,
  };
}
