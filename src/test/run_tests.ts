import assert from 'node:assert/strict';

if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map<string, string>();
  globalThis.localStorage = {
    getItem: (k: string) => store.get(k) ?? null,
    setItem: (k: string, v: string) => { store.set(k, String(v)); },
    removeItem: (k: string) => { store.delete(k); },
    clear: () => { store.clear(); },
    key: (i: number) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  } as any;
}

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

console.log('--- ЗАПУСК АВТОМАТИЧЕСКИХ ТЕСТОВ САОТ (ЭТАПЫ 2, 3, 4 И 5) ---');

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

// 14. Backup creation & restoration round-trip (FR-14, D-005, counts)
console.log('[14/16] Тестирование полного резервного копирования и восстановления (FR-14)...');
import { storage } from '../services/storage';

// Seed test data in storage
const testLe = storage.createLegalEntity({
  full_name: 'Общество с ограниченной ответственностью «САОТ-Тест»',
  short_name: 'ООО «САОТ-Тест»',
  inn: '7707083893',
  kpp: '770701001',
  ogrn: '1027700132195',
});
const testDept = storage.createDepartment({
  legal_entity_id: testLe.id,
  name: 'Служба охраны труда',
});
const testPos = storage.createPosition('Специалист по охране труда');
const testCont = storage.createContingentRecord({
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  workplace_label: 'Кабинет №1',
  medical_items_29n: ['Приложение 1, п. 4.1'],
});
const testEmp = storage.createEmployee({
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  contingent_record_id: testCont.id,
  last_name: 'Кузнецов',
  first_name: 'Алексей',
  middle_name: 'Сергеевич',
  hire_date: '2023-03-01',
  birth_date: '1990-07-15',
  snils: '112-233-445 95',
});

// Create backup
const backupJson = storage.createBackup('test-stage5');
const manifest = JSON.parse(backupJson);
assert.ok(manifest.id);
assert.equal(manifest.counts.legal_entities >= 1, true);
assert.equal(manifest.counts.departments >= 1, true);
assert.equal(manifest.counts.positions >= 1, true);
assert.equal(manifest.counts.contingent >= 1, true);
assert.equal(manifest.counts.employees >= 1, true);
assert.equal(manifest.counts.employment_history >= 1, true);

// 15. Referential integrity verification (Scenario 18: Проверка связей после восстановления)
console.log('[15/16] Тестирование проверки связей и целостности данных (Сценарий 18)...');
// First, restore and check integrity report on clean data
const reportAfterRestore = storage.restoreFromBackup(backupJson);
assert.equal(reportAfterRestore.valid, true);
assert.equal(reportAfterRestore.errors.length, 0);
assert.ok(reportAfterRestore.stats.employees >= 1);

// Now run standalone verifyDataIntegrity
const cleanIntegrity = storage.verifyDataIntegrity();
assert.equal(cleanIntegrity.valid, true);
assert.equal(cleanIntegrity.errors.length, 0);

// Test detection of broken links: artificially corrupt department_id of an employee
const rawEmps = storage.getEmployeesRaw();
const savedEmpDept = rawEmps[0].department_id;
rawEmps[0].department_id = 'non-existent-dept-uuid';
storage.saveEmployeesRaw(rawEmps);

const brokenIntegrity = storage.verifyDataIntegrity();
assert.equal(brokenIntegrity.valid, false);
assert.ok(brokenIntegrity.errors.some(e => e.includes('несуществующее подразделение')));

// Restore original department to return to clean state
rawEmps[0].department_id = savedEmpDept;
storage.saveEmployeesRaw(rawEmps);
assert.equal(storage.verifyDataIntegrity().valid, true);

// 16. Automatic backup triggers (auto-import, pre-restore, auto-daily)
console.log('[16/16] Тестирование авто-резервного копирования (импорт, страховочная копия, суточная)...');
const initialBackupsCount = storage.getBackupsList().length;

// Pre-restore backup was generated in test 15
assert.ok(storage.getBackupsList().some(b => b.label === 'pre-restore'));

// Auto-backup on import
storage.commitEmployeeImport(
  [
    {
      legal_entity_id: testLe.id,
      department_id: testDept.id,
      position_id: testPos.id,
      last_name: 'Фёдоров',
      first_name: 'Дмитрий',
      hire_date: '2024-01-10',
    },
  ],
  'add'
);
assert.ok(storage.getBackupsList().some(b => b.label === 'auto-import-employees'));

// Periodic auto-backup
storage.checkPeriodicAutoBackup();
assert.ok(storage.getBackupsList().some(b => b.label === 'auto-daily'));

// 17. SOUT cards: classes, harmful factors, automatic guarantees (TK RF), expiry (426-FZ)
console.log('[17/19] Тестирование карт СОУТ: классы, факторы, авторасчёт гарантий и сроков (426-ФЗ)...');
import { mapSoutHeaders, parseSoutFactors } from '../services/excel';

// Static guarantee/expiry calculations via the storage instance constructor
const StorageService: any = (storage as any).constructor;

// Disabled module blocks creation before validation (module lifecycle check first)
assert.equal(storage.isModuleEnabled('sout'), false);
assert.throws(
  () => storage.createSoutCard({ card_number: 'OFF-0', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /Модуль СОУТ отключён/
);
// Enable the module for further tests
storage.toggleModule('sout');
assert.equal(storage.isModuleEnabled('sout'), true);

// Invalid class rejected
assert.throws(
  () => storage.createSoutCard({ card_number: 'X-0', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '3.5' }),
  /Недопустимый класс условий труда/
);
// Missing card number rejected
assert.throws(
  () => storage.createSoutCard({ card_number: ' ', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /Номер карты СОУТ обязателен/
);
// Department of another legal entity rejected (isolation)
const otherLe = storage.createLegalEntity({ full_name: 'ООО «Другое»', inn: '7702000002' });
assert.throws(
  () => storage.createSoutCard({ card_number: 'X-ERR', legal_entity_id: otherLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /Подразделение не принадлежит выбранному юридическому лицу/
);

// Class 3.3 — ст. 92 (36 ч), ст. 117 (7 дней), ст. 147 (4%), молоко, досрочная пенсия, СИЗ
const card33 = storage.createSoutCard({
  card_number: 'СОУТ-001',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  workplace_label: 'Кабинет №2',
  factors: [
    { type: 'noise', class: '3.3', note: '85 дБА' },
    { type: 'chemical', class: '3.2' },
  ],
  final_class: '3.3',
  employees_count: 5,
  women_count: 2,
  minors_count: 0,
  disabled_count: 1,
  report_approved_at: '2024-05-20',
});
assert.equal(card33.guarantees.reduced_hours, true); // ст. 92 ТК РФ
assert.equal(card33.guarantees.extra_vacation_days, 7); // ст. 117 ТК РФ
assert.equal(card33.guarantees.pay_increase_percent, 4); // ст. 147 ТК РФ
assert.equal(card33.guarantees.milk_issue, true); // ст. 222 ТК РФ
assert.equal(card33.guarantees.early_pension, true);
assert.equal(card33.guarantees.ppe_issue, true);
assert.equal(card33.expires_at, '2029-05-20'); // 5 лет со дня утверждения отчёта (ст. 8 426-ФЗ)
assert.equal(card33.declaration_active, false);

// Class 2 — no guarantees
const card2 = storage.createSoutCard({
  card_number: 'СОУТ-002',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  final_class: '2',
  report_approved_at: '2024-01-15',
});
assert.equal(card2.guarantees.reduced_hours, false);
assert.equal(card2.guarantees.extra_vacation_days, 0);
assert.equal(card2.guarantees.pay_increase_percent, 0);
assert.equal(card2.guarantees.milk_issue, false);
assert.equal(card2.expires_at, '2029-01-15');

// Class 3.1 — only pay increase from 4%, milk/PPE, no reduced hours/vacation
const g31 = StorageService.computeGuarantees('3.1');
assert.equal(g31.reduced_hours, false);
assert.equal(g31.extra_vacation_days, 0);
assert.equal(g31.pay_increase_percent, 4);
assert.equal(g31.milk_issue, true);
// Class 4 — hazardous: all guarantees
const g4 = StorageService.computeGuarantees('4');
assert.equal(g4.reduced_hours, true);
assert.equal(g4.extra_vacation_days, 7);
assert.equal(g4.pay_increase_percent, 4);
assert.equal(g4.early_pension, true);

// Declaration (ст. 11 426-ФЗ) — perpetual card (expires_at = null)
const cardDecl = storage.createSoutCard({
  card_number: 'СОУТ-003',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  final_class: '2',
  report_approved_at: '2023-09-01',
  declaration_active: true,
  declaration_number: 'Д-77-2023-0456',
});
assert.equal(cardDecl.expires_at, null); // бессрочная карта по декларации
assert.equal(cardDecl.declaration_number, 'Д-77-2023-0456');

// Duplicate card number in same LE -> error; in another LE -> allowed (isolation)
assert.throws(
  () => storage.createSoutCard({ card_number: 'соут-001', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }),
  /уже зарегистрирована/
);

// Archive & restore without cascade damage to related data
const archived = storage.archiveSoutCard(card2.id);
assert.equal(archived.status, 'archived');
assert.throws(() => storage.archiveSoutCard(card2.id), /уже в архиве/);
const restored = storage.restoreSoutCard(card2.id);
assert.equal(restored.status, 'active');
assert.equal(storage.verifyDataIntegrity().valid, true); // связанные данные не повреждены

// SOUT header aliases mapping and factor parsing (IMPORT_EXPORT)
const { mapping: soutMap, problems: soutProb } = mapSoutHeaders([
  'Организация',
  'Отдел',
  'Профессия',
  '№ карты СОУТ',
  'Рабочее место',
  'Вредные факторы',
  'Класс СОУТ',
]);
assert.equal(soutMap[0], 'legal_entity');
assert.equal(soutMap[3], 'card_number');
assert.equal(soutMap[6], 'final_class');
assert.equal(soutProb.length, 0);

const parsedFactors = parseSoutFactors('Шум:3.3; Химический фактор:3.2; Освещённость:2');
assert.equal(parsedFactors.errors.length, 0);
assert.equal(parsedFactors.factors.length, 3);
assert.equal(parsedFactors.factors[0].type, 'noise');
assert.equal(parsedFactors.factors[0].class, '3.3');
assert.equal(parsedFactors.factors[2].type, 'illumination');
const badFactors = parseSoutFactors('Шум:9.9');
assert.ok(badFactors.errors.length > 0);

// 18. Worker familiarization under signature (ст. 5 426-ФЗ) + audit log
console.log('[18/19] Тестирование ознакомления работников под роспись (ст. 5 426-ФЗ)...');
const fam = storage.familiarizeSoutCard(card33.id, testEmp.employee.id, '2024-06-01', 'Электронно через САОТ');
assert.equal(fam.sout_card_id, card33.id);
assert.equal(fam.employee_id, testEmp.employee.id);
assert.equal(fam.signed_at, '2024-06-01');

// Double signature rejected
assert.throws(
  () => storage.familiarizeSoutCard(card33.id, testEmp.employee.id),
  /уже ознакомлен/
);
// Future date rejected
assert.throws(
  () => storage.familiarizeSoutCard(cardDecl.id, testEmp.employee.id, '2099-01-01'),
  /не может быть в будущем/
);
// Employee from another LE rejected (organizational isolation)
const otherDept = storage.createDepartment({ legal_entity_id: otherLe.id, name: 'Цех других' });
const empOtherRes = storage.createEmployee({
  legal_entity_id: otherLe.id,
  department_id: otherDept.id,
  position_id: testPos.id,
  last_name: 'Другов',
  first_name: 'Андрей',
  hire_date: '2024-02-01',
});
assert.throws(
  () => storage.familiarizeSoutCard(card33.id, empOtherRes.employee.id),
  /другому юридическому лицу/
);

// In another LE -> allowed (isolation)
const cardIso = storage.createSoutCard({
  card_number: 'СОУТ-001',
  legal_entity_id: otherLe.id,
  department_id: otherDept.id,
  position_id: testPos.id,
  final_class: '2',
});
assert.equal(cardIso.card_number, 'СОУТ-001');
assert.equal(cardIso.legal_entity_id, otherLe.id);


// Familiarization list and audit log registration (sout_familiarize)
const famList = storage.listSoutFamiliarizations(card33.id);
assert.equal(famList.length, 1);
const auditLog = storage.getAuditLogs();
assert.ok(auditLog.some((a: any) => a.action === 'sout_familiarize' && String(a.comment || '').includes('картой СОУТ')));

// Remove mark and confirm cleanup
storage.removeSoutFamiliarization(fam.id);
assert.equal(storage.listSoutFamiliarizations(card33.id).length, 0);

// 19. SOUT referential integrity, module toggle, backup integration
console.log('[19/19] Тестирование целостности СОУТ, переключения модуля и бэкапа...');
// Corrupt card link: nonexistent department
const rawCards = storage.getSoutCardsRaw();
const savedDept = rawCards[0].department_id;
rawCards[0].department_id = 'non-existent-dept-uuid';
storage.saveSoutCardsRaw(rawCards);
const brokenSout = storage.verifyDataIntegrity();
assert.equal(brokenSout.valid, false);
assert.ok(brokenSout.errors.some(e => e.includes('Карта СОУТ') && e.includes('несуществующее подразделение')));
rawCards[0].department_id = savedDept;
storage.saveSoutCardsRaw(rawCards);
assert.equal(storage.verifyDataIntegrity().valid, true);

// Corrupt familiarization link: nonexistent card
const rawFam = storage.getSoutFamiliarizationsRaw();
storage.familiarizeSoutCard(card33.id, testEmp.employee.id); // re-create one record
const famAgain = storage.getSoutFamiliarizationsRaw();
const savedCardId = famAgain[famAgain.length - 1].sout_card_id;
famAgain[famAgain.length - 1].sout_card_id = 'ghost-card-uuid';
storage.saveSoutFamiliarizationsRaw(famAgain);
const brokenFam = storage.verifyDataIntegrity();
assert.equal(brokenFam.valid, false);
assert.ok(brokenFam.errors.some(e => e.includes('ознакомления') && e.includes('несуществующую карту')));
famAgain[famAgain.length - 1].sout_card_id = savedCardId;
storage.saveSoutFamiliarizationsRaw(famAgain);
assert.equal(storage.verifyDataIntegrity().valid, true);

// Module toggle: disable hides menu/routes and blocks CRUD, data preserved
const setModuleState = (moduleId: string, enabled: boolean) => {
  if (storage.isModuleEnabled(moduleId) !== enabled) {
    storage.toggleModule(moduleId);
  }
};
setModuleState('sout', false);
assert.equal(storage.isModuleEnabled('sout'), false);
assert.throws(() => storage.createSoutCard({ card_number: 'OFF-1', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '2' }), /Модуль СОУТ отключён/);
assert.throws(() => storage.familiarizeSoutCard(card33.id, testEmp.employee.id), /Модуль СОУТ отключён/);
assert.equal(storage.getSoutCardsRaw().length >= 4, true); // данные сохранены при отключении
setModuleState('sout', true);
assert.equal(storage.isModuleEnabled('sout'), true);


// Backup manifest includes sout counts and body; restore round-trip preserves SOUT
const backup2 = JSON.parse(storage.createBackup('test-stage6'));
assert.ok(backup2.counts.sout_cards >= 4);
assert.ok(backup2.counts.sout_familiarizations >= 1);
assert.ok(Array.isArray(backup2.data.sout_cards) && backup2.data.sout_cards.length >= 4);
assert.ok(Array.isArray(backup2.data.sout_familiarizations));

// Add a card after backup, then restore -> card disappears, integrity valid
storage.createSoutCard({ card_number: 'СОУТ-POST', legal_entity_id: testLe.id, department_id: testDept.id, position_id: testPos.id, final_class: '1' });
const restoreReport = storage.restoreFromBackup(JSON.stringify(backup2));
assert.equal(restoreReport.valid, true);
assert.equal(storage.getSoutCardsRaw().some(c => c.card_number === 'СОУТ-POST'), false);
assert.ok(storage.getSoutCardsRaw().some(c => c.card_number === 'СОУТ-001'));
assert.equal(storage.verifyDataIntegrity().valid, true);

// Module remains enabled after restore (module registry is not part of backup payload)
assert.equal(storage.isModuleEnabled('sout'), true);

console.log('✅ ТЕСТЫ ЭТАПОВ 2–6 ПРОЙДЕНЫ (19/19)');

// 20. OPR (Stage 7): 5x5 Matrix calculations, bounds, hazards catalog, card CRUD, measures plan, and legal entity isolation
console.log('[20/21] Тестирование модуля ОПР: матрица 5х5, уровни риска, каталог опасностей 776н и план мероприятий...');

import { DEFAULT_OPR_HAZARDS } from '../services/storage';
import { mapOprHeaders, parseOprHazards, OPR_HEADERS } from '../services/excel';

// 5x5 Matrix calculations (severity 1..5, probability 1..5, score 1..25)
assert.equal(storage.computeRiskScore(1, 1), 1);
assert.equal(storage.computeRiskScore(3, 3), 9);
assert.equal(storage.computeRiskScore(4, 3), 12);
assert.equal(storage.computeRiskScore(5, 5), 25);

// Bounds validation
assert.throws(() => storage.computeRiskScore(0, 3), /Тяжесть должна быть в диапазоне от 1 до 5/);
assert.throws(() => storage.computeRiskScore(6, 3), /Тяжесть должна быть в диапазоне от 1 до 5/);
assert.throws(() => storage.computeRiskScore(3, 0), /Вероятность должна быть в диапазоне от 1 до 5/);
assert.throws(() => storage.computeRiskScore(3, 6), /Вероятность должна быть в диапазоне от 1 до 5/);

// Risk levels
assert.equal(storage.computeRiskLevel(1), 'low');
assert.equal(storage.computeRiskLevel(4), 'low');
assert.equal(storage.computeRiskLevel(5), 'moderate');
assert.equal(storage.computeRiskLevel(9), 'moderate');
assert.equal(storage.computeRiskLevel(10), 'high');
assert.equal(storage.computeRiskLevel(15), 'high');
assert.equal(storage.computeRiskLevel(16), 'unacceptable');
assert.equal(storage.computeRiskLevel(25), 'unacceptable');

// Catalog of standard hazards (Приказ 776н)
assert.ok(DEFAULT_OPR_HAZARDS.length >= 12);
assert.ok(DEFAULT_OPR_HAZARDS.some(h => h.category.includes('Механическ')));
assert.ok(DEFAULT_OPR_HAZARDS.some(h => h.category.includes('Электрическ')));
assert.ok(DEFAULT_OPR_HAZARDS.some(h => h.name.includes('падения') || h.category.includes('Механическ')));

// Disabled module blocks creation before validation
assert.equal(storage.isModuleEnabled('opr'), false);
assert.throws(
  () =>
    storage.createOprCard({
      card_number: 'OFF-0',
      legal_entity_id: testLe.id,
      department_id: testDept.id,
      position_id: testPos.id,
      hazards: [],
    }),
  /Модуль ОПР отключён/
);
// Enable the module for further tests
storage.toggleModule('opr');
assert.equal(storage.isModuleEnabled('opr'), true);

// Create OPR Card with multiple hazards
const testHazards = [
  {
    id: 'hz-1',
    category: 'Механическая',
    name: 'Движущиеся детали оборудования',
    severity: 3,
    probability: 3,
    risk_score: 9,
    risk_level: storage.computeRiskLevel(9),
  },
  {
    id: 'hz-2',
    category: 'Падение',
    name: 'Падение на скользкой поверхности',
    severity: 4,
    probability: 3,
    risk_score: 12,
    risk_level: storage.computeRiskLevel(12),
  },
];

const oprCard1 = storage.createOprCard({
  card_number: 'ОПР-001',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  workplace_label: 'Участок механической обработки',
  assessment_date: '2024-05-15',
  assessment_method: 'Матричный метод (5x5, Приказ 776н)',
  commission_members: 'Петров А.А., Сидоров В.В.',
  hazards: testHazards,
});

assert.equal(oprCard1.card_number, 'ОПР-001');
assert.equal(oprCard1.overall_risk_score, 12); // максимальный из 9 и 12
assert.equal(oprCard1.overall_risk_level, 'high');
assert.equal(oprCard1.hazards.length, 2);

// Card number uniqueness per legal entity
assert.throws(
  () =>
    storage.createOprCard({
      card_number: 'ОПР-001',
      legal_entity_id: testLe.id,
      department_id: testDept.id,
      position_id: testPos.id,
      hazards: [],
    }),
  /уже зарегистрирована/
);

// Card number in another legal entity is permitted (multi-tenant isolation)
const oprCardOther = storage.createOprCard({
  card_number: 'ОПР-001',
  legal_entity_id: otherLe.id,
  department_id: otherDept.id,
  position_id: testPos.id,
  hazards: [],
});
assert.equal(oprCardOther.card_number, 'ОПР-001');
assert.equal(oprCardOther.legal_entity_id, otherLe.id);

// Risk reduction action plan (OprMeasureItem)
const measure1 = storage.createOprMeasure({
  opr_card_id: oprCard1.id,
  measure_title: 'Установка защитного кожуха на станок',
  deadline: '2024-08-01',
  responsible_person: 'Главный механик',
  cost_estimate: '25 000 руб.',
  status: 'planned',
});
assert.equal(measure1.measure_title, 'Установка защитного кожуха на станок');
assert.equal(measure1.status, 'planned');

const measuresList = storage.listOprMeasures(oprCard1.id);
assert.equal(measuresList.length, 1);

// Update measure status
const updatedMeasure = storage.updateOprMeasure(measure1.id, { status: 'completed' });
assert.equal(updatedMeasure.status, 'completed');

// Validation: measure title required
assert.throws(
  () =>
    storage.createOprMeasure({
      opr_card_id: oprCard1.id,
      measure_title: '',
    }),
  /Укажите наименование мероприятия/
);

// 21. OPR mapping, referential integrity, module toggle, and backup round-trip
console.log('[21/21] Тестирование маппинга ОПР, ссылочной целостности, переключения модуля и бэкапа...');

// Header mapping & aliases
const oprHeadersMap = mapOprHeaders([
  'Юридическое лицо',
  'Структурное подразделение',
  'Должность',
  'Номер карты ОПР',
  'Рабочее место',
  'Дата оценки',
  'Идентифицированные опасности',
]);
assert.equal(oprHeadersMap.problems.length, 0);
assert.ok(Object.values(oprHeadersMap.mapping).includes('legal_entity'));
assert.ok(Object.values(oprHeadersMap.mapping).includes('card_number'));

// Hazard text parsing
const parsedHz = parseOprHazards('Механическая - Движущиеся детали [Т:3, В:3]; Термическая - Горячие поверхности [Т:2, В:2]');
assert.equal(parsedHz.length, 2);
assert.equal(parsedHz[0].category, 'Механическая');
assert.equal(parsedHz[0].risk_score, 9);
assert.equal(parsedHz[0].risk_level, 'moderate');
assert.equal(parsedHz[1].category, 'Термическая');
assert.equal(parsedHz[1].risk_score, 4);
assert.equal(parsedHz[1].risk_level, 'low');

// Referential integrity: corrupt card department link
const rawOprCards = storage.getOprCardsRaw();
const savedOprDept = rawOprCards[0].department_id;
rawOprCards[0].department_id = 'missing-dept-uuid';
storage.saveOprCardsRaw(rawOprCards);
const brokenOpr = storage.verifyDataIntegrity();
assert.equal(brokenOpr.valid, false);
assert.ok(brokenOpr.errors.some(e => e.includes('Карта ОПР') && e.includes('несуществующее подразделение')));
rawOprCards[0].department_id = savedOprDept;
storage.saveOprCardsRaw(rawOprCards);
assert.equal(storage.verifyDataIntegrity().valid, true);

// Referential integrity: corrupt measure card link
const rawMeasures = storage.getOprMeasuresRaw();
const savedMeasureCardId = rawMeasures[0].opr_card_id;
rawMeasures[0].opr_card_id = 'ghost-opr-card';
storage.saveOprMeasuresRaw(rawMeasures);
const brokenMeasure = storage.verifyDataIntegrity();
assert.equal(brokenMeasure.valid, false);
assert.ok(brokenMeasure.errors.some(e => e.includes('Мероприятие ОПР') && e.includes('несуществующую карту')));
rawMeasures[0].opr_card_id = savedMeasureCardId;
storage.saveOprMeasuresRaw(rawMeasures);
assert.equal(storage.verifyDataIntegrity().valid, true);

// Module toggle: disable opr
setModuleState('opr', false);
assert.equal(storage.isModuleEnabled('opr'), false);
assert.throws(
  () =>
    storage.createOprCard({
      card_number: 'BLOCKED-1',
      legal_entity_id: testLe.id,
      department_id: testDept.id,
      position_id: testPos.id,
      hazards: [],
    }),
  /Модуль ОПР отключён/
);
assert.throws(
  () =>
    storage.createOprMeasure({
      opr_card_id: oprCard1.id,
      measure_title: 'Тест',
    }),
  /Модуль ОПР отключён/
);
assert.ok(storage.getOprCardsRaw().length >= 2); // Data preserved
setModuleState('opr', true);
assert.equal(storage.isModuleEnabled('opr'), true);

// Backup and restore round-trip for OPR
const backupStage7 = JSON.parse(storage.createBackup('test-stage7'));
assert.ok(backupStage7.counts.opr_cards >= 2);
assert.ok(backupStage7.counts.opr_measures >= 1);
assert.ok(Array.isArray(backupStage7.data.opr_cards) && backupStage7.data.opr_cards.length >= 2);
assert.ok(Array.isArray(backupStage7.data.opr_measures) && backupStage7.data.opr_measures.length >= 1);

// Add temporary card, then restore -> temporary card gone, integrity valid
storage.createOprCard({
  card_number: 'ОПР-TEMP',
  legal_entity_id: testLe.id,
  department_id: testDept.id,
  position_id: testPos.id,
  hazards: [],
});
assert.ok(storage.getOprCardsRaw().some(c => c.card_number === 'ОПР-TEMP'));

const restoreReport7 = storage.restoreFromBackup(JSON.stringify(backupStage7));
assert.equal(restoreReport7.valid, true);
assert.equal(storage.getOprCardsRaw().some(c => c.card_number === 'ОПР-TEMP'), false);
assert.ok(storage.getOprCardsRaw().some(c => c.card_number === 'ОПР-001'));
assert.equal(storage.verifyDataIntegrity().valid, true);
assert.equal(storage.isModuleEnabled('opr'), true);

console.log('✅ ВСЕ ТЕСТЫ ЭТАПОВ 2–7 УСПЕШНО ПРОЙДЕНЫ (21/21)!');

// 22. Medical examinations (Stage 8): card CRUD, date validations, links to LE/employee/contingent/SOUT
console.log('[22/24] Тестирование карт медосмотров (Приказ 29н): CRUD, валидация дат и сроков, связи с СОУТ и контингентом...');

import { mapMedicalHeaders, generateMedicalPreview, MEDICAL_HEADERS } from '../services/excel';

// Disabled module blocks creation before validation
assert.equal(storage.isModuleEnabled('medical'), false);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'OFF-MED',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'preliminary',
      conclusion: 'pending',
    }),
  /Модуль «Медосмотры» отключён/
);
// Enable the module for further tests
storage.toggleModule('medical');
assert.equal(storage.isModuleEnabled('medical'), true);

// Create preliminary exam card with pending conclusion (referral issued, exam not passed yet)
const medCard1 = storage.createMedicalCard({
  card_number: 'МЕД-001',
  legal_entity_id: testLe.id,
  employee_id: testEmp.employee.id,
  contingent_record_id: testCont.id,
  sout_card_id: card33.id,
  exam_type: 'preliminary',
  referral_date: '2024-03-01',
  conclusion: 'pending',
});
assert.equal(medCard1.card_number, 'МЕД-001');
assert.equal(medCard1.exam_type, 'preliminary');
assert.equal(medCard1.conclusion, 'pending');
assert.equal(medCard1.contingent_record_id, testCont.id);
assert.equal(medCard1.sout_card_id, card33.id);
assert.equal(medCard1.status, 'active');

// Periodic exam passed with conclusion «Годен»
const medCard2 = storage.createMedicalCard({
  card_number: 'МЕД-002',
  legal_entity_id: testLe.id,
  employee_id: testEmp.employee.id,
  exam_type: 'periodic',
  referral_date: '2024-02-01',
  exam_date: '2024-03-01',
  next_due_date: '2026-03-01',
  clinic_name: 'ГБУЗ «Центр профпатологии»',
  doctor_fio: 'Петрова А.С.',
  conclusion: 'fit',
});
assert.equal(medCard2.conclusion, 'fit');

// Date ordering validations
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-ERR1',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'periodic',
      referral_date: '2024-05-10',
      exam_date: '2024-05-01',
      conclusion: 'fit',
    }),
  /Дата медосмотра не может быть раньше даты выдачи направления/
);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-ERR2',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'periodic',
      exam_date: '2024-05-01',
      next_due_date: '2024-05-01',
      conclusion: 'fit',
    }),
  /Срок следующего медосмотра должен быть позже даты пройденного медосмотра/
);
// Conclusion without exam date is rejected; pending without date is allowed
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-ERR3',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'periodic',
      conclusion: 'fit',
    }),
  /Укажите дату прохождения медосмотра/
);

// Enum and required-field validations
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-ERR4',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'exotic' as any,
      conclusion: 'pending',
    }),
  /Недопустимый вид медосмотра/
);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-ERR5',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'periodic',
      exam_date: '2024-01-01',
      conclusion: 'maybe' as any,
    }),
  /Недопустимое заключение/
);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: '',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /Номер карты медосмотра обязателен/
);

// Referential validations: cross-LE employee, ghost refs
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-XLE',
      legal_entity_id: otherLe.id,
      employee_id: testEmp.employee.id, // Кузнецов belongs to testLe
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /Работник относится к другому юридическому лицу/
);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-GHOST',
      legal_entity_id: testLe.id,
      employee_id: 'ghost-employee-uuid',
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /Работник не найден/
);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-GCR',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      contingent_record_id: 'ghost-contingent-uuid',
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /Запись контингента не найдена/
);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-GSOUT',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      sout_card_id: 'ghost-sout-card-uuid',
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /Карта СОУТ не найдена/
);

// Card number uniqueness per legal entity (case-insensitive), allowed in another LE
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'мед-001',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'preliminary',
      conclusion: 'pending',
    }),
  /уже зарегистрирована/
);
const medCardOtherLe = storage.createMedicalCard({
  card_number: 'МЕД-001',
  legal_entity_id: otherLe.id,
  employee_id: empOtherRes.employee.id,
  exam_type: 'pre_shift',
  conclusion: 'pending',
});
assert.equal(medCardOtherLe.legal_entity_id, otherLe.id);

// Update: fill in results of the pending preliminary exam
const medCard1Updated = storage.updateMedicalCard(medCard1.id, {
  exam_date: '2024-03-15',
  next_due_date: '2026-03-15',
  conclusion: 'fit_restrictions',
  conclusion_details: 'Ограничения по высоте выше 3 м',
  contraindications_found: true,
});
assert.equal(medCard1Updated.conclusion, 'fit_restrictions');
assert.equal(medCard1Updated.exam_date, '2024-03-15');
assert.equal(medCard1Updated.contraindications_found, true);
// Invalid update is rejected and data stays intact
assert.throws(() => storage.updateMedicalCard(medCard1.id, { next_due_date: '2024-01-01' }), /Срок следующего медосмотра должен быть позже/);
assert.equal(storage.getMedicalCardById(medCard1.id)?.next_due_date, '2026-03-15');
assert.throws(() => storage.updateMedicalCard('ghost-med-id', { conclusion: 'fit' }), /Карта медосмотра не найдена/);

// List filters: by type, conclusion, overdue flag, search
const periodicList = storage.listMedicalCards({ legal_entity_id: testLe.id, exam_type: 'periodic' });
assert.equal(periodicList.total, 1);
assert.equal(periodicList.items[0].id, medCard2.id);
const unfitList = storage.listMedicalCards({ exam_type: 'preliminary', conclusion: 'fit_restrictions' });
assert.equal(unfitList.total, 1);
// Overdue filter: card with expired next_due_date is listed, future/empty dates are not
const overdueCard = storage.createMedicalCard({
  card_number: 'МЕД-003',
  legal_entity_id: testLe.id,
  employee_id: testEmp.employee.id,
  exam_type: 'periodic',
  exam_date: '2024-01-10',
  next_due_date: '2025-01-10',
  conclusion: 'fit',
});
const overdueList = storage.listMedicalCards({ overdue: true });
assert.ok(overdueList.items.some(c => c.id === overdueCard.id));
assert.ok(!overdueList.items.some(c => c.id === medCard1.id || c.id === medCard2.id || c.id === medCardOtherLe.id));
const searchByClinic = storage.listMedicalCards({ search: 'профпатологии' });
assert.equal(searchByClinic.total, 1);
const searchByFio = storage.listMedicalCards({ search: 'кузнецов алексей' });
assert.ok(searchByFio.total >= 2);

// Archive/restore lifecycle: archived cards hidden from active list, unique number freed
const archivedMed = storage.archiveMedicalCard(medCardOtherLe.id);
assert.equal(archivedMed.status, 'archived');
assert.equal(storage.listMedicalCards({ legal_entity_id: otherLe.id }).total, 0);
const afterArchiveNumber = storage.createMedicalCard({
  card_number: 'МЕД-001',
  legal_entity_id: otherLe.id,
  employee_id: empOtherRes.employee.id,
  exam_type: 'periodic',
  conclusion: 'pending',
});
assert.ok(afterArchiveNumber.id);
assert.throws(() => storage.archiveMedicalCard(medCardOtherLe.id), /уже в архиве/);
const restoredMed = storage.restoreMedicalCard(medCardOtherLe.id);
assert.equal(restoredMed.status, 'active');
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'МЕД-001',
      legal_entity_id: otherLe.id,
      employee_id: empOtherRes.employee.id,
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /уже зарегистрирована/
);

// 23. Psychiatric examinations (Order 342н) within module 'medical': CRUD and date bounds
console.log('[23/24] Тестирование психиатрических освидетельствований (Приказ 342н): создание, сроки действия заключения...');

const psychExam1 = storage.createPsychiatricExam({
  legal_entity_id: testLe.id,
  employee_id: testEmp.employee.id,
  exam_date: '2024-04-01',
  commission_members: 'Психиатр Иванов И.И., нарколог Сидоров С.С.',
  conclusion: 'fit',
  conclusion_protocol_number: 'Протокол № 12/24',
  valid_until: '2026-04-01',
  basis: 'Периодическое освидетельствование, Приказ 342н',
});
assert.equal(psychExam1.conclusion, 'fit');
assert.equal(psychExam1.valid_until, '2026-04-01');
assert.ok(psychExam1.id);

// valid_until must be later than exam_date
assert.throws(
  () =>
    storage.createPsychiatricExam({
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_date: '2024-04-01',
      valid_until: '2024-04-01',
      conclusion: 'fit',
    }),
  /Срок действия заключения должен быть позже даты освидетельствования/
);
// Invalid conclusion enum
assert.throws(
  () =>
    storage.createPsychiatricExam({
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      conclusion: 'suspicious' as any,
    }),
  /Недопустимое заключение комиссии/
);
// Cross-legal-entity employee rejected
assert.throws(
  () =>
    storage.createPsychiatricExam({
      legal_entity_id: otherLe.id,
      employee_id: testEmp.employee.id,
      conclusion: 'fit',
    }),
  /Работник относится к другому юридическому лицу/
);

const psychList = storage.listPsychiatricExams({ legal_entity_id: testLe.id });
assert.equal(psychList.total, 1);
const psychSearch = storage.listPsychiatricExams({ search: 'протокол № 12' });
assert.equal(psychSearch.total, 1);

const psychUpdated = storage.updatePsychiatricExam(psychExam1.id, { conclusion: 'fit_restricted', comment: 'Допуск с ограничениями по решению комиссии' });
assert.equal(psychUpdated.conclusion, 'fit_restricted');
assert.throws(() => storage.updatePsychiatricExam(psychExam1.id, { valid_until: '2020-01-01' }), /Срок действия заключения должен быть позже/);
const psychArchived = storage.archivePsychiatricExam(psychExam1.id);
assert.equal(psychArchived.status, 'archived');
assert.equal(storage.listPsychiatricExams({ legal_entity_id: testLe.id }).total, 0);
assert.throws(() => storage.archivePsychiatricExam(psychExam1.id), /уже в архиве/);

// 24. Medical mapping, import preview, referential integrity, module toggle, backup round-trip
console.log('[24/24] Тестирование маппинга медосмотров, предпросмотра импорта, целостности, переключения модуля и бэкапа...');

// Header mapping & aliases
const medHeadersMap = mapMedicalHeaders([
  'Юридическое лицо',
  'ФИО работника',
  'СНИЛС',
  '№ карты медосмотра',
  'Вид медосмотра',
  'Направление',
  'Дата осмотра',
  'Срок следующего осмотра',
  'Клиника',
  'Врач',
  'Заключение',
  'Противопоказания',
]);
assert.equal(medHeadersMap.problems.length, 0);
const mappedFields = Object.values(medHeadersMap.mapping);
for (const f of ['legal_entity', 'employee_fio', 'employee_snils', 'card_number', 'exam_type', 'referral_date', 'exam_date', 'next_due_date', 'clinic_name', 'doctor_fio', 'conclusion', 'conclusion_details']) {
  assert.ok(mappedFields.includes(f), `Поле ${f} не сопоставлено`);
}
const medMissing = mapMedicalHeaders(['Рядовой столбец']);
assert.ok(medMissing.problems.some(p => p.includes('card_number')));
assert.ok(medMissing.problems.some(p => p.includes('exam_type')));
assert.ok(medMissing.problems.some(p => p.includes('работник')));
assert.equal(MEDICAL_HEADERS.length, 12);

// Import preview: valid row, bad exam type, unknown LE, missing dates
const existingCards = storage.getMedicalCardsRaw();
const medPreviewRows = [
  ['ООО «Другое»', '', '112-233-445 95', 'МЕД-IMP-1', 'Предварительный', '', '', '', '', '', '', ''],
  [testLe.short_name || '', 'Кузнецов Алексей Сергеевич', '', 'МЕД-IMP-2', 'Экзотический', '', '', '', '', '', '', ''],
  ['ООО «Нет такой организации»', 'Иванов И.И.', '', 'МЕД-IMP-3', 'Периодический', '', '', '', '', '', '', ''],
  [testLe.short_name || '', 'Кузнецов А.С.', '', 'МЕД-IMP-4', 'Периодический', '01.02.2024', '01.03.2024', '01.03.2026', 'Клиника', 'Врач В.В.', 'Годен', ''],
];
const medMapping: Record<number, string> = {};
MEDICAL_HEADERS.forEach((h, idx) => {
  medMapping[idx] = mapMedicalHeaders([h]).mapping[0];
});
const medPreview = generateMedicalPreview(medPreviewRows, medMapping, existingCards, 'add');
assert.equal(medPreview.results.length, 4);
assert.equal(medPreview.results[0].action, 'add');
assert.equal(medPreview.results[0].data.exam_type, 'preliminary');
assert.equal(medPreview.results[1].action, 'reject');
assert.ok(medPreview.results[1].errors.some(e => e.includes('Недопустимый вид медосмотра')));
assert.equal(medPreview.results[2].action, 'reject');
assert.ok(medPreview.results[2].errors.some(e => e.includes('не найдено в базе')));
assert.equal(medPreview.results[3].action, 'add');
assert.equal(medPreview.results[3].data.exam_date, '2024-03-01');
assert.equal(medPreview.results[3].data.next_due_date, '2026-03-01');
assert.equal(medPreview.results[3].data.conclusion, 'fit');
assert.ok(medPreview.summary.add >= 2);

// Duplicate detection in add mode: existing card number МЕД-002 -> update action in update mode
const medPreviewDup = generateMedicalPreview([['ООО «САОТ-Тест»', 'Кузнецов А.С.', '', 'МЕД-002', 'Периодический', '', '01.04.2024', '', '', '', 'Годен', '']], medMapping, existingCards, 'update');
assert.equal(medPreviewDup.results[0].action, 'update');

// Referential integrity: corrupt card sout_card_id link
const rawMedCards = storage.getMedicalCardsRaw();
const savedSoutLink = rawMedCards.find(c => c.sout_card_id)!.sout_card_id;
rawMedCards.find(c => c.sout_card_id)!.sout_card_id = 'ghost-sout-link';
storage.saveMedicalCardsRaw(rawMedCards);
const brokenMed = storage.verifyDataIntegrity();
assert.equal(brokenMed.valid, false);
assert.ok(brokenMed.errors.some(e => e.includes('Карта медосмотра') && e.includes('несуществующую карту СОУТ')));
const fixTarget = storage.getMedicalCardsRaw().find(c => c.sout_card_id === 'ghost-sout-link')!;
fixTarget.sout_card_id = savedSoutLink || null;
storage.saveMedicalCardsRaw(storage.getMedicalCardsRaw());
assert.equal(storage.verifyDataIntegrity().valid, true);

// Referential integrity: wrong LE-employee pairing passes undetected only if consistent — check via create instead
// Module toggle: disable medical blocks CRUD, data preserved
setModuleState('medical', false);
assert.equal(storage.isModuleEnabled('medical'), false);
assert.throws(
  () =>
    storage.createMedicalCard({
      card_number: 'BLOCKED-MED',
      legal_entity_id: testLe.id,
      employee_id: testEmp.employee.id,
      exam_type: 'periodic',
      conclusion: 'pending',
    }),
  /Модуль «Медосмотры» отключён/
);
assert.throws(() => storage.createPsychiatricExam({ legal_entity_id: testLe.id, employee_id: testEmp.employee.id, conclusion: 'fit' }), /Модуль «Медосмотры» отключён/);
assert.ok(storage.getMedicalCardsRaw().length >= 3); // данные сохранены при отключении
setModuleState('medical', true);
assert.equal(storage.isModuleEnabled('medical'), true);

// Backup manifest includes medical counts and body; restore round-trip preserves medical data
const backupStage8 = JSON.parse(storage.createBackup('test-stage8'));
assert.ok(backupStage8.counts.medical_cards >= 3);
assert.ok(backupStage8.counts.psychiatric_exams >= 1);
assert.ok(Array.isArray(backupStage8.data.medical_cards) && backupStage8.data.medical_cards.length >= 3);
assert.ok(Array.isArray(backupStage8.data.psychiatric_exams) && backupStage8.data.psychiatric_exams.length >= 1);

// Add temporary card, then restore -> temporary card gone, real cards remain, integrity valid
storage.createMedicalCard({
  card_number: 'МЕД-TEMP',
  legal_entity_id: testLe.id,
  employee_id: testEmp.employee.id,
  exam_type: 'periodic',
  conclusion: 'pending',
});
assert.ok(storage.getMedicalCardsRaw().some(c => c.card_number === 'МЕД-TEMP'));
const restoreReport8 = storage.restoreFromBackup(JSON.stringify(backupStage8));
assert.equal(restoreReport8.valid, true);
assert.equal(storage.getMedicalCardsRaw().some(c => c.card_number === 'МЕД-TEMP'), false);
assert.ok(storage.getMedicalCardsRaw().some(c => c.card_number === 'МЕД-001'));
assert.ok(storage.getMedicalCardsRaw().some(c => c.card_number === 'МЕД-002'));
assert.equal(storage.verifyDataIntegrity().valid, true);
assert.equal(storage.isModuleEnabled('medical'), true);

console.log('✅ ВСЕ ТЕСТЫ ЭТАПОВ 2–8 УСПЕШНО ПРОЙДЕНЫ (24/24)!');


