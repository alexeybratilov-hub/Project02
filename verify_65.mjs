// Временный скрипт ручной верификации сценариев подэтапа 6.5 (Обучение, Постановление 2464)
// Использует тот же localStorage-шим, что и src/test/run_tests.ts
import { execSync } from 'node:child_process';

// shim localStorage before importing storage (same pattern as src/test/run_tests.ts)
if (!globalThis.localStorage || typeof globalThis.localStorage.getItem !== 'function') {
  const store = new Map();
  globalThis.localStorage = {
    getItem: (k) => store.get(k) ?? null,
    setItem: (k, v) => { store.set(k, String(v)); },
    removeItem: (k) => { store.delete(k); },
    clear: () => store.clear(),
    key: (i) => Array.from(store.keys())[i] ?? null,
    get length() { return store.size; },
  };
}

const { storage } = await import('./src/services/storage.ts');
const excel = await import('./src/services/excel.ts');

// Module toggle ON
storage.toggleModule('training', true);
console.log('1) Модуль training включён:', storage.isModuleEnabled('training'));

// Legal entity + employee
const le = storage.createLegalEntity({ full_name: 'ООО «Тест Обучение»', short_name: 'ООО Тест Обучение', inn: '7701234567' });
const dept = storage.createDepartment({ legal_entity_id: le.id, name: 'Энергетический участок' });
const pos = storage.createPosition('Электрик');
const { employee: emp } = storage.createEmployee({ legal_entity_id: le.id, department_id: dept.id, position_id: pos.id, last_name: 'Иванов', first_name: 'Иван', snils: '112-233-445 95' });
console.log('2) Работник создан:', emp.last_name, emp.snils);

// Program A with insufficient hours -> must throw
let threw = false;
try { storage.createTrainingProgram({ legal_entity_id: le.id, name: 'Программа А', category: 'program_a', hours: 8 }); }
catch (e) { threw = /не менее 16/.test(e.message); console.log('3) Валидация мин. 16 ч для А:', threw ? 'OK' : 'FAIL: ' + e.message); }
if (!threw) console.log('3) Валидация мин. 16 ч для А: FAIL (не выбросил)');

// Valid program A
const progA = storage.createTrainingProgram({ legal_entity_id: le.id, name: 'Программа А — общие вопросы ОТ', category: 'program_a', hours: 16 });
console.log('4) Программа А создана, периодичность авто:', progA.recurring_months, '(ожидалось 36)');

// Program C periodичность 12
const progC = storage.createTrainingProgram({ legal_entity_id: le.id, name: 'Работы повышенной опасности', category: 'program_c', hours: 24 });
console.log('5) Программа В периодичность:', progC.recurring_months, '(ожидалось 12)');

// Assignment
const assign = storage.createTrainingAssignment({ legal_entity_id: le.id, employee_id: emp.id, training_program_id: progA.id, assignment_date: '2026-10-01' });
console.log('6) Назначение создано:', assign.status);

// Protocol with too few commission members -> throw
try {
  storage.createTrainingProtocol({
    legal_entity_id: le.id, protocol_number: '1', training_program_id: progA.id, session_date: '2026-10-10',
    chairperson: { position: 'Председатель', last_name: 'Петров' }, members: [], employee_id: emp.id, result: 'passed',
  });
  console.log('7) Мин. состав комиссии: FAIL (не выбросил)');
} catch (e) { console.log('7) Мин. состав комиссии (не менее 3 человек):', /не менее чем из 3/.test(e.message) ? 'OK' : 'FAIL: ' + e.message); }

// Passed protocol, auto next_check_date
const proto = storage.createTrainingProtocol({
  legal_entity_id: le.id, protocol_number: '12-А', training_program_id: progA.id, session_date: '2026-10-10',
  chairperson: { position: 'Гл. специалист ОТ', last_name: 'Петров', trained_in_commission_program: true },
  members: [
    { position: 'Инженер', last_name: 'Сидоров', trained_in_commission_program: true },
    { position: 'Начальник участка', last_name: 'Кузнецов', trained_in_commission_program: true },
  ],
  employee_id: emp.id, result: 'passed', issues_certificate: true, certificate_number: 'УД-001', registry_entry_number: 'ЕИСОТ-123',
});
console.log('8) Протокол создан, next_check_date авто:', proto.next_check_date, '(ожидалось 2029-10-10)');
console.log('9) Назначение закрыто протоколом:', storage.getTrainingAssignmentById(assign.id).completed_protocol_id === proto.id);

// Failed protocol cannot issue certificate
try {
  storage.createTrainingProtocol({
    legal_entity_id: le.id, protocol_number: '13-А', training_program_id: progA.id, session_date: '2026-10-11',
    chairperson: { position: 'Гл. специалист ОТ', last_name: 'Петров' },
    members: [{ position: 'Инженер', last_name: 'Сидоров' }, { position: 'Мастер', last_name: 'Рыбов' }],
    employee_id: emp.id, result: 'failed', issues_certificate: true,
  });
  console.log('10) Запрет удостоверения при несдаче: FAIL');
} catch (e) { console.log('10) Удостоверение не выдаётся при неудовлетворительном результате (п. 33):', /п. 33/.test(e.message) ? 'OK' : 'FAIL: ' + e.message); }

// Invalidation (п. 35)
const inv = storage.invalidateTrainingProtocol(proto.id, 'ошибка в составе комиссии');
console.log('11) Аннулирование протокола (п. 35):', inv.status === 'archived' || inv.invalidated || inv.invalidation_reason ? 'OK' : JSON.stringify({st: inv.status, r: inv.invalidation_reason}));

// Integrity steps 16-18 present
const integ = storage.verifyDataIntegrity();
console.log('12) verifyDataIntegrity ошибок нет:', integ.errors.length === 0, '| всего проверок связей:', Array.isArray(integ.checks) ? integ.checks.length : 'n/a');

// Backup manifest counts
const backup = JSON.parse(storage.createBackup('manual'));
console.log('13) Манифест бэкапа: programs=%s assignments=%s protocols=%s', backup.counts.training_programs, backup.counts.training_assignments, backup.counts.training_protocols);

// Excel mapping + preview
const mapped = excel.mapTrainingProtocolsHeaders(['Номер протокола', 'Дата заседания комиссии', 'Программа (наименование или категория)', 'ФИО работника', 'СНИЛС', 'Результат (удовлетворительно/неудовлетворительно)', 'Председатель ФИО', 'Председатель должность', 'Член комиссии 1', 'Член комиссии 1 должность']);
console.log('14) Маппинг протоколов: protocol_number=%s, snils=%s, member1=%s', Object.values(mapped).includes('protocol_number'), Object.values(mapped).includes('snils'), Object.values(mapped).includes('member1_fio'));
const cat = excel.resolveTrainingCategory('Программа В — безопасные методы работ повышенной опасности');
console.log('15) resolveTrainingCategory(«Программа В…»):', cat, '(ожидалось program_c)');

// Module toggle OFF blocks operations, data preserved
storage.toggleModule('training', false);
let blocked = false;
try { storage.createTrainingProgram({ legal_entity_id: le.id, name: 'X', category: 'program_b', hours: 16 }); }
catch (e) { blocked = /отключён/.test(e.message); }
console.log('16) Блокировка при отключении модуля:', blocked ? 'OK' : 'FAIL', '| данные сохранены:', storage.getTrainingProgramsRaw().length >= 2);
storage.toggleModule('training', true);

console.log('\nРУЧНАЯ ВЕРИФИКАЦИЯ 6.5 ЗАВЕРШЕНА');
