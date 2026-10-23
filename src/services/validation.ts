import { LegalEntity } from '../types';

export function normalizeText(value: any): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  return s || null;
}

export function ciCompare(value: string | null | undefined): string {
  return (value || '').toLowerCase().replace(/ё/g, 'е').trim();
}

export function validateInn(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!/^\d{10}$|^\d{12}$/.test(s)) {
    throw new Error('ИНН должен содержать 10 или 12 цифр.');
  }
  return s;
}

export function validateKpp(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!/^\d{9}$/.test(s)) {
    throw new Error('КПП должен содержать 9 цифр.');
  }
  return s;
}

export function validateOgrn(value: string | null | undefined): string | null {
  if (!value) return null;
  const s = value.trim();
  if (!/^\d{13}$|^\d{15}$/.test(s)) {
    throw new Error('ОГРН должен содержать 13 или 15 цифр.');
  }
  return s;
}

export function checksumWarning(inn: string | null | undefined): string | null {
  if (!inn) return null;
  const s = inn.trim();
  if (s.length !== 10 && s.length !== 12) return null;
  const digits = s.split('').map(d => parseInt(d, 10));

  if (digits.length === 12) {
    const w11 = [7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const w12 = [3, 7, 2, 4, 10, 3, 5, 9, 4, 6, 8];
    const n11 = digits.slice(0, 11).reduce((acc, d, i) => acc + d * w11[i], 0) % 11 % 10;
    const n12 = digits.slice(0, 12).reduce((acc, d, i) => acc + d * w12[i], 0) % 11 % 10;
    if (digits[10] !== n11 || digits[11] !== n12) {
      return 'Контрольная сумма ИНН не сходится — проверьте значение.';
    }
    return null;
  }

  const w10 = [2, 4, 10, 3, 5, 9, 4, 6, 8];
  const control = digits.slice(0, 9).reduce((acc, d, i) => acc + d * w10[i], 0) % 11 % 10;
  if (digits[9] !== control) {
    return 'Контрольная сумма ИНН не сходится — проверьте значение.';
  }
  return null;
}

export function findDuplicates(
  allEntities: LegalEntity[],
  data: {
    inn?: string | null;
    kpp?: string | null;
    ogrn?: string | null;
    full_name: string;
    exclude_id?: string | null;
  }
): { conflict: string | null; warnings: string[] } {
  let conflict: string | null = null;
  const warnings: string[] = [];

  const active = allEntities.filter(
    le => le.status === 'active' && (!data.exclude_id || le.id !== data.exclude_id)
  );

  const inn = normalizeText(data.inn);
  const kpp = normalizeText(data.kpp);
  const ogrn = normalizeText(data.ogrn);
  const fullNameNorm = ciCompare(data.full_name);

  // INN + KPP conflict
  if (inn && kpp) {
    const dup = active.find(le => le.inn === inn && le.kpp === kpp);
    if (dup) {
      conflict = `Юридическое лицо с такими ИНН и КПП уже зарегистрировано: «${dup.full_name}».`;
    }
  }

  // OGRN conflict
  if (!conflict && ogrn) {
    const dup = active.find(le => le.ogrn === ogrn);
    if (dup) {
      conflict = `Юридическое лицо с таким ОГРН уже зарегистрировано: «${dup.full_name}».`;
    }
  }

  // INN warning
  if (!conflict && inn) {
    const dup = active.find(le => le.inn === inn);
    if (dup) {
      warnings.push(`В базе уже есть юридическое лицо с таким ИНН: «${dup.full_name}».`);
    }
  }

  // Full name similarity warning
  const nameDup = active.find(le => ciCompare(le.full_name) === fullNameNorm);
  if (nameDup) {
    warnings.push('Похожее полное наименование уже существует — возможен дубликат.');
  }

  return { conflict, warnings };
}

// --- Employees (Этап 4, FR-07…FR-09, DATA_MODEL §1.7) ---

export function normalizeSnils(value: string | null | undefined): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  // Хранение строкой по D-007: допускаются цифры с разделителями XXX-XXX-XXX YY
  const digits = s.replace(/\D/g, '');
  if (digits.length !== 11) {
    throw new Error('СНИЛС должен содержать 11 цифр (формат XXX-XXX-XXX YY).');
  }

  const numberPart = parseInt(digits.slice(0, 9), 10);
  // Проверка контрольной суммы проводится для номеров больше 001-001-998
  if (numberPart > 1001998) {
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      sum += parseInt(digits[i], 10) * (9 - i);
    }
    let control = 0;
    if (sum < 100) {
      control = sum;
    } else if (sum === 100 || sum === 101) {
      control = 0;
    } else {
      const rem = sum % 101;
      control = (rem === 100 || rem === 101) ? 0 : rem;
    }

    const checkDigits = parseInt(digits.slice(9, 11), 10);
    if (control !== checkDigits) {
      throw new Error('Контрольная сумма СНИЛС не сходится — проверьте значение.');
    }
  }

  // Канонический вид XXX-XXX-XXX YY
  return `${digits.slice(0, 3)}-${digits.slice(3, 6)}-${digits.slice(6, 9)} ${digits[9]}${digits[10]}`;
}

export function validateDateNotFuture(value: string | null | undefined, fieldName: string): string | null {
  if (value === null || value === undefined) return null;
  const s = String(value).trim();
  if (!s) return null;
  const d = new Date(s);
  if (isNaN(d.getTime())) {
    throw new Error(`Некорректная дата в поле «${fieldName}».`);
  }
  const now = new Date();
  if (d.getTime() > now.getTime()) {
    throw new Error(`Дата в поле «${fieldName}» не может быть в будущем.`);
  }
  return s;
}

export function findEmployeeDuplicates(
  allEmployees: Array<{
    id: string;
    legal_entity_id: string;
    last_name: string;
    first_name: string;
    middle_name?: string | null;
    birth_date?: string | null;
    snils?: string | null;
    status: string;
  }>,
  data: {
    legal_entity_id: string;
    last_name: string;
    first_name: string;
    middle_name?: string | null;
    birth_date?: string | null;
    snils?: string | null;
    exclude_id?: string | null;
  }
): { conflict: string | null; warnings: string[] } {
  // Дубликаты НЕ объединяются автоматически (STAGE_4, IMPORT_EXPORT §5).
  // Жёсткого конфликта нет: возможны внешние совместители и совпадения СНИЛС.
  const warnings: string[] = [];
  const active = allEmployees.filter(
    e => e.status === 'active' && (!data.exclude_id || e.id !== data.exclude_id)
  );

  const snilsNorm = ciCompare(data.snils || '');
  if (snilsNorm) {
    const snilsDup = active.find(
      e => e.legal_entity_id === data.legal_entity_id && ciCompare(e.snils || '') === snilsNorm
    );
    if (snilsDup) {
      warnings.push(
        `В этом юридическом лице уже есть работник с таким СНИЛС: ${snilsDup.last_name} ${snilsDup.first_name} (${formatFioShort(snilsDup)}). Возможен совместитель или дубликат.`
      );
    }
  }

  const fullNameKey = `${ciCompare(data.last_name)}|${ciCompare(data.first_name)}|${ciCompare(data.middle_name || '')}`;
  const fioDup = active.find(
    e =>
      e.legal_entity_id === data.legal_entity_id &&
      `${ciCompare(e.last_name)}|${ciCompare(e.first_name)}|${ciCompare(e.middle_name || '')}` === fullNameKey
  );
  if (fioDup) {
    if (data.birth_date && fioDup.birth_date === data.birth_date) {
      warnings.push(
        `Полное совпадение ФИО и даты рождения внутри одного юридического лица: ${fioDup.last_name} ${fioDup.first_name}. Проверьте, не является ли запись дубликатом (объединение по ФИО запрещено).`
      );
    } else {
      warnings.push(
        `Уже есть работник с похожим ФИО в этом юридическом лице: ${fioDup.last_name} ${fioDup.first_name}. Если это совместитель — оставьте обе записи.`
      );
    }
  }

  return { conflict: null, warnings };
}

function snilsDupValue(v: string): string {
  return v;
}

function formatFioShort(e: { last_name: string; first_name: string; middle_name?: string | null }): string {
  const mi = e.middle_name ? ` ${e.middle_name.charAt(0)}.` : '';
  return `${e.last_name} ${e.first_name}${mi}`;
}
