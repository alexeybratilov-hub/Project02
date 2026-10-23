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
