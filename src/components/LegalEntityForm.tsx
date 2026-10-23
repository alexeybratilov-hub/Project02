import React, { useState, useEffect } from 'react';
import { storage } from '../services/storage';
import { checksumWarning, findDuplicates } from '../services/validation';

interface LegalEntityFormProps {
  id?: string;
  onNavigate: (view: string, id?: string) => void;
  onRefreshCurrentLe: () => void;
}

export const LegalEntityForm: React.FC<LegalEntityFormProps> = ({
  id,
  onNavigate,
  onRefreshCurrentLe,
}) => {
  const isEdit = Boolean(id);

  const [formData, setFormData] = useState({
    full_name: '',
    short_name: '',
    inn: '',
    kpp: '',
    ogrn: '',
    legal_address: '',
    actual_address: '',
    extra_info: '',
  });

  const [errors, setErrors] = useState<string[]>([]);
  const [warnings, setWarnings] = useState<string[]>([]);

  useEffect(() => {
    if (id) {
      const existing = storage.getLegalEntityById(id);
      if (existing) {
        setFormData({
          full_name: existing.full_name || '',
          short_name: existing.short_name || '',
          inn: existing.inn || '',
          kpp: existing.kpp || '',
          ogrn: existing.ogrn || '',
          legal_address: existing.legal_address || '',
          actual_address: existing.actual_address || '',
          extra_info: existing.extra_info || '',
        });
      }
    }
  }, [id]);

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>
  ) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrors([]);
    setWarnings([]);

    try {
      if (isEdit && id) {
        const updated = storage.updateLegalEntity(id, formData);
        onRefreshCurrentLe();
        onNavigate('legal-entities-view', updated.id);
      } else {
        const created = storage.createLegalEntity(formData);
        onRefreshCurrentLe();
        onNavigate('legal-entities-view', created.id);
      }
    } catch (err: any) {
      setErrors([err.message || 'Ошибка сохранения']);
    }
  };

  // Realtime duplicate & checksum warning
  useEffect(() => {
    if (!formData.full_name.trim()) {
      setWarnings([]);
      return;
    }
    const all = storage.listLegalEntities({ pageSize: 10000 }).items;
    const { warnings: dups } = findDuplicates(all, {
      inn: formData.inn,
      kpp: formData.kpp,
      ogrn: formData.ogrn,
      full_name: formData.full_name,
      exclude_id: id || null,
    });
    const innChk = checksumWarning(formData.inn);
    const combined = [...dups];
    if (innChk) combined.push(innChk);
    setWarnings(combined);
  }, [formData.inn, formData.kpp, formData.ogrn, formData.full_name, id]);

  return (
    <div>
      <h1>
        {isEdit ? 'Изменение юридического лица' : 'Новое юридическое лицо'}
      </h1>

      {errors.length > 0 && (
        <div className="alert">
          {errors.map((err, i) => (
            <p key={i}>{err}</p>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="alert" style={{ background: '#fffbeb', borderColor: '#fef3c7' }}>
          {warnings.map((warn, i) => (
            <p key={i} className="warn" style={{ color: '#92400e' }}>
              ⚠️ {warn}
            </p>
          ))}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-row">
          <label htmlFor="full_name">Полное наименование *</label>
          <input
            id="full_name"
            name="full_name"
            type="text"
            required
            value={formData.full_name}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label htmlFor="short_name">Сокращённое наименование</label>
          <input
            id="short_name"
            name="short_name"
            type="text"
            value={formData.short_name}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label htmlFor="inn">ИНН</label>
          <input
            id="inn"
            name="inn"
            type="text"
            maxLength={12}
            value={formData.inn}
            onChange={handleChange}
            placeholder="10 или 12 цифр"
          />
        </div>

        <div className="form-row">
          <label htmlFor="kpp">КПП</label>
          <input
            id="kpp"
            name="kpp"
            type="text"
            maxLength={9}
            value={formData.kpp}
            onChange={handleChange}
            placeholder="9 цифр"
          />
        </div>

        <div className="form-row">
          <label htmlFor="ogrn">ОГРН</label>
          <input
            id="ogrn"
            name="ogrn"
            type="text"
            maxLength={15}
            value={formData.ogrn}
            onChange={handleChange}
            placeholder="13 или 15 цифр"
          />
        </div>

        <div className="form-row">
          <label htmlFor="legal_address">Юридический адрес</label>
          <textarea
            id="legal_address"
            name="legal_address"
            rows={2}
            value={formData.legal_address}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label htmlFor="actual_address">Фактический адрес</label>
          <textarea
            id="actual_address"
            name="actual_address"
            rows={2}
            value={formData.actual_address}
            onChange={handleChange}
          />
        </div>

        <div className="form-row">
          <label htmlFor="extra_info">Дополнительные сведения</label>
          <textarea
            id="extra_info"
            name="extra_info"
            rows={2}
            value={formData.extra_info}
            onChange={handleChange}
          />
        </div>

        <p className="muted">
          * — обязательное поле. ИНН: 10 или 12 цифр; КПП: 9 цифр; ОГРН: 13 или 15 цифр.
        </p>

        <div className="toolbar" style={{ marginTop: '1.25rem' }}>
          <button className="btn" type="submit">
            Сохранить
          </button>
          <button
            type="button"
            className="secondary"
            onClick={() => {
              if (isEdit && id) {
                onNavigate('legal-entities-view', id);
              } else {
                onNavigate('legal-entities');
              }
            }}
          >
            Отмена
          </button>
        </div>
      </form>
    </div>
  );
};
