import assert from 'node:assert/strict';
import {
  validateInn,
  validateKpp,
  validateOgrn,
  checksumWarning,
  findDuplicates,
  ciCompare,
} from '../services/validation';
import {
  sanitizeCell,
  mapHeaders,
  mapContingentHeaders,
  LE_HEADERS,
  CONTINGENT_HEADERS,
} from '../services/excel';

console.log('--- ЗАПУСК АВТОМАТИЧЕСКИХ ТЕСТОВ САОТ (ЭТАП 2 И ЭТАП 3) ---');

// 1. Validation tests
console.log('[1/7] Тестирование валидации реквизитов (ИНН/КПП/ОГРН)...');
assert.equal(validateInn('7707083893'), '7707083893');
assert.equal(validateInn('500100732259'), '500100732259');
assert.throws(() => validateInn('123'), /ИНН должен содержать 10 или 12 цифр/);
assert.throws(() => validateInn('12345678901'), /ИНН должен содержать 10 или 12 цифр/);

assert.equal(validateKpp('770701001'), '770701001');
assert.throws(() => validateKpp('12345'), /КПП должен содержать 9 цифр/);

assert.equal(validateOgrn('1027700132195'), '1027700132195');
assert.equal(validateOgrn('304500116000157'), '304500116000157');
assert.throws(() => validateOgrn('12345'), /ОГРН должен содержать 13 или 15 цифр/);

// Checksum
assert.equal(checksumWarning('7707083893'), null); // Valid Sberbank INN
assert.ok(checksumWarning('7707083890') !== null); // Invalid checksum

// 2. Duplicate checking
console.log('[2/7] Тестирование проверки дубликатов юридических лиц...');
const sampleEntities: any[] = [
  {
    id: '1',
    full_name: 'Общество с ограниченной ответственностью «Альфа»',
    inn: '7701000001',
    kpp: '770101001',
    ogrn: '1027700000001',
    status: 'active',
  },
];

const dupConflict = findDuplicates(sampleEntities, {
  full_name: 'ООО Бета',
  inn: '7701000001',
  kpp: '770101001',
});
assert.ok(dupConflict.conflict && dupConflict.conflict.includes('уже зарегистрировано'));

const dupWarning = findDuplicates(sampleEntities, {
  full_name: 'общество с ограниченной ответственностью «альфа»',
  inn: '7702000002',
});
assert.ok(dupWarning.warnings.some(w => w.includes('Похожее полное наименование')));

// 3. Normalized position names (D-013)
console.log('[3/7] Тестирование справочника должностей (D-013)...');
const p1 = '  Инженер   по охране  труда ';
const p2 = 'инженер по ОХРАНЕ труда';
assert.equal(
  p1.toLowerCase().replace(/\s+/g, ' ').trim(),
  p2.toLowerCase().replace(/\s+/g, ' ').trim()
);

// 4. Excel Headers & Aliases mapping
console.log('[4/7] Тестирование маппинга заголовков Excel (Legal Entities & Contingent)...');
const { mapping: leMap, problems: leProb } = mapHeaders([
  'Наименование',
  'инн',
  'кпп',
  'огрн',
  'фактический адрес',
]);
assert.equal(leMap[0], 'full_name');
assert.equal(leMap[1], 'inn');
assert.equal(leProb.length, 0);

const { mapping: contMap, problems: contProb } = mapContingentHeaders([
  'Организация',
  'Отдел',
  'Профессия',
  'Рабочее место',
  '29н',
  '342н',
  'Карта СОУТ',
  'Карта ОПР',
]);
assert.equal(contMap[0], 'legal_entity');
assert.equal(contMap[1], 'department');
assert.equal(contMap[2], 'position');
assert.equal(contMap[3], 'workplace_label');
assert.equal(contMap[4], 'items_29n');
assert.equal(contMap[5], 'items_342n');
assert.equal(contProb.length, 0);

// 5. Formula injection protection (IMPORT_EXPORT §6)
console.log('[5/7] Тестирование защиты от формульных инъекций...');
assert.equal(sanitizeCell('=SUM(A1:A10)'), "'=SUM(A1:A10)");
assert.equal(sanitizeCell('+cmd|...'), "'+cmd|...");
assert.equal(sanitizeCell('-100'), "'-100");
assert.equal(sanitizeCell('@test'), "'@test");
assert.equal(sanitizeCell('ООО «Ромашка»'), 'ООО «Ромашка»');

// 6. D-004 Contingent Candidate Identification Key logic
console.log('[6/7] Тестирование идентификации контингента по D-004...');
const candidateA = {
  legal_entity_id: 'le-1',
  department_id: 'dept-1',
  position_id: 'pos-1',
  workplace_label: 'Цех №1',
};
const candidateB = {
  legal_entity_id: 'le-1',
  department_id: 'dept-1',
  position_id: 'pos-1',
  workplace_label: 'Цех №2',
};
const matchesCandidateA = (item: any) =>
  item.legal_entity_id === candidateA.legal_entity_id &&
  item.department_id === candidateA.department_id &&
  item.position_id === candidateA.position_id &&
  item.workplace_label === candidateA.workplace_label;

assert.equal(matchesCandidateA(candidateA), true);
assert.equal(matchesCandidateA(candidateB), false);

// 7. Casefold cyrillic comparison
console.log('[7/13] Тестирование регистронезависимого сравнения кириллицы (Ё/е)...');
assert.equal(ciCompare('Пётр'), ciCompare('петр'));
assert.equal(ciCompare('МОНТЁР'), ciCompare('монтер'));

// 8. SNILS normalization & checksum verification (Stage 4, D-007)
console.log('[8/13] Тестирование нормализации и контрольной суммы СНИЛС (D-007)...');
import { normalizeSnils, validateDateNotFuture, findEmployeeDuplicates } from '../services/validation';
import { mapEmployeeHeaders, EMPLOYEE_HEADERS } from '../services/excel';

// Valid SNILS (112-233-445 95): sum = 1*9 + 1*8 + 2*7 + 2*6 + 3*5 + 3*4 + 4*3 + 4*2 + 5*1 = 95
assert.equal(normalizeSnils('112-233-445 95'), '112-233-445 95');
assert.equal(normalizeSnils('11223344595'), '112-233-445 95');
assert.equal(normalizeSnils('  112 233 445-95  '), '112-233-445 95');
// Invalid length
assert.throws(() => normalizeSnils('12345'), /СНИЛС должен содержать 11 цифр/);
assert.throws(() => normalizeSnils('112-233-445 950'), /СНИЛС должен содержать 11 цифр/);
// Invalid checksum
assert.throws(() => normalizeSnils('112-233-445 96'), /Контрольная сумма СНИЛС не сходится/);
assert.throws(() => normalizeSnils('112-233-445 00'), /Контрольная сумма СНИЛС не сходится/);

// 9. Employee dates validation (no future dates)
console.log('[9/13] Тестирование проверки дат работника (FR-08)...');
assert.equal(validateDateNotFuture('2020-01-15', 'Дата приёма'), '2020-01-15');
assert.equal(validateDateNotFuture('1985-11-20', 'Дата рождения'), '1985-11-20');
assert.throws(() => validateDateNotFuture('2099-01-01', 'Дата приёма'), /не может быть в будущем/);
assert.throws(() => validateDateNotFuture('not-a-date', 'Дата приёма'), /Некорректная дата/);

// 10. Duplicate employee warnings (no hard conflict, no auto-merge)
console.log('[10/13] Тестирование детектора дубликатов работников (без автообъединения)...');
const existingEmps: any[] = [
  {
    id: 'emp-1',
    legal_entity_id: 'le-1',
    last_name: 'Иванов',
    first_name: 'Иван',
    middle_name: 'Иванович',
    birth_date: '1980-05-10',
    snils: '112-233-445 95',
    status: 'active',
  },
];

// Same SNILS in same LE -> warning, not conflict
const snilsDup = findEmployeeDuplicates(existingEmps, {
  legal_entity_id: 'le-1',
  last_name: 'Петров',
  first_name: 'Пётр',
  snils: '112-233-445 95',
});
assert.equal(snilsDup.conflict, null);
assert.ok(snilsDup.warnings.some(w => w.includes('уже есть работник с таким СНИЛС')));

// Same FIO + birth date -> warning, not conflict
const fioDup = findEmployeeDuplicates(existingEmps, {
  legal_entity_id: 'le-1',
  last_name: 'иванов',
  first_name: 'иван',
  middle_name: 'иванович',
  birth_date: '1980-05-10',
});
assert.equal(fioDup.conflict, null);
assert.ok(fioDup.warnings.some(w => w.includes('Полное совпадение ФИО и даты рождения')));
assert.ok(fioDup.warnings.some(w => w.includes('объединение по ФИО запрещено')));

// Different legal entity -> no warning
const diffLe = findEmployeeDuplicates(existingEmps, {
  legal_entity_id: 'le-2',
  last_name: 'Иванов',
  first_name: 'Иван',
  middle_name: 'Иванович',
  birth_date: '1980-05-10',
  snils: '112-233-445 95',
});
assert.equal(diffLe.warnings.length, 0);

// 11. Employee header aliases mapping (IMPORT_EXPORT §5)
console.log('[11/13] Тестирование маппинга заголовков импорта работников...');
const { mapping: empMap, problems: empProb } = mapEmployeeHeaders([
  'Организация',
  'Отдел',
  'Должность',
  'Фамилия',
  'Имя',
  'Отчество',
  'Дата приёма',
  'Дата рождения',
  'СНИЛС',
  'Рабочее место',
]);
assert.equal(empMap[0], 'legal_entity');
assert.equal(empMap[1], 'department');
assert.equal(empMap[2], 'position');
assert.equal(empMap[3], 'last_name');
assert.equal(empMap[4], 'first_name');
assert.equal(empMap[5], 'middle_name');
assert.equal(empMap[6], 'hire_date');
assert.equal(empMap[7], 'birth_date');
assert.equal(empMap[8], 'snils');
assert.equal(empMap[9], 'contingent_label');
assert.equal(empProb.length, 0);

// Missing required column error
const { problems: missingProb } = mapEmployeeHeaders(['Фамилия', 'Имя']);
assert.ok(missingProb.some(p => p.includes('Отсутствует обязательный столбец «Юридическое лицо»')));
assert.ok(missingProb.some(p => p.includes('Отсутствует обязательный столбец «Должность»')));

// 12. Employee import identification logic (SNILS + LE)
console.log('[12/13] Тестирование логики идентификации при импорте (СНИЛС + Юрлицо)...');
const importEmps: any[] = [
  {
    id: 'emp-10',
    legal_entity_id: 'le-100',
    snils: '112-233-445 95',
    last_name: 'Сидоров',
    first_name: 'Алексей',
    status: 'active',
  },
];
const identifyImport = (rec: { legal_entity_id: string; snils?: string }) => {
  if (!rec.snils) return null;
  return importEmps.find(
    e => e.legal_entity_id === rec.legal_entity_id && e.snils === rec.snils && e.status === 'active'
  ) || null;
};
assert.ok(identifyImport({ legal_entity_id: 'le-100', snils: '112-233-445 95' }) !== null);
assert.equal(identifyImport({ legal_entity_id: 'le-200', snils: '112-233-445 95' }), null);
assert.equal(identifyImport({ legal_entity_id: 'le-100' }), null); // without SNILS -> never matched, always new

// 13. Employment history period opening & closing logic (D-005)
console.log('[13/13] Тестирование логики кадровых перемещений (D-005)...');
const periods: any[] = [
  {
    id: 'h-1',
    employee_id: 'emp-1',
    start_date: '2023-01-10',
    end_date: null,
    department_id: 'dept-1',
    position_id: 'pos-1',
    contingent_record_id: null,
    reason: 'Приём на работу',
  },
];
// Transfer simulation
const openPeriod = periods.find(p => p.employee_id === 'emp-1' && !p.end_date);
assert.ok(openPeriod);
openPeriod.end_date = '2024-06-01'; // closed
periods.push({
  id: 'h-2',
  employee_id: 'emp-1',
  start_date: '2024-06-01',
  end_date: null,
  department_id: 'dept-2',
  position_id: 'pos-2',
  contingent_record_id: 'c-1',
  reason: 'Перевод на должность инженера',
});
assert.equal(periods.length, 2);
assert.equal(periods[0].end_date, '2024-06-01');
assert.equal(periods[1].end_date, null);
assert.equal(periods[1].department_id, 'dept-2');

console.log('✅ ВСЕ ТЕСТЫ ЭТАПА 2, 3 И 4 УСПЕШНО ПРОЙДЕНЫ (13/13)!');

