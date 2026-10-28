import React, { useState } from 'react';
import { storage } from '../services/storage';

interface PpeCardFormProps {
  id?: string; // If provided, edit mode
  onNavigate: (view: string, id?: string) => void;
}

export const PpeCardForm: React.FC<PpeCardFormProps> = ({ id, onNavigate }) => {
  const isEdit = !!id;
  const existingCard = id ? storage.getPpeCardById(id) : null;
  const currentLe = storage.getCurrentLegalEntity();

  const [legalEntityId, setLegalEntityId] = useState<string>(
    existingCard ? existingCard.legal_entity_id : currentLe ? currentLe.id : ''
  );
  const [employeeId, setEmployeeId] = useState<string>(
    existingCard ? existingCard.employee_id : ''
  );
  const [cardNumber, setCardNumber] = useState<string>(
    existingCard ? existingCard.card_number : ''
  );
  const [height, setHeight] = useState<string>(
    existingCard?.height ? String(existingCard.height) : ''
  );
  const [clothingSize, setClothingSize] = useState<string>(
    existingCard?.clothing_size || ''
  );
  const [shoeSize, setShoeSize] = useState<string>(
    existingCard?.shoe_size || ''
  );
  const [headwearSize, setHeadwearSize] = useState<string>(
    existingCard?.headwear_size || ''
  );
  const [gasmaskSize, setGasmaskSize] = useState<string>(
    existingCard?.gasmask_size || ''
  );
  const [glovesSize, setGlovesSize] = useState<string>(
    existingCard?.gloves_size || ''
  );
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const legalEntities = storage.listLegalEntities({ pageSize: 1000 }).items;
  const allEmployees = storage.getEmployeesRaw();
  const allExistingCards = storage.getPpeCardsRaw().filter(c => c.status === 'active');

  // Filter employees for selected organization
  // Exclude employees who already have an active card (except current employee in edit mode)
  const availableEmployees = allEmployees.filter(e => {
    if (e.status !== 'active') return false;
    if (legalEntityId && e.legal_entity_id !== legalEntityId) return false;
    const hasCard = allExistingCards.some(
      c => c.employee_id === e.id && (!isEdit || c.id !== existingCard?.id)
    );
    return !hasCard;
  });

  const handleSuggestCardNumber = () => {
    if (!legalEntityId) return;
    const leCards = allExistingCards.filter(c => c.legal_entity_id === legalEntityId);
    const nextNum = leCards.length + 1;
    setCardNumber(`СИЗ-${String(nextNum).padStart(3, '0')}`);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);

    try {
      if (isEdit && existingCard) {
        storage.updatePpeCard(existingCard.id, {
          card_number: cardNumber,
          height: height ? Number(height) : null,
          clothing_size: clothingSize,
          shoe_size: shoeSize,
          headwear_size: headwearSize,
          gasmask_size: gasmaskSize,
          gloves_size: glovesSize,
        });
        onNavigate('ppe-view', existingCard.id);
      } else {
        const created = storage.createPpeCard({
          card_number: cardNumber,
          legal_entity_id: legalEntityId,
          employee_id: employeeId,
          height: height ? Number(height) : null,
          clothing_size: clothingSize,
          shoe_size: shoeSize,
          headwear_size: headwearSize,
          gasmask_size: gasmaskSize,
          gloves_size: glovesSize,
        });
        onNavigate('ppe-view', created.id);
      }
    } catch (err: any) {
      setErrorMsg(err.message || 'Ошибка сохранения личной карточки СИЗ');
    }
  };

  return (
    <div className="p-6 max-w-3xl mx-auto space-y-6">
      <button
        onClick={() => (isEdit ? onNavigate('ppe-view', id) : onNavigate('ppe'))}
        className="text-sm text-blue-600 hover:underline mb-1 inline-block"
      >
        ← {isEdit ? 'Назад к карточке СИЗ' : 'К реестру СИЗ'}
      </button>

      <div>
        <h1 className="text-2xl font-bold text-slate-800">
          {isEdit ? `Редактирование карточки СИЗ № ${existingCard?.card_number}` : 'Новая личная карточка учёта выдачи СИЗ'}
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Типовая форма согласно Приложению № 2 к Правилам (Приказ Минтруда России № 766н)
        </p>
      </div>

      {errorMsg && (
        <div className="p-4 bg-rose-50 border border-rose-200 text-rose-700 rounded-lg text-sm">
          {errorMsg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="p-6 bg-white rounded-lg border border-slate-200 shadow-sm space-y-6">
        {/* Организация и работник */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            1. Идентификация и привязка к работнику
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Юридическое лицо *
              </label>
              <select
                disabled={isEdit}
                required
                value={legalEntityId}
                onChange={e => {
                  setLegalEntityId(e.target.value);
                  setEmployeeId('');
                }}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
              >
                <option value="">-- Выберите организацию --</option>
                {legalEntities.map(l => (
                  <option key={l.id} value={l.id}>
                    {l.short_name || l.full_name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Номер карточки СИЗ *
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  required
                  value={cardNumber}
                  onChange={e => setCardNumber(e.target.value)}
                  placeholder="Например: СИЗ-001"
                  className="flex-1 px-3 py-2 border border-slate-300 rounded text-sm font-semibold"
                />
                {!isEdit && (
                  <button
                    type="button"
                    onClick={handleSuggestCardNumber}
                    className="px-2.5 py-2 bg-slate-100 text-slate-600 rounded text-xs hover:bg-slate-200"
                    title="Сгенерировать следующий свободный номер"
                  >
                    Авто
                  </button>
                )}
              </div>
            </div>

            <div className="sm:col-span-2">
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Работник *
              </label>
              <select
                disabled={isEdit}
                required
                value={employeeId}
                onChange={e => setEmployeeId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm bg-white disabled:bg-slate-100"
              >
                <option value="">
                  {legalEntityId
                    ? '-- Выберите работника из списка --'
                    : '-- Сначала выберите юридическое лицо --'}
                </option>
                {availableEmployees.map(e => (
                  <option key={e.id} value={e.id}>
                    {e.last_name} {e.first_name} {e.middle_name || ''} {e.snils ? `(СНИЛС: ${e.snils})` : ''}
                  </option>
                ))}
              </select>
              {!isEdit && availableEmployees.length === 0 && legalEntityId && (
                <p className="text-xs text-amber-600 mt-1">
                  У всех работников данной организации уже заведены личные карточки СИЗ, либо работники ещё не добавлены.
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Антропометрические размеры */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-slate-500 border-b border-slate-100 pb-2">
            2. Антропометрические характеристики (Размеры работника)
          </h2>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Рост (см)
              </label>
              <input
                type="number"
                min="100"
                max="250"
                value={height}
                onChange={e => setHeight(e.target.value)}
                placeholder="Например: 176"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Размер одежды
              </label>
              <input
                type="text"
                value={clothingSize}
                onChange={e => setClothingSize(e.target.value)}
                placeholder="48-50 / 170-176"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Размер обуви
              </label>
              <input
                type="text"
                value={shoeSize}
                onChange={e => setShoeSize(e.target.value)}
                placeholder="42, 43"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Головной убор
              </label>
              <input
                type="text"
                value={headwearSize}
                onChange={e => setHeadwearSize(e.target.value)}
                placeholder="58"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Противогаз / Респиратор
              </label>
              <input
                type="text"
                value={gasmaskSize}
                onChange={e => setGasmaskSize(e.target.value)}
                placeholder="2 (М), 3 (L)"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Размер перчаток
              </label>
              <input
                type="text"
                value={glovesSize}
                onChange={e => setGlovesSize(e.target.value)}
                placeholder="8, 9 (L)"
                className="w-full px-3 py-2 border border-slate-300 rounded text-sm"
              />
            </div>
          </div>
        </div>

        {/* Кнопки сохранения */}
        <div className="flex justify-end gap-3 pt-4 border-t border-slate-100">
          <button
            type="button"
            onClick={() => (isEdit ? onNavigate('ppe-view', id) : onNavigate('ppe'))}
            className="px-4 py-2 border border-slate-300 text-slate-700 rounded text-sm hover:bg-slate-50"
          >
            Отмена
          </button>
          <button
            type="submit"
            className="px-6 py-2 bg-blue-600 text-white rounded text-sm font-semibold hover:bg-blue-700 shadow-sm"
          >
            {isEdit ? 'Сохранить изменения' : 'Создать личную карточку'}
          </button>
        </div>
      </form>
    </div>
  );
};
