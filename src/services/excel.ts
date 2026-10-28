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
  OprCard,
  OprHazard,
  OprMeasureItem,
  OprImportRowResult,
  OprImportPreviewData,
  RiskLevel,
  RISK_LEVEL_LABELS_RU,
  MedicalExaminationCard,
  MedicalExamType,
  MedicalConclusion,
  MedicalImportRowResult,
  MedicalImportPreviewData,
  MEDICAL_EXAM_TYPE_LABELS_RU,
  MEDICAL_CONCLUSION_LABELS_RU,
  PpeNormItem,
  PpeCard,
  PpeIssuanceRecord,
  PpeCategory,
  PPE_CATEGORY_LABELS_RU,
  PpeImportRowResult,
  PpeImportPreviewData,
  TrainingProgram,
  TrainingProtocolItem,
  TrainingProgramCategory,
  TRAINING_PROGRAM_CATEGORY_LABELS_RU,
  TrainingImportRowResult,
  TrainingImportPreviewData,
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

// ==============================
// СОУТ (Этап 6, 426-ФЗ): заголовки, алиасы, шаблон, импорт/экспорт
// ==============================

// 18 колонок согласно IMPORT_EXPORT.md и промпту Этапа 6
export const SOUT_HEADERS = [
  'Юридическое лицо',
  'Структурное подразделение',
  'Должность',
  'Номер карты СОУТ',
  'Рабочее место (уточнение)',
  'Аналогичное рабочее место',
  'Основание аналогичности',
  'Вредные факторы',
  'Класс условий труда',
  'Занятых работников',
  'Из них женщин',
  'Из них несовершеннолетних',
  'Из них инвалидов',
  'Организация, проводившая измерения',
  'Номер протокола измерений',
  'Дата утверждения отчёта',
  'Декларация соответствия',
  'Номер декларации',
];

export const SOUT_ALIASES: Record<string, string> = {
  'юридическое лицо': 'legal_entity',
  'юрлицо': 'legal_entity',
  'организация': 'legal_entity',
  'структурное подразделение': 'department',
  'подразделение': 'department',
  'отдел': 'department',
  'цех': 'department',
  'должность': 'position',
  'профессия': 'position',
  'номер карты соут': 'card_number',
  'карта соут': 'card_number',
  '№ карты соут': 'card_number',
  'рабочее место (уточнение)': 'workplace_label',
  'рабочее место': 'workplace_label',
  'уточнение рабочего места': 'workplace_label',
  'аналогичное рабочее место': 'is_analogous',
  'аналогично': 'is_analogous',
  'основание аналогичности': 'analogous_basis',
  'вредные факторы': 'factors',
  'факторы': 'factors',
  'класс условий труда': 'final_class',
  'класс соут': 'final_class',
  'итоговый класс': 'final_class',
  'занятых работников': 'employees_count',
  'численность занятых': 'employees_count',
  'из них женщин': 'women_count',
  'женщин': 'women_count',
  'из них несовершеннолетних': 'minors_count',
  'несовершеннолетних': 'minors_count',
  'из них инвалидов': 'disabled_count',
  'инвалидов': 'disabled_count',
  'организация, проводившая измерения': 'measurement_org',
  'лаборатория': 'measurement_org',
  'номер протокола измерений': 'protocol_number',
  'протокол': 'protocol_number',
  'дата утверждения отчёта': 'report_approved_at',
  'утверждение отчёта': 'report_approved_at',
  'декларация соответствия': 'declaration_active',
  'декларация': 'declaration_active',
  'номер декларации': 'declaration_number',
};

const SOUT_FACTOR_ALIAS_TO_TYPE: Record<string, SoutHarmfulFactorType> = (() => {
  const map: Record<string, SoutHarmfulFactorType> = {};
  (Object.keys(SOUT_FACTOR_LABELS_RU) as SoutHarmfulFactorType[]).forEach(t => {
    map[normalizeHeaderLocal(SOUT_FACTOR_LABELS_RU[t])] = t;
  });
  // дополнительные синонимы
  map['вибрация'] = 'vibration_general';
  map['химия'] = 'chemical';
  map['тяжесть'] = 'gravity';
  map['напряженность'] = 'stress';
  map['напряжённость'] = 'stress';
  return map;
})();

function normalizeHeaderLocal(h: string): string {
  return String(h || '').toLowerCase().trim().replace(/ё/g, 'е').replace(/\s+/g, ' ');
}

export function downloadSoutTemplate(): void {
  const exampleRow = [
    'ООО Ромашка',
    'Производственный цех',
    'Станочник',
    'СОУТ-001',
    'Станок №3',
    'нет',
    '',
    'Шум:3.2; Вибрация локальная:3.1',
    '3.2',
    '5',
    '1',
    '0',
    '0',
    'АО «Профлаборатория»',
    'Пр-123/2024',
    '01.03.2024',
    'нет',
    '',
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([SOUT_HEADERS, exampleRow]);
  ws['!cols'] = SOUT_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Карты СОУТ');
  XLSX.writeFile(wb, 'template_sout.xlsx');
}

export function mapSoutHeaders(
  headers: string[]
): { mapping: Record<number, string>; problems: string[] } {
  const mapping: Record<number, string> = {};
  const problems: string[] = [];
  const used = new Set<string>();

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h);
    if (!norm) return;
    const key = SOUT_ALIASES[norm];
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

  const required: Array<[string, string]> = [
    ['legal_entity', 'Юридическое лицо'],
    ['department', 'Структурное подразделение'],
    ['position', 'Должность'],
    ['card_number', 'Номер карты СОУТ'],
    ['final_class', 'Класс условий труда'],
  ];
  for (const [key, label] of required) {
    if (!used.has(key)) {
      problems.unshift(`Отсутствует обязательный столбец «${label}».`);
    }
  }

  return { mapping, problems };
}

// Разбор строки факторов вида "Шум:3.2; Химический фактор:3.1" или "Шум, вибрация"
export function parseSoutFactors(raw: string | undefined): { factors: SoutHarmfulFactor[]; errors: string[] } {
  const factors: SoutHarmfulFactor[] = [];
  const errors: string[] = [];
  const s = String(raw || '').trim();
  if (!s) return { factors, errors };

  const parts = s.split(/[;,\n]+/).map(p => p.trim()).filter(Boolean);
  for (const part of parts) {
    const m = /^(.+?)\s*[:\-–]\s*(\d(?:\.\d)?|оптимальны\w*|допустим\w*)$/i.exec(part);
    let factorText = part;
    let classText = '';
    if (m) {
      factorText = m[1].trim();
      classText = m[2].trim();
    }
    const typeKey = normalizeHeaderLocal(factorText);
    const type = SOUT_FACTOR_ALIAS_TO_TYPE[typeKey];
    if (!type) {
      errors.push(`Неизвестный вредный фактор «${factorText}» (строка факторов: «${part}»).`);
      continue;
    }
    let cls = classText.replace(',', '.');
    if (!cls || /^(оптимальн|допустим)/i.test(cls)) {
      cls = /^оптимальн/i.test(cls) ? '1' : '2';
    }
    if (!StorageServiceValidClasses.includes(cls)) {
      errors.push(`Недопустимый класс «${classText}» для фактора «${factorText}». Допустимы: ${StorageServiceValidClasses.join(', ')}.`);
      continue;
    }
    factors.push({ type, class: cls, note: null });
  }
  return { factors, errors };
}

const StorageServiceValidClasses = ['1', '2', '3.1', '3.2', '3.3', '3.4', '4'];

function parseYesNo(val: any): boolean {
  const s = normalizeHeaderLocal(String(val ?? ''));
  return ['да', 'yes', '1', 'true', 'истина', '+'].includes(s);
}

export function generateSoutPreview(
  rawRows: any[][],
  mapping: Record<number, string>,
  existingCards: SoutCard[],
  mode: 'add' | 'update'
): SoutImportPreviewData {
  const results: SoutImportRowResult[] = [];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();

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
    const cardNumber = String(rec.card_number || '').trim();
    const classRaw = String(rec.final_class || '').trim().replace(',', '.');
    const label = String(rec.workplace_label || '').trim();

    const title = cardNumber ? `Карта № ${cardNumber}` : '(без номера)';

    const res: SoutImportRowResult = {
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
        card_number: cardNumber,
        workplace_label: label,
        final_class: classRaw,
        factors_raw: String(rec.factors || '').trim(),
      },
    };

    if (!leQuery) res.errors.push('Не указано юридическое лицо.');
    if (!deptQuery) res.errors.push('Не указано структурное подразделение.');
    if (!posQuery) res.errors.push('Не указана должность.');
    if (!cardNumber) res.errors.push('Не указан номер карты СОУТ.');
    if (!classRaw) {
      res.errors.push('Не указан класс условий труда.');
    } else if (!StorageServiceValidClasses.includes(classRaw)) {
      res.errors.push(`Недопустимый класс условий труда «${classRaw}». Допустимы: ${StorageServiceValidClasses.join(', ')}.`);
    }

    // Факторы
    const parsedFactors = parseSoutFactors(rec.factors_raw !== undefined ? String(rec.factors_raw) : String(rec.factors || ''));
    if (parsedFactors.errors.length > 0) {
      parsedFactors.errors.forEach(e => res.errors.push(e));
    }
    if (parsedFactors.factors.length > 0) {
      res.data.factors = JSON.stringify(parsedFactors.factors);
    }

    // Числовые поля
    const numFields: Array<[string, string]> = [
      ['employees_count', 'Занятых работников'],
      ['women_count', 'Из них женщин'],
      ['minors_count', 'Из них несовершеннолетних'],
      ['disabled_count', 'Из них инвалидов'],
    ];
    for (const [key, labelRu] of numFields) {
      const rawVal = rec[key];
      if (rawVal === undefined || rawVal === null || String(rawVal).trim() === '') {
        res.data[key] = '0';
        continue;
      }
      const n = Number(String(rawVal).trim());
      if (!Number.isFinite(n) || n < 0 || !Number.isInteger(n)) {
        res.errors.push(`Поле «${labelRu}»: ожидалось целое неотрицательное число, получено «${rawVal}».`);
      } else {
        res.data[key] = String(n);
      }
    }

    // Дата утверждения отчёта
    if (rec.report_approved_at !== undefined && String(rec.report_approved_at).trim() !== '') {
      const parsedDate = parseExcelDate(rec.report_approved_at);
      if (parsedDate) {
        try {
          validateDateNotFuture(parsedDate, 'Дата утверждения отчёта');
          res.data.report_approved_at = parsedDate;
        } catch (e: any) {
          res.errors.push(e.message);
        }
      }
    }

    res.data.is_analogous = parseYesNo(rec.is_analogous) ? '1' : '0';
    res.data.analogous_basis = String(rec.analogous_basis || '').trim();
    res.data.measurement_org = String(rec.measurement_org || '').trim();
    res.data.protocol_number = String(rec.protocol_number || '').trim();
    res.data.declaration_active = parseYesNo(rec.declaration_active) ? '1' : '0';
    res.data.declaration_number = String(rec.declaration_number || '').trim();

    // Совпадение с базой: юрлицо по ИНН/наименованию
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

    // Предупреждения о словаре
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
      const targetPos = positions.find(p => p.normalized_name === posNorm && p.status === 'active');
      if (!targetPos) {
        res.warnings.push(`Должность «${posQuery}» отсутствует в справочнике — будет создана.`);
      }
    }

    // Ключ обновления: номер карты + юридическое лицо
    if (targetLe && cardNumber) {
      const existingMatch = existingCards.find(
        c =>
          c.status === 'active' &&
          c.legal_entity_id === targetLe!.id &&
          ciCompare(c.card_number) === ciCompare(cardNumber)
      );
      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(
            `Найдена карта № ${existingMatch.card_number} (${existingMatch.final_class} кл.) по ключу «номер карты + организация». Данные будут обновлены.`
          );
        } else {
          res.action = 'skip';
          res.warnings.push('Карта с таким номером уже существует в организации — строка будет пропущена.');
        }
      } else {
        res.action = 'add';
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

export function exportSoutToXLSX(cards: SoutCard[], filename = 'sout_cards.xlsx'): void {
  const rows: any[][] = [SOUT_HEADERS];
  for (const c of cards) {
    rows.push(soutCardToRow(c));
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = SOUT_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Карты СОУТ');
  XLSX.writeFile(wb, filename);
}

export function exportSoutToCSV(cards: SoutCard[], filename = 'sout_cards.csv'): void {
  const lines: string[] = [];
  lines.push(SOUT_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const c of cards) {
    const row = soutCardToRow(c);
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

function soutCardToRow(c: SoutCard): string[] {
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const le = les.find(l => l.id === c.legal_entity_id);
  const dept = depts.find(d => d.id === c.department_id);
  const pos = positions.find(p => p.id === c.position_id);
  const factorsStr = (c.factors || [])
    .map(f => `${SOUT_FACTOR_LABELS_RU[f.type] || f.type}:${f.class}`)
    .join('; ');
  return [
    sanitizeCell(le?.full_name || ''),
    sanitizeCell(dept?.name || ''),
    sanitizeCell(pos?.name || ''),
    sanitizeCell(c.card_number),
    sanitizeCell(c.workplace_label || ''),
    sanitizeCell(c.is_analogous ? 'да' : 'нет'),
    sanitizeCell(c.analogous_basis || ''),
    sanitizeCell(factorsStr),
    sanitizeCell(c.final_class),
    sanitizeCell(c.employees_count),
    sanitizeCell(c.women_count),
    sanitizeCell(c.minors_count),
    sanitizeCell(c.disabled_count),
    sanitizeCell(c.measurement_org || ''),
    sanitizeCell(c.protocol_number || ''),
    sanitizeCell(formatDateForDisplay(c.report_approved_at)),
    sanitizeCell(c.declaration_active ? 'да' : 'нет'),
    sanitizeCell(c.declaration_number || ''),
  ];
}

// ===============================================
// Модуль «ОПР» (Этап 7, Приказ 776н)
// ===============================================

export const OPR_HEADERS = [
  'Юридическое лицо',
  'Подразделение',
  'Должность',
  'Номер карты ОПР',
  'Рабочее место (уточнение)',
  'Дата оценки',
  'Методика оценки',
  'Состав комиссии',
  'Идентифицированные опасности',
  'Максимальный балл риска',
  'Итоговый уровень риска',
];

export const OPR_ALIASES: Record<string, string> = {
  'юридическое лицо': 'legal_entity',
  'юрлицо': 'legal_entity',
  'организация': 'legal_entity',
  'подразделение': 'department',
  'отдел': 'department',
  'структурное подразделение': 'department',
  'должность': 'position',
  'профессия': 'position',
  'номер карты опр': 'card_number',
  'номер карты': 'card_number',
  '№ карты опр': 'card_number',
  '№ карты': 'card_number',
  'карта опр': 'card_number',
  'рабочее место (уточнение)': 'workplace_label',
  'рабочее место': 'workplace_label',
  'дата оценки': 'assessment_date',
  'дата': 'assessment_date',
  'методика оценки': 'assessment_method',
  'методика': 'assessment_method',
  'состав комиссии': 'commission_members',
  'комиссия': 'commission_members',
  'идентифицированные опасности': 'hazards',
  'опасности': 'hazards',
  'максимальный балл риска': 'overall_risk_score',
  'балл риска': 'overall_risk_score',
  'итоговый уровень риска': 'overall_risk_level',
  'уровень риска': 'overall_risk_level',
};

export function mapOprHeaders(rawHeaders: string[]): {
  mapping: Record<number, string>;
  problems: string[];
} {
  const mapping: Record<number, string> = {};
  const problems: string[] = [];
  const foundFields = new Set<string>();

  rawHeaders.forEach((raw, idx) => {
    const clean = String(raw || '').trim().toLowerCase();
    if (OPR_ALIASES[clean]) {
      const field = OPR_ALIASES[clean];
      mapping[idx] = field;
      foundFields.add(field);
    }
  });

  const required = ['legal_entity', 'department', 'position', 'card_number'];
  for (const req of required) {
    if (!foundFields.has(req)) {
      problems.push(`Отсутствует обязательная колонка для сопоставления: «${req}»`);
    }
  }

  return { mapping, problems };
}

function oprCardToRow(c: OprCard): string[] {
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();
  const le = les.find(l => l.id === c.legal_entity_id);
  const dept = depts.find(d => d.id === c.department_id);
  const pos = positions.find(p => p.id === c.position_id);
  const hazardsStr = (c.hazards || [])
    .map(h => `${h.category} - ${h.name} [Т:${h.severity}, В:${h.probability}, балл:${h.risk_score}]`)
    .join('; ');

  return [
    sanitizeCell(le?.full_name || ''),
    sanitizeCell(dept?.name || ''),
    sanitizeCell(pos?.name || ''),
    sanitizeCell(c.card_number),
    sanitizeCell(c.workplace_label || ''),
    sanitizeCell(formatDateForDisplay(c.assessment_date)),
    sanitizeCell(c.assessment_method || ''),
    sanitizeCell(c.commission_members || ''),
    sanitizeCell(hazardsStr),
    sanitizeCell(c.overall_risk_score),
    sanitizeCell(RISK_LEVEL_LABELS_RU[c.overall_risk_level]?.name || c.overall_risk_level),
  ];
}

export function exportOprToXLSX(cards: OprCard[], filename = 'opr_cards.xlsx'): void {
  const rows: any[][] = [OPR_HEADERS];
  for (const c of cards) {
    rows.push(oprCardToRow(c));
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = OPR_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Карты ОПР');
  XLSX.writeFile(wb, filename);
}

export function exportOprToCSV(cards: OprCard[], filename = 'opr_cards.csv'): void {
  const lines: string[] = [];
  lines.push(OPR_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const c of cards) {
    const row = oprCardToRow(c);
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

export function exportOprPlanToXLSX(measures: OprMeasureItem[], filename = 'opr_plan_measures.xlsx'): void {
  const headers = [
    'Карта ОПР',
    'Организация',
    'Подразделение / Должность',
    'Мероприятие по снижению риска',
    'Срок реализации',
    'Ответственный',
    'Статус выполнения',
    'Ориентировочные затраты',
    'Комментарий',
  ];
  const oprCards = storage.getOprCardsRaw();
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();

  const rows: any[][] = [headers];
  for (const m of measures) {
    const card = oprCards.find(c => c.id === m.opr_card_id);
    const le = card ? les.find(l => l.id === card.legal_entity_id) : undefined;
    const dept = card ? depts.find(d => d.id === card.department_id) : undefined;
    const pos = card ? positions.find(p => p.id === card.position_id) : undefined;
    const statusLabel = m.status === 'completed' ? 'Выполнено' : m.status === 'in_progress' ? 'В работе' : 'Запланировано';

    rows.push([
      sanitizeCell(card?.card_number || ''),
      sanitizeCell(le?.full_name || ''),
      sanitizeCell(`${dept?.name || ''} / ${pos?.name || ''}`),
      sanitizeCell(m.measure_title),
      sanitizeCell(formatDateForDisplay(m.deadline)),
      sanitizeCell(m.responsible_person || ''),
      sanitizeCell(statusLabel),
      sanitizeCell(m.cost_estimate || ''),
      sanitizeCell(m.comment || ''),
    ]);
  }

  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = headers.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'План мероприятий ОПР');
  XLSX.writeFile(wb, filename);
}

export function downloadOprTemplate(): void {
  const exampleRow = [
    'ООО Ромашка',
    'Производственный цех',
    'Станочник',
    'ОПР-001',
    'Станок №3',
    '01.03.2024',
    'Матричный метод (5x5)',
    'Иванов И.И., Петров П.П.',
    'Механическая - Движущиеся детали оборудования [Т:3, В:3, балл:9]',
    '9',
    'Умеренный (допустимый)',
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([OPR_HEADERS, exampleRow]);
  ws['!cols'] = OPR_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Карты ОПР');
  XLSX.writeFile(wb, 'template_opr.xlsx');
}

export function parseOprHazards(raw: string | undefined): OprHazard[] {
  if (!raw) return [];
  const s = String(raw).trim();
  if (!s) return [];
  const parts = s.split(/[;\n]+/).map(p => p.trim()).filter(Boolean);
  const result: OprHazard[] = [];
  for (const part of parts) {
    const m = /^(?:([^–\-]+?)\s*[-–]\s*)?([^\[:]+?)(?:\s*\[\s*Т\s*:\s*(\d+)\s*,\s*В\s*:\s*(\d+)(?:\s*,\s*балл\s*:\s*\d+)?\s*\]|\s*:\s*(\d+)\s*,\s*(\d+))?$/i.exec(part);
    if (m) {
      const category = (m[1] || 'Прочая').trim();
      const name = m[2].trim();
      let sev = parseInt(m[3] || m[5] || '2', 10);
      let prob = parseInt(m[4] || m[6] || '2', 10);
      if (isNaN(sev) || sev < 1 || sev > 5) sev = 2;
      if (isNaN(prob) || prob < 1 || prob > 5) prob = 2;
      const score = sev * prob;
      const level: RiskLevel = score <= 4 ? 'low' : score <= 9 ? 'moderate' : score <= 15 ? 'high' : 'unacceptable';
      result.push({
        id: `hz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        category,
        name,
        severity: sev,
        probability: prob,
        risk_score: score,
        risk_level: level,
      });
    } else {
      const score = 4;
      result.push({
        id: `hz_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
        category: 'Прочая',
        name: part,
        severity: 2,
        probability: 2,
        risk_score: score,
        risk_level: 'low',
      });
    }
  }
  return result;
}

export function generateOprPreview(
  rawRows: any[][],
  mapping: Record<number, string>,
  existingCards: OprCard[],
  mode: 'add' | 'update'
): OprImportPreviewData {
  const results: OprImportRowResult[] = [];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const depts = storage.getDepartmentsRaw();
  const positions = storage.getPositionsRaw();

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
    const cardNumber = String(rec.card_number || '').trim();
    const label = String(rec.workplace_label || '').trim();
    const method = String(rec.assessment_method || '').trim() || 'Матричный метод (5x5)';
    const commission = String(rec.commission_members || '').trim();

    const title = cardNumber ? `Карта ОПР № ${cardNumber}` : '(без номера)';

    const res: OprImportRowResult = {
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
        card_number: cardNumber,
        workplace_label: label,
        assessment_method: method,
        commission_members: commission,
        hazards_raw: String(rec.hazards || '').trim(),
      },
    };

    if (!leQuery) res.errors.push('Не указано юридическое лицо.');
    if (!deptQuery) res.errors.push('Не указано структурное подразделение.');
    if (!posQuery) res.errors.push('Не указана должность.');
    if (!cardNumber) res.errors.push('Не указан номер карты ОПР.');

    // Дата оценки
    if (rec.assessment_date !== undefined && String(rec.assessment_date).trim() !== '') {
      const parsed = parseExcelDate(rec.assessment_date);
      if (parsed) {
        try {
          validateDateNotFuture(parsed, 'Дата оценки');
          res.data.assessment_date = parsed;
        } catch (e: any) {
          res.errors.push(e.message);
        }
      }
    }

    // Сопоставление с юридическим лицом
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

      // Идентификация: номер карты ОПР уникален в пределах юридического лица
      const existingMatch = existingCards.find(
        c =>
          c.status === 'active' &&
          c.legal_entity_id === targetLe!.id &&
          ciCompare(c.card_number) === ciCompare(cardNumber)
      );

      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(`Карта № ${cardNumber} найдена в организации. Данные будут обновлены.`);
        } else {
          res.action = 'skip';
          res.warnings.push(`Карта № ${cardNumber} уже существует в этой организации — строка будет пропущена.`);
        }
      } else {
        res.action = 'add';
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

// ===============================================
// Модуль «Медосмотры» (Этап 8, Приказ Минздрава 29н)
// ===============================================

export const MEDICAL_HEADERS = [
  'Юридическое лицо',
  'Работник (ФИО)',
  'СНИЛС работника',
  'Номер карты медосмотра',
  'Вид медосмотра',
  'Дата направления',
  'Дата медосмотра',
  'Срок следующего медосмотра',
  'Медицинская организация',
  'Врач (ФИО)',
  'Заключение',
  'Подробности заключения / противопоказания',
];

export const MEDICAL_ALIASES: Record<string, string> = {
  'юридическое лицо': 'legal_entity',
  'юрлицо': 'legal_entity',
  'организация': 'legal_entity',
  'работник (фио)': 'employee_fio',
  'работник фио': 'employee_fio',
  'фио работника': 'employee_fio',
  'фио': 'employee_fio',
  'работник': 'employee_fio',
  'снилс работника': 'employee_snils',
  'снилс': 'employee_snils',
  'номер карты медосмотра': 'card_number',
  'номер карты': 'card_number',
  '№ карты медосмотра': 'card_number',
  '№ карты': 'card_number',
  'карта медосмотра': 'card_number',
  'вид медосмотра': 'exam_type',
  'вид осмотра': 'exam_type',
  'осмотр': 'exam_type',
  'дата направления': 'referral_date',
  'направление': 'referral_date',
  'дата медосмотра': 'exam_date',
  'дата осмотра': 'exam_date',
  'срок следующего медосмотра': 'next_due_date',
  'следующий медосмотр': 'next_due_date',
  'срок следующего осмотра': 'next_due_date',
  'медицинская организация': 'clinic_name',
  'медорганизация': 'clinic_name',
  'клиника': 'clinic_name',
  'учреждение': 'clinic_name',
  'врач (фио)': 'doctor_fio',
  'врач фио': 'doctor_fio',
  'врач': 'doctor_fio',
  'заключение': 'conclusion',
  'заключение по результатам': 'conclusion',
  'подробности заключения / противопоказания': 'conclusion_details',
  'подробности заключения': 'conclusion_details',
  'противопоказания': 'conclusion_details',
  'комментарий заключения': 'conclusion_details',
};

const MEDICAL_EXAM_TYPE_RU_TO_KEY: Record<string, MedicalExamType> = {
  'предварительный': 'preliminary',
  'предварительный (при поступлении на работу)': 'preliminary',
  'предварительный при поступлении на работу': 'preliminary',
  'периодический': 'periodic',
  'предсменный': 'pre_shift',
  'предрейсовый': 'pre_shift',
  'предсменный (предрейсовый)': 'pre_shift',
  'предсменный/предрейсовый': 'pre_shift',
};

const MEDICAL_CONCLUSION_RU_TO_KEY: Record<string, MedicalConclusion> = {
  'годен': 'fit',
  'допущен': 'fit',
  'годен с ограничениями': 'fit_restrictions',
  'допущен с ограничениями': 'fit_restrictions',
  'не годен': 'unfit',
  'не допущен': 'unfit',
  'заключение не получено': 'pending',
  'не получено': 'pending',
  'ожидание': 'pending',
};

export function mapMedicalHeaders(rawHeaders: string[]): {
  mapping: Record<number, string>;
  problems: string[];
} {
  const mapping: Record<number, string> = {};
  const problems: string[] = [];
  const foundFields = new Set<string>();

  rawHeaders.forEach((raw, idx) => {
    const clean = String(raw || '').trim().toLowerCase();
    if (MEDICAL_ALIASES[clean]) {
      const field = MEDICAL_ALIASES[clean];
      mapping[idx] = field;
      foundFields.add(field);
    }
  });

  const required = ['legal_entity', 'card_number', 'exam_type'];
  for (const req of required) {
    if (!foundFields.has(req)) {
      problems.push(`Отсутствует обязательная колонка для сопоставления: «${req}»`);
    }
  }
  if (!foundFields.has('employee_fio') && !foundFields.has('employee_snils')) {
    problems.push('Отсутствуют обязательные колонки работника: «Работник (ФИО)» или «СНИЛС работника»');
  }

  return { mapping, problems };
}

function medicalCardToRow(c: MedicalExaminationCard): string[] {
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const emp = storage.getEmployeesRaw().find(e => e.id === c.employee_id);
  const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim() : '';
  const le = les.find(l => l.id === c.legal_entity_id);

  return [
    sanitizeCell(le?.full_name || ''),
    sanitizeCell(fio),
    sanitizeCell(emp?.snils || ''),
    sanitizeCell(c.card_number),
    sanitizeCell(MEDICAL_EXAM_TYPE_LABELS_RU[c.exam_type] || c.exam_type),
    sanitizeCell(formatDateForDisplay(c.referral_date)),
    sanitizeCell(formatDateForDisplay(c.exam_date)),
    sanitizeCell(formatDateForDisplay(c.next_due_date)),
    sanitizeCell(c.clinic_name || ''),
    sanitizeCell(c.doctor_fio || ''),
    sanitizeCell(MEDICAL_CONCLUSION_LABELS_RU[c.conclusion]?.name || c.conclusion),
    sanitizeCell(c.conclusion_details || ''),
  ];
}

export function exportMedicalToXLSX(cards: MedicalExaminationCard[], filename = 'medical_cards.xlsx'): void {
  const rows: any[][] = [MEDICAL_HEADERS];
  for (const c of cards) {
    rows.push(medicalCardToRow(c));
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = MEDICAL_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Карты медосмотров');
  XLSX.writeFile(wb, filename);
}

export function exportMedicalToCSV(cards: MedicalExaminationCard[], filename = 'medical_cards.csv'): void {
  const lines: string[] = [];
  lines.push(MEDICAL_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const c of cards) {
    const row = medicalCardToRow(c);
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

export function downloadMedicalTemplate(): void {
  const exampleRow = [
    'ООО Ромашка',
    'Иванов Иван Иванович',
    '112-003-456 78',
    'МЕД-001',
    'Периодический',
    '15.02.2024',
    '01.03.2024',
    '01.03.2026',
    'ГБУЗ «Центр профпатологии»',
    'Петрова А.С.',
    'Годен',
    '',
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([MEDICAL_HEADERS, exampleRow]);
  ws['!cols'] = MEDICAL_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Карты медосмотров');
  XLSX.writeFile(wb, 'template_medical.xlsx');
}

export function generateMedicalPreview(
  rawRows: any[][],
  mapping: Record<number, string>,
  existingCards: MedicalExaminationCard[],
  mode: 'add' | 'update'
): MedicalImportPreviewData {
  const results: MedicalImportRowResult[] = [];
  const les = storage.listLegalEntities({ pageSize: 10000 }).items;
  const employees = storage.getEmployeesRaw();

  rawRows.forEach((row, i) => {
    const rowNum = i + 2;
    const rec: Record<string, any> = {};

    Object.entries(mapping).forEach(([colIdx, key]) => {
      const idx = parseInt(colIdx, 10);
      rec[key] = row[idx];
    });

    const leQuery = String(rec.legal_entity || '').trim();
    const fioQuery = String(rec.employee_fio || '').trim();
    const snilsQuery = normalizeSnils(String(rec.employee_snils || '').trim());
    const cardNumber = String(rec.card_number || '').trim();
    const examTypeRaw = String(rec.exam_type || '').trim();
    const clinicName = String(rec.clinic_name || '').trim();
    const doctorFio = String(rec.doctor_fio || '').trim();
    const conclusionRaw = String(rec.conclusion || '').trim();
    const details = String(rec.conclusion_details || '').trim();

    const title = cardNumber ? `Карта медосмотра № ${cardNumber}` : '(без номера)';

    const res: MedicalImportRowResult = {
      row: rowNum,
      action: 'add',
      title,
      errors: [],
      warnings: [],
      changes: [],
      data: {
        legal_entity_name: leQuery,
        employee_fio: fioQuery,
        employee_snils: snilsQuery || '',
        card_number: cardNumber,
        exam_type_raw: examTypeRaw,
        clinic_name: clinicName,
        doctor_fio: doctorFio,
        conclusion_raw: conclusionRaw,
        conclusion_details: details,
      },
    };

    if (!leQuery) res.errors.push('Не указано юридическое лицо.');
    if (!cardNumber) res.errors.push('Не указан номер карты медосмотра.');
    if (!fioQuery && !snilsQuery) res.errors.push('Укажите ФИО или СНИЛС работника.');

    // Вид медосмотра
    const examTypeKey = examTypeRaw
      ? MEDICAL_EXAM_TYPE_RU_TO_KEY[examTypeRaw.toLowerCase().replace(/\s+/g, ' ').trim()]
      : undefined;
    if (!examTypeRaw) {
      res.errors.push('Не указан вид медосмотра.');
    } else if (!examTypeKey) {
      res.errors.push(`Недопустимый вид медосмотра «${examTypeRaw}». Допустимы: Предварительный, Периодический, Предсменный (предрейсовый).`);
    } else {
      res.data.exam_type = examTypeKey;
    }

    // Заключение
    let conclusionKey: MedicalConclusion | undefined;
    if (conclusionRaw) {
      conclusionKey = MEDICAL_CONCLUSION_RU_TO_KEY[conclusionRaw.toLowerCase().replace(/\s+/g, ' ').trim()];
      if (!conclusionKey) {
        res.errors.push(`Недопустимое заключение «${conclusionRaw}». Допустимы: Годен, Годен с ограничениями, Не годен, Заключение не получено.`);
      } else {
        res.data.conclusion = conclusionKey;
      }
    } else {
      conclusionKey = 'pending';
      res.data.conclusion = 'pending';
      res.warnings.push('Заключение не указано — будет установлено «Заключение не получено».');
    }

    // Даты
    const dateFields: Array<[string, string]> = [
      ['referral_date', 'Дата направления'],
      ['exam_date', 'Дата медосмотра'],
      ['next_due_date', 'Срок следующего медосмотра'],
    ];
    for (const [field, label] of dateFields) {
      const rawVal = rec[field];
      if (rawVal !== undefined && String(rawVal).trim() !== '') {
        const parsed = parseExcelDate(rawVal);
        if (!parsed) {
          res.errors.push(`${label}: не удалось распознать дату «${rawVal}» (ожидается ГГГГ-ММ-ДД или ДД.ММ.ГГГГ).`);
        } else if (field !== 'next_due_date') {
          try {
            validateDateNotFuture(parsed, label);
            res.data[field] = parsed;
          } catch (e: any) {
            res.errors.push(e.message);
          }
        } else {
          res.data[field] = parsed;
        }
      }
    }

    const examDateVal = res.data.exam_date;
    const referralVal = res.data.referral_date;
    const nextDueVal = res.data.next_due_date;
    if (referralVal && examDateVal && examDateVal < referralVal) {
      res.errors.push('Дата медосмотра раньше даты выдачи направления.');
    }
    if (examDateVal && nextDueVal && nextDueVal <= examDateVal) {
      res.errors.push('Срок следующего медосмотра должен быть позже даты пройденного медосмотра.');
    }
    if (conclusionKey && conclusionKey !== 'pending' && !examDateVal) {
      res.errors.push('Для полученного заключения обязательна дата медосмотра.');
    }

    // Сопоставление юридического лица
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

    // Сопоставление работника
    if (targetLe && (fioQuery || snilsQuery)) {
      const leEmployees = employees.filter(e => e.status === 'active' && e.legal_entity_id === targetLe!.id);
      let matched: Employee[] = [];
      if (snilsQuery) {
        matched = leEmployees.filter(e => normalizeSnils(e.snils || '') === snilsQuery);
      }
      if (matched.length === 0 && fioQuery) {
        const needle = ciCompare(fioQuery);
        matched = leEmployees.filter(e => {
          const fio = `${e.last_name} ${e.first_name} ${e.middle_name || ''}`.trim();
          const f1 = e.first_name ? e.first_name.charAt(0) : '';
          const m1 = e.middle_name ? e.middle_name.charAt(0) : '';
          const shortVariants = [
            `${e.last_name} ${f1}.${m1 ? m1 + '.' : ''}`.trim(),
            `${e.last_name} ${f1}. ${m1 ? m1 + '.' : ''}`.trim(),
            `${e.last_name} ${f1}.${m1 ? '.' + m1 : ''}`.trim(),
            `${e.last_name} ${f1}${m1 ? '.' + m1 : ''}`.trim(),
            `${e.last_name} ${f1}${m1 ? m1 : ''}`.trim(),
          ];
          return ciCompare(fio) === needle || shortVariants.some(v => ciCompare(v) === needle);
        });
      }
      if (matched.length === 0) {
        res.errors.push(`Работник «${fioQuery || 'СНИЛС ' + snilsQuery}» не найден в организации.`);
      } else {
        if (matched.length > 1) {
          res.warnings.push(`Найдено несколько работников с таким ФИО — выбран первый (${matched[0].last_name} ${matched[0].first_name}). Уточните импорт через СНИЛС.`);
        }
        res.data.employee_id = matched[0].id;
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    if (targetLe) {
      // Идентификация: номер карты уникален в пределах юридического лица
      const existingMatch = existingCards.find(
        c =>
          c.status === 'active' &&
          c.legal_entity_id === targetLe!.id &&
          ciCompare(c.card_number) === ciCompare(cardNumber)
      );

      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(`Карта № ${cardNumber} найдена в организации. Данные будут обновлены.`);
        } else {
          res.action = 'skip';
          res.warnings.push(`Карта № ${cardNumber} уже существует в этой организации — строка будет пропущена.`);
        }
      } else {
        res.action = 'add';
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

// =========================================================================
// ЭТАП 9: СРЕДСТВА ИНДИВИДУАЛЬНОЙ ЗАЩИТЫ (СИЗ) — EXCEL ИМПОРТ И ЭКСПОРТ
// =========================================================================

export const PPE_NORMS_HEADERS = [
  'Организация (ИНН или наименование)',
  'Подразделение',
  'Должность / профессия',
  'Вид СИЗ',
  'Наименование СИЗ',
  'Защитные свойства / марка',
  'Количество',
  'Единица измерения',
  'Срок носки (мес.)',
  'Дежурное (Да/Нет)',
  'Основание нормы (ЕТН / ЛНА)',
  'Опасность / вредный фактор',
];

export const PPE_NORMS_ALIASES: Record<string, string> = {
  'организация': 'legal_entity',
  'юрлицо': 'legal_entity',
  'инн': 'legal_entity',
  'структурное подразделение': 'department',
  'подразделение': 'department',
  'отдел': 'department',
  'цех': 'department',
  'должность': 'position',
  'профессия': 'position',
  'должность / профессия': 'position',
  'вид сиз': 'ppe_type',
  'категория сиз': 'ppe_type',
  'тип сиз': 'ppe_type',
  'наименование сиз': 'ppe_name',
  'наименование': 'ppe_name',
  'сиз': 'ppe_name',
  'защитные свойства': 'protection_properties',
  'свойства': 'protection_properties',
  'марка': 'protection_properties',
  'защитные свойства / марка': 'protection_properties',
  'количество': 'quantity',
  'норма': 'quantity',
  'количество на период': 'quantity',
  'единица измерения': 'unit',
  'ед. изм.': 'unit',
  'ед.изм.': 'unit',
  'срок носки': 'period_months',
  'срок носки (мес.)': 'period_months',
  'периодичность (мес.)': 'period_months',
  'период': 'period_months',
  'дежурное': 'is_duty',
  'дежурное (да/нет)': 'is_duty',
  'дежурный': 'is_duty',
  'основание нормы': 'norm_basis',
  'основание нормы (етн / лна)': 'norm_basis',
  'етн': 'norm_basis',
  'пункт етн': 'norm_basis',
  'опасность / вредный фактор': 'hazard_or_factor',
  'опасность': 'hazard_or_factor',
  'фактор': 'hazard_or_factor',
};

export function exportPpeNormsToXLSX(
  norms: PpeNormItem[],
  leMap: Map<string, LegalEntity>,
  posMap: Map<string, Position>,
  deptMap: Map<string, Department>,
  filename = 'ppe_norms.xlsx'
): void {
  const rows: any[][] = [PPE_NORMS_HEADERS];
  for (const n of norms) {
    const le = leMap.get(n.legal_entity_id);
    const pos = posMap.get(n.position_id);
    const dept = n.department_id ? deptMap.get(n.department_id) : undefined;
    rows.push([
      sanitizeCell(le?.short_name || le?.full_name || n.legal_entity_id),
      sanitizeCell(dept?.name || ''),
      sanitizeCell(pos?.name || n.position_id),
      sanitizeCell(PPE_CATEGORY_LABELS_RU[n.ppe_type] || n.ppe_type),
      sanitizeCell(n.ppe_name),
      sanitizeCell(n.protection_properties || ''),
      n.quantity_per_period,
      sanitizeCell(n.unit),
      n.period_months,
      n.is_duty ? 'Да' : 'Нет',
      sanitizeCell(n.norm_basis || ''),
      sanitizeCell(n.hazard_or_factor || ''),
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = PPE_NORMS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Нормы СИЗ (ЕТН)');
  XLSX.writeFile(wb, filename);
}

export function exportPpeNormsToCSV(
  norms: PpeNormItem[],
  leMap: Map<string, LegalEntity>,
  posMap: Map<string, Position>,
  deptMap: Map<string, Department>,
  filename = 'ppe_norms.csv'
): void {
  const lines: string[] = [];
  lines.push(PPE_NORMS_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const n of norms) {
    const le = leMap.get(n.legal_entity_id);
    const pos = posMap.get(n.position_id);
    const dept = n.department_id ? deptMap.get(n.department_id) : undefined;
    const row = [
      le?.short_name || le?.full_name || n.legal_entity_id,
      dept?.name || '',
      pos?.name || n.position_id,
      PPE_CATEGORY_LABELS_RU[n.ppe_type] || n.ppe_type,
      n.ppe_name,
      n.protection_properties || '',
      String(n.quantity_per_period),
      n.unit,
      String(n.period_months),
      n.is_duty ? 'Да' : 'Нет',
      n.norm_basis || '',
      n.hazard_or_factor || '',
    ];
    lines.push(row.map(cell => `"${sanitizeCell(cell).replace(/"/g, '""')}"`).join(';'));
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPpeNormsTemplate(): void {
  const rows: any[][] = [
    PPE_NORMS_HEADERS,
    [
      'ООО «Пример»',
      'Производственный отдел',
      'Электрогазосварщик',
      'Специальная одежда',
      'Костюм для сварщика из огнестойких материалов',
      'Тр, Тит',
      1,
      'компл.',
      12,
      'Нет',
      'Приказ 767н, Прил. 1, п. 5.12',
      'Повышенная температура, искры и брызги расплавленного металла',
    ],
    [
      'ООО «Пример»',
      'Производственный отдел',
      'Электрогазосварщик',
      'Средства защиты глаз и лица',
      'Щиток защитный лицевой с автоматическим светофильтром',
      'УФ, ИК, В',
      1,
      'шт.',
      24,
      'Нет',
      'Приказ 767н, Прил. 1, п. 5.14',
      'Оптическое излучение сварочной дуги',
    ],
    [
      'ООО «Пример»',
      'Складское хозяйство',
      'Кладовщик',
      'Средства защиты головы',
      'Каска защитная',
      'Мун',
      1,
      'шт.',
      0,
      'Да',
      'Приказ 766н, п. 32 (дежурные СИЗ)',
      'Падение предметов с высоты при погрузке',
    ],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = PPE_NORMS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон норм СИЗ');
  XLSX.writeFile(wb, 'template_ppe_norms.xlsx');
}

export function mapPpeNormsHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const clean = h.trim().toLowerCase().replace(/\s+/g, ' ');
    if (PPE_NORMS_ALIASES[clean]) {
      mapping[h] = PPE_NORMS_ALIASES[clean];
    }
  }
  return mapping;
}

export function generatePpeNormsPreview(
  rows: Record<string, any>[],
  les: LegalEntity[],
  depts: Department[],
  positions: Position[],
  existingNorms: PpeNormItem[],
  mode: 'add' | 'update'
): PpeImportPreviewData {
  const results: PpeImportRowResult[] = [];

  rows.forEach((row, idx) => {
    const res: PpeImportRowResult = {
      row: idx + 2,
      action: 'skip',
      title: '',
      errors: [],
      warnings: [],
      changes: [],
      data: {},
    };

    const leQuery = normalizeText(row.legal_entity);
    const deptQuery = normalizeText(row.department);
    const posQuery = normalizeText(row.position);
    const ppeName = normalizeText(row.ppe_name);
    const ppeTypeRaw = normalizeText(row.ppe_type);
    const qtyRaw = row.quantity;
    const unitRaw = normalizeText(row.unit);
    const periodRaw = row.period_months;
    const isDutyRaw = normalizeText(row.is_duty);

    res.title = ppeName ? `${ppeName} (${posQuery || 'должность не указана'})` : `Строка ${idx + 2}`;

    if (!leQuery) res.errors.push('Не указано юридическое лицо (ИНН или наименование).');
    if (!posQuery) res.errors.push('Не указана должность / профессия.');
    if (!ppeName) res.errors.push('Не указано наименование СИЗ.');

    const qty = Number(qtyRaw);
    if (isNaN(qty) || qty <= 0) {
      res.errors.push('Количество должно быть положительным числом больше 0.');
    }
    const period = periodRaw !== undefined && periodRaw !== null && periodRaw !== '' ? Number(periodRaw) : 12;
    if (isNaN(period) || period < 0) {
      res.errors.push('Срок носки должен быть неотрицательным числом месяцев (0 — до износа).');
    }

    const unit = unitRaw || 'шт.';
    const isDuty = ['да', 'true', '1', 'дежурное', 'дежурный'].includes((isDutyRaw || '').toLowerCase());

    // Определение категории СИЗ
    let ppeCategory: PpeCategory = 'clothing';
    if (ppeTypeRaw) {
      const pCat = ppeTypeRaw.toLowerCase();
      if (pCat.includes('обув')) ppeCategory = 'footwear';
      else if (pCat.includes('рук') || pCat.includes('перчат') || pCat.includes('рукавиц')) ppeCategory = 'hands';
      else if (pCat.includes('голов') || pCat.includes('каск')) ppeCategory = 'head';
      else if (pCat.includes('глаз') || pCat.includes('лиц') || pCat.includes('очк') || pCat.includes('щиток')) ppeCategory = 'eyes_face';
      else if (pCat.includes('дыхан') || pCat.includes('респират') || pCat.includes('противогаз')) ppeCategory = 'respiratory';
      else if (pCat.includes('слух') || pCat.includes('наушник') || pCat.includes('беруш')) ppeCategory = 'hearing';
      else if (pCat.includes('паден') || pCat.includes('высот') || pCat.includes('привяз')) ppeCategory = 'fall_protection';
      else if (pCat.includes('смыв') || pCat.includes('дерматолог') || pCat.includes('крем')) ppeCategory = 'dermatological';
      else if (pCat.includes('одежд') || pCat.includes('костюм') || pCat.includes('халат')) ppeCategory = 'clothing';
      else ppeCategory = 'other';
    }

    res.data = {
      ppe_name: ppeName,
      ppe_type: ppeCategory,
      protection_properties: normalizeText(row.protection_properties),
      quantity_per_period: qty,
      unit,
      period_months: period,
      is_duty: isDuty,
      norm_basis: normalizeText(row.norm_basis),
      hazard_or_factor: normalizeText(row.hazard_or_factor),
    };

    // Сопоставление юридического лица
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
      } else {
        res.data.legal_entity_id = targetLe.id;
      }
    }

    // Сопоставление должности
    let targetPos: Position | undefined;
    if (posQuery) {
      const posNorm = posQuery.toLowerCase().replace(/\s+/g, ' ').trim();
      targetPos = positions.find(p => p.normalized_name === posNorm && p.status === 'active');
      if (!targetPos) {
        res.warnings.push(`Должность «${posQuery}» отсутствует в справочнике — будет создана автоматически.`);
      } else {
        res.data.position_id = targetPos.id;
      }
    }

    // Сопоставление подразделения
    if (targetLe && deptQuery) {
      const targetDept = depts.find(
        d =>
          d.legal_entity_id === targetLe!.id &&
          d.status === 'active' &&
          ciCompare(d.name) === ciCompare(deptQuery)
      );
      if (!targetDept) {
        res.warnings.push(`Подразделение «${deptQuery}» не найдено — будет создано автоматически.`);
      } else {
        res.data.department_id = targetDept.id;
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    if (targetLe) {
      // Идентификация нормы: юрлицо + должность + наименование СИЗ + признак дежурного
      const existingMatch = existingNorms.find(
        n =>
          n.status === 'active' &&
          n.legal_entity_id === targetLe!.id &&
          (targetPos ? n.position_id === targetPos.id : false) &&
          ciCompare(n.ppe_name) === ciCompare(ppeName) &&
          n.is_duty === isDuty
      );

      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(`Норма «${ppeName}» найдена для должности. Параметры выдачи будут обновлены.`);
        } else {
          res.action = 'skip';
          res.warnings.push(`Норма «${ppeName}» уже существует для данной должности — строка будет пропущена.`);
        }
      } else {
        res.action = 'add';
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

  return { results, structure_errors: [], summary };
}

// --- Личные карточки СИЗ (Приказ Минтруда 766н) ---

export const PPE_CARDS_HEADERS = [
  'Организация (ИНН или наименование)',
  'Номер карточки СИЗ',
  'ФИО работника',
  'СНИЛС',
  'Рост (см)',
  'Размер одежды',
  'Размер обуви',
  'Размер головного убора',
  'Размер противогаза/респиратора',
  'Размер перчаток',
];

export const PPE_CARDS_ALIASES: Record<string, string> = {
  'организация': 'legal_entity',
  'юрлицо': 'legal_entity',
  'инн': 'legal_entity',
  'номер карточки сиз': 'card_number',
  'номер карточки': 'card_number',
  'номер карты': 'card_number',
  'номер сиз': 'card_number',
  'номер': 'card_number',
  'фио работника': 'fio',
  'фио': 'fio',
  'работник': 'fio',
  'снилс': 'snils',
  'рост (см)': 'height',
  'рост': 'height',
  'размер одежды': 'clothing_size',
  'одежда': 'clothing_size',
  'размер обуви': 'shoe_size',
  'обувь': 'shoe_size',
  'размер головного убора': 'headwear_size',
  'головной убор': 'headwear_size',
  'каска': 'headwear_size',
  'размер противогаза/респиратора': 'gasmask_size',
  'респиратор': 'gasmask_size',
  'противогаз': 'gasmask_size',
  'размер перчаток': 'gloves_size',
  'перчатки': 'gloves_size',
  'рукавицы': 'gloves_size',
};

export function exportPpeCardsToXLSX(
  cards: PpeCard[],
  leMap: Map<string, LegalEntity>,
  empMap: Map<string, Employee>,
  filename = 'ppe_cards.xlsx'
): void {
  const rows: any[][] = [PPE_CARDS_HEADERS];
  for (const c of cards) {
    const le = leMap.get(c.legal_entity_id);
    const emp = empMap.get(c.employee_id);
    const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim() : c.employee_id;
    rows.push([
      sanitizeCell(le?.short_name || le?.full_name || c.legal_entity_id),
      sanitizeCell(c.card_number),
      sanitizeCell(fio),
      sanitizeCell(emp?.snils || ''),
      c.height || '',
      sanitizeCell(c.clothing_size || ''),
      sanitizeCell(c.shoe_size || ''),
      sanitizeCell(c.headwear_size || ''),
      sanitizeCell(c.gasmask_size || ''),
      sanitizeCell(c.gloves_size || ''),
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = PPE_CARDS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 16) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Личные карточки СИЗ');
  XLSX.writeFile(wb, filename);
}

export function exportPpeCardsToCSV(
  cards: PpeCard[],
  leMap: Map<string, LegalEntity>,
  empMap: Map<string, Employee>,
  filename = 'ppe_cards.csv'
): void {
  const lines: string[] = [];
  lines.push(PPE_CARDS_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const c of cards) {
    const le = leMap.get(c.legal_entity_id);
    const emp = empMap.get(c.employee_id);
    const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim() : c.employee_id;
    const row = [
      le?.short_name || le?.full_name || c.legal_entity_id,
      c.card_number,
      fio,
      emp?.snils || '',
      c.height ? String(c.height) : '',
      c.clothing_size || '',
      c.shoe_size || '',
      c.headwear_size || '',
      c.gasmask_size || '',
      c.gloves_size || '',
    ];
    lines.push(row.map(cell => `"${sanitizeCell(cell).replace(/"/g, '""')}"`).join(';'));
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadPpeCardsTemplate(): void {
  const rows: any[][] = [
    PPE_CARDS_HEADERS,
    [
      'ООО «Пример»',
      'СИЗ-001',
      'Иванов Иван Иванович',
      '112-233-445 95',
      176,
      '48-50 / 170-176',
      '42',
      '58',
      '2',
      '9 (L)',
    ],
    [
      'ООО «Пример»',
      'СИЗ-002',
      'Петров Пётр Сергеевич',
      '223-344-556 06',
      182,
      '52-54 / 182-188',
      '44',
      '60',
      '3',
      '10 (XL)',
    ],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = PPE_CARDS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон карточек СИЗ');
  XLSX.writeFile(wb, 'template_ppe_cards.xlsx');
}

export function mapPpeCardsHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const clean = h.trim().toLowerCase().replace(/\s+/g, ' ');
    if (PPE_CARDS_ALIASES[clean]) {
      mapping[h] = PPE_CARDS_ALIASES[clean];
    }
  }
  return mapping;
}

export function generatePpeCardsPreview(
  rows: Record<string, any>[],
  les: LegalEntity[],
  employees: Employee[],
  existingCards: PpeCard[],
  mode: 'add' | 'update'
): PpeImportPreviewData {
  const results: PpeImportRowResult[] = [];

  rows.forEach((row, idx) => {
    const res: PpeImportRowResult = {
      row: idx + 2,
      action: 'skip',
      title: '',
      errors: [],
      warnings: [],
      changes: [],
      data: {},
    };

    const leQuery = normalizeText(row.legal_entity);
    const cardNumber = normalizeText(row.card_number);
    const fioQuery = normalizeText(row.fio);
    const snilsQuery = row.snils ? normalizeSnils(row.snils) : '';

    res.title = cardNumber ? `Карточка № ${cardNumber}` : `Строка ${idx + 2}`;

    if (!leQuery) res.errors.push('Не указано юридическое лицо (ИНН или наименование).');
    if (!cardNumber) res.errors.push('Не указан номер личной карточки СИЗ.');
    if (!fioQuery && !snilsQuery) res.errors.push('Не указан работник (ФИО или СНИЛС).');

    const heightVal = row.height ? Number(row.height) : null;
    if (heightVal !== null && (isNaN(heightVal) || heightVal < 100 || heightVal > 250)) {
      res.warnings.push(`Указан необычный рост работника: ${heightVal} см.`);
    }

    res.data = {
      card_number: cardNumber,
      height: heightVal,
      clothing_size: normalizeText(row.clothing_size),
      shoe_size: normalizeText(row.shoe_size),
      headwear_size: normalizeText(row.headwear_size),
      gasmask_size: normalizeText(row.gasmask_size),
      gloves_size: normalizeText(row.gloves_size),
    };

    // Сопоставление юридического лица
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
      } else {
        res.data.legal_entity_id = targetLe.id;
      }
    }

    // Сопоставление работника
    if (targetLe && (fioQuery || snilsQuery)) {
      const leEmployees = employees.filter(e => e.status === 'active' && e.legal_entity_id === targetLe!.id);
      let matched: Employee[] = [];
      if (snilsQuery) {
        matched = leEmployees.filter(e => normalizeSnils(e.snils || '') === snilsQuery);
      }
      if (matched.length === 0 && fioQuery) {
        const needle = ciCompare(fioQuery);
        matched = leEmployees.filter(e => {
          const fio = `${e.last_name} ${e.first_name} ${e.middle_name || ''}`.trim();
          const f1 = e.first_name ? e.first_name.charAt(0) : '';
          const m1 = e.middle_name ? e.middle_name.charAt(0) : '';
          const shortVariants = [
            `${e.last_name} ${f1}.${m1 ? m1 + '.' : ''}`.trim(),
            `${e.last_name} ${f1}. ${m1 ? m1 + '.' : ''}`.trim(),
            `${e.last_name} ${f1}.${m1 ? '.' + m1 : ''}`.trim(),
            `${e.last_name} ${f1}${m1 ? '.' + m1 : ''}`.trim(),
            `${e.last_name} ${f1}${m1 ? m1 : ''}`.trim(),
          ];
          return ciCompare(fio) === needle || shortVariants.some(v => ciCompare(v) === needle);
        });
      }

      if (matched.length === 0) {
        res.errors.push(`Работник «${fioQuery || 'СНИЛС ' + snilsQuery}» не найден в организации.`);
      } else {
        if (matched.length > 1) {
          res.warnings.push(`Найдено несколько работников с таким ФИО — выбран первый (${matched[0].last_name} ${matched[0].first_name}). Уточните импорт через СНИЛС.`);
        }
        res.data.employee_id = matched[0].id;
        res.title = `Карточка № ${cardNumber} (${matched[0].last_name} ${matched[0].first_name})`;
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    if (targetLe) {
      const existingMatch = existingCards.find(
        c =>
          c.status === 'active' &&
          c.legal_entity_id === targetLe!.id &&
          ciCompare(c.card_number) === ciCompare(cardNumber)
      );

      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(`Карточка № ${cardNumber} найдена в организации. Размеры будут обновлены.`);
        } else {
          res.action = 'skip';
          res.warnings.push(`Карточка № ${cardNumber} уже существует — строка будет пропущена.`);
        }
      } else {
        // Проверка: нет ли у работника другой активной карточки
        if (res.data.employee_id) {
          const empCard = existingCards.find(
            c => c.status === 'active' && c.employee_id === res.data.employee_id
          );
          if (empCard) {
            res.action = 'reject';
            res.errors.push(`У работника уже есть активная карточка СИЗ № «${empCard.card_number}».`);
            results.push(res);
            return;
          }
        }
        res.action = 'add';
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

  return { results, structure_errors: [], summary };
}


// =========================================================================
// Этап 10 — Обучение по охране труда и проверка знаний (Постановление РФ № 2464)
// =========================================================================

export const TRAINING_PROGRAMS_HEADERS = [
  'Организация (ИНН или наименование)',
  'Наименование программы',
  'Категория программы',
  'Трудоемкость (часы)',
  'Периодичность (мес.)',
  'Должности / профессии',
  'Основание разработки',
];

export const TRAINING_PROGRAMS_ALIASES: Record<string, string> = {
  'организация': 'legal_entity',
  'юрлицо': 'legal_entity',
  'инн': 'legal_entity',
  'наименование программы': 'name',
  'программа': 'name',
  'категория программы': 'category',
  'категория': 'category',
  'вид программы': 'category',
  'программа а/б/в': 'category',
  'трудоемкость (часы)': 'hours',
  'трудоемкость': 'hours',
  'часов': 'hours',
  'объем часов': 'hours',
  'периодичность (мес.)': 'recurring_months',
  'периодичность': 'recurring_months',
  'должности / профессии': 'positions',
  'должности': 'positions',
  'профессии': 'positions',
  'основание разработки': 'basis',
  'основание': 'basis',
};

const TRAINING_CATEGORY_KEYWORDS: Array<[TrainingProgramCategory, string[]]> = [
  ['program_a', ['программа а', 'общие вопросы', 'суот']],
  ['program_b', ['программа б', 'вредных', 'опасных производственных факторов']],
  ['program_c', ['программа в', 'повышенной опасности']],
  ['first_aid', ['первой помощи', 'первая помощь']],
  ['ppe_use', ['применению си', 'использованию си', 'средства индивидуальной защиты', 'сиз']],
  ['intro_briefing', ['вводный']],
  ['primary_briefing', ['первичный']],
  ['repeated_briefing', ['повторный']],
  ['unexpected_briefing', ['внеплановый']],
  ['targeted_briefing', ['целевой']],
];

export function resolveTrainingCategory(raw?: string | null): TrainingProgramCategory | null {
  if (!raw) return null;
  const s = String(raw).trim().toLowerCase().replace(/ё/g, 'е').replace(/\s+/g, ' ');
  const keys = Object.keys(TRAINING_PROGRAM_CATEGORY_LABELS_RU) as TrainingProgramCategory[];
  for (const k of keys) {
    if (s === k) return k;
  }
  for (const [cat, words] of TRAINING_CATEGORY_KEYWORDS) {
    for (const w of words) {
      if (s.includes(w)) return cat;
    }
  }
  return null;
}

export function exportTrainingProgramsToXLSX(
  programs: TrainingProgram[],
  leMap: Map<string, LegalEntity>,
  filename = 'training_programs.xlsx'
): void {
  const rows: any[][] = [TRAINING_PROGRAMS_HEADERS];
  for (const p of programs) {
    const le = leMap.get(p.legal_entity_id);
    rows.push([
      sanitizeCell(le?.short_name || le?.full_name || p.legal_entity_id),
      sanitizeCell(p.name),
      sanitizeCell(TRAINING_PROGRAM_CATEGORY_LABELS_RU[p.category] || p.category),
      p.hours,
      p.recurring_months ?? '',
      sanitizeCell(p.positions || ''),
      sanitizeCell(p.basis || ''),
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = TRAINING_PROGRAMS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Программы обучения');
  XLSX.writeFile(wb, filename);
}

export function exportTrainingProgramsToCSV(
  programs: TrainingProgram[],
  leMap: Map<string, LegalEntity>,
  filename = 'training_programs.csv'
): void {
  const lines: string[] = [];
  lines.push(TRAINING_PROGRAMS_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const p of programs) {
    const le = leMap.get(p.legal_entity_id);
    const row = [
      le?.short_name || le?.full_name || p.legal_entity_id,
      p.name,
      TRAINING_PROGRAM_CATEGORY_LABELS_RU[p.category] || p.category,
      String(p.hours),
      p.recurring_months != null ? String(p.recurring_months) : '',
      p.positions || '',
      p.basis || '',
    ];
    lines.push(row.map(cell => `"${sanitizeCell(cell).replace(/"/g, '""')}"`).join(';'));
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTrainingProgramsTemplate(): void {
  const rows: any[][] = [
    TRAINING_PROGRAMS_HEADERS,
    [
      'ООО «Пример»',
      'Программа обучения по общим вопросам охраны труда и функционирования СУОТ',
      'Программа А',
      16,
      36,
      'Все работники организации',
      'Постановление Правительства РФ от 24.12.2021 № 2464, п. 17',
    ],
    [
      'ООО «Пример»',
      'Обучение безопасным методам и приемам выполнения работ при воздействии вредных производственных факторов',
      'Программа Б',
      16,
      36,
      'Стропальщик, Электрогазосварщик',
      'Постановление Правительства РФ от 24.12.2021 № 2464, п. 19',
    ],
    [
      'ООО «Пример»',
      'Обучение по оказанию первой помощи пострадавшим',
      'Первая помощь',
      8,
      36,
      'Все работники организации',
      'Постановление Правительства РФ от 24.12.2021 № 2464, п. 22',
    ],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = TRAINING_PROGRAMS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 20) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон программ обучения');
  XLSX.writeFile(wb, 'template_training_programs.xlsx');
}

export function mapTrainingProgramsHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const clean = h.trim().toLowerCase().replace(/\s+/g, ' ');
    if (TRAINING_PROGRAMS_ALIASES[clean]) {
      mapping[h] = TRAINING_PROGRAMS_ALIASES[clean];
    }
  }
  return mapping;
}

export function generateTrainingProgramsPreview(
  rows: Record<string, any>[],
  les: LegalEntity[],
  existingPrograms: TrainingProgram[],
  mode: 'add' | 'update'
): TrainingImportPreviewData {
  const results: TrainingImportRowResult[] = [];

  rows.forEach((row, idx) => {
    const res: TrainingImportRowResult = {
      row: idx + 2, action: 'skip', title: '', errors: [], warnings: [], changes: [], data: {},
    };

    const leQuery = normalizeText(row.legal_entity);
    const name = normalizeText(row.name);
    const categoryRaw = normalizeText(row.category);
    const hoursRaw = row.hours;
    const recurringRaw = row.recurring_months;

    res.title = name ? `Программа «${name}»` : `Строка ${idx + 2}`;

    if (!leQuery) res.errors.push('Не указано юридическое лицо (ИНН или наименование).');
    if (!name) res.errors.push('Не указано наименование программы обучения.');

    const category = resolveTrainingCategory(categoryRaw);
    if (categoryRaw && !category) {
      res.errors.push(`Не распознана категория программы «${categoryRaw}».`);
    }

    const hours = Number(hoursRaw);
    if (isNaN(hours) || hours <= 0) {
      res.errors.push('Трудоемкость должна быть положительным числом часов.');
    } else if ((category === 'program_a' || category === 'program_b') && hours < 16) {
      res.errors.push('По Постановлению № 2464 программы А и Б — не менее 16 часов.');
    } else if ((category === 'first_aid' || category === 'ppe_use') && hours < 8) {
      res.errors.push('По Постановлению № 2464 обучение первой помощи и применению СИЗ — не менее 8 часов.');
    }

    const recurring =
      recurringRaw !== undefined && recurringRaw !== null && String(recurringRaw).trim() !== ''
        ? Number(recurringRaw)
        : null;
    if (recurring !== null && (isNaN(recurring) || recurring < 0)) {
      res.errors.push('Периодичность должна быть неотрицательным числом месяцев (пусто — без периодичности).');
    }

    res.data = {
      name,
      category: category || 'program_a',
      hours: isNaN(hours) ? 0 : hours,
      recurring_months: recurring,
      positions: normalizeText(row.positions),
      basis: normalizeText(row.basis),
    };

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
      } else {
        res.data.legal_entity_id = targetLe.id;
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    if (targetLe) {
      const existingMatch = existingPrograms.find(
        p => p.status === 'active' && p.legal_entity_id === targetLe!.id && ciCompare(p.name) === ciCompare(name)
      );
      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(`Программа «${name}» найдена в организации. Параметры будут обновлены.`);
        } else {
          res.action = 'skip';
          res.warnings.push(`Программа «${name}» уже существует — строка будет пропущена.`);
        }
      } else {
        res.action = 'add';
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

  return { results, structure_errors: [], summary };
}

// --- Протоколы проверки знаний (Постановление № 2464, Приложение № 3) ---

export const TRAINING_PROTOCOLS_HEADERS = [
  'Организация (ИНН или наименование)',
  'Номер протокола',
  'Дата заседания комиссии',
  'Программа (наименование или категория)',
  'ФИО работника',
  'СНИЛС',
  'Результат (удовлетворительно/неудовлетворительно)',
  'Председатель ФИО',
  'Председатель должность',
  'Член комиссии 1 ФИО',
  'Член комиссии 1 должность',
  'Удостоверение выдано (Да/Нет)',
  'Номер удостоверения',
  'Регистрационный номер в реестре Минтруда',
];

export const TRAINING_PROTOCOLS_ALIASES: Record<string, string> = {
  'организация': 'legal_entity',
  'юрлицо': 'legal_entity',
  'инн': 'legal_entity',
  'номер протокола': 'protocol_number',
  'протокол': 'protocol_number',
  'дата заседания комиссии': 'session_date',
  'дата заседания': 'session_date',
  'программа': 'program',
  'программа обучения': 'program',
  'наименование программы': 'program',
  'категория программы': 'program',
  'фио работника': 'fio',
  'фио': 'fio',
  'работник': 'fio',
  'снилс': 'snils',
  'результат': 'result',
  'результат проверки знаний': 'result',
  'председатель фио': 'chairperson_fio',
  'председатель': 'chairperson_fio',
  'председатель должность': 'chairperson_position',
  'член комиссии 1 фио': 'member1_fio',
  'член комиссии 1': 'member1_fio',
  'член комиссии 1 должность': 'member1_position',
  'удостоверение выдано (да/нет)': 'issues_certificate',
  'выдача удостоверения': 'issues_certificate',
  'номер удостоверения': 'certificate_number',
  'регистрационный номер': 'registry_entry_number',
  'регистрационный номер в реестре минтруда': 'registry_entry_number',
  'еисот': 'registry_entry_number',
};

export function exportTrainingProtocolsToXLSX(
  protocols: TrainingProtocolItem[],
  leMap: Map<string, LegalEntity>,
  empMap: Map<string, Employee>,
  programMap: Map<string, TrainingProgram>,
  filename = 'training_protocols.xlsx'
): void {
  const rows: any[][] = [TRAINING_PROTOCOLS_HEADERS];
  for (const pr of protocols) {
    const le = leMap.get(pr.legal_entity_id);
    const emp = empMap.get(pr.employee_id);
    const prog = programMap.get(pr.training_program_id);
    const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim() : pr.employee_id;
    const m1 = pr.members[0];
    rows.push([
      sanitizeCell(le?.short_name || le?.full_name || pr.legal_entity_id),
      sanitizeCell(pr.protocol_number),
      pr.session_date,
      sanitizeCell(prog ? prog.name : pr.training_program_id),
      sanitizeCell(fio),
      sanitizeCell(emp?.snils || ''),
      pr.result === 'passed' ? 'Удовлетворительно' : 'Неудовлетворительно',
      sanitizeCell(`${pr.chairperson.last_name} ${pr.chairperson.first_name || ''} ${pr.chairperson.middle_name || ''}`.trim()),
      sanitizeCell(pr.chairperson.position),
      m1 ? sanitizeCell(`${m1.last_name} ${m1.first_name || ''} ${m1.middle_name || ''}`.trim()) : '',
      m1 ? sanitizeCell(m1.position) : '',
      pr.issues_certificate ? 'Да' : 'Нет',
      sanitizeCell(pr.certificate_number || ''),
      sanitizeCell(pr.registry_entry_number || ''),
    ]);
  }
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = TRAINING_PROTOCOLS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 18) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Протоколы проверки знаний');
  XLSX.writeFile(wb, filename);
}

export function exportTrainingProtocolsToCSV(
  protocols: TrainingProtocolItem[],
  leMap: Map<string, LegalEntity>,
  empMap: Map<string, Employee>,
  programMap: Map<string, TrainingProgram>,
  filename = 'training_protocols.csv'
): void {
  const lines: string[] = [];
  lines.push(TRAINING_PROTOCOLS_HEADERS.map(h => `"${h.replace(/"/g, '""')}"`).join(';'));
  for (const pr of protocols) {
    const le = leMap.get(pr.legal_entity_id);
    const emp = empMap.get(pr.employee_id);
    const prog = programMap.get(pr.training_program_id);
    const fio = emp ? `${emp.last_name} ${emp.first_name} ${emp.middle_name || ''}`.trim() : pr.employee_id;
    const m1 = pr.members[0];
    const row = [
      le?.short_name || le?.full_name || pr.legal_entity_id,
      pr.protocol_number,
      pr.session_date,
      prog ? prog.name : pr.training_program_id,
      fio,
      emp?.snils || '',
      pr.result === 'passed' ? 'Удовлетворительно' : 'Неудовлетворительно',
      `${pr.chairperson.last_name} ${pr.chairperson.first_name || ''} ${pr.chairperson.middle_name || ''}`.trim(),
      pr.chairperson.position,
      m1 ? `${m1.last_name} ${m1.first_name || ''} ${m1.middle_name || ''}`.trim() : '',
      m1 ? m1.position : '',
      pr.issues_certificate ? 'Да' : 'Нет',
      pr.certificate_number || '',
      pr.registry_entry_number || '',
    ];
    lines.push(row.map(cell => `"${sanitizeCell(cell).replace(/"/g, '""')}"`).join(';'));
  }
  const bom = '\uFEFF';
  const blob = new Blob([bom + lines.join('\r\n')], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export function downloadTrainingProtocolsTemplate(): void {
  const rows: any[][] = [
    TRAINING_PROTOCOLS_HEADERS,
    [
      'ООО «Пример»',
      'ПЗ-01/2026',
      '2026-02-10',
      'Программа обучения по общим вопросам охраны труда и функционирования СУОТ',
      'Иванов Иван Иванович',
      '112-233-445 95',
      'Удовлетворительно',
      'Петров Петр Петрович',
      'Главный инженер, ООО «Пример»',
      'Сидоров Сергей Сергеевич',
      'Специалист по охране труда, ООО «Пример»',
      'Да',
      '001-УТ-2464',
      '1234567890',
    ],
  ];
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet(rows);
  ws['!cols'] = TRAINING_PROTOCOLS_HEADERS.map(h => ({ wch: Math.max(h.length + 4, 20) }));
  XLSX.utils.book_append_sheet(wb, ws, 'Шаблон протоколов');
  XLSX.writeFile(wb, 'template_training_protocols.xlsx');
}

export function mapTrainingProtocolsHeaders(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  for (const h of headers) {
    const clean = h.trim().toLowerCase().replace(/\s+/g, ' ');
    if (TRAINING_PROTOCOLS_ALIASES[clean]) {
      mapping[h] = TRAINING_PROTOCOLS_ALIASES[clean];
    }
  }
  return mapping;
}

export function generateTrainingProtocolsPreview(
  rows: Record<string, any>[],
  les: LegalEntity[],
  employees: Employee[],
  programs: TrainingProgram[],
  existingProtocols: TrainingProtocolItem[],
  mode: 'add' | 'update'
): TrainingImportPreviewData {
  const results: TrainingImportRowResult[] = [];

  rows.forEach((row, idx) => {
    const res: TrainingImportRowResult = {
      row: idx + 2, action: 'skip', title: '', errors: [], warnings: [], changes: [], data: {},
    };

    const leQuery = normalizeText(row.legal_entity);
    const protocolNumber = normalizeText(row.protocol_number);
    const sessionDate = normalizeText(row.session_date);
    const programQuery = normalizeText(row.program);
    const fioQuery = normalizeText(row.fio);
    const snilsQuery = row.snils ? normalizeSnils(row.snils) : '';
    const resultRaw = normalizeText(row.result);
    const chairFio = normalizeText(row.chairperson_fio);
    const chairPosition = normalizeText(row.chairperson_position);
    const member1Fio = normalizeText(row.member1_fio);
    const member1Position = normalizeText(row.member1_position);

    res.title = protocolNumber ? `Протокол № ${protocolNumber}` : `Строка ${idx + 2}`;

    if (!leQuery) res.errors.push('Не указано юридическое лицо (ИНН или наименование).');
    if (!protocolNumber) res.errors.push('Не указан номер протокола заседания комиссии.');
    if (!sessionDate || !/^\d{4}-\d{2}-\d{2}$/.test(sessionDate)) {
      res.errors.push('Дата заседания комиссии должна быть в формате ГГГГ-ММ-ДД.');
    } else {
      const dateErr = validateDateNotFuture(sessionDate, 'Дата заседания комиссии');
      if (dateErr) res.errors.push(dateErr);
    }
    if (!programQuery) res.errors.push('Не указана программа обучения.');
    if (!fioQuery && !snilsQuery) res.errors.push('Не указан работник (ФИО или СНИЛС).');

    const resultLower = (resultRaw || '').toLowerCase();
    let result: 'passed' | 'failed' | null = null;
    if (['удовлетворительно', 'passed', 'сдал', 'сдан', '+'].includes(resultLower)) result = 'passed';
    else if (['неудовлетворительно', 'failed', 'не сдал', '-'].includes(resultLower)) result = 'failed';
    if (!result) res.errors.push(`Не распознан результат проверки знаний «${resultRaw || ''}» (ожидается «удовлетворительно» / «неудовлетворительно»).`);

    const chairWords = chairFio ? chairFio.split(/\s+/) : [];
    if (!chairFio) res.errors.push('Не указан председатель комиссии (ФИО).');
    if (!chairPosition) res.warnings.push('Не указана должность председателя комиссии.');
    if (!member1Fio) res.warnings.push('Не указан член комиссии — по п. 27 Порядка № 2464 комиссия не менее 3 человек.');

    const issuesCertRaw = normalizeText(row.issues_certificate);
    const issuesCertificate = ['да', 'true', '1', 'yes'].includes((issuesCertRaw || '').toLowerCase());

    res.data = {
      protocol_number: protocolNumber,
      session_date: sessionDate,
      result,
      chairperson: {
        position: chairPosition || '',
        last_name: chairWords[0] || '',
        first_name: chairWords[1] || null,
        middle_name: chairWords[2] || null,
        trained_in_commission_program: false,
      },
      members: member1Fio
        ? [{
            position: member1Position || '',
            last_name: member1Fio.split(/\s+/)[0] || '',
            first_name: member1Fio.split(/\s+/)[1] || null,
            middle_name: member1Fio.split(/\s+/)[2] || null,
            trained_in_commission_program: false,
          }]
        : [],
      issues_certificate: issuesCertificate,
      certificate_number: normalizeText(row.certificate_number),
      registry_entry_number: normalizeText(row.registry_entry_number),
    };

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
      } else {
        res.data.legal_entity_id = targetLe.id;
      }
    }

    if (targetLe && programQuery) {
      const byName = programs.find(
        p => p.status === 'active' && p.legal_entity_id === targetLe!.id && ciCompare(p.name) === ciCompare(programQuery)
      );
      const resolvedCat = resolveTrainingCategory(programQuery);
      const byCategory = !byName && resolvedCat
        ? programs.find(p => p.status === 'active' && p.legal_entity_id === targetLe!.id && p.category === resolvedCat)
        : undefined;
      const targetProg = byName || byCategory;
      if (!targetProg) {
        res.errors.push(`Программа обучения «${programQuery}» не найдена в организации. Сначала импортируйте программы.`);
      } else {
        res.data.training_program_id = targetProg.id;
      }
    }

    if (targetLe && (fioQuery || snilsQuery)) {
      const leEmployees = employees.filter(e => e.status === 'active' && e.legal_entity_id === targetLe!.id);
      let matched: Employee[] = [];
      if (snilsQuery) {
        matched = leEmployees.filter(e => normalizeSnils(e.snils || '') === snilsQuery);
      }
      if (matched.length === 0 && fioQuery) {
        const needle = ciCompare(fioQuery);
        matched = leEmployees.filter(e => {
          const fio = `${e.last_name} ${e.first_name} ${e.middle_name || ''}`.trim();
          return ciCompare(fio) === needle;
        });
      }
      if (matched.length === 0) {
        res.errors.push(`Работник «${fioQuery || 'СНИЛС ' + snilsQuery}» не найден в организации.`);
      } else {
        if (matched.length > 1) {
          res.warnings.push('Найдено несколько работников с таким ФИО — выбран первый. Уточните импорт через СНИЛС.');
        }
        res.data.employee_id = matched[0].id;
        res.title = `Протокол № ${protocolNumber} (${matched[0].last_name} ${matched[0].first_name})`;
      }
    }

    if (res.errors.length > 0) {
      res.action = 'reject';
      results.push(res);
      return;
    }

    if (targetLe) {
      const existingMatch = existingProtocols.find(
        p =>
          p.status === 'active' &&
          p.legal_entity_id === targetLe!.id &&
          ciCompare(p.protocol_number) === ciCompare(protocolNumber) &&
          p.employee_id === res.data.employee_id
      );
      if (existingMatch) {
        if (mode === 'update') {
          res.action = 'update';
          res.changes.push(`Протокол № ${protocolNumber} для работника найден. Результаты будут обновлены.`);
        } else {
          res.action = 'skip';
          res.warnings.push(`Протокол № ${protocolNumber} уже зарегистрирован для данного работника — строка будет пропущена.`);
        }
      } else {
        res.action = 'add';
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

  return { results, structure_errors: [], summary };
}
